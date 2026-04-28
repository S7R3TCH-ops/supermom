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

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // --- MOCK FALLBACK MODE ---
  if (!anthropicKey) {
    console.warn('[estimate-duration] No ANTHROPIC_API_KEY found. Using local fallback.');
    const { clientId, serviceName } = req.body;
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

  const anthropic = new Anthropic({ apiKey: anthropicKey });

  const { clientId, serviceName, businessProfile } = req.body;

  if (!clientId || !serviceName) {
    return res.status(400).json({ error: 'Missing clientId or serviceName' });
  }

  try {
    // 1. Fetch Client Details
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('first_name, last_name, notes, ai_context, tags')
      .eq('id', clientId)
      .single();

    if (clientErr || !client) {
      throw new Error('Client not found');
    }

    // 2. Fetch last 5 COMPLETED jobs for this service
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

    if (jobsErr) {
      throw new Error('Failed to fetch jobs');
    }

    // 3. Construct Prompt
    const style = businessProfile?.ai_profile?.style || 'professional';
    const ownerName = businessProfile?.owner_name || 'the business owner';
    const clientName = [client.first_name, client.last_name].filter(Boolean).join(' ');

    const learnedPattern = client.ai_context?.learned?.duration_patterns?.[serviceName];
    const patternBlock = learnedPattern
      ? `\nLearned: avg actual ${learnedPattern.avg_actual_minutes} min, estimate ratio ${learnedPattern.avg_estimate_ratio?.toFixed(2)} over ${learnedPattern.sample_size} jobs. Weight this heavily.`
      : '';

    let historyText = jobs.length > 0
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

    // 4. Call Claude
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 300,
      messages: [
        { role: 'user', content: prompt }
      ],
    });

    const content = response.content[0].text;
    
    // Attempt to extract JSON if Claude wraps it in markdown blocks
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const result = JSON.parse(jsonMatch ? jsonMatch[0] : content);

    return res.status(200).json(result);
  } catch (error) {
    console.error('AI Duration Estimator Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
