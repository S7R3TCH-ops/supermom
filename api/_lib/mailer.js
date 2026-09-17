// Shared Gmail transport for new server-side email sends. Does NOT replace the
// three existing copy-pasted nodemailer blocks (errorLog.js, daily.js,
// invoice.ts) — those are left alone per the request-pipeline design doc;
// this is for new code only.

import nodemailer from 'nodemailer';

/**
 * @param {object} params
 * @param {string} params.to
 * @param {string} params.subject
 * @param {string} params.text
 * @param {string} [params.html]
 * @throws if GMAIL_USER/GMAIL_APP_PASSWORD are missing or the send fails.
 */
export async function sendMail({ to, subject, text, html }) {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  if (!gmailUser || !gmailPass) {
    throw new Error('Gmail credentials not configured (GMAIL_USER/GMAIL_APP_PASSWORD)');
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailUser, pass: gmailPass },
  });

  await transporter.sendMail({
    from: `"Supermom Alerts" <${gmailUser}>`,
    to,
    subject,
    text,
    ...(html ? { html } : {}),
  });
}
