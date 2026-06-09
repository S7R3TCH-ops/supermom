import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import { computeJobFinancials } from '../../src/lib/financialMath.js';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
}

const CREAM   = '#EAE2D8';
const FAINT   = '#F5F1EC';
const PINK    = '#E91E6A';
const PAID    = '#16A34A';
const INK     = '#1a1a1a';
const MUTED   = '#555';
const LIGHT   = '#888';
const LABEL_C = '#aaa';
const BORDER  = '#f0f0f0';

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: INK,
    paddingTop: 28,
    paddingBottom: 32,
    paddingLeft: 40,
    paddingRight: 40,
    backgroundColor: '#ffffff',
  },
  // Header
  header:  { alignItems: 'center', marginBottom: 12 },
  logo:    { width: 140, height: 140, marginBottom: -8 },
  bizName: { fontSize: 16, fontFamily: 'Helvetica-Bold', letterSpacing: 1, textTransform: 'uppercase', color: INK, marginBottom: 3 },
  hst:     { fontSize: 8, color: LABEL_C, letterSpacing: 0.5 },
  // Info row (3 cols)
  infoRow:   { flexDirection: 'row', marginBottom: 14, gap: 12 },
  infoCol:   { flex: 1 },
  infoLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: LABEL_C, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 5 },
  infoBlock: { fontSize: 10, lineHeight: 1.15 },
  infoBold:  { fontFamily: 'Helvetica-Bold', color: INK },
  infoMuted: { color: MUTED },
  infoLight: { color: LIGHT },
  // Invoice meta rows
  metaRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginBottom: 3 },
  metaKey: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: LABEL_C, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 1 },
  metaVal: { fontFamily: 'Helvetica-Bold', color: INK, fontSize: 10 },
  // Table
  tableHeaderRow: { flexDirection: 'row', backgroundColor: CREAM, paddingTop: 5, paddingBottom: 5, paddingLeft: 2, paddingRight: 2 },
  tableRow:       { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER, paddingTop: 7, paddingBottom: 7, paddingLeft: 2, paddingRight: 2 },
  tableRowAlt:    { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER, backgroundColor: '#fafafa', paddingTop: 5, paddingBottom: 5, paddingLeft: 2, paddingRight: 2 },
  cDate:  { width: 72, paddingLeft: 8, paddingRight: 4 },
  cDesc:  { flex: 1,   paddingLeft: 4, paddingRight: 4 },
  cRate:  { width: 56, paddingLeft: 4, paddingRight: 4 },
  cHours: { width: 44, paddingLeft: 4, paddingRight: 4 },
  cAmt:   { width: 64, paddingLeft: 4, paddingRight: 8 },
  thText:    { fontSize: 7, fontFamily: 'Helvetica-Bold', color: MUTED, letterSpacing: 0.8, textTransform: 'uppercase' },
  thCenter:  { fontSize: 7, fontFamily: 'Helvetica-Bold', color: MUTED, letterSpacing: 0.8, textTransform: 'uppercase', textAlign: 'center' },
  thRight:   { fontSize: 7, fontFamily: 'Helvetica-Bold', color: MUTED, letterSpacing: 0.8, textTransform: 'uppercase', textAlign: 'right' },
  tdMuted:   { fontSize: 10, color: MUTED },
  tdCenter:  { fontSize: 10, color: MUTED, textAlign: 'center' },
  tdBold:    { fontSize: 10, fontFamily: 'Helvetica-Bold', color: INK },
  tdRight:   { fontSize: 10, fontFamily: 'Helvetica-Bold', color: INK, textAlign: 'right' },
  tdPink:    { fontSize: 7, fontFamily: 'Helvetica-Bold', color: PINK, letterSpacing: 0.8, textTransform: 'uppercase' },
  tdRightM:  { fontSize: 10, color: MUTED, textAlign: 'right' },
  // Totals
  totalsWrap:  { alignItems: 'flex-end', marginTop: 4, marginBottom: 10 },
  totalsInner: { width: 200 },
  tRow:        { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 3, paddingBottom: 3, paddingLeft: 10, paddingRight: 10 },
  tLabel:      { fontSize: 10, color: MUTED },
  tVal:        { fontSize: 10, color: MUTED },
  tDueRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: CREAM, paddingTop: 8, paddingBottom: 8, paddingLeft: 10, paddingRight: 10, borderRadius: 4, marginTop: 3 },
  tDueLabel:   { fontSize: 7, fontFamily: 'Helvetica-Bold', color: MUTED, letterSpacing: 1, textTransform: 'uppercase' },
  tDueVal:     { fontSize: 18, fontFamily: 'Helvetica-Bold', color: INK },
  // Payments received — its own faint-headed breakdown table
  paymentsWrap:      { marginTop: 6 },
  paymentsHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: FAINT, paddingTop: 4, paddingBottom: 4, paddingLeft: 10, paddingRight: 10, borderRadius: 3 },
  paymentsHeaderText:{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#999', letterSpacing: 0.8, textTransform: 'uppercase' },
  paymentRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 3, paddingBottom: 3, paddingLeft: 10, paddingRight: 10 },
  paymentDate:    { fontSize: 9, color: MUTED },
  paymentAmt:     { fontSize: 9, fontFamily: 'Helvetica-Bold', color: PAID },
  // Outstanding balance row — always shown
  balanceWrap:    { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 7, paddingBottom: 7, paddingLeft: 10, paddingRight: 10, marginTop: 3 },
  balanceMainRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  balanceLabel:   { fontSize: 7, fontFamily: 'Helvetica-Bold', color: MUTED, letterSpacing: 1, textTransform: 'uppercase' },
  balanceVal:     { fontSize: 13, fontFamily: 'Helvetica-Bold' },
  paidBadge:      { fontSize: 9, fontFamily: 'Helvetica-Bold', color: PAID },
  // Other outstanding balances — faint-headed breakdown table
  outstandingWrap: { marginTop: 2, marginBottom: 10 },
  outHeaderRow:  { flexDirection: 'row', backgroundColor: FAINT, paddingTop: 4, paddingBottom: 4, borderRadius: 3, marginBottom: 2 },
  outHeaderText: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#999', letterSpacing: 0.8, textTransform: 'uppercase' },
  outRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4, paddingBottom: 4 },
  outDate:     { fontSize: 9, color: MUTED, width: 90 },
  outDesc:     { fontSize: 9, color: INK, flex: 1 },
  outAmt:      { fontSize: 9, fontFamily: 'Helvetica-Bold', color: INK, textAlign: 'right', width: 64 },
  outTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: CREAM, paddingTop: 7, paddingBottom: 7, paddingLeft: 10, paddingRight: 10, borderRadius: 4, marginTop: 5 },
  outTotalLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: MUTED, letterSpacing: 0.8, textTransform: 'uppercase' },
  outTotalVal:   { fontSize: 13, fontFamily: 'Helvetica-Bold', color: INK },
  // Footer
  footerBorder: { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 9, marginBottom: 10 },
  footerLabel:  { fontSize: 7, fontFamily: 'Helvetica-Bold', color: LABEL_C, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 5 },
  footerText:   { fontSize: 10, color: '#444', lineHeight: 1.1 },
  thankYou:     { fontSize: 11, color: '#777', fontFamily: 'Helvetica-Oblique', textAlign: 'center', marginTop: 4 },
});

