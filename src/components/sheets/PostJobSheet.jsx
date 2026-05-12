import { useEffect, useRef, useState, useMemo } from 'react';
import { useAppTheme } from '../../context/AppThemeContext';
import { SectionLabel } from '../ui/typography';
import { fetchJobById, recordPayment } from '../../data/jobsRepo';
import { notifyDataChanged, useBusiness } from '../../data/useData';
import { useToast } from '../../context/ToastContext';
import ThankYouDraftSheet from './ThankYouDraftSheet';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { supabase } from '../../lib/supabase';
import GrabBar from '../ui/GrabBar';
import FinancialMathBreakdown from '../ui/FinancialMathBreakdown';

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
  const [done, setDone] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);
  const [invoiceId, setInvoiceId] = useState(null);
  const [costs, setCosts] = useState([{ amount: '', description: '' }]);
  const [showHoursPrompt, setShowHoursPrompt] = useState(false);
  const [pendingAdjustedAmt, setPendingAdjustedAmt] = useState(null);
  // Track whether this is the first time actualMinutes was set by job load
  // so we don't overwrite the pre-filled amount on mount
  const hoursInitialized = useRef(false);

  // Derived state defined early to satisfy linter and simplify logic
  const totalAmt = parseFloat(job?.total_amount ?? job?.flat_rate ?? 0);
  const isHourly = job?.pricing_type === 'Hourly';
  const hourlyRate = useMemo(() => {
    if (!job) return 0;
    return (Number(job.flat_rate) || (job.estimated_hours > 0 ? totalAmt / job.estimated_hours : totalAmt));
  }, [job, totalAmt]);
  
  const liveTotal = useMemo(() => {
    const liveTotalBase = isHourly ? hourlyRate * (actualMinutes / 60) : totalAmt;
    const addlTotal = costs.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);
    return Math.round((liveTotalBase + addlTotal) * 100) / 100;
  }, [isHourly, hourlyRate, actualMinutes, totalAmt, costs]);

  useEffect(() => {
    if (!jobId) return;
    let alive = true;
    Promise.resolve().then(() => setFetchErr(null));
    fetchJobById(jobId)
      .then(j => { 
        if (alive) { 
          setJob(j); 
          setJobNotes(j?.completion_notes || '');
          const fullTotal = Number(j?.total_amount ?? j?.flat_rate ?? 0);
          // For partial-paid jobs, pre-fill the remaining balance instead of full total
          if (j?.payment_status === 'Partial') {
            supabase
              .from('payments')
              .select('amount')
              .eq('job_id', jobId)
              .eq('is_void', false)
              .then(({ data: pays }) => {
                const alreadyPaid = (pays ?? []).reduce((s, p) => s + Number(p.amount), 0);
                const remaining = Math.round(Math.max(0, fullTotal - alreadyPaid) * 100) / 100;
                setAmount(String(remaining > 0 ? remaining : fullTotal));
              })
              .catch(() => setAmount(String(fullTotal)));
          } else {
            setAmount(String(fullTotal));
          }
          // Round to nearest 30-min increment
          const srcHours = j?.actual_duration || j?.estimated_hours || 1;
          const rawMin = Math.round(srcHours * 60);
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
  }, [jobId]);

  // When actual hours change after initial load, sync the payment amount (for non-partial status)
  // so the input field stays consistent with the live total shown in the header
  useEffect(() => {
    if (!hoursInitialized.current) {
      hoursInitialized.current = true;
      return;
    }
    if (!job || !isHourly) return;
    if (payStatus !== 'partial') {
      Promise.resolve().then(() => setAmount(String(Math.round(liveTotal * 100) / 100)));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actualMinutes, liveTotal, isHourly]);

  async function handleLogPayment(overrideAmt = null) {
    if (!job) return;
    const jobDate = new Date(job.scheduled_date + 'T00:00:00');
    const today = new Date();
    today.setHours(0,0,0,0);

    if (jobDate > today) {
      if (!window.confirm("Roads? Where we're going, we don't need roads... but we do need the right date! Mark this future job as complete/paid anyway?")) return;
    }

    const totalDuration = actualMinutes / 60;

    // Hourly job — if actual hours differ from estimated, prompt to adjust amount
    if (overrideAmt === null && job.pricing_type === 'Hourly' && job.estimated_hours && totalDuration !== job.estimated_hours) {
      const hRate = job.estimated_hours > 0 ? (parseFloat(amount) || 0) / job.estimated_hours : 0;
      const adjusted = Math.round(hRate * totalDuration * 100) / 100;
      if (Math.abs(adjusted - (parseFloat(amount) || 0)) > 0.5) {
        setPendingAdjustedAmt(adjusted);
        setShowHoursPrompt(true);
        return;
      }
    }

    setBusy(true);
    try {
      const baseAmt = overrideAmt !== null ? overrideAmt : (parseFloat(amount) || 0);
      const paidAmt = payStatus === 'paid' ? baseAmt : payStatus === 'partial' ? (parseFloat(amount) || 0) : 0;
      const ps = payStatus === 'paid' ? 'Paid' : payStatus === 'partial' ? 'Partial' : '';

      const validCosts = costs
        .filter(c => parseFloat(c.amount) > 0)
        .map(c => ({ amount: parseFloat(c.amount), description: c.description }));

      await recordPayment(jobId, paidAmt, method, ps, totalDuration, null, validCosts, jobNotes);

      const { data } = await supabase
        .from('invoice_jobs')
        .select('invoice_id')
        .eq('job_id', jobId)
        .maybeSingle();
      if (data) setInvoiceId(data.invoice_id);

      notifyDataChanged();
      toast.success(payStatus === 'paid' ? 'Payment recorded!' : 'Job marked complete!');
      setDone(true);
      setTimeout(onClose, 2500);
    } catch (e) {
      const msg = e.message || String(e);
      toast.error(msg);
      setBusy(false);
    }
  }

  function fmtMins(min) {
    const h = min / 60;
    if (h === 0.5) return '½ hr';
    if (h % 1 === 0.5) return `${Math.floor(h)}½ hrs`;
    if (h === 1) return '1 hr';
    return `${h} hrs`;
  }

  const isPaidRecord = job?.payment_status === 'Paid';

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
      <div style={{
        background: T.bg, width: '100%', maxWidth: 500, margin: '0 auto',
        height: '92svh', borderTopLeftRadius: 28, borderTopRightRadius: 28,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        animation: 'pjSlide 300ms cubic-bezier(0.16, 1, 0.3, 1)',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.4)',
      }}>
        <GrabBar />

        {/* Header with Live Total */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: T.bg }}>
          <div>
            <SectionLabel serif={false} style={{ marginBottom: 4 }}>Job Wrap-Up</SectionLabel>
            <div style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 500, color: T.ink }}>
              {loading ? 'Loading...' : job?.client_name || 'Done!'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: T.pink, fontFamily: T.font }}>
              ${liveTotal.toFixed(2)}
            </div>
            <div style={{ fontSize: 9, fontWeight: 700, color: T.inkMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Live Total</div>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: T.inkMuted }}>Initializing...</div>
        ) : fetchErr ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#EF4444' }}>{fetchErr}</div>
        ) : (
          <>
          <div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          
          <FinancialMathBreakdown 
            job={job}
            actualMinutes={actualMinutes}
            costs={costs}
            business={business}
            T={T}
            mode={mode}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 24 }}>
          
          {/* Section 1: Duration Adjustment */}
          <div>
          <SectionLabel>Actual Duration</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => setActualMinutes(m => Math.max(30, m - 30))} style={{ width: 44, height: 44, borderRadius: 12, border: `1.5px solid ${T.cardBorder}`, background: T.card, color: T.ink, fontSize: 20, fontWeight: 600, cursor: 'pointer' }}>–</button>
            <div style={{ flex: 1, textAlign: 'center', background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 12, padding: '10px 0' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.pink }}>{fmtMins(actualMinutes)}</div>
            </div>
            <button onClick={() => setActualMinutes(m => m + 30)} style={{ width: 44, height: 44, borderRadius: 12, border: `1.5px solid ${T.cardBorder}`, background: T.card, color: T.ink, fontSize: 20, fontWeight: 600, cursor: 'pointer' }}>+</button>
          </div>
          </div>

          {/* Section 2: Payment Toggle */}
          {!isPaidRecord && (
          <div>
          <SectionLabel>Payment Status</SectionLabel>
          <div style={{ display: 'flex', background: T.card, borderRadius: 12, padding: 4, border: `1px solid ${T.cardBorder}` }}>
            {['paid', 'partial', 'unpaid'].map(s => (
              <button
                key={s}
                onClick={() => setPayStatus(s)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 8, border: 'none',
                  background: payStatus === s ? T.pink : 'transparent',
                  color: payStatus === s ? 'white' : T.inkMuted,
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                  textTransform: 'uppercase'
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
              <SectionLabel>Payment Method & Amount</SectionLabel>
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                {['Cash', 'e-Transfer'].map(m => (
                  <button
                    key={m}
                    onClick={() => setMethod(m)}
                    style={{
                      flex: 1, padding: '10px 0', borderRadius: 10,
                      background: method === m ? (mode === 'dark' ? 'rgba(255,255,255,0.1)' : T.pinkPale) : 'transparent',
                      border: `1.5px solid ${method === m ? T.pink : T.cardBorder}`,
                      color: method === m ? T.pink : T.inkMuted,
                      fontSize: 12, fontWeight: 700, cursor: 'pointer'
                    }}
                  >
                    {m.toUpperCase()}
                  </button>
                ))}
              </div>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: T.inkMuted, fontSize: 16, fontWeight: 600 }}>$</span>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  style={{
                    width: '100%', padding: '12px 14px 12px 30px', borderRadius: 12,
                    background: T.bg, border: `1px solid ${T.cardBorder}`,
                    color: T.ink, fontSize: 16, fontWeight: 600, outline: 'none'
                  }}
                />
              </div>
              <div style={{ fontSize: 10, color: T.inkMuted, marginTop: 8, textAlign: 'center', fontWeight: 500 }}>
                {payStatus === 'paid' ? 'Full amount for this job' : 'Partial amount being paid today'}
              </div>
            </div>
          )}

          {/* Section 4: Additional Costs */}
          <div>
          <SectionLabel>Additional Costs</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {costs.map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: 8 }}>
                <div style={{ position: 'relative', width: 90 }}>
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.inkMuted, fontSize: 12 }}>$</span>
                  <input
                    type="number"
                    value={c.amount}
                    onChange={e => {
                      const newCosts = [...costs];
                      newCosts[i].amount = e.target.value;
                      setCosts(newCosts);
                    }}
                    placeholder="0"
                    style={{ width: '100%', padding: '10px 10px 10px 22px', borderRadius: 10, background: T.card, border: `1px solid ${T.cardBorder}`, color: T.ink, fontSize: 13, outline: 'none' }}
                  />
                </div>
                <input
                  value={c.description}
                  onChange={e => {
                    const newCosts = [...costs];
                    newCosts[i].description = e.target.value;
                    setCosts(newCosts);
                  }}
                  placeholder="e.g. Supplies, Parking"
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 10, background: T.card, border: `1px solid ${T.cardBorder}`, color: T.ink, fontSize: 13, outline: 'none' }}
                />
                {costs.length > 1 && (
                  <button onClick={() => setCosts(costs.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: 18, cursor: 'pointer' }}>×</button>
                )}
              </div>
            ))}
            <button
              onClick={() => setCosts([...costs, { amount: '', description: '' }])}
              style={{ background: 'none', border: 'none', color: T.pink, fontSize: 11, fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start', padding: '4px 0' }}
            >
              + ADD ANOTHER COST
            </button>
          </div>
          </div>

          {/* Section 5: Completion Notes */}
          <div>
          <SectionLabel>Post-Job Notes</SectionLabel>
          <textarea
            value={jobNotes}
            onChange={e => setJobNotes(e.target.value)}
            placeholder="Anything special happen? Client wasn't home, dog was extra cute..."
            style={{
              width: '100%', height: 80, padding: '12px', borderRadius: 12,
              background: T.card, border: `1px solid ${T.cardBorder}`,
              color: T.ink, fontSize: 13, outline: 'none', resize: 'none', fontFamily: T.font
            }}
          />
          </div>

          {/* Invoice Link if exists */}
          {invoiceId && (
            <div style={{ background: T.pinkTint, padding: '12px 16px', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.pink }}>Invoice Ready</div>
                <div style={{ fontSize: 10, color: T.pink }}>Job will be added to invoice automatically.</div>
              </div>
              <button onClick={() => window.open(`/i/${invoiceId}`, '_blank')} style={{ background: T.pink, color: 'white', border: 'none', padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>VIEW</button>
            </div>
          )}

          <div style={{ height: 40 }} />
        </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 18px 18px', borderTop: `1px solid ${T.cardBorder}`, display: 'flex', gap: 10, background: T.bg }}>
          <button onClick={onClose} style={{ flex: 1, background: 'transparent', border: `1.5px solid ${T.cardBorder}`, color: T.inkMuted, borderRadius: 12, padding: '12px 0', fontFamily: T.font, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Later</button>
          <button onClick={() => handleLogPayment()} disabled={busy || done} style={{ flex: 2, background: busy || done ? T.pinkTint : '#E91E6A', color: 'white', border: 'none', borderRadius: 12, padding: '12px 0', fontFamily: T.font, fontSize: 13, fontWeight: 700, cursor: busy || done ? 'default' : 'pointer', boxShadow: '0 4px 12px rgba(233,30,106,0.3)' }}>
            {busy ? 'Saving…' : done ? 'Success ✓' : payStatus === 'paid' ? 'Save & Log Paid' : payStatus === 'partial' ? 'Save & Log Partial' : 'Save & Close'}
          </button>
        </div>
        </>
      )}

      {/* Hours Mismatch Prompt */}
      {showHoursPrompt && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: T.card, borderRadius: 20, padding: 24, width: '100%', maxWidth: 320, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>⏱️</div>
            <Title style={{ fontSize: 18, marginBottom: 8 }}>Adjust Total?</Title>
            <Text style={{ fontSize: 14, color: T.inkMuted, marginBottom: 20 }}>
              You logged {fmtMins(actualMinutes)}, which changes the total to <strong>${pendingAdjustedAmt}</strong>. Update the payment amount to match?
            </Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={() => { setShowHoursPrompt(false); handleLogPayment(pendingAdjustedAmt); }} style={{ width: '100%', padding: '12px', borderRadius: 12, background: T.pink, color: 'white', border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Yes, update amount</button>
              <button onClick={() => { setShowHoursPrompt(false); handleLogPayment(null); }} style={{ width: '100%', padding: '12px', borderRadius: 12, background: 'transparent', border: `1.5px solid ${T.cardBorder}`, color: T.ink, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>No, keep original</button>
            </div>
          </div>
        </div>
      )}

      </div>
      <ThankYouDraftSheet isOpen={showThankYou} onClose={() => setShowThankYou(false)} jobId={jobId} />
    </div>
  );
}
