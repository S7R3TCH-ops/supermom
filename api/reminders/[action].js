// Shared reminders sweep — currently PUSH ONLY (leave-time + wrap-up lockscreen
// alerts). Named api/reminders/[action].js rather than api/push/[action].js
// because the separately-approved SMS-reminders design (2026-09-17,
// second-brain/99-archive/2026-09-17-supermom-sms-reminders-design.md) is
// designed to ride this exact same pg_cron-triggered sweep, bearer-secret
// guard, and action-router shape — its own Twilio Phase-0 (a phone number +
// env vars) just wasn't done yet, so push built the shared function first per
// that design's own §2.4 fallback. When SMS is built, it adds 'send' /
// 'status' / 'inbound' actions below (see the marked hook points) and its own
// steps inside handleSweep — no restructuring needed.
//
// Vercel serverless function #11 of 12 (see CLAUDE.md's constraint line).
//
// Design: second-brain/00-inbox/2026-09-18-supermom-lockscreen-notifications-design.md §2.

import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { requireUser } from '../_lib/authGuard.js';
import { logServerError } from '../_lib/errorLog.js';
import { torontoDateStr, torontoToUtc } from '../_lib/torontoTime.js';
import {
  TTL_SEC,
  computeLeaveAt, computeEndAt, isLeaveDue, isWrapupDue,
  buildLeaveBody, buildWrapupBody, computeUnpaidBalance,
} from '../_lib/pushAlerts.js';

export const config = { maxDuration: 30 };

function initSupabase() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error('DB config missing (VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
}

/** Returns true if VAPID env vars are present and web-push is configured. Fails closed. */
function configureWebPush() {
  const publicKey = process.env.VITE_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

function clientDisplayName(client) {
  return `${client?.first_name ?? ''} ${client?.last_name ?? ''}`.trim() || null;
}

function clientAddress(client) {
  return [client?.street, client?.city, client?.province, client?.postal_code].filter(Boolean).join(', ') || null;
}

// ── push dispatch (shared by leave + wrapup) ────────────────────────────────

/**
 * Claims the dedupe row first (INSERT ... the UNIQUE (job_id, kind, job_start_at)
 * constraint does the ON CONFLICT DO NOTHING work — a duplicate insert throws
 * postgres code 23505, which we treat as "another tick already claimed it").
 * Returns the claimed row's id, or null if already claimed.
 */
async function claimPushLog(sb, { businessId, jobId, kind, jobStartAt, title, body }) {
  const { data, error } = await sb
    .from('push_log')
    .insert({ business_id: businessId, job_id: jobId, kind, job_start_at: jobStartAt, title, body })
    .select('id')
    .single();
  if (error) {
    if (error.code === '23505') return null; // unique violation — already claimed
    throw new Error(`push_log insert failed (job ${jobId}, ${kind}): ${error.message}`);
  }
  return data.id;
}

/** Sends to every subscription owned by this business's 'owner' user(s). Updates push_log counts. */
async function dispatchPush(sb, { businessId, jobId, kind, title, body, url, pushLogId, vapidReady }) {
  if (!vapidReady) {
    await logServerError({
      severity: 'critical',
      message: 'Push dispatch skipped — VAPID env vars not configured',
      context: { businessId, jobId, kind },
      businessId,
      alert: true,
    });
    return { sent: 0, failed: 0 };
  }

  const { data: owners, error: ownersErr } = await sb
    .from('users')
    .select('id')
    .eq('business_id', businessId)
    .eq('role', 'owner');
  if (ownersErr) throw new Error(`owners query failed for business ${businessId}: ${ownersErr.message}`);
  const ownerIds = (owners ?? []).map(u => u.id);
  if (ownerIds.length === 0) return { sent: 0, failed: 0 };

  const { data: subs, error: subsErr } = await sb
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, fail_count')
    .eq('business_id', businessId)
    .in('user_id', ownerIds);
  if (subsErr) throw new Error(`push_subscriptions query failed for business ${businessId}: ${subsErr.message}`);

  let sent = 0;
  let failed = 0;
  const payload = JSON.stringify({ kind, jobId, tag: `${kind}-${jobId}`, title, body, url });

  for (const sub of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: TTL_SEC, urgency: 'high' }
      );
      sent += 1;
      const { error } = await sb.from('push_subscriptions')
        .update({ last_success_at: new Date().toISOString(), fail_count: 0 })
        .eq('id', sub.id);
      if (error) throw new Error(`push_subscriptions success-update failed: ${error.message}`);
    } catch (err) {
      failed += 1;
      const statusCode = err?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        // Subscription revoked — PWA removed, or iOS/Chrome dropped it.
        await sb.from('push_subscriptions').delete().eq('id', sub.id);
      } else {
        const nextFailCount = (sub.fail_count ?? 0) + 1;
        if (nextFailCount >= 5) {
          await sb.from('push_subscriptions').delete().eq('id', sub.id);
          await logServerError({
            severity: 'warning',
            message: 'Push subscription removed after 5 consecutive failures',
            context: { subscriptionId: sub.id, businessId, lastError: String(err?.message ?? err) },
            businessId,
          });
        } else {
          await sb.from('push_subscriptions').update({ fail_count: nextFailCount }).eq('id', sub.id);
        }
      }
    }
  }

  const { error: logErr } = await sb.from('push_log').update({ sent_count: sent, failed_count: failed }).eq('id', pushLogId);
  if (logErr) throw new Error(`push_log count-update failed: ${logErr.message}`);

  return { sent, failed };
}

