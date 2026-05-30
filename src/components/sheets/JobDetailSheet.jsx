import { useEffect, useState, useRef } from 'react';
import { useAppTheme } from '../../context/AppThemeContext';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useKeyboardFocus } from '../../hooks/useKeyboardFocus';
import { fetchJobById, updateJob, softDeleteJob, cancelJob, hardDeleteJob } from '../../data/jobsRepo';
import { useAuth } from '../../context/AuthContext';
import { notifyDataChanged, useBusiness, useServices, useWorkers } from '../../data/useData';
import { useToast } from '../../context/ToastContext';
import { usePostJobSheet } from '../../context/PostJobSheetContext';
import { RECURRENCE } from '../../data/services';
import { uploadFile, getSignedUrls, getSignedUrl } from '../../lib/storage';
import { generateCommandBrief, speakBrief, stopSpeaking } from '../../data/ai';
import PrepNoteSheet from '../sheets/PrepNoteSheet';
import { supabase } from '../../lib/supabase';
import GrabBar from '../ui/GrabBar';
import FinancialMathBreakdown from '../ui/FinancialMathBreakdown';
import { useSwipeToDismiss } from '../../hooks/useSwipeToDismiss';

const STATUS_COLORS = {
  Scheduled: { bg: 'rgba(59,130,246,0.12)',   color: '#3B82F6', border: 'rgba(59,130,246,0.25)' },
  Completed:  { bg: 'rgba(34,197,94,0.12)',   color: '#22C55E', border: 'rgba(34,197,94,0.25)'  },
  Cancelled:  { bg: 'rgba(107,114,128,0.12)', color: '#6B7280', border: 'rgba(107,114,128,0.25)' },
};
const PAY_COLORS = {
  Paid:    { bg: 'rgba(34,197,94,0.12)',   color: '#22C55E', border: 'rgba(34,197,94,0.25)'  },
  Partial: { bg: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: 'rgba(245,158,11,0.25)' },
  '':      { bg: 'rgba(233,30,106,0.12)', color: '#E91E6A', border: 'rgba(233,30,106,0.25)' },
};

