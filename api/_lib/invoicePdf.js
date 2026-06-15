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
const PINK    = '#B01550';
const PAID    = '#16A34A';
const INK     = '#1a1a1a';
const MUTED   = '#555';
const LIGHT   = '#888';
const LABEL_C = '#6b7280';
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
  tDueVal:     { fontSize: 14, fontFamily: 'Helvetica-Bold', color: INK },
  // Payments received — its own faint-headed breakdown table
  paymentsWrap:      { marginTop: 6 },
  paymentsHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4, paddingBottom: 4, paddingLeft: 10, paddingRight: 10 },
  paymentsHeaderText:{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#999', letterSpacing: 0.8, textTransform: 'uppercase' },
  paymentRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 3, paddingBottom: 3, paddingLeft: 10, paddingRight: 10 },
  paymentDate:    { fontSize: 9, color: MUTED },
  paymentAmt:     { fontSize: 9, fontFamily: 'Helvetica-Bold', color: PAID },
  // Outstanding balance row — always shown
  balanceWrap:    { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 7, paddingBottom: 7, paddingLeft: 10, paddingRight: 10, marginTop: 3 },
  balanceMainRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  balanceLabel:   { fontSize: 7, fontFamily: 'Helvetica-Bold', color: MUTED, letterSpacing: 1, textTransform: 'uppercase' },
  balanceVal:     { fontSize: 12, fontFamily: 'Helvetica-Bold' },
  paidBadge:      { fontSize: 9, fontFamily: 'Helvetica-Bold', color: PAID },
  // Other outstanding balances — faint-headed breakdown table
  outstandingWrap: { marginTop: 2, marginBottom: 10, borderTopWidth: 2, borderTopColor: CREAM, paddingTop: 12 },
  outSectionLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: LABEL_C, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 3 },
  outSectionDesc:  { fontSize: 8, color: LIGHT, marginBottom: 7 },
  outHeaderRow:  { flexDirection: 'row', backgroundColor: FAINT, paddingTop: 4, paddingBottom: 4, paddingLeft: 6, paddingRight: 6, borderRadius: 3, marginBottom: 2 },
  outHeaderText: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#999', letterSpacing: 0.8, textTransform: 'uppercase' },
  outRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4, paddingBottom: 4, paddingLeft: 6, paddingRight: 6, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  outDate:     { fontSize: 9, color: MUTED, width: 90 },
  outDesc:     { fontSize: 9, color: INK, flex: 1 },
  outAmt:      { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#DC2626', textAlign: 'right', width: 64 },
  outTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: CREAM, paddingTop: 8, paddingBottom: 8, paddingLeft: 10, paddingRight: 10, borderRadius: 4, marginTop: 7 },
  outTotalLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: MUTED, letterSpacing: 0.8, textTransform: 'uppercase' },
  outTotalVal:   { fontSize: 15, fontFamily: 'Helvetica-Bold', color: '#DC2626' },
  // Also paid for this client — same layout as outstanding, paid (green) amounts
  paidAmt:      { fontSize: 9, fontFamily: 'Helvetica-Bold', color: PAID, textAlign: 'right', width: 64 },
  paidTotalVal: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: PAID },
  // Footer
  footerBorder: { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 9, marginBottom: 10 },
  footerLabel:  { fontSize: 7, fontFamily: 'Helvetica-Bold', color: LABEL_C, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 5 },
  footerText:   { fontSize: 10, color: '#444', lineHeight: 1.1 },
  thankYou:     { fontSize: 11, color: '#666', fontFamily: 'Helvetica-Oblique', textAlign: 'center', marginTop: 4 },
});

function el(type, props, ...children) {
  return React.createElement(type, props, ...children);
}
const V = (props, ...children) => el(View, props, ...children);
const T = (props, ...children) => el(Text, props, ...children);

