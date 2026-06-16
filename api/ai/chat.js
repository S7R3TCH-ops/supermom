import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { messages, businessId, clientId, jobId } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Missing messages array' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Database configuration missing' });
  }
  if (!anthropicKey) {
    return res.status(503).json({ error: 'AI service not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const anthropic = new Anthropic({ apiKey: anthropicKey });

  const systemParts = [
    'You are an AI operations assistant for "Supermom for Hire", a personal-life-operations business in Georgetown, ON.',
    'Services: home organizing, decluttering, caregiving, life coaching, errands.',
    'Help the owner manage scheduling, clients, invoicing, and daily decisions.',
    'Tone: warm, direct, capable — like a brilliant operations partner. Be concise. No fluff. Real answers.',
  ];

  if (businessId) {
    const { data: biz } = await supabase
      .from('businesses')
      .select('owner_name, ai_profile')
      .eq('id', businessId)
      .single();
    if (biz?.owner_name) systemParts.push(`Owner: ${biz.owner_name}.`);
    if (biz?.ai_profile?.style) systemParts.push(`Preferred style: ${biz.ai_profile.style}.`);
  }

  if (clientId) {
    const { data: client } = await supabase
      .from('clients')
      .select('first_name, last_name, notes, ai_context, tags')
      .eq('id', clientId)
      .single();
    if (client) {
      const name = [client.first_name, client.last_name].filter(Boolean).join(' ');
      systemParts.push(`Client context: ${name}.`);
      if (client.notes) systemParts.push(`Client notes: ${client.notes}`);
      const synthesis = client.ai_context?.learned?.synthesis_note;
      if (synthesis) systemParts.push(`Learned patterns: ${synthesis}`);
    }
  }

  if (jobId) {
    const { data: job } = await supabase
      .from('jobs')
      .select('service_name, scheduled_date, job_status, job_notes')
      .eq('id', jobId)
      .single();
    if (job) {
      systemParts.push(`Job context: ${job.service_name} on ${job.scheduled_date}, status: ${job.job_status}.`);
      if (job.job_notes) systemParts.push(`Job notes: ${job.job_notes}`);
    }
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: systemParts.join('\n'),
      messages: messages.slice(-20),
    });
    return res.status(200).json({ reply: response.content[0].text });
  } catch (err) {
    console.error('[ai/chat] Anthropic error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
