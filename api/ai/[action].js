import { createClient } from '@supabase/supabase-js';
import { requireUser, assertClientAccess, canAccessBusiness } from '../_lib/authGuard.js';
import { sendMail } from '../_lib/mailer.js';
import { logServerError } from '../_lib/errorLog.js';
import { hashInputs, buildClientBriefPrompt, buildDayBriefPrompt } from '../_lib/briefs.js';
import { computeEndAt, computeUnpaidBalance } from '../_lib/pushAlerts.js';
import { torontoDateStr, torontoToUtc } from '../_lib/torontoTime.js';
import { initGemini, generateText, GEMINI_MODEL } from '../_lib/gemini.js';

// Actions that must work even when the AI kill-switch (app_settings.ai_enabled)
// is off, and that never touch Gemini — living under /api/ai/ purely to
// reuse this router's existing auth/dispatch plumbing without spending a new
// Vercel serverless function slot.
const NON_AI_ACTIONS = new Set(['notify-request']);

// Actions that must degrade gracefully instead of hard-failing when the kill
// switch is off — per design doc §3.6, "no regeneration, but keep rendering
// the last cached row." These still call Gemini when ai_enabled is true;
// the router just skips its blanket 503 for them and lets the handler decide.
const KILL_SWITCH_FALLBACK_ACTIONS = new Set(['client-brief', 'day-brief']);

function initClients() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Database configuration missing');
  }
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const gemini = initGemini();
  return { supabase, gemini };
}

// ── helpers ──────────────────────────────────────────────────────────────────

function timeBucket(timeStr) {
  if (!timeStr) return null;
  const h = parseInt(timeStr.slice(0, 2), 10);
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function dayOfWeek(dateStr) {
  if (!dateStr) return null;
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date(dateStr + 'T12:00:00').getDay()];
}

