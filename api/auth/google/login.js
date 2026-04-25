const { google } = require('googleapis');

export default async function handler(req, res) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    // Note: In production VERCEL_URL is used, in dev localhost:3000 or similar
    // The redirect URI must be registered in Google Cloud Console
    `https://${process.env.VERCEL_URL || 'localhost:3000'}/api/auth/google/callback`
  );

  const scopes = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.readonly'
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Critical for getting a refresh_token
    scope: scopes,
    prompt: 'consent' // Force show consent screen to ensure refresh_token is sent
  });

  res.redirect(url);
}
