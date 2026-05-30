import nodemailer from 'nodemailer';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function brandedEmailHtml({ clientName, bizName, bizEmail, invoiceNumber, invoiceUrl }) {
  clientName   = escapeHtml(clientName);
  bizName      = escapeHtml(bizName);
  bizEmail     = escapeHtml(bizEmail);
  invoiceNumber = escapeHtml(invoiceNumber);
  // invoiceUrl is server-generated (not from req.body) — no escaping needed
  const pink = '#E91E6A';
  const cream = '#FFF9F5';
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

        <!-- Header -->
        <tr><td style="background:${pink};padding:28px 32px;text-align:center;">
          <img src="https://supermom-v2.vercel.app/branding/logo-final.png" alt="${bizName}" height="80" style="display:block;margin:0 auto 12px;" />
          <div style="color:white;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;opacity:.85;">Invoice</div>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px;">
          <p style="margin:0 0 20px;font-size:15px;color:#1a1a1a;">Hi ${clientName || 'there'},</p>
          <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.6;">
            Please find your invoice #${invoiceNumber} from <strong>${bizName}</strong> attached below.
            You can view the full invoice by clicking the button below.
          </p>

          <!-- Invoice # callout -->
          <div style="background:${cream};border:1.5px solid #FFD6E8;border-radius:12px;padding:16px 20px;margin-bottom:28px;">
            <div style="font-size:10px;font-weight:700;color:#aaa;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Invoice Number</div>
            <div style="font-size:18px;font-weight:600;color:#1a1a1a;">#${invoiceNumber}</div>
          </div>

          <!-- CTA button -->
          <div style="text-align:center;margin-bottom:28px;">
            <a href="${invoiceUrl}" style="display:inline-block;background:${pink};color:white;text-decoration:none;font-size:14px;font-weight:700;padding:14px 32px;border-radius:10px;letter-spacing:0.3px;">
              View Invoice
            </a>
          </div>

          <!-- Payment note -->
          <div style="border-top:1px solid #eee;padding-top:20px;">
            <div style="font-size:10px;font-weight:700;color:#aaa;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">Payment</div>
            <p style="margin:0;font-size:13px;color:#555;line-height:1.7;">
              e-Transfer to <strong>${bizEmail || 'sandra@supermom.com'}</strong><br>
              <span style="color:#888;">Reference: Invoice #${invoiceNumber}</span>
            </p>
          </div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#fafafa;border-top:1px solid #eee;padding:20px 32px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#aaa;">${bizName} · Georgetown, ON</p>
          <p style="margin:6px 0 0;font-size:12px;color:#ccc;">
            <a href="${invoiceUrl}" style="color:#ccc;">View online</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { invoiceId, clientEmail, clientName, invoiceNumber, bizName, bizEmail } = req.body;

  if (!clientEmail || !invoiceId || !invoiceNumber) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;

  if (!gmailUser || !gmailPass) {
    console.warn('[email-invoice] Gmail credentials not configured — email not sent');
    // Return success in dev so the UI flow can be tested without real creds
    return res.status(200).json({ ok: true, mock: true });
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailUser, pass: gmailPass },
  });

  const appBase = process.env.APP_BASE_URL || 'https://supermom-v2.vercel.app';
  const invoiceUrl = `${appBase}/i/${invoiceId}`;

  try {
    await transporter.sendMail({
      from: `"${bizName || 'Supermom for Hire'}" <${gmailUser}>`,
      to: clientEmail,
      subject: `Invoice #${invoiceNumber} from ${bizName || 'Supermom for Hire'}`,
      html: brandedEmailHtml({ clientName, bizName, bizEmail, invoiceNumber, invoiceUrl }),
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[email-invoice] Send error:', err);
    return res.status(500).json({ error: err.message });
  }
}
