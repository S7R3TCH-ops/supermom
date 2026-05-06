import { useEffect, useState, useRef } from 'react';
import { useAppTheme } from '../../context/AppThemeContext';
import { SectionLabel } from '../ui/typography';
import { fetchJobById, recordPayment } from '../../data/jobsRepo';
import { notifyDataChanged } from '../../data/useData';
import { useToast } from '../../context/ToastContext';
import ThankYouDraftSheet from './ThankYouDraftSheet';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { supabase } from '../../lib/supabase';

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
  const [actualH, setActualH] = useState('');
  const [actualM, setActualM] = useState('');
  const [jobNotes, setJobNotes] = useState('');
  const [isPaidToggle, setIsPaidToggle] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mutErr, setMutErr] = useState(null);
  const [done, setDone] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);
  const [invoiceId, setInvoiceId] = useState(null);

  useEffect(() => {
    setLoading(true);
    setFetchErr(null);
    fetchJobById(jobId)
      .then(j => {
        setJob(j);
        setAmount(String(j?.total_amount ?? j?.flat_rate ?? 0));
        setJobNotes(j?.job_notes || '');
        if (j?.actual_duration) {
          setActualH(Math.floor(j.actual_duration).toString());
          setActualM(Math.round((j.actual_duration % 1) * 60).toString());
        } else if (j?.estimated_hours) {
          setActualH(Math.floor(j.estimated_hours).toString());
          setActualM(Math.round((j.estimated_hours % 1) * 60).toString());
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

  async function handleLogPayment() {
    const jobDate = new Date(job.scheduled_date + 'T00:00:00');
    const today = new Date();
    today.setHours(0,0,0,0);
    
    if (jobDate > today) {
      if (!window.confirm("Roads? Where we're going, we don't need roads... but we do need the right date! Mark this future job as complete/paid anyway?")) {
        return;
      }
    }

    const h = parseFloat(actualH) || 0;
    const m = parseFloat(actualM) || 0;
    const totalDuration = h + (m / 60);

    if (totalDuration <= 0) {
      if (!window.confirm("You haven't entered any hours for this job. Log it with 0 hours?")) {
        return;
      }
    }

    setBusy(true);
    setMutErr(null);
    try {
      const amt = isPaidToggle ? (parseFloat(amount) || 0) : 0;
      await recordPayment(jobId, amt, method, null, totalDuration, jobNotes);
      
      const { data } = await supabase
        .from('invoice_jobs')
        .select('invoice_id')
        .eq('job_id', jobId)
        .maybeSingle();
      if (data) setInvoiceId(data.invoice_id);

      notifyDataChanged();
      toast.success(isPaidToggle ? 'Payment recorded!' : 'Job marked complete!');
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

        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
          <div style={{ width: 40, height: 4, background: '#FFD6E8', borderRadius: 4, opacity: mode === 'dark' ? 0.6 : 1 }} />
        </div>

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
          
          <SectionLabel>Actual Duration</SectionLabel>
          <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
            <div style={{ flex: 1, background: T.card, border: `1.5px solid ${actualH ? T.pink : T.cardBorder}`, borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="number" placeholder="0" value={actualH} onChange={e => setActualH(e.target.value)} style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontFamily: T.serif, fontSize: 20, color: T.ink, textAlign: 'center' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: T.inkMuted }}>HRS</span>
            </div>
            <div style={{ flex: 1, background: T.card, border: `1.5px solid ${actualM ? T.pink : T.cardBorder}`, borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="number" placeholder="0" value={actualM} onChange={e => setActualM(e.target.value)} style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontFamily: T.serif, fontSize: 20, color: T.ink, textAlign: 'center' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: T.inkMuted }}>MINS</span>
            </div>
          </div>

          <SectionLabel>After-Job Intel (Updates System)</SectionLabel>
          <textarea
            placeholder="Any specific notes for this job? (e.g. key location, client mood, issues found)"
            value={jobNotes}
            onChange={e => setJobNotes(e.target.value)}
            style={{ width: '100%', minHeight: 80, padding: '12px', borderRadius: 14, background: T.card, border: `1.5px solid ${T.cardBorder}`, color: T.ink, fontFamily: T.font, fontSize: 13, resize: 'none', outline: 'none', marginBottom: 18 }}
          />

          <SectionLabel>Payment Status</SectionLabel>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <button 
              onClick={() => setIsPaidToggle(true)}
              style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: `1.5px solid ${isPaidToggle ? '#22C55E' : T.cardBorder}`, background: isPaidToggle ? 'rgba(34,197,94,0.1)' : 'transparent', color: isPaidToggle ? '#22C55E' : T.inkMuted, fontFamily: T.font, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              Paid now ✓
            </button>
            <button 
              onClick={() => setIsPaidToggle(false)}
              style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: `1.5px solid ${!isPaidToggle ? '#F59E0B' : T.cardBorder}`, background: !isPaidToggle ? 'rgba(245,158,11,0.1)' : 'transparent', color: !isPaidToggle ? '#D97706' : T.inkMuted, fontFamily: T.font, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              Not paid yet
            </button>
          </div>

          {isPaidToggle && (
            <div style={{ animation: 'pjFade 200ms ease' }}>
              <SectionLabel>Payment Method & Amount</SectionLabel>
              <div style={{ display: 'flex', background: mode === 'dark' ? 'rgba(255,255,255,0.04)' : '#FFF0F7', borderRadius: 10, padding: 3, marginBottom: 10 }}>
                {['Cash', 'e-Transfer'].map(m => (
                  <button key={m} onClick={() => setMethod(m)} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: method === m ? '#E91E6A' : 'transparent', fontFamily: T.font, fontSize: 12, fontWeight: 600, color: method === m ? 'white' : T.inkSub, cursor: 'pointer' }}>{m}</button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 12, padding: '10px 14px', marginBottom: 18 }}>
                <span style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 500, color: T.inkSub }}>$</span>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontFamily: T.serif, fontSize: 22, fontWeight: 500, color: T.ink }} />
              </div>
            </div>
          )}

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
            {busy ? 'Saving…' : done ? 'Success ✓' : isPaidToggle ? 'Save & Log Paid' : 'Save & Close'}
          </button>
        </div>
      </div>
      <ThankYouDraftSheet isOpen={showThankYou} onClose={() => setShowThankYou(false)} jobId={jobId} />
    </div>
  );
}
