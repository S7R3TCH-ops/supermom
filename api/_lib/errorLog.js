// Best-effort server error capture into public.error_logs (see
// supabase/migrations/20260710010000_add_error_logs.sql), with an optional
// email alert for failures nobody would otherwise notice (e.g. the daily
// briefing cron — nothing watches its response body).

import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const ALERT_EMAIL = process.env.ALERT_EMAIL || 'jlundie@gmail.com';

function makeServiceClient() {
  return createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

/**
 * @param {object} params
 * @param {string} [params.severity]
 * @param {string} params.message
 * @param {string|null} [params.stack]
 * @param {object|null} [params.context]
 * @param {string|null} [params.businessId]
 * @param {boolean} [params.alert]
 */
export async function logServerError({
  severity = 'error',
  message,
  stack = null,
  context = null,
  businessId = null,
  alert = false,
}) {
  try {
    const sb = makeServiceClient();
    await sb.from('error_logs').insert({
      business_id: businessId,
      source: 'server',
      severity,
      message: String(message).slice(0, 2000),
      stack: stack ? String(stack).slice(0, 4000) : null,
      context,
    });
  } catch (err) {
    console.error('[errorLog] Failed to write error_logs row:', err);
  }

  if (!alert) return;

  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  if (!gmailUser || !gmailPass) return;

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
    });
    await transporter.sendMail({
      from: `"Supermom Alerts" <${gmailUser}>`,
      to: ALERT_EMAIL,
      subject: `[Supermom] ${severity.toUpperCase()}: ${String(message).slice(0, 150)}`,
      text: `${message}\n\nContext: ${JSON.stringify(context ?? {}, null, 2)}\n\nStack:\n${stack || '(none)'}`,
    });
  } catch (mailErr) {
    console.error('[errorLog] Failed to send alert email:', mailErr);
  }
}
