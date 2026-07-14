import { createClient } from '@supabase/supabase-js';

const SUPER_ADMIN_EMAILS = ['jlundie@gmail.com', 'joel@supermomforhire.com'];

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Database configuration missing' });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });

  const token = authHeader.replace('Bearer ', '');

  try {
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user || !SUPER_ADMIN_EMAILS.includes(user.email)) {
      return res.status(403).json({ error: 'Forbidden: Only Super Admins can manage AI settings.' });
    }

    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin.from('app_settings').select('ai_enabled').eq('id', 1).single();
      if (error) throw new Error(`Failed to read AI setting: ${error.message}`);
      return res.status(200).json({ ai_enabled: data.ai_enabled });
    }

    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'Missing or invalid "enabled" boolean' });
    }
    const { error: updErr } = await supabaseAdmin.from('app_settings').update({ ai_enabled: enabled }).eq('id', 1);
    if (updErr) throw new Error(`Failed to update AI setting: ${updErr.message}`);
    return res.status(200).json({ ai_enabled: enabled });
  } catch (error) {
    console.error('AI Toggle Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
