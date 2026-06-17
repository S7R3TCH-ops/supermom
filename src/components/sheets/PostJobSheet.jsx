import { useEffect, useRef, useState, useMemo } from 'react';
import { useAppTheme } from '../../context/AppThemeContext';
import { SectionLabel } from '../ui/typography';
import { fetchJobById, recordPayment, fetchOutstandingJobsForClient } from '../../data/jobsRepo';
import { addJobsToInvoice, settleInvoiceOutstanding } from '../../data/invoicesRepo';
import { computeJobTotal } from '../../lib/financialMath';
import { notifyDataChanged, useBusiness } from '../../data/useData';
import { useToast } from '../../context/ToastContext';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { supabase } from '../../lib/supabase';
import GrabBar from '../ui/GrabBar';
import FinancialMathBreakdown from '../ui/FinancialMathBreakdown';
import { useSwipeToDismiss } from '../../hooks/useSwipeToDismiss';
import { triggerHaptic } from '../../lib/haptics';

export default function PostJobSheet({ jobId, onClose }) {
  const { T, mode } = useAppTheme();
  const { business } = useBusiness();
  const toast = useToast();
  const sheetRef = useRef(null);
  useFocusTrap(sheetRef, true, onClose);
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchErr, setFetchErr] = useState(null);
  const [method, setMethod] = useState('Cash');
  const [amount, setAmount] = useState('');
  const [actualMinutes, setActualMinutes] = useState(60);
  const [jobNotes, setJobNotes] = useState('');
  // payStatus: 'paid' | 'partial' | 'unpaid'
  const [payStatus, setPayStatus] = useState('paid');
  const [busy, setBusy] = useState(false);
  // phase: 'form' | 'checking' | 'bundle' | 'nudge'
  const [phase, setPhase] = useState('form');
  const [savedPs, setSavedPs] = useState(null);
  const [invoiceId, setInvoiceId] = useState(null);
  const [clientOutstanding, setClientOutstanding] = useState([]);
  const [bundleSelected, setBundleSelected] = useState(new Set());
  const [bundleBusy, setBundleBusy] = useState(false);
  const [jobPayments, setJobPayments] = useState([]);
  const [costs, setCosts] = useState([{ amount: '', description: '' }]);
  const [workerPaid, setWorkerPaid] = useState(false);
  const [taxEnabled, setTaxEnabled] = useState(false);
  const { panelRef: swipePanelRef, scrollRef: swipeScrollRef, handlers: swipeHandlers } = useSwipeToDismiss(onClose);

  // Derived state defined early to satisfy linter and simplify logic
  // Use flat_rate (pre-tax base set at booking) or subtotal DB column (pre-tax base written by recordPayment).
  // Never use total_amount — it becomes tax-inclusive after recordPayment runs, causing double-HST.
  const totalAmt = parseFloat(job?.flat_rate ?? job?.subtotal ?? 0);
  const isHourly = job?.pricing_type === 'Hourly';
  const hourlyRate = useMemo(() => {
    if (!job) return 0;
    return (Number(job.flat_rate) || (job.estimated_hours > 0 ? totalAmt / job.estimated_hours : totalAmt));
  }, [job, totalAmt]);
  
  const liveSubtotal = useMemo(() => {
    const base = isHourly ? hourlyRate * (actualMinutes / 60) : totalAmt;
    const addl = costs.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);
    return Math.round((base + addl) * 100) / 100;
  }, [isHourly, hourlyRate, actualMinutes, totalAmt, costs]);

  const liveHst = useMemo(() => {
    if (!job) return 0;
    if (taxEnabled) {
      return Math.round(liveSubtotal * Number(business?.hst_rate ?? 0.13) * 100) / 100;
    }
    return 0;
  }, [job, taxEnabled, liveSubtotal, business]);

  const liveTotal = useMemo(() => {
    return Math.round((liveSubtotal + liveHst) * 100) / 100;
  }, [liveSubtotal, liveHst]);

  const liveBreakdownForm = useMemo(() => {
    if (!job) return null;
    return {
      pricing_type: job.pricing_type,
      estimated_hours: actualMinutes / 60,
      hourly_rate: isHourly ? hourlyRate : undefined,
      total_amount: isHourly ? undefined : totalAmt,
      tax_enabled: taxEnabled,
      additional_costs_json: costs
        .filter(c => parseFloat(c.amount) > 0)
        .map(c => ({ amount: parseFloat(c.amount), description: c.description })),
    };
  }, [job, actualMinutes, isHourly, hourlyRate, totalAmt, taxEnabled, costs]);

  const alreadyPaid = useMemo(
    () => jobPayments.reduce((s, p) => s + Number(p.amount), 0),
    [jobPayments]
  );

  useEffect(() => {
    if (!jobId) return;
    let alive = true;
    Promise.resolve().then(() => setFetchErr(null));
    fetchJobById(jobId)
      .then(j => { 
        if (alive) { 
          setJob(j);
          setJobNotes(j?.completion_notes || '');
          setWorkerPaid(!!j?.worker_paid);
          setTaxEnabled(j?.tax_enabled ?? (business?.tax_enabled ?? false));
          supabase
            .from('payments')
            .select('amount, payment_date, payment_method')
            .eq('job_id', jobId)
            .eq('is_void', false)
            .order('payment_date', { ascending: true })
            .then(({ data: pays }) => {
              setJobPayments(pays ?? []);
              if (j?.payment_status === 'Partial') {
                setPayStatus('paid');
              }
            });
          // Round to nearest 30-min increment
          const initHours = j?.actual_duration || j?.estimated_hours || 1;
          const rawMin = Math.round(initHours * 60);
          const snapped = Math.max(30, Math.round(rawMin / 30) * 30);
          setActualMinutes(snapped);
          setCosts([{ amount: '', description: '' }]);
          if (j?.additional_costs_json?.length > 0) {
            setCosts(j.additional_costs_json.map(c => ({ amount: String(c.amount), description: c.description || '' })));
          } else if (j?.additional_cost > 0) {
            setCosts([{ amount: String(j.additional_cost), description: j.additional_cost_notes || '' }]);
          }

          supabase
            .from('invoice_jobs')
            .select('invoice_id')
            .eq('job_id', jobId)
            .maybeSingle()
            .then(({ data }) => {
              if (data && alive) setInvoiceId(data.invoice_id);
            });
        } 
      })
      .catch(e => { if (alive) setFetchErr(e.message || String(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [jobId, business?.tax_enabled]);

  // Keep the payment amount field in sync with the live total (HST-inclusive).
  // Whenever liveTotal, alreadyPaid, or payStatus changes, re-derive the default.
  // 'partial' is skipped so the user can type a custom partial amount freely.
  useEffect(() => {
    if (!job || payStatus === 'partial') return;
    const balance = Math.max(0, Math.round((liveTotal - alreadyPaid) * 100) / 100);
    setAmount(String(balance > 0 ? balance : liveTotal));
  }, [liveTotal, alreadyPaid, payStatus, job]);

  async function handleLogPayment() {
    if (!job) return;
    const jobDate = new Date(job.scheduled_date + 'T00:00:00');
    const today = new Date();
    today.setHours(0,0,0,0);

    if (jobDate > today) {
      if (!window.confirm("Roads? Where we're going, we don't need roads... but we do need the right date! Mark this future job as complete/paid anyway?")) return;
    }

    const totalDuration = actualMinutes / 60;

    setBusy(true);
    triggerHaptic('light');
    try {
      const paidAmt = payStatus === 'paid' ? (parseFloat(amount) || 0) : payStatus === 'partial' ? (parseFloat(amount) || 0) : 0;
      let ps = payStatus === 'paid' ? 'Paid' : payStatus === 'partial' ? 'Partial' : '';
      if (ps === 'Paid' && alreadyPaid + paidAmt < liveTotal - 0.01) ps = 'Partial';
      if (ps === 'Partial' && alreadyPaid + paidAmt >= liveTotal - 0.01) ps = 'Paid';

      const validCosts = costs
        .filter(c => parseFloat(c.amount) > 0)
        .map(c => ({ amount: parseFloat(c.amount), description: c.description }));

      await recordPayment(jobId, paidAmt, method, ps, totalDuration, null, validCosts, jobNotes, job?.worker_name ? workerPaid : null, taxEnabled);

      const { data } = await supabase
        .from('invoice_jobs')
        .select('invoice_id')
        .eq('job_id', jobId)
        .maybeSingle();
      if (data) setInvoiceId(data.invoice_id);

      notifyDataChanged();
      setSavedPs(ps);
      setPhase('checking');
      triggerHaptic('success');

      // Check for other outstanding jobs for this client before opening PDF
      try {
        const outstanding = await fetchOutstandingJobsForClient(job.client_id, jobId);
        if (outstanding.length > 0) {
          setClientOutstanding(outstanding);
          setBundleSelected(new Set(outstanding.map(j => j.id)));
          setPhase('bundle');
        } else {
          setPhase('nudge');
        }
      } catch (_) {
        setPhase('nudge');
      }
      setBusy(false);
    } catch (e) {
      const msg = e.message || String(e);
      toast.error(msg);
      setBusy(false);
      triggerHaptic('error');
    }
  }

  function fmtMins(min) {
    if (!min) return '0 hrs';
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return h === 1 ? '1 hr' : `${h} hrs`;
    if (m === 30) return h === 1 ? '1½ hrs' : `${h}½ hrs`;
    return `${h}h ${m}m`;
  }

  const isPaidRecord = job?.payment_status === 'Paid';
  const isNudge = phase === 'nudge';
  const isBundle = phase === 'bundle';
  const isChecking = phase === 'checking';

  return (
    <div ref={sheetRef} role="dialog" aria-modal="true" aria-label="Complete job" style={{
      position: 'fixed', inset: 0, zIndex: 60,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      background: 'rgba(4,1,12,0.65)',
      animation: 'pjFade 180ms ease-out',
    }}>
      <style>{`
        @keyframes pjFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pjSlide { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
      <div ref={swipePanelRef} {...swipeHandlers} style={{
        background: T.bg, width: '100%', maxWidth: 500, margin: '0 auto',
        height: '92svh', borderTopLeftRadius: 28, borderTopRightRadius: 28,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        animation: 'pjSlide 300ms cubic-bezier(0.16, 1, 0.3, 1)',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.4)',
      }}>
        <GrabBar onDismiss={onClose} />

        {/* Header with Live Total */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: T.bg }}>
          <div>
            <SectionLabel serif={false} style={{ marginBottom: 4 }}>Job wrap-up</SectionLabel>
            <div style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 500, color: T.ink }}>
              {loading ? 'Loading...' : job?.client_name || 'Done!'}
            </div>
            {!loading && job?.worker_name && (
              <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 3 }}>
                {job.assignee_type === 'staff' ? '🌟 Wingmom:' : '🦸 Sidekick:'} {job.worker_name}{job.worker_pay != null ? <span style={{ opacity: 0.7 }}> · ${Number(job.worker_pay).toFixed(0)} pay</span> : ''}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ textAlign: 'right' }}>
              {alreadyPaid > 0 ? (
                <>
                  <div style={{ fontSize: 22, fontWeight: 900, color: T.pink, fontFamily: T.font }}>
                    ${(liveTotal - alreadyPaid).toFixed(2)}
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: T.inkMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Balance due</div>
                  <div style={{ fontSize: 9, color: T.inkMuted, marginTop: 1 }}>
                    ${liveTotal.toFixed(2)} total · ${alreadyPaid.toFixed(2)} paid
                  </div>
                </>
              ) : liveHst > 0 ? (
                <>
                  <div style={{ fontSize: 22, fontWeight: 900, color: T.pink, fontFamily: T.font }}>
                    ${liveTotal.toFixed(2)}
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: T.inkMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Total to collect</div>
                  <div style={{ fontSize: 9, color: T.inkMuted, marginTop: 1 }}>
                    ${liveSubtotal.toFixed(2)} + ${liveHst.toFixed(2)} HST
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 22, fontWeight: 900, color: T.pink, fontFamily: T.font }}>
                    ${liveTotal.toFixed(2)}
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: T.inkMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Live total</div>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                width: 44, height: 44, borderRadius: '50%',
                background: 'transparent', border: 'none', color: T.ink, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                marginRight: -10, marginTop: -4,
              }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'rgba(0,0,0,0.07)', border: '1.5px solid rgba(0,0,0,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              </div>
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: T.inkMuted }}>Initializing...</div>
        ) : fetchErr ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#EF4444' }}>{fetchErr}</div>
        ) : isChecking ? (
          /* ── Checking outstanding jobs ── */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '32px 24px', gap: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 32 }}>✓</div>
            <div style={{ fontSize: 14, color: T.inkMuted }}>Checking outstanding invoices…</div>
          </div>

        ) : isBundle ? (
          /* ── Bundle outstanding jobs pre-flight ── */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px 20px', gap: 0 }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 500, color: T.ink, marginBottom: 6 }}>
                {job?.client_name || 'This client'} has other open invoices
              </div>
              <div style={{ fontSize: 13, color: T.inkMuted, lineHeight: 1.45 }}>
                {savedPs !== 'Paid' && savedPs !== 'Partial'
                  ? 'Do you want to bundle these on the same invoice?'
                  : 'Did this payment also cover any of these?'}
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {clientOutstanding.map(j => {
                const svcName = j.services?.name || 'Service';
                const dateStr = j.scheduled_date
                  ? new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', timeZone: 'America/Toronto' }).format(new Date(j.scheduled_date + 'T12:00:00'))
                  : '';
                const total = computeJobTotal(j);
                const isSelected = bundleSelected.has(j.id);
                return (
                  <label
                    key={j.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                      background: isSelected ? T.pinkTint : T.card,
                      border: `1.5px solid ${isSelected ? T.pink : T.cardBorder}`,
                      borderRadius: 12, padding: '12px 14px', transition: 'all 0.15s',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        setBundleSelected(prev => {
                          const next = new Set(prev);
                          next.has(j.id) ? next.delete(j.id) : next.add(j.id);
                          return next;
                        });
                      }}
                      style={{ width: 18, height: 18, accentColor: T.pink, flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{svcName}</div>
                      <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 2 }}>
                        {dateStr}
                        {j.payment_status === 'Partial' && (
                          <span style={{ marginLeft: 6, background: T.amberBg, color: T.amberFg, borderRadius: 4, padding: '1px 5px', fontSize: 10, fontWeight: 700 }}>Partial</span>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, fontVariantNumeric: 'tabular-nums' }}>
                      ${total.toFixed(2)}
                    </div>
                  </label>
                );
              })}
            </div>

            <div style={{ paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type="button"
                disabled={bundleBusy || bundleSelected.size === 0}
                onClick={async () => {
                  if (bundleSelected.size === 0) { setPhase('nudge'); return; }
                  setBundleBusy(true);
                  try {
                    const ids = [...bundleSelected];
                    if (savedPs !== 'Paid' && savedPs !== 'Partial') {
                      await addJobsToInvoice(invoiceId, ids);
                    } else {
                      await settleInvoiceOutstanding(invoiceId, method, ids);
                    }
                    notifyDataChanged();
                  } catch (_) {
                    // non-fatal — proceed to nudge regardless
                  }
                  setBundleBusy(false);
                  setPhase('nudge');
                }}
                style={{
                  width: '100%', padding: '14px', borderRadius: 12,
                  background: bundleSelected.size === 0 ? T.cardBorder : T.pink,
                  color: bundleSelected.size === 0 ? T.inkMuted : 'white',
                  border: 'none', fontFamily: T.font, fontSize: 14, fontWeight: 700,
                  cursor: bundleBusy || bundleSelected.size === 0 ? 'default' : 'pointer',
                  boxShadow: bundleSelected.size > 0 ? '0 4px 12px rgba(233,30,106,0.3)' : 'none',
                  minHeight: 44,
                }}
              >
                {bundleBusy ? 'Saving…' : savedPs !== 'Paid' && savedPs !== 'Partial'
                  ? `Add ${bundleSelected.size} job${bundleSelected.size !== 1 ? 's' : ''} to invoice`
                  : `Yes, mark ${bundleSelected.size} paid`}
              </button>
              <button
                type="button"
                onClick={() => setPhase('nudge')}
                disabled={bundleBusy}
                style={{
                  width: '100%', padding: '13px', borderRadius: 12,
                  background: 'transparent', border: `1.5px solid ${T.cardBorder}`,
                  color: T.inkMuted, fontFamily: T.font, fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', minHeight: 44,
                }}
              >
                No, keep separate
              </button>
            </div>
          </div>

        ) : isNudge ? (
          /* ── Success + send nudge ── */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '32px 24px', gap: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 48 }}>✓</div>
            <div>
              <div style={{ fontFamily: T.serif, fontSize: 22, fontWeight: 500, color: T.ink, marginBottom: 6 }}>
                {savedPs === 'Paid' ? 'Receipt ready!' : savedPs === 'Partial' ? 'Payment saved!' : 'Invoice ready!'}
              </div>
              {invoiceId && (
                <div style={{ fontSize: 14, color: T.inkMuted, lineHeight: 1.4 }}>
                  {savedPs === 'Paid'
                    ? `Want to send the receipt to ${job?.client_name || 'the client'}?`
                    : `Want to send ${savedPs === 'Partial' ? 'the updated invoice' : 'the invoice'} to ${job?.client_name || 'the client'}?`}
                </div>
              )}
            </div>
            {invoiceId ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
                <button
                  type="button"
                  onClick={() => { window.open(`/i/${invoiceId}`, '_blank'); onClose(); }}
                  style={{ width: '100%', padding: '14px', borderRadius: 12, background: T.pink, color: 'white', border: 'none', fontFamily: T.font, fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(233,30,106,0.3)' }}
                >
                  {savedPs === 'Paid' ? 'Send Receipt' : 'Send Invoice'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  style={{ width: '100%', padding: '13px', borderRadius: 12, background: 'transparent', border: `1.5px solid ${T.cardBorder}`, color: T.inkMuted, fontFamily: T.font, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                >
                  Not now
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onClose}
                style={{ width: '100%', padding: '14px', borderRadius: 12, background: T.pink, color: 'white', border: 'none', fontFamily: T.font, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
              >
                Done
              </button>
            )}
          </div>
        ) : (
          <>
          <div ref={swipeScrollRef} className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Section 1: Duration Adjustment */}
          <div>
          <SectionLabel>Actual duration</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="button" onClick={() => setActualMinutes(m => Math.max(30, m - 30))} aria-label="Decrease duration" style={{ width: 44, height: 44, borderRadius: 12, border: `1.5px solid ${T.cardBorder}`, background: T.card, color: T.ink, fontSize: 20, fontWeight: 600, cursor: 'pointer' }}>–</button>
            <div style={{ flex: 1, textAlign: 'center', background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 12, padding: '10px 0' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.pink }}>{fmtMins(actualMinutes)}</div>
            </div>
            <button type="button" onClick={() => setActualMinutes(m => m + 30)} aria-label="Increase duration" style={{ width: 44, height: 44, borderRadius: 12, border: `1.5px solid ${T.cardBorder}`, background: T.card, color: T.ink, fontSize: 20, fontWeight: 600, cursor: 'pointer' }}>+</button>
          </div>
          </div>

          {/* Section 2: Payment Toggle */}
          {!isPaidRecord && (
          <div>
          <SectionLabel>Payment status</SectionLabel>
          <div style={{ display: 'flex', background: T.card, borderRadius: 12, padding: 4, border: `1px solid ${T.cardBorder}` }}>
            {['paid', 'partial', 'unpaid'].map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setPayStatus(s)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 8, border: 'none',
                  background: payStatus === s ? T.pink : 'transparent',
                  color: payStatus === s ? 'white' : T.inkMuted,
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                  textTransform: 'capitalize'
                }}
              >
                {s}
              </button>
            ))}
          </div>
          </div>
          )}

          {/* Section 3: Amount & Method */}
          {payStatus !== 'unpaid' && !isPaidRecord && (
            <div style={{ background: T.card, padding: 16, borderRadius: 16, border: `1px solid ${T.cardBorder}` }}>
              <SectionLabel>{alreadyPaid > 0 ? 'Remaining balance' : 'Payment method & amount'}</SectionLabel>
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                {['Cash', 'e-Transfer'].map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    style={{
                      flex: 1, padding: '10px 0', borderRadius: 10,
                      background: method === m ? (mode === 'dark' ? 'rgba(255,255,255,0.1)' : T.pinkPale) : 'transparent',
                      border: `1.5px solid ${method === m ? T.pink : T.cardBorder}`,
                      color: method === m ? T.pink : T.inkMuted,
                      fontSize: 12, fontWeight: 700, cursor: 'pointer'
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
              {alreadyPaid > 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'rgba(245,158,11,0.10)',
                  border: '1px solid rgba(245,158,11,0.35)',
                  borderRadius: 10,
                  padding: '8px 12px',
                  marginBottom: 10,
                }}>
                  <span style={{ fontSize: 14 }}>✓</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#92400E' }}>
                    Pre-paid: ${alreadyPaid.toFixed(2)}
                  </span>
                  <span style={{ fontSize: 11, color: '#B45309', marginLeft: 'auto' }}>
                    of ${liveTotal.toFixed(2)} total
                  </span>
                </div>
              )}
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: T.inkMuted, fontSize: 16, fontWeight: 600 }}>$</span>
                <input
                  type="number"
                  className="sm-input"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  onFocus={e => e.target.select()}
                  placeholder={alreadyPaid > 0 ? `Remaining: $${Math.max(0, liveTotal - alreadyPaid).toFixed(2)}` : '0.00'}
                  style={{
                    width: '100%', padding: '12px 14px 12px 30px', borderRadius: 12,
                    background: T.bg, border: `1px solid ${T.cardBorder}`,
                    color: T.ink, fontSize: 16, fontWeight: 600
                  }}
                />
              </div>
              <div style={{ fontSize: 10, color: T.inkMuted, marginTop: 8, textAlign: 'center', fontWeight: 500 }}>
                {alreadyPaid > 0
                  ? `Balance after pre-payment of $${alreadyPaid.toFixed(2)}`
                  : payStatus === 'paid'
                    ? 'Full amount for this job'
                    : 'Partial amount being paid today'}
              </div>
            </div>
          )}

          {/* Section 4: Additional Costs */}
          <div>
          <SectionLabel>Additional costs</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {costs.map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: 8 }}>
                <div style={{ position: 'relative', width: 90 }}>
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.inkMuted, fontSize: 12 }}>$</span>
                  <input
                    type="number"
                    className="sm-input"
                    value={c.amount}
                    onChange={e => {
                      const newCosts = [...costs];
                      newCosts[i].amount = e.target.value;
                      setCosts(newCosts);
                    }}
                    onFocus={e => e.target.select()}
                    placeholder="0"
                    style={{ width: '100%', padding: '10px 10px 10px 22px', borderRadius: 10, background: T.card, border: `1px solid ${T.cardBorder}`, color: T.ink, fontSize: 13 }}
                  />
                </div>
                <input
                  className="sm-input"
                  value={c.description}
                  onChange={e => {
                    const newCosts = [...costs];
                    newCosts[i].description = e.target.value;
                    setCosts(newCosts);
                  }}
                  placeholder="e.g. Supplies, Parking"
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 10, background: T.card, border: `1px solid ${T.cardBorder}`, color: T.ink, fontSize: 13 }}
                />
                {costs.length > 1 && (
                  <button type="button" onClick={() => setCosts(costs.filter((_, idx) => idx !== i))} aria-label="Remove cost" style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>×</button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setCosts([...costs, { amount: '', description: '' }])}
              style={{ background: 'none', border: 'none', color: T.pink, fontSize: 11, fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start', padding: '8px 0' }}
            >
              + Add another cost
            </button>
          </div>
          </div>

          {/* Section 5: Worker Pay confirmation */}
          {job?.worker_name && job?.worker_pay != null && (
          <div style={{ background: T.card, padding: 14, borderRadius: 14, border: `1px solid ${T.cardBorder}` }}>
            <SectionLabel style={{ marginBottom: 8 }}>Worker pay</SectionLabel>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontFamily: T.font, fontSize: 13, color: T.ink }}>
                {job.assignee_type === 'staff' ? '🌟' : '🦸'} {job.worker_name}
                <span style={{ color: T.inkMuted, marginLeft: 6 }}>· ${Number(job.worker_pay).toFixed(0)}</span>
              </div>
              <button
                type="button"
                onClick={() => setWorkerPaid(p => !p)}
                style={{
                  background: workerPaid ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.12)',
                  border: `1.5px solid ${workerPaid ? '#22C55E' : '#F59E0B'}`,
                  borderRadius: 8, padding: '5px 12px', cursor: 'pointer',
                  fontFamily: T.font, fontSize: 11, fontWeight: 700,
                  color: workerPaid ? '#16A34A' : '#B45309',
                  minHeight: 32,
                }}
              >
                {workerPaid ? 'Paid ✓' : 'Mark paid'}
              </button>
            </div>
          </div>
          )}

          {/* Section 6: HST Toggle — only show when business has HST enabled */}
          {business?.tax_enabled && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: T.card, padding: '12px 16px', borderRadius: 14, border: `1px solid ${T.cardBorder}` }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>Charge HST</div>
              <div style={{ fontSize: 10, color: T.inkMuted, marginTop: 2 }}>
                {taxEnabled ? `+$${liveHst.toFixed(2)} HST included in total` : 'No HST on this job'}
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={taxEnabled}
              onClick={() => setTaxEnabled(v => !v)}
              style={{ width: 44, height: 26, borderRadius: 13, background: taxEnabled ? T.pink : T.inkMuted, border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
            >
              <span style={{ position: 'absolute', top: 3, left: taxEnabled ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', display: 'block' }} />
            </button>
          </div>
          )}

          {/* Section 7: Completion Notes */}
          <div>
          <SectionLabel>Post-job notes</SectionLabel>
          <textarea
            className="sm-input"
            value={jobNotes}
            onChange={e => setJobNotes(e.target.value)}
            placeholder="Anything special happen? Client wasn't home, dog was extra cute..."
            style={{
              width: '100%', height: 80, padding: '12px', borderRadius: 12,
              background: T.card, border: `1px solid ${T.cardBorder}`,
              color: T.ink, fontSize: 13, resize: 'none', fontFamily: T.font
            }}
          />
          </div>

          {/* Financial Breakdown */}
          <FinancialMathBreakdown
            job={job}
            liveForm={liveBreakdownForm}
            payments={jobPayments}
            business={business}
            T={T}
            mode={mode}
          />


          <div style={{ height: 40 }} />
        </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 18px 18px', borderTop: `1px solid ${T.cardBorder}`, display: 'flex', gap: 10, background: T.bg }}>
          <button type="button" onClick={onClose} style={{ flex: 1, background: 'transparent', border: `1.5px solid ${T.cardBorder}`, color: T.inkMuted, borderRadius: 12, padding: '12px 0', fontFamily: T.font, fontSize: 13, fontWeight: 600, cursor: 'pointer', minHeight: 44 }}>Later</button>
          <button type="button" onClick={() => handleLogPayment()} disabled={busy} style={{ flex: 2, background: busy ? T.pinkTint : T.pink, color: 'white', border: 'none', borderRadius: 12, padding: '12px 0', fontFamily: T.font, fontSize: 13, fontWeight: 700, cursor: busy ? 'default' : 'pointer', boxShadow: '0 4px 12px rgba(233,30,106,0.3)', minHeight: 44 }}>
            {busy ? 'Saving…' : payStatus === 'paid' ? 'Save & log paid' : payStatus === 'partial' ? 'Save & log partial' : 'Save & close'}
          </button>
        </div>
        </>
      )}

      </div>
    </div>
  );
}
