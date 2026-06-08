import { createClient } from '@supabase/supabase-js';
import { buildInvoicePdfBuffer } from './_lib/invoicePdf.js';
import { decorateInvoiceWithBalances } from '../src/lib/invoiceBalances.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  const sb = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  const { data: invoice, error } = await sb
    .from('invoices')
    .select('*, clients(*), businesses(*), invoice_jobs(job_id, jobs(*))')
    .eq('id', id)
    .single();

  if (error || !invoice) return res.status(404).json({ error: 'Invoice not found' });

  const lastName = invoice.clients?.last_name || 'Client';
  const invoiceNumber = invoice.invoice_number || 'Invoice';
  const filename = `${lastName}_Invoice_${invoiceNumber}.pdf`;

  try {
    const decorated = await decorateInvoiceWithBalances(sb, invoice);
    const pdfBuffer = await buildInvoicePdfBuffer(decorated);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error('[download-invoice] PDF generation failed:', err);
    return res.status(500).json({ error: 'Failed to generate PDF' });
  }
}