function fmtDate(s) {
  if (!s) return '—';
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
function fmtTime12(s) {
  if (!s) return '—';
  const [h, m] = s.split(':').map(Number);
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${m.toString().padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}
function calcEnd(timeStr, hours) {
  if (!timeStr || !hours) return null;
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + Math.round(Number(hours) * 60);
  const hh = Math.floor(total / 60) % 24, mm = total % 60;
  return `${((hh + 11) % 12) + 1}:${mm.toString().padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`;
}
function toHHMMStr(startHHMM, mins) {
  if (!startHHMM || !mins) return '';
  const [h, m] = startHHMM.split(':').map(Number);
  const total = h * 60 + m + mins;
  if (total <= 0) return '';
  const eh = Math.floor(total / 60) % 24, em = total % 60;
  return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
}
function diffMinutes(startHHMM, endHHMM) {
  if (!startHHMM || !endHHMM) return null;
  const [sh, sm] = startHHMM.split(':').map(Number);
  const [eh, em] = endHHMM.split(':').map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  return diff >= 15 ? diff : null;
}

/* ============= ROOT COMPONENT ============= */
export default function JobDetailSheet({ jobId, onClose }) {
  const { T, mode } = useAppTheme();
  const toast = useToast();
  const isKeyboardFocused = useKeyboardFocus();
  const { business } = useBusiness();
  const { services } = useServices();
  const { workers } = useWorkers();
  const sheetRef = useRef(null);
  useFocusTrap(sheetRef, true, onClose);
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mutErr, setMutErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({});
  const [showSeriesPicker, setShowSeriesPicker] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [showDeepPrep, setShowDeepPrep] = useState(false);
  const [invoiceId, setInvoiceId] = useState(null);
  const [jobPayments, setJobPayments] = useState([]);
  const [prevJobId, setPrevJobId] = useState(jobId);
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);
  const { panelRef: swipePanelRef, scrollRef: swipeScrollRef, handlers: swipeHandlers } = useSwipeToDismiss(onClose);

  if (jobId !== prevJobId) {
    setPrevJobId(jobId);
    setError(null);
    setLoading(true);
    setShowCancelForm(false);
    setCancelReason('');
  }

  useEffect(() => {
    if (!jobId) return;
    let alive = true;
    fetchJobById(jobId)
      .then(j => {
        if (alive) {
          setJob(j);
          setLoading(false);
          supabase
            .from('invoice_jobs')
            .select('invoice_id')
            .eq('job_id', jobId)
            .maybeSingle()
            .then(({ data }) => {
              if (data && alive) setInvoiceId(data.invoice_id);
            });
          supabase
            .from('payments')
            .select('amount, payment_date, payment_method')
            .eq('job_id', jobId)
            .eq('is_void', false)
            .order('payment_date', { ascending: true })
            .then(({ data }) => { if (alive) setJobPayments(data ?? []); });
        }
      })
      .catch(e => { if (alive) { setError(e.message || String(e)); setLoading(false); } });
    return () => { alive = false; };
  }, [jobId]);

  function showToast(msg, ok = true) {
    if (ok) toast.success(msg);
    else toast.error(msg);
    notifyDataChanged();
    onClose();
  }

  const { openPostJob } = usePostJobSheet();

  async function markComplete() {
    const jobDate = new Date(job.scheduled_date + 'T00:00:00');
    const today = new Date();
    today.setHours(0,0,0,0);
    if (jobDate > today) {
      if (!window.confirm("Great Scott! This job is scheduled for the future. Are you sure?")) return;
    }
    onClose();
    openPostJob(job.id);
  }

  function markPaid() {
    const jobDate = new Date(job.scheduled_date + 'T00:00:00');
    const today = new Date();
    today.setHours(0,0,0,0);
    if (jobDate > today) {
      if (!window.confirm("1.21 Gigawatts! You're marking a future job as paid. Sure?")) return;
    }
    onClose();
    openPostJob(job.id);
  }

  function initiateDelete() {
    if (job.template_id) { setPendingAction('delete'); setShowSeriesPicker(true); }
    else setConfirm(true);
  }

  async function deleteJob(action = 'this') {
    setBusy(true); setMutErr(null);
    try {
      await softDeleteJob(job.id, action);
      setConfirm(false);
      setShowSeriesPicker(false);
      showToast(action === 'this' ? 'Job deleted' : 'Series deleted');
    } catch (e) { setMutErr(e.message || String(e)); setBusy(false); }
  }

  const [hardDeleteConfirm, setHardDeleteConfirm] = useState(false);
  async function handleHardDelete() {
    setBusy(true); setMutErr(null);
    try {
      await hardDeleteJob(job.id);
      showToast('Job permanently deleted');
      onClose();
    } catch (e) { setMutErr(e.message || String(e)); setBusy(false); }
  }

  function initiateSave() {
    if (job.template_id) { setPendingAction('save'); setShowSeriesPicker(true); }
    else saveEdit('this');
  }

  async function saveEdit(action = 'this') {
    setBusy(true); setMutErr(null);
    try {
      await updateJob(job.id, {
        scheduled_date:  form.scheduled_date,
        scheduled_time:  form.scheduled_time,
        service_name:    form.service_name,
        service_id:      form.service_id,
        pricing_type:    form.pricing_type,
        total_amount:    form.total_amount === '' ? null : Number(form.total_amount),
        ...(form.pricing_type === 'Flat'
          ? { flat_rate: form.total_amount === '' ? null : Number(form.total_amount), subtotal: form.total_amount === '' ? null : Number(form.total_amount) }
          : { flat_rate: Number(form.hourly_rate) || null }),
        estimated_hours: form.estimated_hours === '' ? null : Number(form.estimated_hours),
        job_notes:       form.job_notes || null,
        additional_costs_json: form.additional_costs_json || [],
        worker_id:       form.worker_id || null,
        worker_pay:      form.worker_id && form.worker_pay !== '' ? Number(form.worker_pay) : null,
        worker_paid:     form.worker_paid ?? false,
        ai_context: {
          ...(job.ai_context || {}),
          payment_method:  form.payment_method,
          recurrence_rule: form.recurrence || null,
        },
      }, action);
      setShowSeriesPicker(false);
      showToast('Job updated');
    } catch (e) { setMutErr(e.message || String(e)); setBusy(false); }
  }

  async function handleCancel() {
    if (!cancelReason.trim() || cancelReason.trim().length < 3) return;
    setCancelBusy(true);
    try {
      await cancelJob(job.id, cancelReason.trim());
      showToast('Booking cancelled');
    } catch (e) {
      setMutErr(e.message || String(e));
      setCancelBusy(false);
    }
  }

  function onSeriesChoice(action) {
    if (pendingAction === 'save') saveEdit(action);
    else if (pendingAction === 'delete') deleteJob(action);
  }

  function openEditMode() {
    const storedTotal = Number(job.total_amount ?? job.flat_rate ?? 0);
    const estimatedHrs = Number(job.estimated_hours || 0);
    const derivedRate = job.flat_rate
      ? Number(job.flat_rate)
      : (estimatedHrs > 0 ? Math.round(storedTotal / estimatedHrs) : Number(business?.hourly_rate || 60));
    setForm({
      scheduled_date:  job.scheduled_date  || '',
      scheduled_time:  (job.scheduled_time || '').slice(0, 5),
      service_name:    job.service_name    || '',
      service_id:      job.service_id      || null,
      pricing_type:    job.pricing_type    || 'Flat',
      total_amount:    String(job.total_amount ?? job.flat_rate ?? ''),
      estimated_hours: String(job.estimated_hours || ''),
      hourly_rate:     String(derivedRate),
      payment_method:  job.ai_context?.payment_method || 'Cash',
      recurrence:      job.ai_context?.recurrence_rule || null,
      job_notes:       job.job_notes || '',
      additional_costs_json: job.additional_costs_json || [],
      worker_id:       job.worker_id || null,
      worker_pay:      job.worker_pay != null ? String(job.worker_pay) : '',
      worker_paid:     job.worker_paid ?? false,
    });
    setEditMode(true);
  }

  const isScheduled = job?.job_status === 'Scheduled';
  const isPaid      = job?.payment_status === 'Paid';
  const isCancelled = job?.job_status === 'Cancelled';

  return (
    <div
      ref={sheetRef}
      role="dialog"
      aria-modal="true"
      aria-label="Job details"
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        background: 'rgba(0,0,0,0.55)',
        animation: 'jdsFade 180ms ease-out',
      }}
      onClick={onClose}
    >
      <style>{`
        @keyframes jdsFade  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes jdsSlide { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>

      <div
        ref={swipePanelRef}
        onClick={e => e.stopPropagation()}
        {...swipeHandlers}
        style={{
          background: T.bg, color: T.ink,
          borderRadius: '18px 18px 0 0',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.38)',
          maxHeight: '92svh', display: 'flex', flexDirection: 'column',
          animation: 'jdsSlide 260ms cubic-bezier(0.2,0.8,0.2,1)',
          border: `1px solid ${T.cardBorder}`, borderBottom: 'none',
        }}
      >
        <GrabBar onDismiss={onClose} />

        {loading && <div style={{ padding: 32, textAlign: 'center', color: T.inkMuted }}>Loading…</div>}

        {!loading && error && !job && (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 22, marginBottom: 10 }}>😬</div>
            <div style={{ fontFamily: T.font, fontSize: 13, color: '#EF4444', fontWeight: 600 }}>Couldn't load job details</div>
            <div style={{ fontFamily: T.font, fontSize: 11, color: T.inkMuted, marginTop: 6 }}>{error}</div>
          </div>
        )}

        {!loading && !error && !job && (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 22, marginBottom: 10 }}>🔍</div>
            <div style={{ fontFamily: T.font, fontSize: 13, color: T.inkMuted, fontWeight: 600 }}>Job not found</div>
            <div style={{ fontFamily: T.font, fontSize: 11, color: T.inkMuted, marginTop: 6 }}>This job may have been deleted or moved.</div>
          </div>
        )}

        {!loading && job && !editMode && (
          <ReadMode
            job={job} T={T} mode={mode} business={business}
            isScheduled={isScheduled} isPaid={isPaid} isCancelled={isCancelled}
            busy={busy} confirm={confirm} mutErr={mutErr}
            invoiceId={invoiceId}
            jobPayments={jobPayments}
            scrollRef={swipeScrollRef}
            isAdmin={isAdmin}
            showCancelForm={showCancelForm}
            cancelReason={cancelReason}
            cancelBusy={cancelBusy}
            onSetShowCancelForm={setShowCancelForm}
            onSetCancelReason={setCancelReason}
            onHandleCancel={handleCancel}
            onClose={onClose}
            onMarkComplete={markComplete}
            onMarkPaid={markPaid}
            onCancelConfirm={initiateDelete}
            onConfirmDelete={() => deleteJob('this')}
            onDismissConfirm={() => { setConfirm(false); setShowSeriesPicker(false); }}
            hardDeleteConfirm={hardDeleteConfirm}
            onHardDeleteConfirm={() => setHardDeleteConfirm(true)}
            onHardDeleteCancel={() => setHardDeleteConfirm(false)}
            onHardDelete={handleHardDelete}
            onEdit={openEditMode}
            onUpdate={(patch) => updateJob(job.id, patch).then(() => notifyDataChanged())}
            onDeepPrep={() => setShowDeepPrep(true)}
          />
        )}

        {!loading && job && editMode && (
          <EditMode
            job={job}
            form={form} setForm={setForm} services={services} workers={workers} business={business}
            T={T} mode={mode} busy={busy} mutErr={mutErr}
            showSeriesPicker={showSeriesPicker} onSeriesChoice={onSeriesChoice}
            onSave={initiateSave}
            onCancelEdit={() => { setEditMode(false); setMutErr(null); setShowSeriesPicker(false); }}
            isKeyboardFocused={isKeyboardFocused}
          />
        )}

        {job && <PrepNoteSheet isOpen={showDeepPrep} onClose={() => setShowDeepPrep(false)} clientId={job.client_id} businessProfile={business} />}
      </div>
    </div>
  );
}

/* ============= READ MODE ============= */
function ReadMode({
  job, T, mode, business, isScheduled, isPaid, isCancelled,
  busy, confirm, mutErr, invoiceId, jobPayments, scrollRef,
  isAdmin,
  showCancelForm, cancelReason, cancelBusy,
  onSetShowCancelForm, onSetCancelReason, onHandleCancel,
  onClose, onMarkComplete, onMarkPaid, onCancelConfirm, onConfirmDelete, onDismissConfirm, onEdit, onUpdate, onDeepPrep,
  hardDeleteConfirm, onHardDeleteConfirm, onHardDeleteCancel, onHardDelete,
}) {
  const statusC = STATUS_COLORS[job.job_status] || STATUS_COLORS.Scheduled;
  const payKey  = job.payment_status || '';
  const payC    = PAY_COLORS[payKey] || PAY_COLORS[''];
  
  const displayHours = (job.job_status === 'Completed' && Number(job.actual_duration) > 0)
    ? Number(job.actual_duration)
    : Number(job.estimated_hours || 0);
  const endTime = calcEnd(job.scheduled_time, displayHours);
  const timeRange = job.scheduled_time ? `${fmtTime12(job.scheduled_time)}${endTime ? ` – ${endTime}` : ''}` : '—';

  return (
    <>
      <div style={{ 
        background: T.hero, 
        borderBottom: mode === 'dark' ? '3px solid #E91E6A' : 'none', 
        padding: '10px 14px 12px', 
        position: 'relative', 
        overflow: 'hidden' 
      }}>
        <div style={{ position: 'absolute', top: -40, right: -20, width: 140, height: 140, borderRadius: '50%', background: `radial-gradient(circle,${T.pinkGlow} 0%,transparent 70%)`, pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, position: 'relative' }}>
          <div style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: mode === 'dark' ? '#FF78B0' : T.pink }}>{job.service_name || 'Job'}</div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: '50%',
            background: mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)',
            border: `1.5px solid ${mode === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.08)'}`,
            color: mode === 'dark' ? 'rgba(255,255,255,0.85)' : T.ink,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div style={{ fontFamily: T.serif, fontSize: 22, fontWeight: 500, color: mode === 'dark' ? 'white' : T.ink, marginBottom: 6, position: 'relative' }}>{job.client_name || 'Unknown'}</div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, opacity: 0.9, position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={mode === 'dark' ? 'white' : T.ink} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            <span style={{ fontFamily: T.font, fontSize: 11, fontWeight: 700, color: mode === 'dark' ? 'white' : T.ink }}>{fmtDate(job.scheduled_date)}</span>
          </div>
          <div style={{ width: 4, height: 4, borderRadius: '50%', background: mode === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.1)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={mode === 'dark' ? 'white' : T.ink} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            <span style={{ fontFamily: T.font, fontSize: 11, fontWeight: 700, color: mode === 'dark' ? 'white' : T.ink }}>{timeRange}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <Pill bg={statusC.bg} border={statusC.border} color={statusC.color} T={T}>{job.job_status}</Pill>
          <Pill bg={payC.bg} border={payC.border} color={payC.color} T={T}>{payKey || 'Unpaid'}</Pill>
        </div>
      </div>

      <div ref={scrollRef} className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '12px 14px 4px' }}>
        <PrepNoteCard job={job} T={T} business={business} onDeepPrep={onDeepPrep} />
        
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, color: T.pink }}>Mission Vitals</div>
        <InfoCard T={T}>
          <Row T={T} label="Date" value={fmtDate(job.scheduled_date)} />
          <Row T={T} label="Time" value={timeRange} />
          <Row T={T} label="Pricing" value={job.pricing_type || '—'} last={!job.worker_name} />
          {job.worker_name && (
            <Row T={T} label={job.assignee_type === 'staff' ? 'Staff' : 'Worker'} value={`${job.worker_name}${job.worker_pay != null ? ` · $${Number(job.worker_pay).toFixed(0)}` : ''}`} last />
          )}
        </InfoCard>

        <FinancialMathBreakdown job={job} business={business} payments={jobPayments} T={T} mode={mode} />

        {job.job_notes && (
          <InfoCard T={T}>
            <div style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: T.inkMuted, marginBottom: 6 }}>Pre-job Notes</div>
            <div style={{ fontFamily: T.font, fontSize: 12.5, color: T.inkSub, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{job.job_notes}</div>
          </InfoCard>
        )}
        {job.completion_notes && (
          <InfoCard T={T}>
            <div style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: T.inkMuted, marginBottom: 6 }}>Post-Job Notes</div>
            <div style={{ fontFamily: T.font, fontSize: 12.5, color: T.inkSub, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{job.completion_notes}</div>
          </InfoCard>
        )}
        <MediaCard job={job} T={T} mode={mode} onUpdate={onUpdate} />
        {mutErr && <div style={{ padding: '9px 11px', borderRadius: 8, background: T.redBg, border: `1px solid ${T.redBorder}`, fontSize: 12, color: T.ink }}>{mutErr}</div>}
        {confirm && (
          <div style={{ padding: '12px', borderRadius: 12, background: 'rgba(233,30,106,0.08)', border: '1px solid rgba(233,30,106,0.3)' }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: T.ink, marginBottom: 10 }}>Delete this job?</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn onClick={onDismissConfirm} bg={T.card} border={`1px solid ${T.cardBorder}`} color={T.inkSub} T={T} style={{ flex: 1 }}>Keep it</Btn>
              <Btn onClick={onConfirmDelete} disabled={busy} bg="#E91E6A" color="white" T={T} style={{ flex: 1 }}>{busy ? 'Deleting…' : 'Yes, delete'}</Btn>
            </div>
          </div>
        )}
      </div>

      {!confirm && (
        <div style={{ padding: '10px 14px 28px', borderTop: `1px solid ${T.cardBorder}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!isCancelled && isScheduled && <Btn onClick={onMarkComplete} disabled={busy} bg="#22C55E" color="white" T={T}>Mark Complete</Btn>}
          {!isCancelled && !isPaid && <Btn onClick={onMarkPaid} disabled={busy} bg="#E91E6A" color="white" T={T}>Mark Paid</Btn>}
          {!isCancelled && (
            <Btn
              onClick={invoiceId ? () => { if (window.confirm('This job has an invoice. Editing may cause the invoice total to diverge. Continue?')) onEdit(); } : onEdit}
              bg={T.card} border={`1.5px solid ${T.cardBorder}`} color={T.ink} T={T}
            >
              Edit Job{invoiceId ? ' ⚠️' : ''}
            </Btn>
          )}

          {isScheduled && !showCancelForm && (
            <button
              onClick={() => onSetShowCancelForm(true)}
              style={{ background: 'transparent', border: 'none', fontSize: 12.5, color: '#F59E0B', padding: '4px 0', cursor: 'pointer', fontFamily: T.font, fontWeight: 600 }}
            >
              Cancel Booking
            </button>
          )}
          {showCancelForm && (
            <div style={{ background: mode === 'dark' ? 'rgba(245,158,11,0.08)' : '#FFFBEB', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12, padding: 12 }}>
              <div style={{ fontFamily: T.font, fontSize: 11, fontWeight: 700, color: '#B45309', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Reason for cancellation</div>
              <textarea
                value={cancelReason}
                onChange={e => onSetCancelReason(e.target.value)}
                placeholder="e.g. Client called to reschedule"
                rows={2}
                style={{ width: '100%', background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 8, padding: '8px 10px', fontFamily: T.font, fontSize: 12.5, color: T.ink, resize: 'none', outline: 'none', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <Btn onClick={() => { onSetShowCancelForm(false); onSetCancelReason(''); }} bg={T.card} border={`1px solid ${T.cardBorder}`} color={T.inkSub} T={T} style={{ flex: 1 }}>Never mind</Btn>
                <Btn
                  onClick={onHandleCancel}
                  disabled={cancelBusy || cancelReason.trim().length < 3}
                  bg="#B45309" color="white" T={T} style={{ flex: 1 }}
                >
                  {cancelBusy ? 'Cancelling…' : 'Cancel Booking'}
                </Btn>
              </div>
            </div>
          )}

          {isAdmin && (
            <>
              <div style={{ height: 1, background: T.cardBorder, margin: '4px 0' }} />
              <button
                onClick={onCancelConfirm}
                style={{ background: 'transparent', border: 'none', fontSize: 12, color: '#B01550', padding: '4px 0', cursor: 'pointer', fontFamily: T.font, fontWeight: 600, textAlign: 'left' }}
              >
                Delete Job (Admin)
              </button>
              <div style={{ height: 1, background: T.cardBorder, margin: '4px 0' }} />
              {!hardDeleteConfirm ? (
                <button
                  onClick={onHardDeleteConfirm}
                  style={{ background: 'transparent', border: 'none', fontSize: 12, color: '#7F1D1D', padding: '4px 0', cursor: 'pointer', fontFamily: T.font, fontWeight: 600, textAlign: 'left' }}
                >
                  Permanently Delete Job (Admin)
                </button>
              ) : (
                <div style={{ background: 'rgba(127,29,29,0.08)', border: '1px solid rgba(127,29,29,0.3)', borderRadius: 10, padding: '10px 12px', marginTop: 4 }}>
                  <div style={{ fontFamily: T.font, fontSize: 11, color: '#7F1D1D', marginBottom: 8, fontWeight: 600 }}>
                    Permanently delete this job? This cannot be undone.
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={onHardDeleteCancel}
                      style={{ flex: 1, background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 9, padding: '8px 0', fontFamily: T.font, fontSize: 12, fontWeight: 600, color: T.inkSub, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={onHardDelete}
                      style={{ flex: 1, background: '#7F1D1D', border: 'none', borderRadius: 9, padding: '8px 0', fontFamily: T.font, fontSize: 12, fontWeight: 700, color: 'white', cursor: 'pointer' }}
                    >
                      Delete Forever
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {invoiceId && (
            <div style={{ marginTop: 4, background: mode === 'dark' ? 'rgba(233,30,106,0.05)' : '#FFF0F7', borderRadius: 16, border: `1px solid ${T.pink}40`, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>Invoice Ready</div>
              <button onClick={() => window.open(`/i/${invoiceId}`, '_blank')} style={{ background: T.pink, color: 'white', border: 'none', padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>VIEW</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/* ============= EDIT MODE ============= */
function EditMode({ job, form, setForm, services, workers, business, T, mode, busy, showSeriesPicker, onSeriesChoice, onSave, onCancelEdit, isKeyboardFocused }) {
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function onPickService(e) {
    const svc = services.find(s => s.id === e.target.value);
    if (!svc) return;
    set('service_id', svc.id);
    set('service_name', svc.name);

    const resolvedPrice = (svc.pricing_type === 'Hourly' && (svc.default_price === null || svc.default_price === 0))
      ? (business?.hourly_rate || 60)
      : svc.default_price;

    if (form.pricing_type === 'Flat') set('total_amount', String(resolvedPrice || ''));
    if (!form.hoursTouched) set('estimated_hours', (Number(svc.default_duration || 120) / 60).toFixed(1));
  }

  const liveHourlyRate = parseFloat(form.hourly_rate) || 0;
  const liveHrs = parseFloat(form.estimated_hours) || 0;
  const liveMathTotal = liveHourlyRate * liveHrs;

  return (
    <>
      <div style={{ padding: '8px 14px 10px', borderBottom: `1px solid ${T.cardBorder}` }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#FF78B0', textTransform: 'uppercase' }}>Editing Job</div>
      </div>
      <div className="sm-scroll" style={{
        flex: 1,
        overflowY: 'auto',
        padding: `12px 14px ${isKeyboardFocused ? '260px' : '4px'}`,
        transition: 'padding-bottom 0.2s ease-out'
      }}>
        <Field T={T} label="Date"><input type="date" value={form.scheduled_date} onChange={e => set('scheduled_date', e.target.value)} style={iStyle(T)} /></Field>
        <Field T={T} label="Time">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 18px 1fr', alignItems: 'end', gap: 4 }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 600, color: T.inkMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Start</div>
              <input type="time" value={form.scheduled_time} onChange={e => set('scheduled_time', e.target.value)} style={iStyle(T)} />
            </div>
            <div style={{ textAlign: 'center', color: T.inkMuted, fontSize: 13, paddingBottom: 9 }}>→</div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 600, color: T.inkMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>End</div>
              <input
                type="time"
                value={toHHMMStr(form.scheduled_time, Math.round(parseFloat(form.estimated_hours || 0) * 60))}
                disabled={!form.scheduled_time}
                onChange={e => {
                  const mins = diffMinutes(form.scheduled_time, e.target.value);
                  if (mins != null) { set('estimated_hours', (mins / 60).toFixed(2)); set('hoursTouched', true); }
                }}
                style={{ ...iStyle(T), opacity: form.scheduled_time ? 1 : 0.4 }}
              />
            </div>
          </div>
        </Field>
        <Field T={T} label="Service">
          <select value={form.service_id || ''} onChange={onPickService} style={{ ...iStyle(T), width: '100%' }}>
            <option value="">— select —</option>
            {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field T={T} label="Pricing">
          <div style={{ display: 'flex', gap: 6 }}>
            {['Flat', 'Hourly'].map(p => <button key={p} onClick={() => {
              set('pricing_type', p);
              if (p === 'Hourly' && liveHourlyRate > 0 && liveHrs > 0) set('total_amount', liveMathTotal.toFixed(0));
            }} style={{ flex: 1, padding: '9px 0', borderRadius: 8, background: form.pricing_type === p ? '#E91E6A' : T.card, border: `1.5px solid ${form.pricing_type === p ? '#E91E6A' : T.cardBorder}`, color: form.pricing_type === p ? 'white' : T.inkSub, cursor: 'pointer' }}>{p}</button>)}
          </div>
        </Field>
        <Field T={T} label="Amount ($)"><input type="number" value={form.total_amount} onChange={e => set('total_amount', e.target.value)} style={{ ...iStyle(T), width: '100%' }} /></Field>
        <Field T={T} label="Est. hours"><input type="number" value={form.estimated_hours} onChange={e => {
          set('estimated_hours', e.target.value);
          set('hoursTouched', true);
        }} style={{ ...iStyle(T), width: '100%' }} /></Field>

        <FinancialMathBreakdown job={job} business={business} liveForm={form} T={T} mode={mode} />

        <Field T={T} label="Recurrence">
          <select value={form.recurrence || ''} onChange={e => set('recurrence', e.target.value || null)} style={{ ...iStyle(T), width: '100%' }}>
            {RECURRENCE.map(r => <option key={r.label} value={r.key || ''}>{r.label}</option>)}
          </select>
        </Field>
        <Field T={T} label="Notes"><textarea rows={3} value={form.job_notes} onChange={e => set('job_notes', e.target.value)} style={{ ...iStyle(T), width: '100%', resize: 'vertical' }} /></Field>
        {workers && workers.length > 0 && (
          <Field T={T} label="Team Member">
            <select
              value={form.worker_id || ''}
              onChange={e => {
                const wid = e.target.value || null;
                set('worker_id', wid);
                if (!wid) { set('worker_pay', ''); return; }
                const w = workers.find(x => x.id === wid);
                if (w?.skills?.length > 0) {
                  const svcName = (form.service_name || '').toLowerCase();
                  const match = svcName ? w.skills.find(sk =>
                    svcName.includes(sk.skill_name.toLowerCase()) || sk.skill_name.toLowerCase().includes(svcName)
                  ) : null;
                  if (match?.pay_rate != null) set('worker_pay', String(match.pay_rate));
                }
              }}
              style={{ ...iStyle(T), width: '100%' }}
            >
              <option value="">— Unassigned —</option>
              {workers.filter(w => (w.person_type || 'worker') === 'worker').length > 0 && (
                <optgroup label="── Workers ──">
                  {workers.filter(w => (w.person_type || 'worker') === 'worker').map(w => (
                    <option key={w.id} value={w.id}>{w.name}{w.skills?.length > 0 ? ` · ${w.skills.map(s => s.skill_name).join(', ')}` : ''}</option>
                  ))}
                </optgroup>
              )}
              {workers.filter(w => w.person_type === 'staff').length > 0 && (
                <optgroup label="── Staff ──">
                  {workers.filter(w => w.person_type === 'staff').map(w => (
                    <option key={w.id} value={w.id}>{w.name}{w.skills?.length > 0 ? ` · ${w.skills.map(s => s.skill_name).join(', ')}` : ''}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </Field>
        )}
        {form.worker_id && (
          <Field T={T} label="Pay for this job ($)"><input type="number" value={form.worker_pay} onChange={e => set('worker_pay', e.target.value)} style={{ ...iStyle(T), width: '100%' }} /></Field>
        )}
        {form.worker_id && (
          <Field T={T} label="Worker Paid?">
            <button
              onClick={() => set('worker_paid', !form.worker_paid)}
              style={{
                background: form.worker_paid ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.12)',
                border: `1.5px solid ${form.worker_paid ? '#22C55E' : '#F59E0B'}`,
                borderRadius: 8, padding: '8px 16px', cursor: 'pointer',
                fontFamily: T.font, fontSize: 12, fontWeight: 700,
                color: form.worker_paid ? '#16A34A' : '#B45309',
              }}
            >
              {form.worker_paid ? 'Paid ✓' : 'Not Yet Paid'}
            </button>
          </Field>
        )}
        <SeriesPicker show={showSeriesPicker} onChoice={onSeriesChoice} onCancel={() => onSeriesChoice(null)} busy={busy} T={T} mode={mode} />
      </div>
      <div style={{ padding: '10px 14px 28px', borderTop: `1px solid ${T.cardBorder}`, display: 'flex', gap: 8 }}>
        <Btn onClick={onCancelEdit} bg={T.card} border={`1.5px solid ${T.cardBorder}`} color={T.inkSub} T={T} style={{ flex: 1 }}>Cancel</Btn>
        <Btn onClick={onSave} disabled={busy} bg="#E91E6A" color="white" T={T} style={{ flex: 2 }}>{busy ? 'Saving…' : 'Save'}</Btn>
      </div>
    </>
  );
}

function InfoCard({ T, children }) { return <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: '11px 13px', marginBottom: 10 }}>{children}</div>; }
function Row({ T, label, value, last, serif, tabular, highlight }) { return <><div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '6px 0' }}><span style={{ fontSize: 11, color: T.inkMuted }}>{label}</span><span style={{ fontFamily: serif ? T.serif : T.font, fontSize: 13, color: highlight ? '#22C55E' : T.ink, fontWeight: highlight ? 700 : undefined, fontVariantNumeric: tabular ? 'tabular-nums' : undefined }}>{value}</span></div>{!last && <div style={{ height: 1, background: T.cardBorder }} />}</>; }
function Pill({ bg, border, color, children }) { return <span style={{ padding: '3px 8px', borderRadius: 20, background: bg, border: `1px solid ${border}`, fontSize: 10.5, fontWeight: 600, color }}>{children}</span>; }
function Btn({ onClick, disabled, bg, border, color, children, T, style: extra }) { return <button onClick={onClick} disabled={disabled} style={{ padding: '11px 14px', borderRadius: 12, background: bg, border: border || 'none', color, fontFamily: T.font, fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1, width: '100%', ...extra }}>{children}</button>; }
function Field({ T, label, children, last }) { return <div style={{ marginBottom: last ? 0 : 14 }}><div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: T.inkMuted, marginBottom: 5 }}>{label}</div>{children}</div>; }
function iStyle(T) { return { background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 8, padding: '9px 11px', color: T.ink, fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' }; }
function SeriesPicker({ show, onChoice, busy, T, mode }) { 
  if (!show) return null; 
  return (
    <div style={{ 
      background: T.hero, 
      borderRadius: 16, 
      padding: '14px', 
      border: `1.5px solid ${mode === 'dark' ? 'rgba(233,30,106,0.35)' : 'rgba(233,30,106,0.15)'}` 
    }}>
      <div style={{ fontSize: 16, color: mode === 'dark' ? 'white' : T.ink, marginBottom: 12 }}>Apply changes to...</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <SeriesBtn onClick={() => onChoice('this')} disabled={busy} T={T} mode={mode}>Just this visit</SeriesBtn>
        <SeriesBtn onClick={() => onChoice('future')} disabled={busy} T={T} mode={mode}>This and future</SeriesBtn>
        <SeriesBtn onClick={() => onChoice('all')} disabled={busy} T={T} mode={mode}>All in series</SeriesBtn>
      </div>
    </div>
  ); 
}

function SeriesBtn({ onClick, disabled, children, T, mode }) { 
  return (
    <button 
      onClick={onClick} 
      disabled={disabled} 
      style={{ 
        width: '100%', 
        background: mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.4)', 
        border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.05)'}`, 
        borderRadius: 10, 
        padding: '10px', 
        color: mode === 'dark' ? 'white' : T.ink, 
        fontSize: 12.5, 
        fontWeight: 600,
        cursor: disabled ? 'default' : 'pointer'
      }}
    >
      {children}
    </button>
  ); 
}

