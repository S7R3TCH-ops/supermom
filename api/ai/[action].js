import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

function initClients() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Database configuration missing');
  }
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const anthropic = anthropicKey ? new Anthropic({ apiKey: anthropicKey }) : null;
  return { supabase, anthropic, anthropicKey };
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

async function enrichClient(req, res, supabase, anthropic) {
  if (!anthropic) {
    console.warn('[enrich-client] No ANTHROPIC_API_KEY found. Skipping background synthesis.');
    return res.status(200).json({ ok: true, skipped: 'no_api_key' });
  }

  const { clientId } = req.body;
  if (!clientId) return res.status(400).json({ error: 'Missing clientId' });

  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id, business_id, ai_context')
    .eq('id', clientId)
    .single();
  if (clientErr || !client) return res.status(404).json({ error: 'Client not found' });

  const { data: business } = await supabase
    .from('businesses')
    .select('owner_name')
    .eq('id', client.business_id)
    .single();
  const ownerName = business?.owner_name || 'the business owner';

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

  const prompt = `You are helping ${ownerName} learn client patterns. Pre-computed stats:
- Jobs completed: ${jobCount}
- Duration patterns: ${JSON.stringify(duration_patterns)}
- Payment preference: ${payment_method_preference || 'unknown'}
- Preferred time: ${preferred_time_of_day || 'unknown'}, day: ${preferred_day_of_week || 'unknown'}

Last 5 jobs:
${last5}

Current note: "${existing.synthesis_note || ''}"
Current flags: ${JSON.stringify(existing.behavioral_flags || [])}

Return ONLY valid JSON (no markdown):
{"synthesis_note":"2-3 sentences about patterns useful before a visit.","behavioral_flags":["snake_case","max_4_words","max_4_items"]}`;

  const response = await anthropic.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 150,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0].text;
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Claude did not return valid JSON');
  const claudeResult = JSON.parse(jsonMatch[0]);

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
          behavioral_flags: claudeResult.behavioral_flags || [],
          synthesis_note: claudeResult.synthesis_note || '',
        },
      },
    })
    .eq('id', clientId);

  return res.status(200).json({ ok: true });
}

async function estimateDuration(req, res, supabase, anthropic) {
  const { clientId, serviceName, businessProfile } = req.body;
  if (!clientId || !serviceName) return res.status(400).json({ error: 'Missing clientId or serviceName' });

  if (!anthropic) {
    console.warn('[estimate-duration] No ANTHROPIC_API_KEY found. Using local fallback.');
    try {
      const { data: jobs } = await supabase.from('jobs').select('actual_duration').eq('client_id', clientId).eq('service_name', serviceName).eq('job_status', 'Completed').not('actual_duration', 'is', null).limit(3);
      let estimate = 120;
      let reason = 'Based on default service duration.';
      if (jobs?.length > 0) {
        const avg = jobs.reduce((s, j) => s + Number(j.actual_duration), 0) / jobs.length;
        estimate = Math.round(avg * 60);
        reason = `Based on average of last ${jobs.length} similar jobs.`;
      }
      return res.status(200).json({ estimate, reason, isMock: true });
    } catch (e) {
      return res.status(200).json({ estimate: 120, reason: 'Fallback default.', isMock: true });
    }
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

  const response = await anthropic.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0].text;
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  const result = JSON.parse(jsonMatch ? jsonMatch[0] : content);
  return res.status(200).json(result);
}

async function prepNote(req, res, supabase, anthropic) {
  const { clientId, businessProfile } = req.body;
  if (!clientId) return res.status(400).json({ error: 'Missing clientId' });

  if (!anthropic) {
    console.warn('[prep-note] No ANTHROPIC_API_KEY found. Using simulated briefing fallback.');
    try {
      const { data: client } = await supabase.from('clients').select('first_name, notes, ai_context').eq('id', clientId).single();
      const { data: jobs } = await supabase.from('jobs').select('service_name, scheduled_date').eq('client_id', clientId).eq('job_status', 'Completed').limit(3);
      const name = client?.first_name || 'Client';
      const lastJob = jobs?.[0];
      const prefs = client?.ai_context?.prefs || client?.notes || 'no special requests';
      const summary = `[Simulated] ${name} usually prefers a ${client?.ai_context?.style || 'professional'} approach. ${lastJob ? `Last time you handled a ${lastJob.service_name} for them on ${lastJob.scheduled_date}.` : 'This is a relatively new client relationship.'} Keep an eye out for their preference regarding ${prefs.toLowerCase().slice(0, 50)}...`;
      return res.status(200).json({ summary, isMock: true });
    } catch (e) {
      return res.status(200).json({ summary: "Ready to help with your next session. Remember to check the client's specific preferences in their profile.", isMock: true });
    }
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
    .select('scheduled_date, scheduled_time, service_name, job_notes')
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
    ? jobs.map(j => `- ${j.scheduled_date}: ${j.service_name}${j.job_notes ? ` (${j.job_notes})` : ''}`).join('\n')
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

  const response = await anthropic.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  });

  return res.status(200).json({ summary: response.content[0].text });
}

async function transcribeVoiceNote(req, res, supabase) {
  const { filePath } = req.body;
  if (!filePath) return res.status(400).json({ error: 'Missing filePath' });
  // TODO: download from job-assets bucket → OpenAI Whisper → return transcript
  return res.json({ transcript: '', note: 'transcription not yet implemented' });
}

async function testPersona(req, res, anthropic) {
  if (!anthropic) {
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

  const response = await anthropic.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 100,
    messages: [{ role: 'user', content: prompt }],
  });

  return res.status(200).json({ message: response.content[0].text });
}

// ── router ────────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { action } = req.query;

  let supabase, anthropic;
  try {
    ({ supabase, anthropic } = initClients());
  } catch (e) {
    console.error('Missing Supabase environment variables');
    return res.status(500).json({ error: e.message });
  }

  try {
    if (action === 'enrich-client') return await enrichClient(req, res, supabase, anthropic);
    if (action === 'estimate-duration') return await estimateDuration(req, res, supabase, anthropic);
    if (action === 'prep-note') return await prepNote(req, res, supabase, anthropic);
    if (action === 'test-persona') return await testPersona(req, res, anthropic);
    if (action === 'transcribe-voice-note') return await transcribeVoiceNote(req, res, supabase);
    return res.status(404).json({ error: `Unknown AI action: ${action}` });
  } catch (error) {
    console.error(`AI handler error [${action}]:`, error);
    return res.status(500).json({ error: error.message });
  }
}
