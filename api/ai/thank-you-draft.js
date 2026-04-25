import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { jobId } = req.body;

  if (!jobId) {
    return res.status(400).json({ error: 'Missing jobId' });
  }

  try {
    const { data: job, error: jobErr } = await supabase
      .from('jobs')
      .select('service_name, total_amount, flat_rate, scheduled_date, job_notes, client_id')
      .eq('id', jobId)
      .single();

    if (jobErr || !job) throw new Error('Job not found');

    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('first_name, last_name, phone')
      .eq('id', job.client_id)
      .single();

    if (clientErr || !client) throw new Error('Client not found');

    const clientFirstName = client.first_name || 'there';
    const amount = Number(job.total_amount ?? job.flat_rate ?? 0).toFixed(0);

    const prompt = `Write a warm, brief thank-you text from Sandra (owner of Supermom for Hire, a personal-life-operations business) to her client ${clientFirstName} after completing a ${job.service_name} job today worth $${amount}.

2–3 sentences. Friendly and personal. No emojis. Sign off as "Sandra".${job.job_notes ? `\n\nJob notes for context: ${job.job_notes}` : ''}`;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });

    const draft = response.content[0].text.trim();

    return res.status(200).json({ draft, phone: client.phone || '', clientFirstName });
  } catch (error) {
    console.error('Thank-you draft error:', error);
    return res.status(500).json({ error: error.message });
  }
}
