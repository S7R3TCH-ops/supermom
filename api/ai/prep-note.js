import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Robust initialization
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables');
    return res.status(500).json({ error: 'Database configuration missing' });
  }
  if (!anthropicKey) {
    console.error('Missing Anthropic API key');
    return res.status(500).json({ error: 'AI configuration missing' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const anthropic = new Anthropic({ apiKey: anthropicKey });

  const { clientId, businessProfile } = req.body;

  if (!clientId) {
    return res.status(400).json({ error: 'Missing clientId' });
  }

  try {
    console.log(`[prep-note] Generating briefing for client ${clientId}`);
    // 1. Fetch Client Details
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('first_name, last_name, notes, ai_context')
      .eq('id', clientId)
      .single();

    if (clientErr) {
      console.error(`[prep-note] DB Error (client):`, clientErr);
      throw new Error(`Client fetch failed: ${clientErr.message}`);
    }
    if (!client) {
      throw new Error('Client not found');
    }

    // 2. Fetch last 5 COMPLETED jobs
    const { data: jobs, error: jobsErr } = await supabase
      .from('jobs')
      .select('scheduled_date, scheduled_time, service_name, job_notes')
      .eq('client_id', clientId)
      .eq('job_status', 'Completed')
      .is('deleted_at', null)
      .order('scheduled_date', { ascending: false })
      .order('scheduled_time', { ascending: false })
      .limit(5);

    if (jobsErr) {
      console.error(`[prep-note] DB Error (jobs):`, jobsErr);
      throw new Error(`Jobs fetch failed: ${jobsErr.message}`);
    }

    // 3. Construct Prompt
    const style = businessProfile?.ai_profile?.style || 'professional';
    const ownerName = businessProfile?.owner_name || 'the business owner';
    const clientName = [client.first_name, client.last_name].filter(Boolean).join(' ');

    let historyText = jobs.length > 0
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
