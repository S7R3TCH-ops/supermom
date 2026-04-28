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
  const { jobId, type = 'thank-you', businessProfile } = req.body;

  if (!jobId) {
    return res.status(400).json({ error: 'Missing jobId' });
  }

  // --- MOCK FALLBACK MODE ---
  if (!anthropicKey) {
    console.warn('[thank-you-draft] No ANTHROPIC_API_KEY found. Using local fallback.');
    try {
      const { data: job } = await supabase.from('jobs').select('service_name, total_amount, client_id').eq('id', jobId).single();
      const { data: client } = await supabase.from('clients').select('first_name, phone, email').eq('id', job.client_id).single();
      const name = client?.first_name || 'there';
      const amount = Number(job?.total_amount || 0).toFixed(0);
      
      const draft = type === 'receipt' 
        ? `Hi ${name}, thanks again for today! I've received your payment of $${amount} for the ${job?.service_name}. See you next time! - ${businessProfile?.owner_name || 'Sandra'}`
        : `Hi ${name}, just wanted to say thanks for having me over for the ${job?.service_name} today! Hope you're loving the results. - ${businessProfile?.owner_name || 'Sandra'}`;
      
      return res.status(200).json({ draft, phone: client?.phone || '', email: client?.email || '', clientFirstName: name, isMock: true });
    } catch (e) {
      return res.status(200).json({ draft: "Thanks for the job today!", isMock: true });
    }
  }

  const anthropic = new Anthropic({ apiKey: anthropicKey });

  try {
    const { data: job, error: jobErr } = await supabase
      .from('jobs')
      .select('service_name, total_amount, flat_rate, scheduled_date, job_notes, client_id')
      .eq('id', jobId)
      .single();

    if (jobErr || !job) throw new Error('Job not found');

    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('first_name, last_name, phone, email')
      .eq('id', job.client_id)
      .single();

    if (clientErr || !client) throw new Error('Client not found');

    const clientFirstName = client.first_name || 'there';
    const amount = Number(job.total_amount ?? job.flat_rate ?? 0).toFixed(0);
    const style = businessProfile?.ai_profile?.style || 'professional';
    const ownerName = businessProfile?.owner_name || 'the business owner';
    const bizName = businessProfile?.name || 'Supermom for Hire';

    // Check for invoice
    const { data: invLink } = await supabase
      .from('invoice_jobs')
      .select('invoice_id')
      .eq('job_id', jobId)
      .maybeSingle();

    const origin = req.headers.origin || 'https://supermom-v2.vercel.app';
    const invoiceUrl = invLink ? `${origin}/i/${invLink.invoice_id}` : null;

    let prompt = '';
    if (type === 'receipt') {
      prompt = `Write a very brief, friendly text message receipt in a ${style} tone from ${ownerName} (owner of ${bizName}) to her client ${clientFirstName}. 
It must acknowledge receipt of $${amount} for the ${job.service_name} job completed on ${job.scheduled_date}. 
Keep it to 2 sentences. No emojis. Sign off as "${ownerName}".${invoiceUrl ? `\n\nAppend this link to the end: ${invoiceUrl}` : ''}`;
    } else {
      prompt = `Write a warm, brief thank-you text in a ${style} tone from ${ownerName} (owner of ${bizName}) to her client ${clientFirstName} after completing a ${job.service_name} job today worth $${amount}.
2–3 sentences. Friendly and personal. No emojis. Sign off as "${ownerName}".${job.job_notes ? `\n\nJob notes for context: ${job.job_notes}` : ''}${invoiceUrl ? `\n\nAppend this link to the end: ${invoiceUrl}` : ''}`;
    }

    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });

    const draft = response.content[0].text.trim();

    return res.status(200).json({ draft, phone: client.phone || '', email: client.email || '', clientFirstName });
  } catch (error) {
    console.error('Thank-you draft error:', error);
    return res.status(500).json({ error: error.message });
  }
}