function PrepNoteCard({ job, T, business, onDeepPrep, mode }) {
  const brief = generateCommandBrief(job, business);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  useEffect(() => { 
    return () => stopSpeaking(); 
  }, []);
  
  if (!brief) return null;
  
  const handleToggleSpeak = (e) => { 
    e.stopPropagation(); 
    if (isSpeaking) { 
      stopSpeaking(); 
      setIsSpeaking(false); 
    } else { 
      setIsSpeaking(true); 
      speakBrief(brief.speechText, () => setIsSpeaking(false)); 
    } 
  };
  
  return (
    <div style={{ 
      background: T.hero, 
      borderRadius: 16, 
      padding: '13px 15px', 
      marginBottom: 10, 
      position: 'relative', 
      overflow: 'hidden',
      border: mode === 'dark' ? 'none' : `1px solid ${T.cardBorder}`
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', color: mode === 'dark' ? '#FF78B0' : T.pink }}>
          ✦ Command Brief
        </div>
        <button 
          onClick={handleToggleSpeak} 
          style={{ 
            background: isSpeaking ? '#E91E6A' : (mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'), 
            border: 'none', 
            borderRadius: 20, 
            padding: '4px 10px', 
            color: isSpeaking ? 'white' : (mode === 'dark' ? 'white' : T.ink), 
            fontSize: 9,
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          {isSpeaking ? 'STOP' : 'LISTEN'}
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {brief.bullets.map((b, i) => (
          <div key={i} style={{ display: 'flex', gap: 10 }}>
            <span style={{ fontSize: 14 }}>{b.icon}</span>
            <span style={{ 
              fontSize: 12, 
              color: mode === 'dark' ? 'rgba(255,255,255,0.9)' : T.ink, 
              lineHeight: 1.5 
            }}>{b.text}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, textAlign: 'center' }}>
        <button 
          onClick={(e) => { e.stopPropagation(); onDeepPrep?.(); }} 
          style={{ 
            background: 'none', 
            border: 'none', 
            color: mode === 'dark' ? '#FFB2D1' : T.pink, 
            fontSize: 10.5, 
            fontWeight: 700, 
            textTransform: 'uppercase', 
            cursor: 'pointer' 
          }}
        >
          ✦ Full History
        </button>
      </div>
    </div>
  );
}

function MediaCard({ job, T, mode, onUpdate }) {
  const [photoUrls, setPhotoUrls] = useState([]);
  const [voiceUrl, setVoiceUrl] = useState(null);
  const fileInputRef = useRef(null);
  const photoPaths = (job.photo_links || '').split(',').filter(Boolean);
  useEffect(() => { 
    const paths = (job.photo_links || '').split(',').filter(Boolean);
    if (paths.length > 0) getSignedUrls(paths).then(setPhotoUrls); 
    if (job.voice_note) getSignedUrl(job.voice_note).then(setVoiceUrl); 
  }, [job.photo_links, job.voice_note]);
  async function handlePhotoUpload(e) { const file = e.target.files?.[0]; if (!file) return; try { const path = await uploadFile(job.id, file, 'photo'); await onUpdate({ photo_links: [...photoPaths, path].join(',') }); } catch (err) { alert(err.message); } }
  return <InfoCard T={T}><div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: T.inkMuted, marginBottom: 6 }}>Media</div>{photoUrls.length > 0 && <div className="sm-scroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 8 }}>{photoUrls.map((url, i) => <img key={i} src={url} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8 }} />)}</div>}{voiceUrl && <div style={{ marginBottom: 12 }}><audio controls src={voiceUrl} style={{ width: '100%', height: 32 }} /></div>}<div style={{ display: 'flex', gap: 8 }}><input type="file" accept="image/*" ref={fileInputRef} onChange={handlePhotoUpload} style={{ display: 'none' }} /><Btn onClick={() => fileInputRef.current?.click()} bg={mode === 'dark' ? 'rgba(255,255,255,0.05)' : T.pinkTint} color={T.pink} T={T} style={{ flex: 1, padding: '8px 0', fontSize: 11.5 }}>📸 Add Photo</Btn></div></InfoCard>;
}
