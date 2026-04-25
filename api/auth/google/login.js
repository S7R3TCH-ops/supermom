import { google } from 'googleapis';
import crypto from 'crypto';

export default async function handler(req, res) {
  const { business_id } = req.query;
  if (!business_id) return res.redirect('/settings?error=missing_business_id');

  const protocol = process.env.VERCEL_URL ? 'https' : 'http';
  const host = process.env.VERCEL_URL || 'localhost:3000';

  const nonce = crypto.randomBytes(16).toString('hex');
  const state = Buffer.from(JSON.stringify({ nonce, business_id })).toString('base64url');
  const secure = process.env.VERCEL_URL ? '; Secure' : '';
  res.setHeader('Set-Cookie', `gcal_oauth_nonce=${nonce}; HttpOnly; SameSite=Lax; Max-Age=600; Path=/${secure}`);

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${protocol}://${host}/api/auth/google/callback`
  );

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly',
    ],
    prompt: 'consent',
    state,
  });

  res.redirect(url);
}
