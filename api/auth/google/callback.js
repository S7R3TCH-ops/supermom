import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function parseCookies(header) {
  if (!header) return {};
  return Object.fromEntries(
    header.split(';').map(c => {
      const [k, ...v] = c.trim().split('=');
      return [k, v.join('=')];
    })
  );
}

export default async function handler(req, res) {
  const { code, state } = req.query;
  const protocol = process.env.VERCEL_URL ? 'https' : 'http';
  const host = process.env.VERCEL_URL || 'localhost:3000';

  // Verify CSRF nonce
  const cookies = parseCookies(req.headers.cookie);
  const storedNonce = cookies.gcal_oauth_nonce;
  let business_id;
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
    if (!storedNonce || decoded.nonce !== storedNonce) {
      return res.redirect('/settings?error=invalid_state');
    }
    business_id = decoded.business_id;
  } catch {
    return res.redirect('/settings?error=invalid_state');
  }

  // Clear nonce cookie immediately
  res.setHeader('Set-Cookie', 'gcal_oauth_nonce=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/');

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${protocol}://${host}/api/auth/google/callback`
  );

  try {
    const { tokens } = await oauth2Client.getToken(code);
    const { refresh_token } = tokens;

    if (!refresh_token) {
      return res.redirect('/settings?error=no_refresh_token');
    }

    const { error } = await supabase.from('integrations').upsert({
      business_id,
      service_name: 'google_calendar',
      refresh_token,
      calendar_id: 'primary',
    }, { onConflict: 'business_id, service_name' });

    if (error) throw error;

    res.redirect('/settings?sync=success');
  } catch (err) {
    console.error('GCal Callback Error:', err);
    res.redirect(`/settings?error=${encodeURIComponent(err.message)}`);
  }
}
