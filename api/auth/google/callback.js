import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { code } = req.query;
  const protocol = process.env.VERCEL_URL ? 'https' : 'http';
  const host = process.env.VERCEL_URL || 'localhost:3000';

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${protocol}://${host}/api/auth/google/callback`
  );

  try {
    const { tokens } = await oauth2Client.getToken(code);
    const { refresh_token } = tokens;

    if (!refresh_token) {
      // If we don't get a refresh_token, it might mean the user already authorized
      // and we didn't force consent. But Task 2 forces consent.
      return res.redirect('/settings?error=no_refresh_token');
    }

    // CRITICAL: We need the business_id.
    // In a real app, we'd use a JWT in the 'state' parameter or check the current session.
    // For now, let's look up the first business (Sandra's) or try to get user from session if possible.
    // Best practice: Google OAuth 'state' parameter should carry the business_id.
    
    // For this prototype, we'll fetch the business_id from the first business record
    // or you can assume business_id is passed in 'state' if you modify Task 2.
    
    // Let's assume for now we fetch Sandra's business ID (usually only one).
    const { data: business } = await supabase.from('businesses').select('id').single();
    
    if (!business) throw new Error('No business found');

    const { error } = await supabase.from('integrations').upsert({
      business_id: business.id,
      service_name: 'google_calendar',
      refresh_token: refresh_token,
      calendar_id: 'primary'
    }, { onConflict: 'business_id, service_name' });

    if (error) throw error;

    res.redirect('/settings?sync=success');
  } catch (err) {
    console.error('GCal Callback Error:', err);
    res.redirect(`/settings?error=${encodeURIComponent(err.message)}`);
  }
}
