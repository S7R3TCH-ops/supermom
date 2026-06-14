import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchInvoiceById, settleInvoiceOutstanding, voidInvoiceSettlement } from '../data/invoicesRepo';
import { computeJobFinancials } from '../lib/financialMath';
import { useAuth } from '../context/AuthContext';
import { getCurrentBusinessId } from '../data/currentBusiness';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
}

const LABEL = { fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 };

export default function InvoiceView() {
  const { id } = useParams();
  const { session } = useAuth();
  const [invoice, setInvoice]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [emailState, setEmailState] = useState('idle');
  const [invoiceSentAt, setInvoiceSentAt] = useState(null);
  const [receiptSentAt, setReceiptSentAt] = useState(null);
  const [isOwner, setIsOwner]       = useState(false);
  const [settleState, setSettleState] = useState('idle'); // idle | saving | error
  const [method, setMethod]         = useState('e-Transfer');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [confirmUndo, setConfirmUndo] = useState(false);
  const settlingRef = useRef(false);
  const wrapRef = useRef(null);
  const boxRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [boxNaturalH, setBoxNaturalH] = useState(0);

  useEffect(() => {
    if (!invoice) return;
    function measure() {
      if (!wrapRef.current || !boxRef.current) return;
      const w = wrapRef.current.offsetWidth;
      const s = Math.min(1, w / 800);
      setScale(s);
      setBoxNaturalH(boxRef.current.scrollHeight);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(wrapRef.current);
    ro.observe(boxRef.current);
    requestAnimationFrame(measure);
    return () => ro.disconnect();
  }, [invoice]);

  function reload() {
    return fetchInvoiceById(id)
      .then(inv => {
        setInvoice(inv);
        const j = inv.invoice_jobs?.[0]?.jobs || {};
        setInvoiceSentAt(j.invoice_sent_at || null);
        setReceiptSentAt(j.receipt_sent_at || null);
        // Default every outstanding job to selected on (re)load.
        const ids = [];
        if (j?.id && inv.balanceOwing > 0.01) ids.push(j.id);
        (inv.otherOutstanding ?? []).forEach(b => ids.push(b.job.id));
        setSelectedIds(new Set(ids));
        return inv;
      });
  }

  useEffect(() => {
    reload()
      .catch(err => { console.error('Failed to load invoice:', err); setError(err.message); })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Owner-only actions: this page is public (/i/:id), so gate mutating UI behind a logged-in
  // session whose business matches the invoice. Mutations are also RLS-protected server-side.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!session || !invoice) { if (alive) setIsOwner(false); return; }
      try {
        const bid = await getCurrentBusinessId();
        if (alive) setIsOwner(!!bid && bid === invoice.business_id);
      } catch { if (alive) setIsOwner(false); }
    })();
    return () => { alive = false; };
  }, [session, invoice]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', fontFamily: 'var(--font-ui)', color: 'var(--ink-muted)' }}>Loading Invoice…</div>;
  if (error)   return <div style={{ padding: 40, textAlign: 'center', fontFamily: 'var(--font-ui)', color: 'var(--ink-muted)' }}>This invoice couldn't be loaded. Please contact Sandra at (416) 738-0309.</div>;
  if (!invoice) return <div style={{ padding: 40, textAlign: 'center', fontFamily: 'var(--font-ui)', color: 'var(--ink-muted)' }}>Invoice not found.</div>;

  const biz       = invoice.businesses || {};
  const client    = invoice.clients    || {};
  const job       = invoice.invoice_jobs?.[0]?.jobs || {};
  const isReceipt = !!invoice.isPaidInFull;

  const financials = computeJobFinancials(job, biz);
  const logoSrc    = biz.logo_url || '/branding/logo-final.png';
  const bizCity    = [biz.city, biz.province].filter(Boolean).join(', ');
  const clientCity = [[client.city, client.province].filter(Boolean).join(', '), client.postal_code].filter(Boolean).join(' ');

  // Outstanding jobs that the owner can settle from this invoice (current job + others).
  const outstandingJobs = [];
  if (job?.id && invoice.balanceOwing > 0.01) {
    outstandingJobs.push({ id: job.id, label: job.service_name || 'Professional Services', date: job.scheduled_date, owing: invoice.balanceOwing, isCurrent: true });
  }
  (invoice.otherOutstanding ?? []).forEach(b => {
    outstandingJobs.push({ id: b.job.id, label: b.job.service_name || 'Professional Services', date: b.job.scheduled_date, owing: b.owing, isCurrent: false });
  });
  const selectedTotal = outstandingJobs
    .filter(j => selectedIds.has(j.id))
    .reduce((s, j) => s + j.owing, 0);
  const showSettlePanel = isOwner && outstandingJobs.length > 0;
  const showUndo = isOwner && (invoice.settlementCount || 0) > 0;

  function toggleJob(jobId) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId); else next.add(jobId);
      return next;
    });
  }

  async function handleSettle() {
    if (settlingRef.current || selectedIds.size === 0) return;
    settlingRef.current = true;
    setSettleState('saving');
    try {
      await settleInvoiceOutstanding(id, method, [...selectedIds]);
      await reload();
      setSettleState('idle');
    } catch (e) {
      console.error('Settle error:', e);
      setSettleState('error');
      setTimeout(() => setSettleState('idle'), 4000);
    } finally {
      settlingRef.current = false;
    }
  }

  async function handleUndo() {
    if (settlingRef.current) return;
    if (!confirmUndo) { setConfirmUndo(true); setTimeout(() => setConfirmUndo(false), 4000); return; }
    setConfirmUndo(false);
    settlingRef.current = true;
    setSettleState('saving');
    try {
      await voidInvoiceSettlement(id);
      await reload();
      setSettleState('idle');
    } catch (e) {
      console.error('Undo error:', e);
      setSettleState('error');
      setTimeout(() => setSettleState('idle'), 4000);
    } finally {
      settlingRef.current = false;
    }
  }

  async function handleEmail() {
    if (!client.email) return;
    setEmailState('sending');
    try {
      const res = await fetch('/api/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: id,
          clientEmail: client.email,
          clientName: client.first_name,
          clientLastName: client.last_name,
          invoiceNumber: invoice.invoice_number,
          bizName: biz.name || 'Supermom for Hire',
          bizEmail: biz.email,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (data.isReceipt) setReceiptSentAt(new Date().toISOString());
      else setInvoiceSentAt(new Date().toISOString());
      setEmailState('sent');
      setTimeout(() => setEmailState('idle'), 4000);
    } catch (e) {
      console.error('Email error:', e);
      setEmailState('error');
      setTimeout(() => setEmailState('idle'), 4000);
    }
  }

  const docLabel   = isReceipt ? 'Receipt' : 'Invoice';
  const emailLabel = emailState === 'sending' ? 'Sending…'
    : emailState === 'sent'    ? '✓ Sent!'
    : emailState === 'error'   ? '✗ Failed — retry'
    : client.email             ? `✉ Email ${docLabel}`
    : '✉ No Email on File';

  return (
    <div className="print-page" style={{ minHeight: '100svh', background: '#f9f9f9', padding: '20px 10px', fontFamily: 'var(--font-ui)' }}>
      <style>{`
        @page { margin: 0; }
        @media print {
          body { background: white !important; padding: 0 !important; margin: 0 !important; }
          .no-print { display: none !important; }
          .print-page { background: white !important; padding: 0 !important; }
          .invoice-box {
            box-shadow: none !important;
            border: none !important;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0.4in 0.5in 0.4in !important;
          }
          .table-wrap { overflow: visible !important; }
          .invoice-footer { page-break-inside: avoid; }
        }
        .invoice-box {
          background: white;
          max-width: 800px;
          margin: 0 auto;
          padding: 44px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.05);
          border: 1px solid #eee;
          font-family: var(--font-ui);
          color: #1a1a1a;
        }
        .inv-display { font-family: var(--font-display); }
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 24px;
          margin-bottom: 16px;
          font-size: 13px;
          line-height: 1.4;
        }
        .table-wrap {
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          margin-bottom: 10px;
        }
        .table-wrap table {
          width: 100%;
          min-width: 520px;
          border-collapse: collapse;
        }
        @media (max-width: 600px) {
          .invoice-box { padding: 16px 12px; }
          .info-grid { grid-template-columns: 1fr; gap: 18px; margin-bottom: 28px; font-size: 12px; }
          .info-col-right { text-align: left !important; }
          .invoice-meta { justify-content: flex-start !important; }
        }
        @media print {
          .invoice-scale-wrap { height: auto !important; overflow: visible !important; }
          .invoice-box { transform: none !important; width: 100% !important; max-width: none !important; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print" style={{ maxWidth: 800, margin: '0 auto 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ fontSize: 12, color: 'var(--ink-muted)', fontWeight: 600 }}>✦ PREVIEW</div>
          {invoiceSentAt && (
            <div style={{ fontSize: 11, color: '#888' }}>
              Invoice sent {new Date(invoiceSentAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          )}
          {receiptSentAt && (
            <div style={{ fontSize: 11, color: '#16A34A', fontWeight: 600 }}>
              ✓ Receipt sent {new Date(receiptSentAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={handleEmail}
            disabled={!client.email || emailState === 'sending'}
            style={{
              background: emailState === 'sent' ? '#16A34A' : 'white',
              color: emailState === 'sent' ? 'white' : client.email ? 'var(--pink)' : '#bbb',
              border: `1.5px solid ${emailState === 'sent' ? '#16A34A' : client.email ? 'var(--pink)' : '#ddd'}`,
              padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700,
              cursor: client.email && emailState === 'idle' ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
            }}
          >
            {emailLabel}
          </button>
          <a
            href={`/api/invoice?id=${id}`}
            download
            style={{
              background: 'var(--pink)', color: 'white', textDecoration: 'none',
              padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700,
              cursor: 'pointer', boxShadow: '0 4px 12px rgba(233,30,106,0.2)',
              display: 'inline-block',
            }}
          >
            Download PDF
          </a>
          <button
            onClick={() => {
              const prev = document.title;
              document.title = `${client.last_name || 'Client'}_${docLabel}_${invoice.invoice_number || docLabel}`;
              window.print();
              setTimeout(() => { document.title = prev; }, 500);
            }}
            style={{
              background: 'white', color: 'var(--ink-muted)', border: '1.5px solid #ddd',
              padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Print
          </button>
        </div>
      </div>

      {/* Owner-only payment panel — never printed / not on PDF */}
      {showSettlePanel && (
        <div className="no-print" style={{ maxWidth: 800, margin: '0 auto 15px', background: 'white', border: '1.5px solid #FFD6E8', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--pink)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>Record Payment</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            {outstandingJobs.map(j => (
              <label key={j.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: '#333' }}>
                <input type="checkbox" checked={selectedIds.has(j.id)} onChange={() => toggleJob(j.id)} style={{ width: 18, height: 18, accentColor: '#E91E6A' }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  {j.isCurrent && <span style={{ fontSize: 9, fontWeight: 700, color: '#E91E6A', textTransform: 'uppercase', marginRight: 6 }}>This Invoice</span>}
                  {j.label}
                  <span style={{ color: '#999' }}>{j.date ? ` · ${formatDate(j.date)}` : ''}</span>
                </span>
                <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>${j.owing.toFixed(2)}</span>
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <select value={method} onChange={e => setMethod(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 13, fontWeight: 600, color: '#333' }}>
              <option value="e-Transfer">e-Transfer</option>
              <option value="Cash">Cash</option>
            </select>
            <button
              onClick={handleSettle}
              disabled={selectedIds.size === 0 || settleState === 'saving'}
              style={{
                flex: 1, minWidth: 180,
                background: settleState === 'saving' ? '#ccc' : selectedIds.size === 0 ? '#eee' : '#16A34A',
                color: selectedIds.size === 0 ? '#aaa' : 'white', border: 'none',
                padding: '10px 14px', borderRadius: 8, fontSize: 14, fontWeight: 700,
                cursor: selectedIds.size === 0 || settleState === 'saving' ? 'not-allowed' : 'pointer',
              }}
            >
              {settleState === 'saving' ? 'Saving…' : settleState === 'error' ? '✗ Failed — retry' : `Mark Paid — $${selectedTotal.toFixed(2)}`}
            </button>
          </div>
        </div>
      )}

      {showUndo && (
        <div className="no-print" style={{ maxWidth: 800, margin: '0 auto 15px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleUndo}
            disabled={settleState === 'saving'}
            style={{
              background: 'white', color: confirmUndo ? '#DC2626' : 'var(--ink-muted)',
              border: `1.5px solid ${confirmUndo ? '#DC2626' : '#ddd'}`,
              padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {settleState === 'saving' ? 'Working…' : confirmUndo ? 'Tap again to undo payment' : '↩ Undo Payment'}
          </button>
        </div>
      )}

      <div ref={wrapRef} className="invoice-scale-wrap" style={{ overflow: 'hidden', height: scale < 1 && boxNaturalH ? boxNaturalH * scale : 'auto' }}>
      <div ref={boxRef} className="invoice-box" style={scale < 1 ? { transform: `scale(${scale})`, transformOrigin: 'top left', width: 800, maxWidth: 'none' } : {}}>

        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 10 }}>
          <img
            src={logoSrc}
            alt={biz.name || 'Supermom for Hire'}
            style={{ width: 150, height: 150, objectFit: 'contain', marginBottom: -14 }}
            onError={e => { e.currentTarget.style.display = 'none'; }}
          />
          <h1 className="inv-display" style={{ fontSize: 24, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', margin: '0 0 3px', color: '#1a1a1a' }}>
            {biz.name || 'Supermom for Hire'}
          </h1>
          {biz.hst_number && (
            <div style={{ fontSize: 11, color: '#999', letterSpacing: '0.5px' }}>
              HST # {biz.hst_number}
            </div>
          )}
        </div>

        {/* Info row */}
        <div className="info-grid">
          <div>
            <div style={LABEL}>Issued to</div>
            <div style={{ fontWeight: 600 }}>{client.first_name} {client.last_name}</div>
            {client.street && <div style={{ color: '#555' }}>{client.street}</div>}
            {clientCity && <div style={{ color: '#555' }}>{clientCity}</div>}
            {client.phone && <div style={{ color: '#888' }}>{client.phone}</div>}
            {client.email && <div style={{ color: '#888' }}>{client.email}</div>}
          </div>

          <div>
            <div style={LABEL}>From</div>
            <div style={{ fontWeight: 600 }}>{biz.name || 'Supermom for Hire'}</div>
            {bizCity && <div style={{ color: '#555' }}>{bizCity}</div>}
            {biz.phone && <div style={{ color: '#888' }}>{biz.phone}</div>}
            {biz.email && <div style={{ color: '#888' }}>{biz.email}</div>}
          </div>

          <div className="info-col-right" style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 30, fontWeight: 700, color: isReceipt ? '#16A34A' : '#1a1a1a', letterSpacing: '3px', textTransform: 'uppercase', lineHeight: 1, marginBottom: 12 }}>{docLabel}</div>
            <div className="invoice-meta" style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '5px 14px', justifyContent: 'end' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textAlign: 'right', alignSelf: 'center' }}>NO</div>
              <div style={{ fontWeight: 600 }}>{invoice.invoice_number}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textAlign: 'right', alignSelf: 'center' }}>DATE</div>
              <div>{formatDate(invoice.invoice_date)}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textAlign: 'right', alignSelf: 'center' }}>DUE DATE</div>
              <div>{formatDate(invoice.due_date)}</div>
            </div>
          </div>
        </div>

        {/* Line items — scrollable on mobile */}
        <div className="table-wrap">
          <table>
            <thead>
              <tr style={{ background: '#EAE2D8', fontSize: 10, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#555' }}>
                <th style={{ textAlign: 'left', padding: '8px 14px', width: 130 }}>Date</th>
                <th style={{ textAlign: 'left', padding: '8px 14px' }}>Description</th>
                {financials.isHourly && <th style={{ textAlign: 'center', padding: '8px 14px', width: 85 }}>Rate / Hr</th>}
                {financials.isHourly && <th style={{ textAlign: 'center', padding: '8px 14px', width: 75 }}>Hours</th>}
                <th style={{ textAlign: 'right', padding: '8px 14px', width: 100 }}>Amount</th>
              </tr>
            </thead>
            <tbody style={{ fontSize: 13, lineHeight: 1.4 }}>

              {/* Service row */}
              <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '8px 14px', color: '#555', verticalAlign: 'top' }}>
                  {job.scheduled_date ? formatDate(job.scheduled_date) : '—'}
                </td>
                <td style={{ padding: '8px 14px', verticalAlign: 'top' }}>
                  <div style={{ fontWeight: 600 }}>{job.service_name || 'Professional Services'}</div>
                </td>
                {financials.isHourly && <td style={{ textAlign: 'center', padding: '8px 14px', color: '#555', verticalAlign: 'top' }}>${financials.rate.toFixed(2)}</td>}
                {financials.isHourly && <td style={{ textAlign: 'center', padding: '8px 14px', color: '#555', verticalAlign: 'top' }}>{financials.hours.toFixed(1)}</td>}
                <td style={{ textAlign: 'right', padding: '8px 14px', fontWeight: 600, verticalAlign: 'top' }}>
                  ${financials.subtotal.toFixed(2)}
                </td>
              </tr>

              {/* Additional cost rows */}
              {financials.activeCosts.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
                  <td style={{ padding: '6px 14px', verticalAlign: 'top' }}></td>
                  <td style={{ padding: '6px 14px', verticalAlign: 'top' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: '#B01550', letterSpacing: '1px', textTransform: 'uppercase' }}>
                        Additional Cost
                      </span>
                      <span style={{ fontWeight: 500, color: '#333' }}>
                        {item.description || 'Miscellaneous'}
                      </span>
                    </div>
                  </td>
                  {financials.isHourly && <td style={{ textAlign: 'center', padding: '6px 14px', verticalAlign: 'top' }}></td>}
                  {financials.isHourly && <td style={{ textAlign: 'center', padding: '6px 14px', verticalAlign: 'top' }}></td>}
                  <td style={{ textAlign: 'right', padding: '6px 14px', fontWeight: 500, verticalAlign: 'top' }}>
                    ${Number(item.amount).toFixed(2)}
                  </td>
                </tr>
              ))}

            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14, gap: 20 }}>
          {/* Left — payments received, compact, bottom-aligned with the totals column */}
          {invoice.payments?.length > 0 ? (
            <div style={{ minWidth: 140, maxWidth: 210 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#999', marginBottom: 4 }}>
                Payments Received
              </div>
              {invoice.payments.map(p => (
                <div key={p.id ?? `${p.payment_date}-${p.amount}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '1px 0', fontSize: 12, color: '#555' }}>
                  <div>{formatDate(p.payment_date)}</div>
                  <div style={{ fontVariantNumeric: 'tabular-nums' }}>${Number(p.amount).toFixed(2)}</div>
                </div>
              ))}
            </div>
          ) : <div />}

          {/* Right — subtotal / HST / invoice total / remaining */}
          <div style={{ width: 280, flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 14px', fontSize: 13, color: '#555' }}>
              <div>Subtotal</div>
              <div>${(financials.subtotal + financials.additionalTotal).toFixed(2)}</div>
            </div>
            {financials.taxAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 14px', fontSize: 13, color: '#555' }}>
                <div>HST ({(financials.taxRate * 100).toFixed(0)}%)</div>
                <div>${financials.taxAmount.toFixed(2)}</div>
              </div>
            )}
            <div style={{ background: '#EAE2D8', padding: '9px 14px', marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#555' }}>Invoice Total</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {invoice.isPaidInFull && <div style={{ fontSize: 11, fontWeight: 700, color: '#16A34A' }}>✓ Paid</div>}
                <div className="inv-display" style={{ fontSize: 17, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: invoice.isPaidInFull ? '#16A34A' : 'inherit' }}>${financials.total.toFixed(2)}</div>
              </div>
            </div>
            {!invoice.isPaidInFull && invoice.payments?.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 14px', marginTop: 2 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#555' }}>Remaining</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#DC2626' }}>${invoice.balanceOwing.toFixed(2)}</div>
              </div>
            )}
          </div>
        </div>

        {/* Other outstanding balances for this client */}
        {invoice.otherOutstanding?.length > 0 && (
          <div style={{ marginBottom: 14, borderTop: '2px solid #EAE2D8', paddingTop: 14 }}>
            <div style={{ marginBottom: 8 }}>
              <div style={{ ...LABEL, marginBottom: 3 }}>Also Outstanding for This Client</div>
              <div style={{ fontSize: 11, color: '#888' }}>Other completed jobs with unpaid balances</div>
            </div>
            <div style={{ display: 'flex', padding: '5px 6px', background: '#F5F1EC', borderRadius: 4, marginBottom: 2, fontSize: 9, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#999' }}>
              <div style={{ width: 110 }}>Date</div>
              <div style={{ flex: 1 }}>Service</div>
              <div style={{ width: 80, textAlign: 'right' }}>Owing</div>
            </div>
            {invoice.otherOutstanding.map(({ job: otherJob, owing }) => (
              <div key={otherJob.id} style={{ display: 'flex', padding: '5px 6px', fontSize: 12, borderBottom: '1px solid #f5f5f5' }}>
                <div style={{ color: '#555', width: 110 }}>{otherJob.scheduled_date ? formatDate(otherJob.scheduled_date) : '—'}</div>
                <div style={{ color: '#1a1a1a', flex: 1 }}>{otherJob.service_name || 'Professional Services'}</div>
                <div style={{ color: '#DC2626', fontWeight: 700, textAlign: 'right', width: 80 }}>${owing.toFixed(2)}</div>
              </div>
            ))}
            <div style={{ background: '#EAE2D8', padding: '10px 14px', marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#555' }}>Total Owed — All Jobs</div>
              <div className="inv-display" style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#DC2626' }}>${invoice.runningTotalOwing.toFixed(2)}</div>
            </div>
          </div>
        )}

        {/* Also paid for this client — jobs settled together on this receipt */}
        {invoice.alsoPaid?.length > 0 && (
          <div style={{ marginBottom: 14, borderTop: '2px solid #EAE2D8', paddingTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid #eee' }}>
              <div style={{ ...LABEL }}>Also Paid for This Client</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#16A34A' }}>✓ Paid</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#16A34A', fontVariantNumeric: 'tabular-nums' }}>${invoice.totalPaidAllJobs.toFixed(2)}</div>
              </div>
            </div>
            <div style={{ display: 'flex', padding: '5px 6px', background: '#F5F1EC', borderRadius: 4, marginBottom: 2, fontSize: 9, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#999' }}>
              <div style={{ width: 110 }}>Date</div>
              <div style={{ flex: 1 }}>Service</div>
              <div style={{ width: 80, textAlign: 'right' }}>Amount</div>
            </div>
            {invoice.alsoPaid.map(({ job: paidJob, total }) => (
              <div key={paidJob.id} style={{ display: 'flex', padding: '5px 6px', fontSize: 12, borderBottom: '1px solid #f5f5f5' }}>
                <div style={{ color: '#555', width: 110 }}>{paidJob.scheduled_date ? formatDate(paidJob.scheduled_date) : '—'}</div>
                <div style={{ color: '#1a1a1a', flex: 1 }}>{paidJob.service_name || 'Professional Services'}</div>
                <div style={{ color: '#16A34A', fontWeight: 700, textAlign: 'right', width: 80 }}>✓ ${total.toFixed(2)}</div>
              </div>
            ))}
          </div>
        )}

        {/* Payment + Thank you — kept together, never split across pages */}
        <div className="invoice-footer">
          <div style={{ borderTop: '1px solid #eee', paddingTop: 9, marginBottom: 6 }}>
            {isReceipt ? (
              <>
                <div style={LABEL}>Payment Received</div>
                <div style={{ fontSize: 13, color: '#16A34A', fontWeight: 600 }}>
                  ✓ Paid in full — Receipt #{invoice.invoice_number}
                </div>
              </>
            ) : (
              <>
                <div style={LABEL}>Payment</div>
                <div style={{ fontSize: 13, color: '#444', lineHeight: 1.6 }}>
                  e-Transfer to <strong>{biz.email || 'sandra@supermomforhire.com'}</strong>
                  <div style={{ color: '#888', fontSize: 12 }}>Reference: Invoice #{invoice.invoice_number}</div>
                </div>
              </>
            )}
          </div>

          <div style={{ textAlign: 'center', paddingTop: 2 }}>
            <div className="inv-display" style={{ fontSize: 17, fontWeight: 500, color: '#777', fontStyle: 'italic' }}>
              Thank you for letting Supermom save the day.
            </div>
          </div>
        </div>

      </div>
      </div>{/* end invoice-scale-wrap */}
    </div>
  );
}
