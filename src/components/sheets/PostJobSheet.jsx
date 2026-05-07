import { useEffect, useState, useRef } from 'react';
import { useAppTheme } from '../../context/AppThemeContext';
import { SectionLabel } from '../ui/typography';
import { fetchJobById, recordPayment } from '../../data/jobsRepo';
import { notifyDataChanged } from '../../data/useData';
import { useToast } from '../../context/ToastContext';
import ThankYouDraftSheet from './ThankYouDraftSheet';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { supabase } from '../../lib/supabase';
import GrabBar from '../ui/GrabBar';

export default function PostJobSheet({ jobId, onClose }) {
  const { T, mode } = useAppTheme();
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
  const [mutErr, setMutErr] = useState(null);
  const [done, setDone] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);
  const [invoiceId, setInvoiceId] = useState(null);
  const [costs, setCosts] = useState([{ amount: '', description: '' }]);
  const [showHoursPrompt, setShowHoursPrompt] = useState(false);
  const [pendingAdjustedAmt, setPendingAdjustedAmt] = useState(null);

  useEffect(() => {
    setLoading(true);
    setFetchErr(null);
    fetchJobById(jobId)
      .then(j => {
        setJob(j);
        setAmount(String(j?.total_amount ?? j?.flat_rate ?? 0));
        setJobNotes(j?.completion_notes || '');
        // Round to nearest 30-min increment
        const srcHours = j?.actual_duration || j?.estimated_hours || 1;
        const rawMin = Math.round(srcHours * 60);
        const snapped = Math.max(30, Math.round(rawMin / 30) * 30);
        setActualMinutes(snapped);
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
            if (data) setInvoiceId(data.invoice_id);
          });
      })
      .catch(e => setFetchErr(e.message))
      .finally(() => setLoading(false));
  }, [jobId]);

  async function handleLogPayment(overrideAmt = null) {
    const jobDate = new Date(job.scheduled_date + 'T00:00:00');
    const today = new Date();
    today.setHours(0,0,0,0);

    if (jobDate > today) {
      if (!window.confirm("Roads? Where we're going, we don't need roads... but we do need the right date! Mark this future job as complete/paid anyway?")) return;
    }

    const totalDuration = actualMinutes / 60;

    // Bug 4: Hourly job — if actual hours differ from estimated, prompt to adjust amount
    if (overrideAmt === null && job.pricing_type === 'Hourly' && job.estimated_hours && totalDuration !== job.estimated_hours) {
      const hourlyRate = job.estimated_hours > 0 ? (parseFloat(amount) || 0) / job.estimated_hours : 0;
      const adjusted = Math.round(hourlyRate * totalDuration * 100) / 100;
      if (Math.abs(adjusted - (parseFloat(amount) || 0)) > 0.5) {
        setPendingAdjustedAmt(adjusted);
        setShowHoursPrompt(true);
        return;
      }
    }

    setBusy(true);
    setMutErr(null);
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
      setMutErr(msg);
      setBusy(false);
    }
  }

  const isPaidRecord = job?.payment_status === 'Paid';
  const totalAmt = parseFloat(job?.total_amount ?? job?.flat_rate ?? 0);

  function fmtMins(min) {
    const h = min / 60;
    if (h === 0.5) return '½ hr';
    if (h % 1 === 0.5) return `${Math.floor(h)}½ hrs`;
    if (h === 1) return '1 hr';
    return `${h} hrs`;
  }

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

      <div onClick={onClose} style={{ flex: 1, minHeight: 40 }} />

      <div onClick={e => e.stopPropagation()} style={{
        background: T.bg, color: T.ink,
        borderRadius: '24px 24px 0 0',
        boxShadow: '0 -10px 40px rgba(0,0,0,0.38)',
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        animation: 'pjSlide 260ms cubic-bezier(0.2,0.8,0.2,1)',
        border: `1px solid ${T.cardBorder}`, borderBottom: 'none',
      }}>
        <GrabBar onDismiss={onClose} />

        {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: T.inkMuted }}>Loading…</div>
      ) : fetchErr ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#EF4444' }}>{fetchErr}</div>
      ) : (
        <>
        <div style={{
          background: 'linear-gradient(145deg,#1C1C1E 0%,#2C2C2E 100%)',
          borderBottom: '3px solid #E91E6A',
          padding: '12px 18px 16px',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -50, right: -30, width: 150, height: 150, borderRadius: '50%', background: `radial-gradient(circle,${T.pinkGlow} 0%,transparent 65%)`, pointerEvents: 'none' }} />
          <div style={{ fontFamily: T.font, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: mode === 'dark' ? '#FF78B0' : T.pink, marginBottom: 6, position: 'relative' }}>
            ✦ MISSION WRAP-UP
          </div>

          {!loading && !fetchErr && job && (
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontFamily: T.font, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: mode === 'dark' ? 'rgba(255,255,255,0.4)' : T.inkMuted, marginBottom: 2 }}>
                  {job.service_name}
                </div>
                <div style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 500, color: mode === 'dark' ? 'white' : T.ink, letterSpacing: '-0.4px' }}>
                  {job.client_name}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: T.serif, fontSize: 28, fontWeight: 500, color: mode === 'dark' ? 'white' : T.ink, letterSpacing: '-1px', fontVariantNumeric: 'tabular-nums' }}>
                  ${totalAmt.toFixed(0)}
                </div>
                <div style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, color: mode === 'dark' ? 'rgba(255,255,255,0.5)' : T.inkMuted, textTransform: 'uppercase', marginTop: 2 }}>
                   {isPaidRecord ? 'RECORDED ✓' : 'WRAP-UP'}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '10px 18px 20px' }}>

          {/* Bug 4 — Hours adjustment prompt */}
          {showHoursPrompt && pendingAdjustedAmt !== null && (
            <div style={{ background: mode === 'dark' ? 'rgba(245,158,11,0.12)' : '#FEF3C7', border: '1.5px solid rgba(245,158,11,0.5)', borderRadius: 16, padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ fontFamily: T.font, fontSize: 13, fontWeight: 700, color: mode === 'dark' ? '#FCD34D' : '#92400E', marginBottom: 6 }}>Actual hours differ from estimate</div>
              <div style={{ fontFamily: T.font, fontSize: 12, color: mode === 'dark' ? 'rgba(255,255,255,0.7)' : '#78350F', marginBottom: 12, lineHeight: 1.4 }}>
                Adjust the total to <strong>${pendingAdjustedAmt.toFixed(0)}</strong> based on actual time, or keep the original <strong>${parseFloat(amount).toFixed(0)}</strong>?
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setAmount(String(pendingAdjustedAmt)); setShowHoursPrompt(false); handleLogPayment(pendingAdjustedAmt); }} style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: '#F59E0B', border: 'none', color: 'white', fontFamily: T.font, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Adjust to ${pendingAdjustedAmt.toFixed(0)}</button>
                <button onClick={() => { setShowHoursPrompt(false); handleLogPayment(parseFloat(amount) || 0); }} style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: T.card, border: `1.5px solid ${T.cardBorder}`, color: T.inkSub, fontFamily: T.font, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Keep ${parseFloat(amount).toFixed(0)}</button>
              </div>
            </div>
          )}

          <SectionLabel>Actual Duration</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 12, padding: '8px 10px', marginBottom: 18 }}>
            <button onClick={() => setActualMinutes(m => Math.max(30, m - 30))} style={{ width: 36, height: 36, borderRadius: 10, background: mode === 'dark' ? 'rgba(255,255,255,0.05)' : T.pinkTint, border: `1px solid ${T.cardBorder}`, color: T.pink, fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 500, color: T.ink }}>{fmtMins(actualMinutes)}</div>
              <div style={{ fontFamily: T.font, fontSize: 9.5, color: T.inkMuted }}>actual time</div>
            </div>
            <button onClick={() => setActualMinutes(m => Math.min(720, m + 30))} style={{ width: 36, height: 36, borderRadius: 10, background: mode === 'dark' ? 'rgba(255,255,255,0.05)' : T.pinkTint, border: `1px solid ${T.cardBorder}`, color: T.pink, fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
          </div>

          <SectionLabel>Payment Status</SectionLabel>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {[
              { key: 'paid',    label: 'Paid ✓',       activeColor: '#22C55E', activeBg: 'rgba(34,197,94,0.1)' },
              { key: 'partial', label: 'Partial',       activeColor: '#F59E0B', activeBg: 'rgba(245,158,11,0.1)' },
              { key: 'unpaid',  label: 'Not paid yet',  activeColor: '#E91E6A', activeBg: 'rgba(233,30,106,0.08)' },
            ].map(({ key, label, activeColor, activeBg }) => (
              <button key={key} onClick={() => setPayStatus(key)} style={{ flex: 1, padding: '10px 4px', borderRadius: 10, border: `1.5px solid ${payStatus === key ? activeColor : T.cardBorder}`, background: payStatus === key ? activeBg : 'transparent', color: payStatus === key ? activeColor : T.inkMuted, fontFamily: T.font, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
            ))}
          </div>

          {(payStatus === 'paid' || payStatus === 'partial') && (
            <div style={{ animation: 'pjFade 200ms ease' }}>
              <SectionLabel>Payment Method & Amount</SectionLabel>
              <div style={{ display: 'flex', background: mode === 'dark' ? 'rgba(255,255,255,0.04)' : '#FFF0F7', borderRadius: 10, padding: 3, marginBottom: 10 }}>
                {['Cash', 'e-Transfer'].map(m => (
                  <button key={m} onClick={() => setMethod(m)} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: method === m ? '#E91E6A' : 'transparent', fontFamily: T.font, fontSize: 12, fontWeight: 600, color: method === m ? 'white' : T.inkSub, cursor: 'pointer' }}>{m}</button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 12, padding: '10px 14px', marginBottom: payStatus === 'partial' ? 8 : 18 }}>
                <span style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 500, color: T.inkSub }}>$</span>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontFamily: T.serif, fontSize: 22, fontWeight: 500, color: T.ink }} />
              </div>
              {payStatus === 'partial' && (
                <div style={{ background: mode === 'dark' ? 'rgba(245,158,11,0.08)' : '#FEF9C3', borderRadius: 10, padding: '8px 12px', marginBottom: 18, fontFamily: T.font, fontSize: 12, color: mode === 'dark' ? '#FCD34D' : '#92400E' }}>
                  Balance owing: <strong>${Math.max(0, totalAmt - (parseFloat(amount) || 0)).toFixed(0)}</strong> of ${totalAmt.toFixed(0)}
                </div>
              )}
            </div>
          )}

          <SectionLabel>Additional Costs</SectionLabel>
          {costs.map((cost, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: T.card, border: `1.5px solid ${cost.amount ? T.pink : T.cardBorder}`, borderRadius: 10, padding: '8px 12px', width: 110, flexShrink: 0 }}>
                <span style={{ fontFamily: T.serif, fontSize: 16, color: T.inkSub }}>$</span>
                <input
                  type="number"
                  placeholder="0"
                  value={cost.amount}
                  onChange={e => setCosts(prev => prev.map((c, i) => i === idx ? { ...c, amount: e.target.value } : c))}
                  style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontFamily: T.serif, fontSize: 16, color: T.ink }}
                />
              </div>
              <input
                type="text"
                placeholder="e.g. cleaning supplies"
                value={cost.description}
                onChange={e => setCosts(prev => prev.map((c, i) => i === idx ? { ...c, description: e.target.value } : c))}
                style={{ flex: 1, background: T.card, border: `1.5px solid ${cost.description ? T.pink : T.cardBorder}`, borderRadius: 10, padding: '8px 12px', color: T.ink, fontFamily: T.font, fontSize: 12, outline: 'none' }}
              />
              {(costs.length > 1 || cost.amount || cost.description) && (
                <button
                  onClick={() => setCosts(prev => prev.length === 1 ? [{ amount: '', description: '' }] : prev.filter((_, i) => i !== idx))}
                  style={{ background: 'none', border: 'none', color: T.inkMuted, cursor: 'pointer', fontSize: 18, padding: '0 4px', lineHeight: 1 }}
                >×</button>
              )}
            </div>
          ))}
          <button
            onClick={() => setCosts(prev => [...prev, { amount: '', description: '' }])}
            style={{ background: 'transparent', border: `1.5px dashed ${T.cardBorder}`, borderRadius: 10, padding: '7px 14px', fontFamily: T.font, fontSize: 11, fontWeight: 600, color: T.pink, cursor: 'pointer', marginBottom: 8, width: '100%' }}
          >＋ Add another cost</button>
          <div style={{ fontFamily: T.font, fontSize: 10, color: T.inkMuted, marginBottom: 18 }}>Supplies or extra costs — each appears as its own line on the invoice</div>

          {job?.job_notes?.trim() && (
            <div style={{ background: mode === 'dark' ? 'rgba(233,30,106,0.07)' : '#FFF0F7', border: `1px solid ${T.pink}30`, borderRadius: 12, padding: '10px 14px', marginBottom: 12 }}>
              <div style={{ fontFamily: T.font, fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: T.pink, letterSpacing: '0.5px', marginBottom: 5 }}>📌 Pre-job notes</div>
              <div style={{ fontFamily: T.font, fontSize: 12, color: T.inkSub, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{job.job_notes}</div>
            </div>
          )}
          <SectionLabel>Post-Job Notes</SectionLabel>
          <textarea
            placeholder="What happened? Key entry, client mood, issues found, follow-ups…"
            value={jobNotes}
            onChange={e => setJobNotes(e.target.value)}
            style={{ width: '100%', minHeight: 80, padding: '12px', borderRadius: 14, background: T.card, border: `1.5px solid ${T.cardBorder}`, color: T.ink, fontFamily: T.font, fontSize: 13, resize: 'none', outline: 'none', marginBottom: 18 }}
          />

          {invoiceId && (
            <div style={{ background: mode === 'dark' ? 'rgba(233,30,106,0.05)' : '#FFF0F7', borderRadius: 16, border: `1px solid ${T.pink}40`, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.ink }}>Invoice Ready</div>
              <button onClick={() => window.open(`/i/${invoiceId}`, '_blank')} style={{ background: T.pink, color: 'white', border: 'none', padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>VIEW</button>
            </div>
          )}

          <button onClick={() => setShowThankYou(true)} style={{ width: '100%', cursor: 'pointer', background: 'linear-gradient(135deg,#FF5A9D,#E91E6A)', border: 'none', borderRadius: 16, padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'white', fontWeight: 700, fontSize: 13, boxShadow: '0 4px 15px rgba(233,30,106,0.3)' }}>
            <span style={{ fontSize: 16 }}>✦</span> AI Thank-you Message
          </button>
        </div>

        <div style={{ padding: '10px 18px 18px', borderTop: `1px solid ${T.cardBorder}`, display: 'flex', gap: 10, background: T.bg }}>
          <button onClick={onClose} style={{ flex: 1, background: 'transparent', border: `1.5px solid ${T.cardBorder}`, color: T.inkSub, borderRadius: 12, padding: '12px 0', fontFamily: T.font, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Later</button>
          <button onClick={handleLogPayment} disabled={busy || done} style={{ flex: 2, background: busy || done ? T.pinkTint : '#E91E6A', color: 'white', border: 'none', borderRadius: 12, padding: '12px 0', fontFamily: T.font, fontSize: 13, fontWeight: 700, cursor: busy || done ? 'default' : 'pointer', boxShadow: '0 4px 12px rgba(233,30,106,0.3)' }}>
            {busy ? 'Saving…' : done ? 'Success ✓' : payStatus === 'paid' ? 'Save & Log Paid' : payStatus === 'partial' ? 'Save & Log Partial' : 'Save & Close'}
          </button>
        </div>
        </>
      )}
      </div>
      <ThankYouDraftSheet isOpen={showThankYou} onClose={() => setShowThankYou(false)} jobId={jobId} />
    </div>
  );
}