// ── sweep ────────────────────────────────────────────────────────────────

async function runPushSweep(sb) {
  const vapidReady = configureWebPush();
  const today = torontoDateStr(0);
  const now = new Date();

  // Runs for every business, INCLUDING is_test=true — deliberate divergence
  // from the (separate, not-yet-built) SMS sweep, which skips test businesses
  // because it texts third parties. Push only reaches the business owner's
  // own subscribed devices, so skipping test businesses would make this
  // feature impossible to QA via the Bright Path account (design doc §2.6).
  const { data: businesses, error: bizErr } = await sb
    .from('businesses')
    .select('id, push_alerts_enabled')
    .is('deleted_at', null);
  if (bizErr) throw new Error(`businesses query failed: ${bizErr.message}`);

  let candidateCount = 0;
  let sentTotal = 0;
  let failedTotal = 0;

  for (const biz of businesses ?? []) {
    if (biz.push_alerts_enabled === false) continue;

    // FK hint is mandatory (v0.13.63/64 lesson) — pending_note_source_job_id
    // creates a second FK path between clients and jobs.
    const { data: jobs, error: jobsErr } = await sb
      .from('jobs')
      .select(`
        id, client_id, scheduled_date, scheduled_time, estimated_hours, job_notes, ai_context,
        clients!jobs_client_id_fkey(first_name, last_name, street, city, province, postal_code, pending_note, pending_note_source_job_id)
      `)
      .eq('business_id', biz.id)
      .eq('job_status', 'Scheduled')
      .is('deleted_at', null)
      .eq('scheduled_date', today)
      .not('scheduled_time', 'is', null);
    if (jobsErr) throw new Error(`jobs query failed for business ${biz.id}: ${jobsErr.message}`);
    if (!jobs || jobs.length === 0) continue;

    // Batched unpaid-balance lookup: all unpaid completed jobs for today's
    // clients, one query per business (not per job) — design doc §3 source 3.
    const clientIds = [...new Set(jobs.map(j => j.client_id).filter(Boolean))];
    const jobsByClient = {};
    if (clientIds.length > 0) {
      const { data: unpaidJobs, error: unpaidErr } = await sb
        .from('jobs')
        .select('id, client_id, scheduled_date, total_amount')
        .eq('business_id', biz.id)
        .in('client_id', clientIds)
        .eq('job_status', 'Completed')
        .neq('payment_status', 'Paid')
        .is('deleted_at', null);
      if (unpaidErr) throw new Error(`unpaid-balance jobs query failed for business ${biz.id}: ${unpaidErr.message}`);

      const unpaidJobIds = (unpaidJobs ?? []).map(j => j.id);
      let paymentsByJob = {};
      if (unpaidJobIds.length > 0) {
        const { data: pmts, error: pmtErr } = await sb
          .from('payments')
          .select('job_id, amount, is_void')
          .in('job_id', unpaidJobIds);
        if (pmtErr) throw new Error(`payments query failed for business ${biz.id}: ${pmtErr.message}`);
        for (const p of pmts ?? []) {
          (paymentsByJob[p.job_id] ??= []).push(p);
        }
      }
      for (const j of unpaidJobs ?? []) {
        (jobsByClient[j.client_id] ??= []).push({
          scheduled_date: j.scheduled_date,
          total_amount: j.total_amount,
          payments: paymentsByJob[j.id] ?? [],
        });
      }
    }

    for (const job of jobs) {
      const client = job.clients ?? {};
      const clientName = clientDisplayName(client);
      const startAt = torontoToUtc(job.scheduled_date, job.scheduled_time);
      if (!startAt) continue;
      const driveSeconds = job.ai_context?.drive_to?.durationValue;
      const leaveAt = computeLeaveAt(startAt, driveSeconds);
      const endAt = computeEndAt(startAt, job.estimated_hours);

      // Leave alert
      if (isLeaveDue({ now, startAt, leaveAt })) {
        candidateCount += 1;
        const { title, body } = buildLeaveBody({
          clientName, startAt, leaveAt, driveSeconds, address: clientAddress(client),
        });
        const pushLogId = await claimPushLog(sb, {
          businessId: biz.id, jobId: job.id, kind: 'leave', jobStartAt: startAt.toISOString(), title, body,
        });
        if (pushLogId) {
          const result = await dispatchPush(sb, {
            businessId: biz.id, jobId: job.id, kind: 'leave', title, body,
            url: `/?job=${job.id}`, pushLogId, vapidReady,
          });
          sentTotal += result.sent;
          failedTotal += result.failed;
        }
      }

      // Wrap-up alert
      if (isWrapupDue({ now, endAt })) {
        candidateCount += 1;
        const balance = computeUnpaidBalance(jobsByClient[job.client_id] ?? []);
        const { title, body } = buildWrapupBody({
          clientName, endAt,
          pendingNote: client.pending_note, pendingNoteSourceJobId: client.pending_note_source_job_id,
          jobId: job.id, jobNotes: job.job_notes, balance,
        });
        const pushLogId = await claimPushLog(sb, {
          businessId: biz.id, jobId: job.id, kind: 'wrapup', jobStartAt: startAt.toISOString(), title, body,
        });
        if (pushLogId) {
          const result = await dispatchPush(sb, {
            businessId: biz.id, jobId: job.id, kind: 'wrapup', title, body,
            url: `/?job=${job.id}`, pushLogId, vapidReady,
          });
          sentTotal += result.sent;
          failedTotal += result.failed;
        }
      }
    }
  }

  // Future SMS steps land here — same tick, same loop over `businesses`,
  // gated on sms_reminders_enabled instead of push_alerts_enabled (see the
  // approved SMS design §1 steps 1-7). Not built yet (Twilio Phase-0 pending).

  return {
    businesses: (businesses ?? []).length,
    candidates: candidateCount,
    sent: sentTotal,
    failed: failedTotal,
    vapidConfigured: vapidReady,
  };
}

