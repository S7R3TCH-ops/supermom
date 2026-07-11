import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
import { logServerError } from '../_lib/errorLog.js';

// ── helpers ───────────────────────────────────────────────────────────────────

function torontoDateStr(offsetDays = 0) {
  const base = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
  if (offsetDays === 0) return base;
  const d = new Date(base + 'T12:00:00');
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
}

function formatMoney(n) {
  return `$${Number(n || 0).toFixed(2)}`;
}

function formatDayLabel(dateStr) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = new Date(dateStr + 'T12:00:00');
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── email builder ─────────────────────────────────────────────────────────────

function buildEmailHtml({ todayJobs, tomorrowJobs, unpaidJobs, todayLabel, tomorrowLabel, ownerName, dadJoke }) {
  const pink = '#FC4693';
  const cream = '#FFF9F5';
  const green = '#22c55e';

  function calcEndTime(startTime, hours) {
    if (!startTime || !hours) return null;
    const [h, m] = startTime.split(':').map(Number);
    const totalMins = h * 60 + m + Math.round(hours * 60);
    const endH = Math.floor(totalMins / 60) % 24;
    const endM = totalMins % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  }

  function jobRow(job) {
    const startFmt = formatTime(job.scheduled_time);
    const endTime = calcEndTime(job.scheduled_time, job.estimated_hours);
    const timeStr = escapeHtml(endTime ? `${startFmt} – ${formatTime(endTime)}` : startFmt);
    const client = escapeHtml(`${job.clients?.first_name ?? ''} ${job.clients?.last_name ?? ''}`.trim() || 'Unknown Client');
    const service = escapeHtml(job.service_name || '');
    const drive = job.clients?.ai_context?.drive_to?.duration ? `🚗 ${job.clients.ai_context.drive_to.duration} away` : '';
    const notes = job.job_notes ? `<div style="font-size:12px;color:#888;margin-top:2px;">${escapeHtml(job.job_notes)}</div>` : '';
    return `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;vertical-align:top;">
          <div style="font-size:13px;font-weight:700;color:${pink};margin-bottom:2px;">${timeStr}</div>
          <div style="display:inline-block;vertical-align:top;">
            <div style="font-size:14px;font-weight:600;color:#1a1a1a;">${client}</div>
            <div style="font-size:12px;color:#666;">${service}${drive ? ` · <span style="color:#888;">${drive}</span>` : ''}</div>
            ${notes}
          </div>
        </td>
      </tr>`;
  }

  function unpaidRow(job) {
    const client = escapeHtml(`${job.clients?.first_name ?? ''} ${job.clients?.last_name ?? ''}`.trim() || 'Unknown Client');
    const amount = escapeHtml(formatMoney(job.total_amount));
    const date = escapeHtml(job.scheduled_date ? formatDayLabel(job.scheduled_date) : '');
    return `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;">
          <span style="font-size:14px;color:#1a1a1a;">${client}</span>
          <span style="font-size:12px;color:#888;margin-left:8px;">${date}</span>
          <span style="float:right;font-size:14px;font-weight:700;color:#e05;">${amount}</span>
        </td>
      </tr>`;
  }

  const todaySection = todayJobs.length > 0
    ? `<table width="100%" cellpadding="0" cellspacing="0">${todayJobs.map(jobRow).join('')}</table>`
    : `<p style="color:#aaa;font-size:13px;margin:0;">Nothing scheduled — enjoy the day off! 🎉</p>`;

  const tomorrowSection = tomorrowJobs.length > 0
    ? `<table width="100%" cellpadding="0" cellspacing="0">${tomorrowJobs.map(jobRow).join('')}</table>`
    : `<p style="color:#aaa;font-size:13px;margin:0;">Nothing scheduled tomorrow.</p>`;

  const unpaidSection = unpaidJobs.length > 0
    ? `<table width="100%" cellpadding="0" cellspacing="0">${unpaidJobs.map(unpaidRow).join('')}</table>
       <p style="font-size:12px;color:#888;margin:12px 0 0;">Tap "Record Payment" in the app to mark these collected.</p>`
    : `<p style="color:${green};font-size:13px;font-weight:600;margin:0;">All caught up — no outstanding balances ✓</p>`;

  const greeting = todayJobs.length === 0
    ? `Good morning, ${escapeHtml(ownerName)}! No jobs today 🎉`
    : `Good morning, ${escapeHtml(ownerName)}! You've got ${todayJobs.length} job${todayJobs.length !== 1 ? 's' : ''} today.`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

        <!-- Header -->
        <tr><td style="background:${pink};padding:28px 32px;text-align:center;">
          <img src="https://app.supermomforhire.com/branding/logo-final.png" alt="Supermom for Hire" height="70" style="display:block;margin:0 auto 12px;" />
          <div style="color:white;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;opacity:.85;">Daily Briefing · ${escapeHtml(todayLabel)}</div>
        </td></tr>

        <!-- Greeting -->
        <tr><td style="padding:24px 32px 0;">
          <p style="margin:0;font-size:16px;font-weight:600;color:#1a1a1a;">${greeting}</p>
          ${dadJoke ? `<p style="margin:10px 0 0;font-size:13px;color:#888;font-style:italic;">😄 ${escapeHtml(dadJoke)}</p>` : ''}
        </td></tr>

        <!-- Today -->
        <tr><td style="padding:20px 32px;">
          <div style="font-size:10px;font-weight:700;color:#aaa;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px;">Today — ${escapeHtml(todayLabel)}</div>
          <div style="background:${cream};border:1.5px solid #FFD6E8;border-radius:12px;padding:16px 20px;">
            ${todaySection}
          </div>
        </td></tr>

        <!-- Outstanding balances -->
        <tr><td style="padding:0 32px 20px;">
          <div style="font-size:10px;font-weight:700;color:#aaa;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px;">Outstanding Balances</div>
          <div style="background:#fafafa;border:1.5px solid #eee;border-radius:12px;padding:16px 20px;">
            ${unpaidSection}
          </div>
        </td></tr>

        <!-- Tomorrow -->
        <tr><td style="padding:0 32px 28px;">
          <div style="font-size:10px;font-weight:700;color:#aaa;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px;">Tomorrow — ${escapeHtml(tomorrowLabel)}</div>
          <div style="background:#fafafa;border:1.5px solid #eee;border-radius:12px;padding:16px 20px;">
            ${tomorrowSection}
          </div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#fafafa;border-top:1px solid #eee;padding:20px 32px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#aaa;">Supermom for Hire · Georgetown, ON</p>
          <p style="margin:6px 0 0;font-size:12px;color:#ccc;">
            <a href="https://app.supermomforhire.com" style="color:#ccc;">Open the app</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // Allow GET (Vercel Cron) or POST (manual trigger)
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end();

  // Verify cron secret — accept Authorization header (Vercel Cron) or ?secret= (browser testing)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers['authorization'] ?? '';
    const querySecret = req.query?.secret ?? '';
    if (authHeader !== `Bearer ${cronSecret}` && querySecret !== cronSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  // ?to= overrides recipient for one-off manual test sends only
  const toOverride = req.query?.to ?? null;

  try {
    return await runDailyBriefing({ req, toOverride, res });
  } catch (err) {
    console.error('[briefing] Unhandled cron failure:', err);
    await logServerError({
      severity: 'critical',
      message: 'Daily briefing cron crashed (uncaught)',
      stack: err.stack,
      alert: true,
    });
    return res.status(500).json({ error: 'Daily briefing failed', message: err.message });
  }
}

async function runDailyBriefing({ req, toOverride, res }) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'DB config missing' });

  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;

  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const today = torontoDateStr(0);
  const tomorrow = torontoDateStr(1);
  const todayLabel = formatDayLabel(today);
  const tomorrowLabel = formatDayLabel(tomorrow);

  // Fetch a dad joke for today's email
  let dadJoke = null;
  try {
    const jokeRes = await fetch('https://icanhazdadjoke.com/', { headers: { Accept: 'application/json' } });
    if (jokeRes.ok) dadJoke = (await jokeRes.json()).joke ?? null;
  } catch { /* non-fatal — email sends without joke if this fails */ }

  // Fetch all active businesses (to support multiple owners in future)
  const { data: businesses, error: bizErr } = await sb
    .from('businesses')
    .select('id, owner_name, email')
    .is('deleted_at', null);
  if (bizErr) return res.status(500).json({ error: bizErr.message });

  const results = [];

  for (const biz of businesses) {
    const toEmail = toOverride || biz.email;
    if (!toEmail) continue;

    // Today's jobs
    const { data: todayJobs } = await sb
      .from('jobs')
      .select('id, scheduled_time, service_name, estimated_hours, job_notes, clients(first_name, last_name, ai_context)')
      .eq('business_id', biz.id)
      .eq('scheduled_date', today)
      .not('job_status', 'eq', 'Cancelled')
      .is('deleted_at', null)
      .order('scheduled_time', { ascending: true });

    // Tomorrow's jobs
    const { data: tomorrowJobs } = await sb
      .from('jobs')
      .select('id, scheduled_time, service_name, estimated_hours, job_notes, clients(first_name, last_name)')
      .eq('business_id', biz.id)
      .eq('scheduled_date', tomorrow)
      .not('job_status', 'eq', 'Cancelled')
      .is('deleted_at', null)
      .order('scheduled_time', { ascending: true });

    // Outstanding balances — completed jobs not fully paid
    const { data: unpaidJobs } = await sb
      .from('jobs')
      .select('id, scheduled_date, total_amount, clients(first_name, last_name)')
      .eq('business_id', biz.id)
      .eq('job_status', 'Completed')
      .neq('payment_status', 'Paid')
      .is('deleted_at', null)
      .order('scheduled_date', { ascending: false })
      .limit(10);

    const todayCount = (todayJobs ?? []).length;
    const firstName = (biz.owner_name || 'Sandra').split(' ')[0];

    const html = buildEmailHtml({
      todayJobs: todayJobs ?? [],
      tomorrowJobs: tomorrowJobs ?? [],
      unpaidJobs: unpaidJobs ?? [],
      todayLabel,
      tomorrowLabel,
      ownerName: firstName,
      dadJoke,
    });

    const subject = todayCount === 0
      ? `Good morning, ${firstName}! No jobs today`
      : `Good morning, ${firstName}! ${todayCount} job${todayCount !== 1 ? 's' : ''} today · ${todayLabel}`;

    if (!gmailUser || !gmailPass) {
      console.warn(`[briefing] No Gmail creds — skipping send to ${toEmail}`);
      results.push({ business: biz.id, skipped: 'no_gmail_creds', todayCount });
      continue;
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
    });

    try {
      await transporter.sendMail({
        from: `"Supermom for Hire" <${gmailUser}>`,
        replyTo: 'noreply@supermomforhire.com',
        to: toEmail,
        subject,
        html,
      });
      console.log(`[briefing] Sent to ${toEmail} — ${todayCount} jobs today`);
      results.push({ business: biz.id, sent: true, to: toEmail, todayCount });
    } catch (mailErr) {
      console.error(`[briefing] sendMail failed for ${toEmail}:`, mailErr.message);
      results.push({ business: biz.id, sent: false, to: toEmail, error: mailErr.message, todayCount });
      // Nobody reads this response body — the cron just fires and forgets.
      // Without this, a broken send here is invisible until someone notices
      // the briefing email never arrived.
      await logServerError({
        severity: 'critical',
        message: `Daily briefing send failed for ${toEmail}`,
        stack: mailErr.stack,
        context: { businessId: biz.id, toEmail, todayCount },
        businessId: biz.id,
        alert: true,
      });
    }
  }

  return res.status(200).json({ ok: true, results, date: today });
}