function el(type, props, ...children) {
  return React.createElement(type, props, ...children);
}
const V = (props, ...children) => el(View, props, ...children);
const T = (props, ...children) => el(Text, props, ...children);

function InvoiceDocument({ invoice }) {
  const biz      = invoice.businesses || {};
  const client   = invoice.clients    || {};
  const job      = invoice.invoice_jobs?.[0]?.jobs || {};
  const f        = computeJobFinancials(job, biz);
  const isReceipt = !!invoice.isPaidInFull;

  const totalRow = V({ style: s.tDueRow, key: 'total' },
    T({ style: s.tDueLabel }, 'Invoice Total'),
    T({ style: s.tDueVal   }, `$${f.total.toFixed(2)}`),
  );

  const paymentsBlock = invoice.payments?.length > 0
    ? V({ style: s.paymentsWrap, key: 'payments' },
        V({ style: s.paymentsHeaderRow },
          T({ style: s.paymentsHeaderText }, 'Payments Received'),
          T({ style: s.paymentsHeaderText }, 'Amount'),
        ),
        ...invoice.payments.map((p, i) =>
          V({ key: p.id ?? `pmt-${i}`, style: s.paymentRow },
            T({ style: s.paymentDate }, formatDate(p.payment_date)),
            T({ style: s.paymentAmt  }, `+$${Number(p.amount).toFixed(2)}`),
          )
        ),
      )
    : null;

  const balanceColor = invoice.balanceOwing > 0 ? '#DC2626' : INK;
  const balanceRow = V({ style: s.balanceWrap, key: 'balance' },
    V({ style: s.balanceMainRow },
      T({ style: s.balanceLabel }, 'Outstanding Balance'),
      T({ style: [s.balanceVal, { color: balanceColor }] }, `$${invoice.balanceOwing.toFixed(2)}`),
    ),
    invoice.isPaidInFull
      ? T({ style: [s.paidBadge, { textAlign: 'right', marginTop: 4 }] }, '✓ Paid')
      : null,
  );

  const bizCity    = [biz.city, biz.province].filter(Boolean).join(', ');
  const clientCity = [[client.city, client.province].filter(Boolean).join(', '), client.postal_code].filter(Boolean).join(' ');
  const appBase    = process.env.APP_BASE_URL || 'https://app.supermomforhire.com';
  const logoUrl    = biz.logo_url?.startsWith('http') ? biz.logo_url : `${appBase}/branding/logo-final.png`;

  return el(Document, null,
    el(Page, { size: 'A4', style: s.page },

      // ── Header ──
      V({ style: s.header },
        el(Image, { src: logoUrl, style: s.logo }),
        T({ style: s.bizName }, biz.name || 'Supermom for Hire'),
        biz.hst_number ? T({ style: s.hst }, `HST # ${biz.hst_number}`) : null,
      ),

      // ── Info row ──
      V({ style: s.infoRow },
        // Issued to
        V({ style: s.infoCol },
          T({ style: s.infoLabel }, 'Issued to'),
          T({ style: s.infoBlock },
            T({ style: s.infoBold }, `${client.first_name || ''} ${client.last_name || ''}`.trim() || '—'),
            clientCity   ? '\n' : null, clientCity   ? T({ style: s.infoMuted }, clientCity)   : null,
            client.phone ? '\n' : null, client.phone ? T({ style: s.infoLight }, client.phone) : null,
            client.email ? '\n' : null, client.email ? T({ style: s.infoLight }, client.email) : null,
          ),
        ),
        // From
        V({ style: s.infoCol },
          T({ style: s.infoLabel }, 'From'),
          T({ style: s.infoBlock },
            T({ style: s.infoBold }, biz.name || 'Supermom for Hire'),
            bizCity   ? '\n' : null, bizCity   ? T({ style: s.infoMuted }, bizCity)   : null,
            biz.phone ? '\n' : null, biz.phone ? T({ style: s.infoLight }, biz.phone) : null,
            biz.email ? '\n' : null, biz.email ? T({ style: s.infoLight }, biz.email) : null,
          ),
        ),
        // Invoice / Receipt meta
        V({ style: [s.infoCol, { alignItems: 'flex-end' }] },
          T({ style: [s.infoLabel, { textAlign: 'right' }] }, isReceipt ? 'Receipt' : 'Invoice'),
          V({ style: s.metaRow }, T({ style: s.metaKey }, 'NO'),   T({ style: s.metaVal }, invoice.invoice_number || '—')),
          V({ style: s.metaRow }, T({ style: s.metaKey }, 'DATE'), T({ style: s.metaVal }, formatDate(invoice.invoice_date))),
          V({ style: s.metaRow }, T({ style: s.metaKey }, 'DUE DATE'), T({ style: s.metaVal }, formatDate(invoice.due_date))),
        ),
      ),

      // ── Table header ──
      V({ style: s.tableHeaderRow },
        V({ style: s.cDate  }, T({ style: s.thText   }, 'Date')),
        V({ style: s.cDesc  }, T({ style: s.thText   }, 'Description')),
        V({ style: s.cRate  }, T({ style: s.thCenter }, 'Rate / Hr')),
        V({ style: s.cHours }, T({ style: s.thCenter }, 'Hours')),
        V({ style: s.cAmt   }, T({ style: s.thRight  }, 'Amount')),
      ),

      // ── Service row ──
      V({ style: s.tableRow },
        V({ style: s.cDate  }, T({ style: s.tdMuted  }, job.scheduled_date ? formatDate(job.scheduled_date) : '—')),
        V({ style: s.cDesc  },
          T({ style: s.tdBold }, job.service_name || 'Professional Services'),
        ),
        V({ style: s.cRate  }, T({ style: s.tdCenter }, f.isHourly ? `$${f.rate.toFixed(2)}` : '—')),
        V({ style: s.cHours }, T({ style: s.tdCenter }, f.isHourly ? f.hours.toFixed(1) : '—')),
        V({ style: s.cAmt   }, T({ style: s.tdRight  }, `$${f.subtotal.toFixed(2)}`)),
      ),

      // ── Additional cost rows ──
      ...f.activeCosts.map((item, idx) =>
        V({ key: idx, style: s.tableRowAlt },
          V({ style: s.cDate  }),
          V({ style: s.cDesc  },
            T({ style: s.tdMuted },
              T({ style: s.tdPink }, 'Additional Cost  '),
              item.description || 'Miscellaneous',
            ),
          ),
          V({ style: s.cRate  }),
          V({ style: s.cHours }),
          V({ style: s.cAmt   }, T({ style: s.tdRightM }, `$${Number(item.amount).toFixed(2)}`)),
        )
      ),

      // ── Totals ──
      V({ style: s.totalsWrap },
        V({ style: s.totalsInner },
          V({ style: s.tRow },
            T({ style: s.tLabel }, 'Subtotal'),
            T({ style: s.tVal   }, `$${(f.subtotal + f.additionalTotal).toFixed(2)}`),
          ),
          f.taxAmount > 0 ? V({ style: s.tRow },
            T({ style: s.tLabel }, `HST (${(f.taxRate * 100).toFixed(0)}%)`),
            T({ style: s.tVal   }, `$${f.taxAmount.toFixed(2)}`),
          ) : null,
          totalRow,
          paymentsBlock,
          balanceRow,
        ),
      ),

      // ── Other outstanding balances for this client ──
      invoice.otherOutstanding?.length > 0 ?
        V({ style: s.outstandingWrap },
          T({ style: s.footerLabel }, 'Other Outstanding Balances'),
          V({ style: s.outHeaderRow },
            T({ style: [s.outDate, s.outHeaderText] }, 'Date'),
            T({ style: [s.outDesc, s.outHeaderText] }, 'Service'),
            T({ style: [s.outAmt,  s.outHeaderText] }, 'Owing'),
          ),
          ...invoice.otherOutstanding.map(({ job: otherJob, owing }) =>
            V({ key: otherJob.id, style: s.outRow },
              T({ style: s.outDate }, otherJob.scheduled_date ? formatDate(otherJob.scheduled_date) : '—'),
              T({ style: s.outDesc }, otherJob.service_name || 'Professional Services'),
              T({ style: s.outAmt  }, `$${owing.toFixed(2)}`),
            )
          ),
          V({ style: s.outTotalRow },
            T({ style: s.outTotalLabel }, 'Combined Balance Owing — All Jobs'),
            T({ style: s.outTotalVal   }, `$${invoice.runningTotalOwing.toFixed(2)}`),
          ),
        )
      : null,

      // ── Payment footer ──
      V({ style: s.footerBorder },
        T({ style: s.footerLabel }, isReceipt ? 'Payment Received' : 'Payment'),
        T({ style: s.footerText  },
          isReceipt
            ? `Payment received in full. Thank you!\nReceipt #${invoice.invoice_number}`
            : `e-Transfer to ${biz.email || 'sandra@supermomforhire.com'}\nReference: Invoice #${invoice.invoice_number}`
        ),
      ),
      T({ style: s.thankYou }, 'Thank you for letting Supermom save the day.'),
    )
  );
}

export async function buildInvoicePdfBuffer(invoice) {
  return await renderToBuffer(el(InvoiceDocument, { invoice }));
}
