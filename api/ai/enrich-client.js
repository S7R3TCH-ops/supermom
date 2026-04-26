import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { clientId } = req.body;
  if (!clientId) return res.status(400).json({ error: 'Missing clientId' });

  try {
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('id, ai_context')
      .eq('id', clientId)
      .single();
    if (clientErr || !client) return res.status(404).json({ error: 'Client not found' });

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
      if (hoursSince < 24 && newJobs < 3) {
        return res.status(200).json({ skipped: 'too_soon' });
      }
    }

    // Compute duration patterns per service in pure JS — no AI for numbers
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

    const prompt = `You are helping Sandra learn client patterns. Pre-computed stats:
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
  } catch (error) {
    console.error('Enrich client error:', error);
    return res.status(500).json({ error: error.message });
  }
}