function InvoiceDocument({ invoice }) {
  const biz      = invoice.businesses || {};
  const client   = invoice.clients    || {};
  const allJobs  = (invoice.invoice_jobs || []).map(ij => ij.jobs).filter(Boolean);
  const isReceipt = !!invoice.isPaidInFull;
  const anyHourly = allJobs.some(j => j.pricing_type === 'Hourly');
  const allF      = allJobs.map(j => computeJobFinancials(j, biz));
  const aggSubtotal   = allF.reduce((s, f) => s + f.subtotal, 0);
  const aggAdditional = allF.reduce((s, f) => s + f.additionalTotal, 0);
  const aggTax        = allF.reduce((s, f) => s + f.taxAmount, 0);
  const aggTotal      = allF.reduce((s, f) => s + f.total, 0);
  const aggTaxRate    = allF[0]?.taxRate || 0;

  const totalRow = V({ style: s.tDueRow, key: 'total' },
    T({ style: s.tDueLabel }, 'Invoice Total'),
    V({ style: { flexDirection: 'row', alignItems: 'center' } },
      isReceipt ? T({ style: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: PAID, marginRight: 4 } }, '✓ Paid') : null,
      T({ style: [s.tDueVal, isReceipt ? { color: PAID } : {}] }, `$${aggTotal.toFixed(2)}`),
    ),
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

  const balanceRow = (invoice.payments?.length > 0 && !invoice.isPaidInFull)
    ? V({ style: s.balanceWrap, key: 'balance' },
        V({ style: s.balanceMainRow },
          T({ style: s.balanceLabel }, 'Remaining'),
          T({ style: [s.balanceVal, { color: '#DC2626' }] }, `$${invoice.balanceOwing.toFixed(2)}`),
        ),
      )
    : null;

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
            client.street ? '\n' : null, client.street ? T({ style: s.infoMuted }, client.street) : null,
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
          T({ style: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: isReceipt ? PAID : PINK, letterSpacing: 2, textTransform: 'uppercase', textAlign: 'right', marginBottom: 8 } }, isReceipt ? 'Receipt' : 'Invoice'),
          V({ style: s.metaRow }, T({ style: s.metaKey }, '#'),   T({ style: s.metaVal }, invoice.invoice_number || '—')),
          V({ style: s.metaRow }, T({ style: s.metaKey }, 'DATE'), T({ style: s.metaVal }, formatDate(invoice.invoice_date))),
          V({ style: s.metaRow }, T({ style: s.metaKey }, 'DUE DATE'), T({ style: s.metaVal }, formatDate(invoice.due_date))),
        ),
      ),

      // ── Table header ──
      V({ style: s.tableHeaderRow },
        V({ style: s.cDate  }, T({ style: s.thText   }, 'Date')),
        V({ style: s.cDesc  }, T({ style: s.thText   }, 'Description')),
        anyHourly ? V({ style: s.cRate  }, T({ style: s.thCenter }, 'Rate / Hr')) : null,
        anyHourly ? V({ style: s.cHours }, T({ style: s.thCenter }, 'Hours')) : null,
        V({ style: s.cAmt   }, T({ style: s.thRight  }, 'Amount')),
      ),

      // ── Line items — one service row + additional costs per job ──
      ...allJobs.flatMap((job, idx) => {
        const f = allF[idx];
        return [
          V({ key: `job-${job.id}`, style: s.tableRow },
            V({ style: s.cDate  }, T({ style: s.tdMuted  }, job.scheduled_date ? formatDate(job.scheduled_date) : '—')),
            V({ style: s.cDesc  }, T({ style: s.tdBold }, job.service_name || 'Professional Services')),
            anyHourly ? V({ style: s.cRate  }, f.isHourly ? T({ style: s.tdCenter }, `$${f.rate.toFixed(2)}`) : T({ style: s.tdCenter }, '')) : null,
            anyHourly ? V({ style: s.cHours }, f.isHourly ? T({ style: s.tdCenter }, f.hours.toFixed(1))     : T({ style: s.tdCenter }, '')) : null,
            V({ style: s.cAmt   }, T({ style: s.tdRight  }, `$${f.subtotal.toFixed(2)}`)),
          ),
          ...f.activeCosts.map((item, i) =>
            V({ key: `cost-${job.id}-${i}`, style: s.tableRowAlt },
              V({ style: s.cDate  }),
              V({ style: s.cDesc  },
                T({ style: s.tdMuted },
                  T({ style: s.tdPink }, 'Additional Cost  '),
                  item.description || 'Miscellaneous',
                ),
              ),
              anyHourly ? V({ style: s.cRate  }) : null,
              anyHourly ? V({ style: s.cHours }) : null,
              V({ style: s.cAmt   }, T({ style: s.tdRightM }, `$${Number(item.amount).toFixed(2)}`)),
            )
          ),
        ];
      }),

      // ── Totals (two-column: payments left, subtotal/total right) ──
      V({ style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 4, marginBottom: 10 } },
        // Left — payments received, fills white space beside totals column
        invoice.payments?.length > 0
          ? V({ style: { width: 160, marginRight: 16 } },
              T({ style: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#999', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 5 } }, 'Payments Received'),
              ...invoice.payments.map((p, i) =>
                V({ key: p.id ?? `pmt-${i}`, style: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 2, paddingBottom: 2 } },
                  T({ style: { fontSize: 9, color: MUTED } }, formatDate(p.payment_date)),
                  T({ style: { fontSize: 9, color: INK    } }, `$${Number(p.amount).toFixed(2)}`),
                )
              ),
            )
          : V({ style: {} }),
        // Right — subtotal / HST / invoice total / remaining
        V({ style: { width: 200 } },
          V({ style: s.tRow },
            T({ style: s.tLabel }, 'Subtotal'),
            T({ style: s.tVal   }, `$${(aggSubtotal + aggAdditional).toFixed(2)}`),
          ),
          aggTax > 0 ? V({ style: s.tRow },
            T({ style: s.tLabel }, `HST (${(aggTaxRate * 100).toFixed(0)}%)`),
            T({ style: s.tVal   }, `$${aggTax.toFixed(2)}`),
          ) : null,
          totalRow,
          balanceRow,
        ),
      ),

      // ── Other outstanding balances for this client ──
      invoice.otherOutstanding?.length > 0 ?
        V({ style: s.outstandingWrap },
          T({ style: s.outSectionLabel }, 'Also Outstanding for This Client'),
          T({ style: s.outSectionDesc  }, 'Other completed jobs with unpaid balances'),
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
            T({ style: s.outTotalLabel }, 'Total Owed — All Jobs'),
            T({ style: s.outTotalVal   }, `$${invoice.runningTotalOwing.toFixed(2)}`),
          ),
        )
      : null,

      // ── Also paid for this client (jobs settled together on this receipt) ──
      invoice.alsoPaid?.length > 0 ?
        V({ style: s.outstandingWrap },
          T({ style: { fontSize: 10, color: MUTED, marginBottom: 7 } },
            'Remaining ',
            T({ style: { fontFamily: 'Helvetica-Bold', color: INK } }, `$${invoice.alsoPaid.reduce((s, { total }) => s + total, 0).toFixed(2)}`),
            ' from this payment was also applied to:',
          ),
          V({ style: s.outHeaderRow },
            T({ style: [s.outDate, s.outHeaderText] }, 'Date'),
            T({ style: [s.outDesc, s.outHeaderText] }, 'Service'),
            T({ style: [s.paidAmt, s.outHeaderText] }, 'Amount'),
          ),
          ...invoice.alsoPaid.map(({ job: paidJob, total }) =>
            V({ key: paidJob.id, style: s.outRow },
              T({ style: s.outDate }, paidJob.scheduled_date ? formatDate(paidJob.scheduled_date) : '—'),
              T({ style: s.outDesc }, paidJob.service_name || 'Professional Services'),
              T({ style: s.paidAmt }, `✓ $${total.toFixed(2)}`),
            )
          ),
        )
      : null,

      // ── Payment footer (only on unpaid invoices) ──
      !isReceipt ? V({ style: s.footerBorder },
        T({ style: s.footerLabel }, 'Payment'),
        T({ style: s.footerText  }, `e-Transfer to ${biz.email || 'sandra@supermomforhire.com'}\nReference: Invoice #${invoice.invoice_number}`),
      ) : null,
      T({ style: s.thankYou }, 'Thank you for letting Supermom save the day.'),
    )
  );
}

export async function buildInvoicePdfBuffer(invoice) {
  return await renderToBuffer(el(InvoiceDocument, { invoice }));
}
