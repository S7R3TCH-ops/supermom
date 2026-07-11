import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
import { buildInvoicePdfBuffer } from './_lib/invoicePdf.js';
import { requireUser, canAccessBusiness } from './_lib/authGuard.js';
import { decorateInvoiceWithBalances } from '../src/lib/invoiceBalances.js';
import { logServerError } from './_lib/errorLog.js';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function brandedEmailHtml({ clientName, bizName, bizEmail, invoiceNumber, isReceipt }) {
  clientName   = escapeHtml(clientName);
  bizName      = escapeHtml(bizName);
  bizEmail     = escapeHtml(bizEmail);
  invoiceNumber = escapeHtml(invoiceNumber);
  const pink  = '#FC4693';
  const green = '#16A34A';
  const cream = '#FFF9F5';
  const docLabel = isReceipt ? 'Receipt' : 'Invoice';
  const headerColor = isReceipt ? green : pink;
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

        <!-- Header -->
        <tr><td style="background:${headerColor};padding:28px 32px;text-align:center;">
          <img src="https://supermom-v2.vercel.app/branding/logo-final.png" alt="${bizName}" height="80" style="display:block;margin:0 auto 12px;" />
          <div style="color:white;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;opacity:.85;">${docLabel}</div>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px;">
          <p style="margin:0 0 20px;font-size:15px;color:#1a1a1a;">Hi ${clientName || 'there'},</p>
          <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.6;">
            ${isReceipt
              ? `Please find your receipt #${invoiceNumber} from <strong>${bizName}</strong> attached. Your payment has been received in full — thank you!`
              : `Please find your invoice #${invoiceNumber} from <strong>${bizName}</strong> attached to this email as a PDF.`
            }
          </p>

          <!-- Doc # callout -->
          <div style="background:${cream};border:1.5px solid ${isReceipt ? '#BBF7D0' : '#FFD6E8'};border-radius:12px;padding:16px 20px;margin-bottom:28px;">
            <div style="font-size:10px;font-weight:700;color:#aaa;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">${docLabel} Number</div>
            <div style="font-size:18px;font-weight:600;color:#1a1a1a;">#${invoiceNumber}</div>
          </div>

          ${isReceipt ? `
          <!-- Paid confirmation -->
          <div style="border-top:1px solid #eee;padding-top:20px;">
            <p style="margin:0;font-size:13px;color:#16A34A;font-weight:600;">✓ Paid in Full</p>
          </div>
          ` : `
          <!-- Payment note -->
          <div style="border-top:1px solid #eee;padding-top:20px;">
            <div style="font-size:10px;font-weight:700;color:#aaa;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">Payment</div>
            <p style="margin:0;font-size:13px;color:#555;line-height:1.7;">
              e-Transfer to <strong>${bizEmail || 'sandra@supermomforhire.com'}</strong><br>
              <span style="color:#888;">Reference: Invoice #${invoiceNumber}</span>
            </p>
          </div>
          `}
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#fafafa;border-top:1px solid #eee;padding:20px 32px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#aaa;">${bizName} · Georgetown, ON</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function makeSupabase() {
  return createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

async function handleDownload(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  const sb = makeSupabase();
  const { data: invoice, error } = await sb
    .from('invoices')
    .select('*, clients(*), businesses(*), invoice_jobs(job_id, jobs(*))')
    .eq('id', id)
    .single();

  if (error || !invoice) return res.status(404).json({ error: 'Invoice not found' });

  const lastName = invoice.clients?.last_name || 'Client';
  const invoiceNumber = invoice.invoice_number || 'Invoice';

  try {
    const decorated = await decorateInvoiceWithBalances(sb, invoice);
    const label = decorated.isPaidInFull ? 'Receipt' : 'Invoice';
    const filename = `${lastName}_${label}_${invoiceNumber}.pdf`;
    const pdfBuffer = await buildInvoicePdfBuffer(decorated);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error('[invoice/download] PDF generation failed:', err);
    return res.status(500).json({ error: 'Failed to generate PDF' });
  }
}

// Public JSON read for the /i/:id invoice page (id is the sole input, like the
// PDF download). Reads via service role so the browser needs NO anon RLS
// access to invoices/clients/businesses/jobs — closes the SEC-1 exposure where
// the anon key's policy scope was unverified and load-bearing.
async function handleJsonRead(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  const sb = makeSupabase();
  const { data: invoice, error } = await sb
    .from('invoices')
    .select('*, clients(*), businesses(*), invoice_jobs(job_id, jobs(*))')
    .eq('id', id)
    .single();
  if (error || !invoice) return res.status(404).json({ error: 'Invoice not found' });

  try {
    const decorated = await decorateInvoiceWithBalances(sb, invoice);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(decorated);
  } catch (err) {
    console.error('[invoice/json] decoration failed:', err);
    return res.status(500).json({ error: 'Failed to load invoice' });
  }
}

async function handleEmail(req, res) {
  const { invoiceId, clientEmail, clientName, clientLastName, invoiceNumber, bizName, bizEmail } = req.body;

  if (!clientEmail || !invoiceId || !invoiceNumber) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const sb = makeSupabase();

  // Sending email + flipping invoice_sent_at/receipt_sent_at is side-effecting:
  // only the invoice's own business (or a super admin) may trigger it.
  // GET download stays public — shareable-by-design.
  const auth = await requireUser(req, sb);
  if (auth.error) return res.status(auth.error.status).json({ error: auth.error.message });

  const { data: invoiceData } = await sb
    .from('invoices')
    .select('*, clients(*), businesses(*), invoice_jobs(job_id, jobs(*))')
    .eq('id', invoiceId)
    .single();
  if (!invoiceData) return res.status(404).json({ error: 'Invoice not found' });
  if (!canAccessBusiness(auth, invoiceData.business_id)) {
    return res.status(403).json({ error: 'Forbidden: invoice not in your business' });
  }

  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;

  if (!gmailUser || !gmailPass) {
    console.warn('[invoice/email] Gmail credentials not configured — email not sent');
    return res.status(200).json({ ok: true, mock: true });
  }

  let pdfBuffer = null;
  let isReceipt = false;
  let jobIds    = [];
  if (invoiceData) {
    try {
      const decorated = await decorateInvoiceWithBalances(sb, invoiceData);
      isReceipt = !!decorated.isPaidInFull;
      jobIds    = (invoiceData.invoice_jobs ?? []).map(ij => ij.job_id).filter(Boolean);
      pdfBuffer = await buildInvoicePdfBuffer(decorated);
    } catch (err) {
      console.error('[invoice/email] PDF generation failed:', err);
    }
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailUser, pass: gmailPass },
  });

  const fromAddress = 'invoice@supermomforhire.com';
  const docLabel = isReceipt ? 'Receipt' : 'Invoice';

  try {
    await transporter.sendMail({
      from: `"${bizName || 'Supermom for Hire'}" <${fromAddress}>`,
      replyTo: fromAddress,
      to: clientEmail,
      subject: `${docLabel} #${invoiceNumber} from ${bizName || 'Supermom for Hire'}`,
      html: brandedEmailHtml({ clientName, bizName, bizEmail, invoiceNumber, isReceipt }),
      attachments: pdfBuffer ? [{
        filename: `${clientLastName || 'Client'}_${docLabel}_${invoiceNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      }] : [],
    });

    if (jobIds.length) {
      const sentField = isReceipt ? 'receipt_sent_at' : 'invoice_sent_at';
      await sb.from('jobs').update({ [sentField]: new Date().toISOString() })
        .in('id', jobIds)
        .eq('business_id', invoiceData.business_id);
    }

    return res.status(200).json({ ok: true, isReceipt });
  } catch (err) {
    console.error('[invoice/email] Send error:', err);
    await logServerError({
      severity: 'error',
      message: `Invoice email send failed for invoice ${invoiceNumber}`,
      stack: err.stack,
      context: { invoiceId, invoiceNumber, clientEmail },
      businessId: invoiceData.business_id,
      alert: true,
    });
    return res.status(500).json({ error: err.message });
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return req.query.format === 'json' ? handleJsonRead(req, res) : handleDownload(req, res);
  }
  if (req.method === 'POST') return handleEmail(req, res);
  return res.status(405).end();
}