function mode(arr) {
  if (!arr.length) return null;
  const counts = arr.reduce((m, v) => { m[v] = (m[v] || 0) + 1; return m; }, {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

// ── handlers ─────────────────────────────────────────────────────────────────

async function enrichClient(req, res, supabase, gemini) {
  if (!gemini) {
    console.warn('[enrich-client] No GEMINI_API_KEY found. Skipping background synthesis.');
    return res.status(200).json({ ok: true, skipped: 'no_api_key' });
  }

  const { clientId } = req.body;
  if (!clientId) return res.status(400).json({ error: 'Missing clientId' });

  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id, business_id, first_name, last_name, ai_context')
    .eq('id', clientId)
    .single();
  if (clientErr || !client) return res.status(404).json({ error: 'Client not found' });

  const { data: business } = await supabase
    .from('businesses')
    .select('owner_name')
    .eq('id', client.business_id)
    .single();
  const ownerName = business?.owner_name || 'the business owner';
  const clientName = [client.first_name, client.last_name].filter(Boolean).join(' ') || 'this client';

  const { data: jobs, error: jobsErr } = await supabase
    .from('jobs')
    .select('scheduled_date, scheduled_time, service_name, actual_duration, estimated_hours, payment_method, job_notes')
    .eq('client_id', clientId)
    .eq('job_status', 'Completed')
    .is('deleted_at', null)
    .order('scheduled_date', { ascending: false });
  if (jobsErr) throw new Error('Failed to fetch jobs');

  const existing = client.ai_context?.learned || {};
  const jobCount = jobs.length;
  if (jobCount < 2) return res.status(200).json({ skipped: 'not_enough_data' });

  if (existing.last_enriched_at) {
    const hoursSince = (Date.now() - new Date(existing.last_enriched_at).getTime()) / 3_600_000;
    const newJobs = jobCount - (existing.last_enriched_job_count || 0);
    if (hoursSince < 24 && newJobs < 3) return res.status(200).json({ skipped: 'too_soon' });
  }

  const serviceGroups = {};
  for (const j of jobs) {
    if (!j.service_name || j.actual_duration == null) continue;
    if (!serviceGroups[j.service_name]) serviceGroups[j.service_name] = [];
    serviceGroups[j.service_name].push(j);
  }
  const duration_patterns = {};
  for (const [svc, svcJobs] of Object.entries(serviceGroups)) {
    const actualMins = svcJobs.map(j => j.actual_duration * 60);
    const avg_actual_minutes = Math.round(actualMins.reduce((s, v) => s + v, 0) / actualMins.length);
    const ratios = svcJobs
      .filter(j => j.estimated_hours != null && j.estimated_hours > 0)
      .map(j => j.actual_duration / j.estimated_hours);
    const avg_estimate_ratio = ratios.length
      ? Math.round((ratios.reduce((s, v) => s + v, 0) / ratios.length) * 100) / 100
      : null;
    duration_patterns[svc] = { avg_actual_minutes, avg_estimate_ratio, sample_size: svcJobs.length };
  }

  const payment_method_preference = mode(jobs.map(j => j.payment_method).filter(Boolean));
  const preferred_time_of_day = mode(jobs.map(j => timeBucket(j.scheduled_time)).filter(Boolean));
  const preferred_day_of_week = mode(jobs.map(j => dayOfWeek(j.scheduled_date)).filter(Boolean));

  const last5 = jobs.slice(0, 5).map(j => {
    const mins = j.actual_duration != null
      ? `${Math.round(j.actual_duration * 60)}m actual`
      : j.estimated_hours ? `${Math.round(j.estimated_hours * 60)}m est` : 'duration unknown';
    return `- ${j.scheduled_date}: ${j.service_name} (${mins})${j.job_notes ? ` — ${j.job_notes}` : ''}`;
  }).join('\n');

  const prompt = `You are helping ${ownerName} (a solo home-services business owner) understand patterns about their client ${clientName} before a visit. Write about ${clientName}'s patterns and preferences — never about ${ownerName} or anyone else. Pre-computed stats:
- Jobs completed: ${jobCount}
- Duration patterns: ${JSON.stringify(duration_patterns)}
- Payment preference: ${payment_method_preference || 'unknown'}
- Preferred time: ${preferred_time_of_day || 'unknown'}, day: ${preferred_day_of_week || 'unknown'}

Last 5 jobs:
${last5}

Current note about ${clientName}: "${existing.synthesis_note || ''}"
Current flags: ${JSON.stringify(existing.behavioral_flags || [])}
If the current note describes ${ownerName} or anyone other than ${clientName}, disregard that part when writing the new note.

Return ONLY valid JSON (no markdown):
{"synthesis_note":"2-3 sentences about ${clientName}'s patterns useful before a visit.","behavioral_flags":["snake_case","max_4_words","max_4_items"]}`;

  const content = await generateText(gemini, prompt, 150);
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Gemini did not return valid JSON');
  const geminiResult = JSON.parse(jsonMatch[0]);

  await supabase
    .from('clients')
    .update({
      ai_context: {
        ...client.ai_context,
        learned: {
          version: 1,
          last_enriched_at: new Date().toISOString(),
          last_enriched_job_count: jobCount,
          duration_patterns,
          payment_method_preference,
          preferred_time_of_day,
          preferred_day_of_week,
          behavioral_flags: geminiResult.behavioral_flags || [],
          synthesis_note: geminiResult.synthesis_note || '',
        },
      },
    })
    .eq('id', clientId);

  return res.status(200).json({ ok: true });
}

async function localEstimateDuration(supabase, clientId, serviceName) {
  try {
    const { data: jobs } = await supabase.from('jobs').select('actual_duration').eq('client_id', clientId).eq('service_name', serviceName).eq('job_status', 'Completed').not('actual_duration', 'is', null).limit(3);
    let duration_minutes = 120;
    let reasoning = 'Based on default service duration.';
    if (jobs?.length > 0) {
      const avg = jobs.reduce((s, j) => s + Number(j.actual_duration), 0) / jobs.length;
      duration_minutes = Math.round(avg * 60);
      reasoning = `Based on average of last ${jobs.length} similar jobs.`;
    }
    return { duration_minutes, reasoning, isMock: true };
  } catch (e) {
    return { duration_minutes: 120, reasoning: 'Fallback default.', isMock: true };
  }
}

async function estimateDuration(req, res, supabase, gemini) {
  const { clientId, serviceName, businessProfile } = req.body;
  if (!clientId || !serviceName) return res.status(400).json({ error: 'Missing clientId or serviceName' });

  if (!gemini) {
    console.warn('[estimate-duration] No GEMINI_API_KEY found. Using local fallback.');
    return res.status(200).json(await localEstimateDuration(supabase, clientId, serviceName));
  }

  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('first_name, last_name, notes, ai_context, tags')
    .eq('id', clientId)
    .single();
  if (clientErr || !client) throw new Error('Client not found');

  const { data: jobs, error: jobsErr } = await supabase
    .from('jobs')
    .select('scheduled_date, actual_duration, estimated_hours, job_notes')
    .eq('client_id', clientId)
    .eq('service_name', serviceName)
    .eq('job_status', 'Completed')
    .is('deleted_at', null)
    .order('scheduled_date', { ascending: false })
    .order('scheduled_time', { ascending: false })
    .limit(5);
  if (jobsErr) throw new Error('Failed to fetch jobs');

  const style = businessProfile?.ai_profile?.style || 'professional';
  const ownerName = businessProfile?.owner_name || 'the business owner';
  const clientName = [client.first_name, client.last_name].filter(Boolean).join(' ');

  const learnedPattern = client.ai_context?.learned?.duration_patterns?.[serviceName];
  const patternBlock = learnedPattern
    ? `\nLearned: avg actual ${learnedPattern.avg_actual_minutes} min, estimate ratio ${learnedPattern.avg_estimate_ratio?.toFixed(2)} over ${learnedPattern.sample_size} jobs. Weight this heavily.`
    : '';

  const historyText = jobs.length > 0
    ? jobs.map(j => {
        const dur = j.actual_duration != null
          ? j.actual_duration * 60
          : j.estimated_hours ? j.estimated_hours * 60 : null;
        return `- ${j.scheduled_date}: ${dur ? `${Math.round(dur)}m` : 'unknown duration'}${j.job_notes ? ` (${j.job_notes})` : ''}`;
      }).join('\n')
    : 'No previous completed jobs found for this service.';

  const prompt = `You are an AI assistant for ${ownerName}, a busy business owner.
Your goal is to provide a smart duration estimate for an upcoming ${serviceName} job with ${clientName}.

Client Notes: ${client.notes || 'None'}
Client Tags: ${JSON.stringify(client.tags || [])}${patternBlock}

Recent Job History for ${serviceName}:
${historyText}

Style Guidance: Use a ${style} tone.

Generate an estimate in hours (decimal). Return ONLY a JSON object in this format:
{
  "duration_minutes": number,
  "reasoning": "string (one short, helpful sentence)"
}`;

  try {
    const content = await generateText(gemini, prompt, 300);
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const result = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    return res.status(200).json(result);
  } catch (e) {
    console.warn('[estimate-duration] Gemini call failed, using local fallback.', e.message);
    return res.status(200).json(await localEstimateDuration(supabase, clientId, serviceName));
  }
}

async function localPrepNote(supabase, clientId) {
  try {
    const { data: client } = await supabase.from('clients').select('first_name, notes, ai_context').eq('id', clientId).single();
    const { data: jobs } = await supabase.from('jobs').select('service_name, scheduled_date').eq('client_id', clientId).eq('job_status', 'Completed').limit(3);
    const name = client?.first_name || 'Client';
    const lastJob = jobs?.[0];
    const prefs = client?.ai_context?.prefs || client?.notes || 'no special requests';
    const summary = `[Simulated] ${name} usually prefers a ${client?.ai_context?.style || 'professional'} approach. ${lastJob ? `Last time you handled a ${lastJob.service_name} for them on ${lastJob.scheduled_date}.` : 'This is a relatively new client relationship.'} Keep an eye out for their preference regarding ${prefs.toLowerCase().slice(0, 50)}...`;
    return { summary, isMock: true };
  } catch (e) {
    return { summary: "Ready to help with your next session. Remember to check the client's specific preferences in their profile.", isMock: true };
  }
}

async function prepNote(req, res, supabase, gemini) {
  const { clientId, businessProfile } = req.body;
  if (!clientId) return res.status(400).json({ error: 'Missing clientId' });

  if (!gemini) {
    console.warn('[prep-note] No GEMINI_API_KEY found. Using simulated briefing fallback.');
    return res.status(200).json(await localPrepNote(supabase, clientId));
  }

  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('first_name, last_name, notes, ai_context')
    .eq('id', clientId)
    .single();
  if (clientErr) throw new Error(`Client fetch failed: ${clientErr.message}`);
  if (!client) throw new Error('Client not found');

  const { data: jobs, error: jobsErr } = await supabase
    .from('jobs')
    .select('scheduled_date, scheduled_time, service_name, job_notes, completion_notes')
    .eq('client_id', clientId)
    .eq('job_status', 'Completed')
    .is('deleted_at', null)
    .order('scheduled_date', { ascending: false })
    .order('scheduled_time', { ascending: false })
    .limit(5);
  if (jobsErr) throw new Error(`Jobs fetch failed: ${jobsErr.message}`);

  const style = businessProfile?.ai_profile?.style || 'professional';
  const ownerName = businessProfile?.owner_name || 'the business owner';
  const clientName = [client.first_name, client.last_name].filter(Boolean).join(' ');
  const historyText = jobs.length > 0
    ? jobs.map(j => {
        const notesParts = [];
        if (j.job_notes) notesParts.push(`prep: ${j.job_notes}`);
        if (j.completion_notes) notesParts.push(`wrap: ${j.completion_notes}`);
        const notesText = notesParts.length > 0 ? ` (${notesParts.join(' | ')})` : '';
        return `- ${j.scheduled_date}: ${j.service_name}${notesText}`;
      }).join('\n')
    : 'No previous completed jobs found.';
  const learned = client.ai_context?.learned;
  const learnedBlock = learned?.synthesis_note
    ? `\nLearned patterns: ${learned.synthesis_note}${learned.behavioral_flags?.length ? `\nFlags: ${learned.behavioral_flags.join(', ')}` : ''}${learned.preferred_time_of_day ? `\nPrefers ${learned.preferred_time_of_day} appointments.` : ''}`
    : '';

  const prompt = `You are an AI assistant for ${ownerName}, a busy business owner.
Your goal is to provide a concise, conversational 3-4 sentence briefing for her upcoming job with ${clientName}.

Client Notes: ${client.notes || 'None'}${learnedBlock}

Recent Job History:
${historyText}

Style Guidance: Use a ${style} tone.

Generate the briefing now. Focus on patterns, preferences, or things she should remember from last time. Keep it to 3-4 sentences.`;

  try {
    const summary = await generateText(gemini, prompt, 300);
    return res.status(200).json({ summary });
  } catch (e) {
    console.warn('[prep-note] Gemini call failed, using local fallback.', e.message);
    return res.status(200).json(await localPrepNote(supabase, clientId));
  }
}

async function summarizeCarriedNote(req, res, supabase, gemini) {
  const { priorNote, newNote } = req.body;
  if (!priorNote || !newNote) return res.status(400).json({ error: 'Missing priorNote or newNote' });

  const fallback = `${priorNote}\n\n${newNote}`;
  if (!gemini) {
    console.warn('[summarize-carried-note] No GEMINI_API_KEY found. Falling back to plain join.');
    return res.status(200).json({ note: fallback, isMock: true });
  }

  const prompt = `Two carry-forward reminder notes for the same client stacked up before either was used. Merge them into ONE short note, 1-2 sentences, plain text, no markdown. Keep every concrete detail (names, requests, reminders) from both — drop only redundant phrasing.

Note 1 (older): "${priorNote}"
Note 2 (newer): "${newNote}"

Return ONLY the merged note text, nothing else.`;

  try {
    const note = (await generateText(gemini, prompt, 150)).trim();
    return res.status(200).json({ note });
  } catch (e) {
    console.warn('[summarize-carried-note] Gemini call failed, using plain join.', e.message);
    return res.status(200).json({ note: fallback, isMock: true });
  }
}

async function transcribeVoiceNote(req, res, supabase) {
  const { filePath } = req.body;
  if (!filePath) return res.status(400).json({ error: 'Missing filePath' });
  // TODO: download from job-assets bucket → OpenAI Whisper → return transcript
  return res.json({ transcript: '', note: 'transcription not yet implemented' });
}

// ── client-brief / day-brief (agentic AI summaries, §3 of the design doc) ──

/**
 * client-brief: { clientId, force? }. Client-scoped, cached in ai_briefs
 * (kind='client', subject_id=clientId). requireUser + assertClientAccess
 * already ran in the router (it checks req.body.clientId generically).
 */
async function clientBrief(req, res, supabase, gemini, aiEnabled) {
  const { clientId, force } = req.body;
  if (!clientId) return res.status(400).json({ error: 'Missing clientId' });

  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id, business_id, first_name, last_name, notes, ai_context, tags, pending_note, pending_note_source_job_id')
    .eq('id', clientId)
    .single();
  if (clientErr || !client) return res.status(404).json({ error: 'Client not found' });

  const { data: business } = await supabase
    .from('businesses')
    .select('owner_name, ai_profile')
    .eq('id', client.business_id)
    .single();
  const ownerName = business?.owner_name || 'the business owner';
  const style = business?.ai_profile?.style || 'professional';

  // Last 5 completed jobs — both job_notes (pre) and completion_notes (post).
  // prep-note (the action this replaces) only ever read job_notes; the
  // design doc's §2.1 finding #3 called that out as a bug this fixes.
  const { data: jobs, error: jobsErr } = await supabase
    .from('jobs')
    .select('scheduled_date, scheduled_time, service_name, job_notes, completion_notes')
    .eq('client_id', clientId)
    .eq('job_status', 'Completed')
    .is('deleted_at', null)
    .order('scheduled_date', { ascending: false })
    .order('scheduled_time', { ascending: false })
    .limit(5);
  if (jobsErr) throw new Error(`Jobs fetch failed: ${jobsErr.message}`);

  const learned = client.ai_context?.learned || {};
  const inputs = {
    ownerName,
    clientName: [client.first_name, client.last_name].filter(Boolean).join(' ') || 'this client',
    style,
    history: (jobs || []).map(j => ({
      date: j.scheduled_date,
      service_name: j.service_name,
      job_notes: j.job_notes,
      completion_notes: j.completion_notes,
    })),
    clientNotes: client.notes || '',
    access: client.ai_context?.access || '',
    prefs: client.ai_context?.prefs || '',
    personal: client.ai_context?.personal || '',
    tags: client.tags || [],
    // clients.pending_note is only ever non-null while unconsumed (jobsRepo
    // clears both pending_note and pending_note_source_job_id together on
    // consumption) — no extra "unconsumed" check needed here.
    pendingNote: client.pending_note || '',
    learned: {
      synthesis_note: learned.synthesis_note || '',
      behavioral_flags: learned.behavioral_flags || [],
      preferred_time_of_day: learned.preferred_time_of_day || '',
    },
  };

  const inputsHash = hashInputs(inputs);

  const { data: existingRow, error: existingErr } = await supabase
    .from('ai_briefs')
    .select('content, inputs_hash, model, generated_at')
    .eq('business_id', client.business_id)
    .eq('kind', 'client')
    .eq('subject_id', clientId)
    .maybeSingle();
  if (existingErr) throw new Error(`ai_briefs read failed: ${existingErr.message}`);

  if (existingRow && existingRow.inputs_hash === inputsHash && !force) {
    return res.status(200).json({ brief: existingRow.content, cached: true });
  }

  // Kill switch off: never regenerate, but keep serving the last cached row
  // (design doc §3.6). Never fabricate a fake summary.
  if (!aiEnabled) {
    if (existingRow) return res.status(200).json({ brief: existingRow.content, cached: true });
    return res.status(503).json({ error: 'AI features are currently turned off.' });
  }

  const built = buildClientBriefPrompt(inputs);

  // First-visit client (zero completed jobs) — deterministic content, no
  // Gemini call, no cost.
  if (built.skip) {
    const { error: upsertErr } = await supabase
      .from('ai_briefs')
      .upsert({
        business_id: client.business_id,
        kind: 'client',
        subject_id: clientId,
        content: built.result,
        inputs_hash: inputsHash,
        model: 'none',
        generated_at: new Date().toISOString(),
      }, { onConflict: 'business_id,kind,subject_id' });
    if (upsertErr) throw new Error(`ai_briefs upsert failed: ${upsertErr.message}`);
    return res.status(200).json({ brief: built.result, cached: false });
  }

  if (!gemini) {
    console.warn('[client-brief] No GEMINI_API_KEY found.');
    if (existingRow) return res.status(200).json({ brief: existingRow.content, cached: true });
    return res.status(503).json({ error: 'AI is not configured.' });
  }

  try {
    const content = await generateText(gemini, built.prompt, built.maxTokens);
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Gemini did not return valid JSON');
    const parsed = JSON.parse(jsonMatch[0]);
    const brief = {
      brief: typeof parsed.brief === 'string' ? parsed.brief : '',
      watch_for: Array.isArray(parsed.watch_for) ? parsed.watch_for.slice(0, 3) : [],
    };

    const { error: upsertErr } = await supabase
      .from('ai_briefs')
      .upsert({
        business_id: client.business_id,
        kind: 'client',
        subject_id: clientId,
        content: brief,
        inputs_hash: inputsHash,
        model: GEMINI_MODEL,
        generated_at: new Date().toISOString(),
      }, { onConflict: 'business_id,kind,subject_id' });
    if (upsertErr) throw new Error(`ai_briefs upsert failed: ${upsertErr.message}`);

    return res.status(200).json({ brief, cached: false });
  } catch (e) {
    await logServerError({
      severity: 'warning',
      message: `client-brief generation failed for client ${clientId}: ${e.message}`,
      stack: e.stack,
      context: { clientId },
      businessId: client.business_id,
      alert: false,
    });
    if (existingRow) return res.status(200).json({ brief: existingRow.content, cached: true });
    return res.status(502).json({ error: 'AI feature is unavailable right now. Try again shortly.' });
  }
}

/**
 * day-brief: { force?, businessId? }. Business-scoped, cached in ai_briefs
 * (kind='day', subject_id=businessId), valid only for today's Toronto date.
 * Callable manually/on-demand only at this stage — no sweep wiring yet.
 */
async function dayBrief(req, res, supabase, gemini, auth, aiEnabled) {
  const { force, businessId: requestedBusinessId } = req.body;
  const businessId = auth.isAdmin && requestedBusinessId ? requestedBusinessId : auth.businessId;
  if (!businessId) return res.status(400).json({ error: 'Missing businessId' });
  if (!canAccessBusiness(auth, businessId)) {
    return res.status(403).json({ error: 'Forbidden: business not in your scope' });
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('owner_name, ai_profile')
    .eq('id', businessId)
    .single();
  const ownerName = business?.owner_name || 'the business owner';
  const style = business?.ai_profile?.style || 'professional';

  const today = torontoDateStr(0);
  const tomorrow = torontoDateStr(1);

  // Today/tomorrow job assembly mirrors api/briefing/daily.js:233-253's shape
  // (same FK-embed hint, same filters), extended with the fields the day
  // brief needs (job_notes, notes_resolved_at, ai_context.drive_to, client
  // tags/pending_note/learned flags).
  const jobSelect = `id, scheduled_time, service_name, estimated_hours, job_notes, notes_resolved_at, ai_context, client_id,
        clients!jobs_client_id_fkey(first_name, last_name, tags, pending_note, ai_context)`;

  const [{ data: todayJobsRaw, error: todayErr }, { data: tomorrowJobsRaw, error: tomorrowErr }] = await Promise.all([
    supabase.from('jobs').select(jobSelect)
      .eq('business_id', businessId).eq('scheduled_date', today).eq('job_status', 'Scheduled').is('deleted_at', null)
      .order('scheduled_time', { ascending: true }),
    supabase.from('jobs').select(jobSelect)
      .eq('business_id', businessId).eq('scheduled_date', tomorrow).eq('job_status', 'Scheduled').is('deleted_at', null)
      .order('scheduled_time', { ascending: true }),
  ]);
  if (todayErr) throw new Error(`todayJobs query failed: ${todayErr.message}`);
  if (tomorrowErr) throw new Error(`tomorrowJobs query failed: ${tomorrowErr.message}`);

  const allJobs = [...(todayJobsRaw || []), ...(tomorrowJobsRaw || [])];
  const clientIds = [...new Set(allJobs.map(j => j.client_id).filter(Boolean))];

  // Batched unpaid-balance lookup — same shape as
  // api/reminders/[action].js:200-234 (one query per business, not per job).
  const jobsByClient = {};
  if (clientIds.length > 0) {
    const { data: unpaidJobs, error: unpaidErr } = await supabase
      .from('jobs')
      .select('id, client_id, scheduled_date, total_amount')
      .eq('business_id', businessId)
      .in('client_id', clientIds)
      .eq('job_status', 'Completed')
      .neq('payment_status', 'Paid')
      .is('deleted_at', null);
    if (unpaidErr) throw new Error(`unpaid-balance jobs query failed: ${unpaidErr.message}`);

    const unpaidJobIds = (unpaidJobs || []).map(j => j.id);
    const paymentsByJob = {};
    if (unpaidJobIds.length > 0) {
      const { data: pmts, error: pmtErr } = await supabase
        .from('payments').select('job_id, amount, is_void').in('job_id', unpaidJobIds);
      if (pmtErr) throw new Error(`payments query failed: ${pmtErr.message}`);
      for (const p of pmts || []) (paymentsByJob[p.job_id] ??= []).push(p);
    }
    for (const j of unpaidJobs || []) {
      (jobsByClient[j.client_id] ??= []).push({
        scheduled_date: j.scheduled_date,
        total_amount: j.total_amount,
        payments: paymentsByJob[j.id] ?? [],
      });
    }
  }

  // First-visit detection: completed-job count per client.
  const completedCountByClient = {};
  if (clientIds.length > 0) {
    const { data: completedJobs, error: completedErr } = await supabase
      .from('jobs').select('client_id')
      .eq('business_id', businessId).in('client_id', clientIds)
      .eq('job_status', 'Completed').is('deleted_at', null);
    if (completedErr) throw new Error(`completed-count query failed: ${completedErr.message}`);
    for (const j of completedJobs || []) {
      completedCountByClient[j.client_id] = (completedCountByClient[j.client_id] || 0) + 1;
    }
  }

  // Attention items — server equivalent of Home.jsx:203-223 (past scheduled
  // end and not marked complete). Scoped to today's jobs only (tomorrow's
  // can't be past-end yet); "completed but unpaid" is already covered by the
  // unpaid-balance data above, surfaced per-job in buildJobLine below rather
  // than duplicated into a second attention-item list.
  const now = new Date();
  const attentionItems = [];
  for (const j of (todayJobsRaw || [])) {
    if (!j.scheduled_time) continue;
    const startAt = torontoToUtc(today, j.scheduled_time);
    const endAt = computeEndAt(startAt, j.estimated_hours);
    if (endAt && now > endAt) {
      const c = j.clients ?? {};
      const clientName = [c.first_name, c.last_name].filter(Boolean).join(' ') || 'client';
      attentionItems.push({ job_id: j.id, client_name: clientName, why: 'past scheduled end time, not marked complete' });
    }
  }

  function buildJobLine(j) {
    const c = j.clients ?? {};
    const clientName = [c.first_name, c.last_name].filter(Boolean).join(' ') || 'client';
    const balance = computeUnpaidBalance(jobsByClient[j.client_id] ?? []);
    const isFirstVisit = !(completedCountByClient[j.client_id] > 0);
    const noteOpen = Boolean(j.job_notes) && !j.notes_resolved_at;
    const driveSeconds = j.ai_context?.drive_to?.durationValue;
    return {
      job_id: j.id,
      time: j.scheduled_time,
      client_name: clientName,
      service_name: j.service_name,
      job_notes: noteOpen ? j.job_notes : null,
      drive_minutes: typeof driveSeconds === 'number' && driveSeconds > 0 ? Math.round(driveSeconds / 60) : null,
      tags: c.tags || [],
      pending_note: c.pending_note || null,
      behavioral_flags: c.ai_context?.learned?.behavioral_flags || [],
      unpaid_amount: balance?.amount ?? null,
      unpaid_since: balance?.oldestDate ?? null,
      is_first_visit: isFirstVisit,
    };
  }

  const inputs = {
    ownerName,
    style,
    nowLabel: new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto', dateStyle: 'full', timeStyle: 'short' }),
    todayJobs: (todayJobsRaw || []).map(buildJobLine),
    tomorrowJobs: (tomorrowJobsRaw || []).map(buildJobLine),
    attentionItems,
  };

  const inputsHash = hashInputs(inputs);

  const { data: existingRow, error: existingErr } = await supabase
    .from('ai_briefs')
    .select('content, inputs_hash, model, subject_date, generated_at')
    .eq('business_id', businessId)
    .eq('kind', 'day')
    .eq('subject_id', businessId)
    .maybeSingle();
  if (existingErr) throw new Error(`ai_briefs read failed: ${existingErr.message}`);

  // A day row is only valid for TODAY's date (design doc §3.4) — a stale
  // date must never be treated as a cache hit even if the hash matches.
  const rowIsForToday = Boolean(existingRow) && existingRow.subject_date === today;

  if (rowIsForToday && existingRow.inputs_hash === inputsHash && !force) {
    return res.status(200).json({ brief: existingRow.content, cached: true });
  }

  if (!aiEnabled) {
    if (rowIsForToday) return res.status(200).json({ brief: existingRow.content, cached: true });
    return res.status(503).json({ error: 'AI features are currently turned off.' });
  }

  if (!gemini) {
    console.warn('[day-brief] No GEMINI_API_KEY found.');
    if (rowIsForToday) return res.status(200).json({ brief: existingRow.content, cached: true });
    return res.status(503).json({ error: 'AI is not configured.' });
  }

  const { prompt, maxTokens } = buildDayBriefPrompt(inputs);

  try {
    const content = await generateText(gemini, prompt, maxTokens);
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Gemini did not return valid JSON');
    const parsed = JSON.parse(jsonMatch[0]);
    const brief = {
      summary: typeof parsed.summary === 'string' ? parsed.summary.slice(0, 160) : '',
      items: Array.isArray(parsed.items) ? parsed.items : [],
    };

    const { error: upsertErr } = await supabase
      .from('ai_briefs')
      .upsert({
        business_id: businessId,
        kind: 'day',
        subject_id: businessId,
        subject_date: today,
        content: brief,
        inputs_hash: inputsHash,
        model: GEMINI_MODEL,
        generated_at: new Date().toISOString(),
      }, { onConflict: 'business_id,kind,subject_id' });
    if (upsertErr) throw new Error(`ai_briefs upsert failed: ${upsertErr.message}`);

    return res.status(200).json({ brief, cached: false });
  } catch (e) {
    await logServerError({
      severity: 'warning',
      message: `day-brief generation failed for business ${businessId}: ${e.message}`,
      stack: e.stack,
      context: { businessId },
      businessId,
      alert: false,
    });
    if (rowIsForToday) return res.status(200).json({ brief: existingRow.content, cached: true });
    return res.status(502).json({ error: 'AI feature is unavailable right now. Try again shortly.' });
  }
}

// Not an AI action — see NON_AI_ACTIONS. Sends Joel an email for a just-submitted
// client_requests row and stamps notified_at. The row write itself already
// happened client-side (RLS insert); this is best-effort notification only.
async function notifyRequest(req, res, supabase, auth) {
  const { requestId } = req.body;
  if (!requestId) return res.status(400).json({ error: 'Missing requestId' });

  const { data: row, error: fetchErr } = await supabase
    .from('client_requests')
    .select('id, business_id, kind, title, body, context, created_at, submitted_by')
    .eq('id', requestId)
    .single();
  if (fetchErr || !row) return res.status(404).json({ error: 'Request not found' });
  if (!canAccessBusiness(auth, row.business_id)) {
    return res.status(403).json({ error: 'Forbidden: request not in your business' });
  }

  const [{ data: business }, { data: submitter }] = await Promise.all([
    supabase.from('businesses').select('name').eq('id', row.business_id).single(),
    row.submitted_by
      ? supabase.from('users').select('email, first_name').eq('id', row.submitted_by).single()
      : Promise.resolve({ data: null }),
  ]);

  const createdToronto = new Date(row.created_at).toLocaleString('en-CA', {
    timeZone: 'America/Toronto', dateStyle: 'medium', timeStyle: 'short',
  });
  const kindLabel = row.kind === 'bug' ? 'BUG' : 'IDEA';

  const text = [
    `Kind: ${kindLabel}`,
    `Business: ${business?.name || row.business_id}`,
    `From: ${submitter?.first_name || 'Unknown'} (${submitter?.email || 'no email on file'})`,
    `Submitted: ${createdToronto} (Toronto)`,
    '',
    row.title,
    '',
    row.body,
    '',
    `Context: ${JSON.stringify(row.context || {}, null, 2)}`,
    '',
    "Exported to second-brain on next session start.",
  ].join('\n');

  try {
    await sendMail({
      to: process.env.ALERT_EMAIL || 'jlundie@gmail.com',
      subject: `[Supermom request] ${kindLabel}: ${row.title}`,
      text,
    });
  } catch (e) {
    await logServerError({
      severity: 'error',
      message: `Failed to email client_requests notification for ${requestId}`,
      stack: e.stack,
      context: { requestId },
      businessId: row.business_id,
      alert: true,
    });
    return res.status(502).json({ error: 'Could not send notification email' });
  }

  const { error: stampErr } = await supabase
    .from('client_requests').update({ notified_at: new Date().toISOString() }).eq('id', requestId);
  if (stampErr) throw stampErr;

  return res.status(200).json({ ok: true });
}

async function testPersona(req, res, gemini) {
  if (!gemini) {
    const mockGreetings = {
      professional: "Good morning! Ready to tackle today's schedule efficiently.",
      coach: "You've got this, superstar! Let's make today your best one yet!",
      casual: "Hey there! Ready to head out and do some great work today?",
    };
    return res.status(200).json({ message: mockGreetings[req.body.style || 'professional'] || mockGreetings.professional });
  }

  const { style, ownerName } = req.body;
  const prompt = `You are an AI assistant for ${ownerName || 'a business owner'}.
Write a single, short, quirky 1-sentence greeting using a "${style || 'professional'}" tone to start the day.
Be concise. No intro/outro.`;

  const message = await generateText(gemini, prompt, 100);
  return res.status(200).json({ message });
}

async function statlerTool(req, res, supabase) {
  const { action, args, businessId } = req.body;

  if (!businessId) {
    return res.status(400).json({ error: 'Missing businessId' });
  }

  if (action === 'leave_note_for_joel') {
    const { note } = args || {};
    if (!note) return res.status(400).json({ error: 'Missing note' });
    
    const { error: insertErr } = await supabase
      .from('client_requests')
      .insert({
        business_id: businessId,
        kind: 'idea',
        title: 'Voice Note from Statler',
        body: note,
        context: { source: 'statler' }
      });

    if (insertErr) {
      console.error('[statlerTool] leave_note_for_joel insert failed:', insertErr.message);
      return res.status(500).json({ error: 'Failed to insert note' });
    }
    return res.status(200).json({ result: 'Note successfully left for Joel.' });
  }

  if (action === 'supermom_schedule_job') {
    let { clientName, date, time, description } = args || {};
    if (!clientName || !date) {
      return res.status(400).json({ error: 'Missing clientName or date' });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    }

    if (time && typeof time === 'string') {
      const match = time.toLowerCase().trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)$/);
      if (match) {
        let hour = parseInt(match[1], 10);
        if (hour >= 1 && hour <= 12) {
          const min = match[2] || '00';
          const ampm = match[3].replace(/\./g, '');
          if (ampm === 'pm' && hour < 12) hour += 12;
          if (ampm === 'am' && hour === 12) hour = 0;
          time = `${hour.toString().padStart(2, '0')}:${min}`;
        }
      }
    }

    if (time && !/^\d{2}:\d{2}(:\d{2})?$/.test(time)) {
      return res.status(400).json({ error: 'time must be HH:MM or HH:MM:SS' });
    }

    clientName = clientName.replace(/[^\p{L} \-']/gu, '').trim();
    if (clientName.length < 2) {
      return res.status(400).json({ error: 'clientName unusable' });
    }

    const tokens = clientName.split(/\s+/);
    let clients = [];

    if (tokens.length === 1) {
      const token = tokens[0];
      const { data, error } = await supabase
        .from('clients')
        .select('id, business_id, first_name, last_name')
        .eq('business_id', businessId)
        .or(`first_name.ilike.%${token}%,last_name.ilike.%${token}%`);
        
      if (error) {
        console.error('[statlerTool] single token client query failed:', error.message);
        return res.status(500).json({ error: 'Failed to query clients' });
      }
      clients = data || [];
    } else {
      const firstToken = tokens[0];
      const lastToken = tokens[tokens.length - 1];
      const { data, error } = await supabase
        .from('clients')
        .select('id, business_id, first_name, last_name')
        .eq('business_id', businessId)
        .ilike('first_name', `${firstToken}%`)
        .ilike('last_name', `${lastToken}%`);
        
      if (error) {
        console.error('[statlerTool] multi token client query failed:', error.message);
        return res.status(500).json({ error: 'Failed to query clients' });
      }
      clients = data || [];

      if (clients.length === 0) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('clients')
          .select('id, business_id, first_name, last_name')
          .eq('business_id', businessId)
          .or(`first_name.ilike.%${firstToken}%,last_name.ilike.%${firstToken}%`);
          
        if (fallbackError) {
          console.error('[statlerTool] fallback single token query failed:', fallbackError.message);
          return res.status(500).json({ error: 'Failed to query clients' });
        }
        clients = fallbackData || [];
      }
    }
    
    if (!clients || clients.length === 0) {
      return res.status(404).json({ error: `Client not found for name: ${clientName}` });
    }
    
    if (clients.length > 1) {
      return res.status(200).json({
        result: `${clients.length} clients match — ask the user which one.`,
        total: clients.length,
        candidates: clients.slice(0, 5).map(c => ({ id: c.id, first_name: c.first_name, last_name: c.last_name }))
      });
    }

    const client = clients[0];

    const { data: existingJobs, error: existingErr } = await supabase
      .from('jobs')
      .select('id')
      .eq('business_id', businessId)
      .eq('client_id', client.id)
      .eq('scheduled_date', date)
      .is('deleted_at', null);

    if (existingErr) {
      console.error('[statlerTool] query existing jobs failed:', existingErr.message);
      return res.status(500).json({ error: 'Failed to check existing jobs' });
    }
    if (existingJobs && existingJobs.length > 0) {
      return res.status(200).json({ result: 'A job is already scheduled for this client on this date.', existingJobId: existingJobs[0].id });
    }

    const aiNotes = `⚠️ BOOKED VIA AI VOICE ASSISTANT - verify with client if unexpected.\n\n${description || ''}`;

    const { data: newJob, error: jobErr } = await supabase
      .from('jobs')
      .insert({
        business_id: businessId,
        client_id: client.id,
        scheduled_date: date,
        scheduled_time: time || '12:00:00',
        job_notes: aiNotes.trim(),
        job_status: 'Scheduled',
        service_name: 'Cleaning'
      })
      .select('id')
      .single();

    if (jobErr) {
      console.error('[statlerTool] insert job failed:', jobErr.message);
      return res.status(500).json({ error: 'Failed to insert job' });
    }

    const { error: auditErr } = await supabase
      .from('audit_log')
      .insert({
        business_id: businessId,
        action: 'ai_action',
        entity: 'jobs',
        entity_id: newJob.id,
        new_value: JSON.stringify(args)
      });
    
    if (auditErr) {
      console.error('[statlerTool] Audit log insertion failed:', auditErr.message);
    }

    return res.status(200).json({ result: `Successfully scheduled job for ${clientName} on ${date}. Job ID: ${newJob.id}` });
  }

  return res.status(400).json({ error: `Unknown statler action: ${action}` });
}

// ── router ────────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { action } = req.query;

  let supabase, gemini;
  try {
    ({ supabase, gemini } = initClients());
  } catch (e) {
    console.error('Missing Supabase environment variables');
    return res.status(500).json({ error: e.message });
  }

  if (action === 'statler-tool') {
    const secret = process.env.STATLER_SECRET;
    if (!secret) {
      return res.status(500).json({ error: 'statler tool not configured' });
    }
    const authHeader = req.headers.authorization || '';
    if (authHeader !== `Bearer ${secret}`) {
      return res.status(401).json({ error: 'Unauthorized statler action' });
    }
    return await statlerTool(req, res, supabase);
  }

  // All AI actions run with the service-role key (bypasses RLS) — require a
  // valid Supabase JWT and verify any requested client belongs to the caller.
  const auth = await requireUser(req, supabase);
  if (auth.error) return res.status(auth.error.status).json({ error: auth.error.message });
  if (req.body?.clientId) {
    const ok = await assertClientAccess(supabase, auth, req.body.clientId);
    if (!ok) return res.status(403).json({ error: 'Forbidden: client not in your business' });
  }

  let aiEnabled = true;
  if (!NON_AI_ACTIONS.has(action)) {
    const { data: settings, error: settingsErr } = await supabase.from('app_settings').select('ai_enabled').eq('id', 1).single();
    if (settingsErr) return res.status(500).json({ error: 'Could not check AI settings' });
    aiEnabled = settings.ai_enabled;
    if (!aiEnabled && !KILL_SWITCH_FALLBACK_ACTIONS.has(action)) {
      return res.status(503).json({ error: 'AI features are currently turned off.' });
    }
  }

  try {
    if (action === 'enrich-client') return await enrichClient(req, res, supabase, gemini);
    if (action === 'estimate-duration') return await estimateDuration(req, res, supabase, gemini);
    if (action === 'prep-note') return await prepNote(req, res, supabase, gemini);
    if (action === 'test-persona') return await testPersona(req, res, gemini);
    if (action === 'summarize-carried-note') return await summarizeCarriedNote(req, res, supabase, gemini);
    if (action === 'transcribe-voice-note') return await transcribeVoiceNote(req, res, supabase);
    if (action === 'notify-request') return await notifyRequest(req, res, supabase, auth);
    if (action === 'client-brief') return await clientBrief(req, res, supabase, gemini, aiEnabled);
    if (action === 'day-brief') return await dayBrief(req, res, supabase, gemini, auth, aiEnabled);
    return res.status(404).json({ error: `Unknown AI action: ${action}` });
  } catch (error) {
    console.error(`AI handler error [${action}]:`, error);
    return res.status(502).json({ error: 'AI feature is unavailable right now. Try again shortly.' });
  }
}