async function handleSweep(req, res, sb) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end();

  // Same header-only bearer guard as api/briefing/daily.js — shared
  // CRON_SECRET. Fails closed (missing env var = reject), never open.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return res.status(500).json({ error: 'CRON_SECRET not configured' });
  const authHeader = req.headers['authorization'] ?? '';
  if (authHeader !== `Bearer ${cronSecret}`) return res.status(401).json({ error: 'Unauthorized' });

  // Heartbeat FIRST — before anything else can throw — so a deliberately
  // disabled/misconfigured tick still shows as "checked in", not an outage.
  const { error: hbErr } = await sb
    .from('app_settings')
    .update({ reminders_last_sweep_at: new Date().toISOString(), reminders_last_sweep_error: null })
    .eq('id', 1);
  if (hbErr) {
    console.error('[reminders] heartbeat write failed:', hbErr.message);
  }

  try {
    const result = await runPushSweep(sb);
    console.log(`[reminders] sweep ok businesses=${result.businesses} candidates=${result.candidates} sent=${result.sent} failed=${result.failed}`);
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error('[reminders] sweep crashed:', err);
    await sb.from('app_settings')
      .update({ reminders_last_sweep_error: String(err.message ?? err).slice(0, 500) })
      .eq('id', 1)
      .then(() => {}, () => {});
    await logServerError({
      severity: 'critical',
      message: 'Reminders sweep crashed (uncaught)',
      stack: err.stack,
      alert: true,
    });
    return res.status(500).json({ error: 'Sweep failed', message: err.message });
  }
}

// ── push-test ────────────────────────────────────────────────────────────

async function handlePushTest(req, res, sb) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const auth = await requireUser(req, sb);
  if (auth.error) return res.status(auth.error.status).json({ error: auth.error.message });

  const vapidReady = configureWebPush();
  if (!vapidReady) return res.status(500).json({ error: 'Push is not configured (missing VAPID env vars).' });

  const businessId = auth.businessId;
  if (!businessId) return res.status(403).json({ error: 'No business scope for this account.' });

  const { data: subs, error: subsErr } = await sb
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('business_id', businessId)
    .eq('user_id', auth.user.id);
  if (subsErr) return res.status(500).json({ error: subsErr.message });
  if (!subs || subs.length === 0) {
    return res.status(404).json({ error: 'No subscriptions found for this device — tap Enable first.' });
  }

  const payload = JSON.stringify({
    kind: 'test',
    title: 'Test alert',
    body: 'If you can read this on your lock screen, job alerts are working.',
    url: '/settings',
  });

  let sent = 0;
  let failed = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: 60, urgency: 'high' }
      );
      sent += 1;
    } catch (err) {
      failed += 1;
      console.error('[reminders] push-test send failed:', err?.message ?? err);
    }
  }

  return res.status(200).json({ ok: true, sent, failed });
}

// ── router ───────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  const { action } = req.query;

  let sb;
  try {
    sb = initSupabase();
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }

  if (action === 'sweep') return handleSweep(req, res, sb);
  if (action === 'push-test') return handlePushTest(req, res, sb);

  // Future SMS-reminders actions ride this same router (approved design,
  // Twilio Phase-0 not yet done — see this file's header comment):
  // if (action === 'send') return handleSmsSend(req, res, sb);
  // if (action === 'status') return handleSmsStatusCallback(req, res, sb);
  // if (action === 'inbound') return handleSmsInbound(req, res, sb);

  return res.status(404).json({ error: `Unknown reminders action: ${action}` });
}
