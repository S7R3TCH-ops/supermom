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

  const { clientId, businessProfile } = req.body;

  if (!clientId) {
    return res.status(400).json({ error: 'Missing clientId' });
  }

  try {
    // 1. Fetch Client Details
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('first_name, last_name, client_notes')
      .eq('id', clientId)
      .single();

    if (clientErr || !client) {
      throw new Error('Client not found');
    }

    // 2. Fetch last 5 COMPLETED jobs
    const { data: jobs, error: jobsErr } = await supabase
      .from('jobs')
      .select('scheduled_date, service_name, job_notes')
      .eq('client_id', clientId)
      .eq('job_status', 'Completed')
      .is('deleted_at', null)
      .order('scheduled_date', { ascending: false })
      .order('scheduled_time', { ascending: false })
      .limit(5);

    if (jobsErr) {
      throw new Error('Failed to fetch jobs');
    }

    // 3. Construct Prompt
    const style = businessProfile?.ai_profile?.style || 'professional';
    const clientName = [client.first_name, client.last_name].filter(Boolean).join(' ');
    
    let historyText = jobs.length > 0 
      ? jobs.map(j => `- ${j.scheduled_date}: ${j.service_name}${j.job_notes ? ` (${j.job_notes})` : ''}`).join('\n')
      : 'No previous completed jobs found.';

    const prompt = `You are an AI assistant for Sandra, a busy business owner. 
Your goal is to provide a concise, conversational 3-4 sentence briefing for her upcoming job with ${clientName}.

Client Notes: ${client.client_notes || 'None'}

Recent Job History:
${historyText}

Style Guidance: Use a ${style} tone.

Generate the briefing now. Focus on patterns, preferences, or things she should remember from last time. Keep it to 3-4 sentences.`;

    // 4. Call Claude
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 300,
      messages: [
        { role: 'user', content: prompt }
      ],
    });

    const summary = response.content[0].text;

    return res.status(200).json({ summary });
  } catch (error) {
    console.error('AI Prep Notes Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
