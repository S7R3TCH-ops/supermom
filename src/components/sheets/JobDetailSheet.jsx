import { useEffect, useState, useRef } from 'react';
import { useAppTheme } from '../../context/AppThemeContext';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { fetchJobById, updateJob, softDeleteJob } from '../../data/jobsRepo';
import { notifyDataChanged } from '../../data/useData';
import { usePostJobSheet } from '../../context/PostJobSheetContext';
import { SERVICES, RECURRENCE } from '../../data/services';
import { uploadFile, getSignedUrls, getSignedUrl } from '../../lib/storage';
import { generateCommandBrief, speakBrief, stopSpeaking } from '../../data/ai';
import { useBusiness } from '../../data/useData';
import PrepNoteSheet from '../sheets/PrepNoteSheet';
import { supabase } from '../../lib/supabase';

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

/* ============= ROOT COMPONENT ============= */
export default function JobDetailSheet({ jobId, onClose }) {
  const { T, mode } = useAppTheme();
  const { business } = useBusiness();
  const sheetRef = useRef(null);
  useFocusTrap(sheetRef, true, onClose);
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);       // fetch errors — blocks sheet body
  const [mutErr, setMutErr] = useState(null);     // mutation errors — shown inline
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({});
  const [seriesAction, setSeriesAction] = useState(null); // 'this', 'future', 'all'
  const [showSeriesPicker, setShowSeriesPicker] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // 'save' or 'delete'
  const [showDeepPrep, setShowDeepPrep] = useState(false);
  const [invoiceId, setInvoiceId] = useState(null);

  useEffect(() => {
    if (!jobId) return;
    let alive = true;
    setLoading(true);
    setError(null);
    fetchJobById(jobId)
      .then(j => { 
        if (alive) { 
          setJob(j); 
          setLoading(false); 
          // Check for existing invoice
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
      .catch(e => { if (alive) { setError(e.message || String(e)); setLoading(false); } });
    return () => { alive = false; };
  }, [jobId]);

  function showToast(msg, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => {
      notifyDataChanged();
      onClose();
    }, 1200);
  }

  async function markComplete() {
    setBusy(true); setMutErr(null);
    try {
      await updateJob(job.id, { job_status: 'Completed' });
      showToast('Job marked complete');
    } catch (e) { setMutErr(e.message || String(e)); setBusy(false); }
  }

  const { openPostJob } = usePostJobSheet();

  function markPaid() {
    onClose();
    openPostJob(job.id);
  }

  function initiateDelete() {
    if (job.template_id) {
      setPendingAction('delete');
      setShowSeriesPicker(true);
    } else {
      setConfirm(true);
    }
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

  function initiateSave() {
    if (job.template_id) {
      setPendingAction('save');
      setShowSeriesPicker(true);
    } else {
      saveEdit('this');
    }
  }

  async function saveEdit(action = 'this') {
    setBusy(true); setMutErr(null);
    try {
      await updateJob(job.id, {
        scheduled_date:  form.scheduled_date,
        scheduled_time:  form.scheduled_time,
        service_name:    form.service_name,
        pricing_type:    form.pricing_type,
        total_amount:    form.total_amount === '' ? null : Number(form.total_amount),
        // Mirror total_amount into flat_rate/subtotal for Flat jobs to keep pricing columns in sync
        ...(form.pricing_type === 'Flat'
          ? { flat_rate: form.total_amount === '' ? null : Number(form.total_amount), subtotal: form.total_amount === '' ? null : Number(form.total_amount) }
          : { flat_rate: null, subtotal: null }),
        estimated_hours: form.estimated_hours === '' ? null : Number(form.estimated_hours),
        job_notes:       form.job_notes || null,
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

  function onSeriesChoice(action) {
    if (pendingAction === 'save') saveEdit(action);
    else if (pendingAction === 'delete') deleteJob(action);
  }

  function openEditMode() {
    setForm({
      scheduled_date:  job.scheduled_date  || '',
      scheduled_time:  job.scheduled_time  || '',
      service_name:    job.service_name    || '',
      pricing_type:    job.pricing_type    || 'Flat',
      total_amount:    String(job.total_amount ?? job.flat_rate ?? ''),
      estimated_hours: String(job.estimated_hours || ''),
      payment_method:  job.ai_context?.payment_method || 'Cash',
      recurrence:      job.ai_context?.recurrence_rule || null,
      job_notes:       job.job_notes || '',
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
        onClick={e => e.stopPropagation()}
        style={{
          background: T.bg, color: T.ink,
          borderRadius: '18px 18px 0 0',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.38)',
          maxHeight: '92svh', display: 'flex', flexDirection: 'column',
          animation: 'jdsSlide 260ms cubic-bezier(0.2,0.8,0.2,1)',
          border: `1px solid ${T.cardBorder}`, borderBottom: 'none',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 9, paddingBottom: 6 }}>
          <div style={{
            width: 42, height: 5, borderRadius: 10,
            background: '#FFD6E8', opacity: mode === 'dark' ? 0.3 : 1,
            transition: 'all 0.2s',
          }} />
        </div>

        {loading && (
          <div style={{ padding: 32, textAlign: 'center', fontFamily: T.font, fontSize: 13, color: T.inkMuted }}>
            Loading…
          </div>
        )}

        {error && !loading && (
          <div style={{ padding: 16 }}>
            <div style={{
              padding: 10, borderRadius: 8,
              background: T.redBg, border: `1px solid ${T.redBorder}`,
              fontFamily: T.font, fontSize: 12, color: T.ink,
            }}>
              {error}
            </div>
          </div>
        )}

        {!loading && !error && job && !editMode && (
          <ReadMode
            job={job} T={T} mode={mode} business={business}
            isScheduled={isScheduled} isPaid={isPaid} isCancelled={isCancelled}
            busy={busy} toast={toast} confirm={confirm} mutErr={mutErr}
            invoiceId={invoiceId}
            showSeriesPicker={showSeriesPicker} onSeriesChoice={onSeriesChoice}
            onClose={onClose}
            onMarkComplete={markComplete}
            onMarkPaid={markPaid}
            onCancelConfirm={initiateDelete}
            onConfirmDelete={() => deleteJob('this')}
            onDismissConfirm={() => { setConfirm(false); setShowSeriesPicker(false); }}
            onEdit={openEditMode}
            onUpdate={(patch) => updateJob(job.id, patch).then(() => notifyDataChanged())}
            onDeepPrep={() => setShowDeepPrep(true)}
          />
        )}

        {!loading && !error && job && editMode && (
          <EditMode
            form={form} setForm={setForm}
            T={T} mode={mode} busy={busy} mutErr={mutErr}
            showSeriesPicker={showSeriesPicker} onSeriesChoice={onSeriesChoice}
            onSave={initiateSave}
            onCancelEdit={() => { setEditMode(false); setMutErr(null); setShowSeriesPicker(false); }}
          />
        )}

        {job && (
          <PrepNoteSheet
            isOpen={showDeepPrep}
            onClose={() => setShowDeepPrep(false)}
            clientId={job.client_id}
            businessProfile={business}
          />
        )}
      </div>
    </div>
  );
}

/* ============= READ MODE ============= */
function ReadMode({
  job, T, mode, business, isScheduled, isPaid, isCancelled,
  busy, toast, confirm, mutErr, invoiceId,
  onClose, onMarkComplete, onMarkPaid, onCancelConfirm, onConfirmDelete, onDismissConfirm, onEdit, onUpdate, onDeepPrep,
}) {
  const statusC = STATUS_COLORS[job.job_status] || STATUS_COLORS.Scheduled;
  const payKey  = job.payment_status || '';
  const payC    = PAY_COLORS[payKey] || PAY_COLORS[''];
  const payLabel = payKey === '' ? 'Unpaid' : payKey;

  const endTime = calcEnd(job.scheduled_time, job.estimated_hours);
  const timeRange = job.scheduled_time
    ? `${fmtTime12(job.scheduled_time)}${endTime ? ` – ${endTime}` : ''}`
    : '—';

  const amtDisplay = job.total_amount != null
    ? `$${Number(job.total_amount).toFixed(0)}`
    : (job.flat_rate != null ? `$${Number(job.flat_rate).toFixed(0)}` : '—');

  return (
    <>
      {/* Hero header */}
      <div style={{
        background: T.hero,
        borderBottom: '3px solid #E91E6A',
        padding: '10px 14px 12px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -40, right: -20,
          width: 140, height: 140, borderRadius: '50%',
          background: 'radial-gradient(circle,rgba(233,30,106,0.22) 0%,transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Service label + close button row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{
            fontFamily: T.font, fontSize: 9, fontWeight: 700,
            letterSpacing: '0.5px', textTransform: 'uppercase',
            color: '#FF78B0',
          }}>
            {job.service_name || 'Job'}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer', padding: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Client name */}
        <div style={{
          fontFamily: T.serif, fontSize: 22, fontWeight: 500,
          letterSpacing: '-0.4px', color: 'white', marginBottom: 8,
        }}>
          {job.client_name || 'Unknown'}
        </div>

        {/* Status pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Pill bg={statusC.bg} border={statusC.border} color={statusC.color} T={T}>
            {job.job_status}
          </Pill>
          <Pill bg={payC.bg} border={payC.border} color={payC.color} T={T}>
            {payLabel}
          </Pill>
          {job.ai_context?.recurrence_rule && (
            <Pill bg="rgba(139,92,246,0.12)" border="rgba(139,92,246,0.28)" color="#8B5CF6" T={T}>
              ↻ {job.ai_context.recurrence_rule}
            </Pill>
          )}
        </div>
      </div>

      {/* Scrollable body */}
      <div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '12px 14px 4px' }}>

        {/* AI Prep Note */}
        <PrepNoteCard job={job} T={T} business={business} onDeepPrep={onDeepPrep} />

        {/* Info card */}
        <InfoCard T={T}>
          <Row T={T} label="Date"      value={fmtDate(job.scheduled_date)} />
          <Row T={T} label="Time"      value={timeRange} />
          <Row T={T} label="Est. hours" value={job.estimated_hours != null ? `${job.estimated_hours}h` : '—'} />
          <Row T={T} label="Amount"    value={amtDisplay} serif tabular />
          <Row T={T} label="Pricing"   value={job.pricing_type || '—'} last />
        </InfoCard>

        {/* Notes card */}
        {job.job_notes && (
          <InfoCard T={T}>
            <div style={{
              fontFamily: T.font, fontSize: 9, fontWeight: 700,
              letterSpacing: '0.5px', textTransform: 'uppercase',
              color: T.inkMuted, marginBottom: 6,
            }}>Notes</div>
            <div style={{
              fontFamily: T.font, fontSize: 12.5, color: T.inkSub,
              lineHeight: 1.5, whiteSpace: 'pre-wrap',
            }}>
              {job.job_notes}
            </div>
          </InfoCard>
        )}

        {/* Media card */}
        {!isCancelled && (
          <MediaCard job={job} T={T} mode={mode} onUpdate={onUpdate} />
        )}

        {/* Mutation error */}
        {mutErr && (
          <div style={{
            padding: '9px 11px', borderRadius: 8, marginBottom: 10,
            background: T.redBg, border: `1px solid ${T.redBorder}`,
            fontFamily: T.font, fontSize: 12, color: T.ink,
          }}>
            {mutErr}
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div style={{
            padding: '10px 12px', borderRadius: 10, marginBottom: 10,
            background: toast.ok ? 'rgba(34,197,94,0.12)' : 'rgba(220,38,38,0.1)',
            border: `1px solid ${toast.ok ? 'rgba(34,197,94,0.3)' : 'rgba(220,38,38,0.25)'}`,
            fontFamily: T.font, fontSize: 12.5, fontWeight: 600,
            color: toast.ok ? '#22C55E' : '#EF4444',
            textAlign: 'center',
          }}>
            {toast.msg}
          </div>
        )}

        {/* Cancel confirm dialog */}
        {confirm && (
          <div style={{
            padding: '12px 14px', borderRadius: 12, marginBottom: 10,
            background: 'rgba(233,30,106,0.08)',
            border: '1px solid rgba(233,30,106,0.3)',
          }}>
            <div style={{
              fontFamily: T.font, fontSize: 12.5, fontWeight: 600,
              color: T.ink, marginBottom: 10, lineHeight: 1.4,
            }}>
              Delete this job? This cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn
                onClick={onDismissConfirm}
                bg={T.card} border={`1px solid ${T.cardBorder}`} color={T.inkSub}
                T={T}
                style={{ flex: 1 }}
              >
                Keep it
              </Btn>
              <Btn
                onClick={onConfirmDelete}
                disabled={busy}
                bg="#E91E6A" border="none" color="white"
                T={T}
                style={{ flex: 1 }}
              >
                {busy ? 'Deleting…' : 'Yes, delete'}
              </Btn>
            </div>
          </div>
        )}
      </div>

      {/* Action buttons — suppressed entirely for cancelled jobs (no actions available) */}
      {!confirm && !isCancelled && (
        <div style={{ padding: '10px 14px 28px', borderTop: `1px solid ${T.cardBorder}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {isScheduled && (
            <Btn
              onClick={onMarkComplete}
              disabled={busy}
              bg="#22C55E" border="none" color="white"
              T={T}
            >
              {busy ? 'Saving…' : 'Mark Complete'}
            </Btn>
          )}
          {!isPaid && !isCancelled && (
            <Btn
              onClick={onMarkPaid}
              disabled={busy}
              bg="#E91E6A" border="none" color="white"
              T={T}
            >
              {busy ? 'Saving…' : 'Mark Paid'}
            </Btn>
          )}
          {!isCancelled && (
            <Btn
              onClick={onEdit}
              disabled={busy}
              bg={T.card} border={`1.5px solid ${T.cardBorder}`} color={T.ink}
              T={T}
            >
              Edit Job
            </Btn>
          )}
          {isScheduled && (
            <button
              onClick={onCancelConfirm}
              disabled={busy}
              style={{
                background: 'transparent', border: 'none',
                fontFamily: T.font, fontSize: 12.5, fontWeight: 600,
                color: '#E91E6A', cursor: busy ? 'not-allowed' : 'pointer',
                padding: '6px 0', textAlign: 'center',
              }}
            >
              Delete Job
            </button>
          )}

          {invoiceId && (
            <div style={{
              marginTop: 12, background: 'white', borderRadius: 16, border: '1.5px solid var(--pink-border)', padding: '14px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Invoice Ready</div>
                <div style={{ fontSize: 11, color: 'var(--ink-muted)', marginTop: 2 }}>Formal record for taxes</div>
              </div>
              <button 
                onClick={() => window.open(`/i/${invoiceId}`, '_blank')}
                style={{ 
                  background: 'var(--pink-tint)', color: 'var(--pink)', border: 'none', 
                  padding: '7px 14px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer' 
                }}
              >
                VIEW
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/* ============= EDIT MODE ============= */
function EditMode({ form, setForm, T, mode, busy, mutErr, showSeriesPicker, onSeriesChoice, onSave, onCancelEdit }) {
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function onPickService(e) {
    const svc = SERVICES.find(s => s.key === e.target.value);
    if (!svc) return;
    set('service_name', svc.label);  // DB stores label, matching NewJobSheet convention
    // Don't overwrite amount for Custom (rate=0) or when user has manually set a value
    if (form.pricing_type === 'Flat' && svc.rate > 0) set('total_amount', String(svc.rate));
    // Only auto-fill hours if user hasn't touched the field
    if (!form.hoursTouched) set('estimated_hours', (svc.defaultDuration / 60).toFixed(1));
  }

  const currentSvcKey = SERVICES.find(s => s.label === form.service_name)?.key || '';

  return (
    <>
      {/* Edit header */}
      <div style={{ padding: '8px 14px 10px', borderBottom: `1px solid ${T.cardBorder}` }}>
        <div style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#FF78B0', marginBottom: 2 }}>
          Editing Job
        </div>
        <div style={{ fontFamily: T.serif, fontSize: 18, fontWeight: 500, color: T.ink, letterSpacing: '-0.3px' }}>
          Make changes below
        </div>
      </div>

      <div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '12px 14px 4px' }}>
        {/* Date */}
        <Field T={T} label="Date">
          <input
            type="date"
            value={form.scheduled_date}
            onChange={e => set('scheduled_date', e.target.value)}
            style={iStyle(T)}
          />
        </Field>

        {/* Time */}
        <Field T={T} label="Time">
          <input
            type="time"
            value={form.scheduled_time}
            onChange={e => set('scheduled_time', e.target.value)}
            style={iStyle(T)}
          />
        </Field>

        {/* Service */}
        <Field T={T} label="Service">
          <select
            value={currentSvcKey}
            onChange={onPickService}
            style={{ ...iStyle(T), width: '100%' }}
          >
            <option value="">— select —</option>
            {SERVICES.map(s => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </Field>

        {/* Pricing type */}
        <Field T={T} label="Pricing">
          <div style={{ display: 'flex', gap: 6 }}>
            {['Flat', 'Hourly'].map(p => {
              const on = form.pricing_type === p;
              return (
                <button
                  key={p}
                  onClick={() => set('pricing_type', p)}
                  style={{
                    flex: 1, padding: '9px 0', borderRadius: 8,
                    background: on ? '#E91E6A' : T.card,
                    border: `1.5px solid ${on ? '#E91E6A' : T.cardBorder}`,
                    fontFamily: T.font, fontSize: 12, fontWeight: 600,
                    color: on ? 'white' : T.inkSub,
                    cursor: 'pointer',
                  }}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </Field>

        {/* Amount */}
        <Field T={T} label="Amount ($)">
          <input
            type="number"
            min="0"
            step="5"
            value={form.total_amount}
            onChange={e => set('total_amount', e.target.value)}
            style={{ ...iStyle(T), fontVariantNumeric: 'tabular-nums', width: '100%' }}
          />
        </Field>

        {/* Est. hours */}
        <Field T={T} label="Est. hours">
          <input
            type="number"
            min="0.5"
            step="0.5"
            value={form.estimated_hours}
            onChange={e => { set('estimated_hours', e.target.value); set('hoursTouched', true); }}
            style={{ ...iStyle(T), fontVariantNumeric: 'tabular-nums', width: '100%' }}
          />
        </Field>

        {/* Payment method */}
        <Field T={T} label="Payment method">
          <div style={{ display: 'flex', gap: 6 }}>
            {['Cash', 'e-Transfer'].map(pm => {
              const on = form.payment_method === pm;
              return (
                <button
                  key={pm}
                  onClick={() => set('payment_method', pm)}
                  style={{
                    flex: 1, padding: '9px 0', borderRadius: 8,
                    background: on ? '#E91E6A' : T.card,
                    border: `1.5px solid ${on ? '#E91E6A' : T.cardBorder}`,
                    fontFamily: T.font, fontSize: 12, fontWeight: 600,
                    color: on ? 'white' : T.inkSub,
                    cursor: 'pointer',
                  }}
                >
                  {pm}
                </button>
              );
            })}
          </div>
        </Field>

        {/* Recurrence */}
        <Field T={T} label="Recurrence">
          <select
            value={form.recurrence === null ? '' : form.recurrence}
            onChange={e => set('recurrence', e.target.value === '' ? null : e.target.value)}
            style={{ ...iStyle(T), width: '100%' }}
          >
            {RECURRENCE.map(r => (
              <option key={r.label} value={r.key === null ? '' : r.key}>{r.label}</option>
            ))}
          </select>
        </Field>

        {/* Notes */}
        <Field T={T} label="Notes" last>
          <textarea
            rows={3}
            value={form.job_notes}
            onChange={e => set('job_notes', e.target.value)}
            style={{
              ...iStyle(T),
              width: '100%', resize: 'vertical',
              lineHeight: 1.5,
            }}
          />
        </Field>

        {mutErr && (
          <div style={{
            padding: '9px 11px', borderRadius: 8, marginBottom: 10,
            background: T.redBg, border: `1px solid ${T.redBorder}`,
            fontFamily: T.font, fontSize: 12, color: T.ink,
          }}>
            {mutErr}
          </div>
        )}

        <SeriesPicker
          show={showSeriesPicker}
          onChoice={onSeriesChoice}
          onCancel={() => onSeriesChoice(null)} // basically close it
          busy={busy} T={T} mode={mode}
        />
      </div>

      {/* Bottom buttons */}
      <div style={{
        padding: '10px 14px 28px',
        borderTop: `1px solid ${T.cardBorder}`,
        display: 'flex', gap: 8,
      }}>
        <Btn
          onClick={onCancelEdit}
          disabled={busy}
          bg={T.card} border={`1.5px solid ${T.cardBorder}`} color={T.inkSub}
          T={T}
          style={{ flex: 1 }}
        >
          Cancel
        </Btn>
        <Btn
          onClick={onSave}
          disabled={busy}
          bg="#E91E6A" border="none" color="white"
          T={T}
          style={{ flex: 2 }}
        >
          {busy ? 'Saving…' : 'Save'}
        </Btn>
      </div>
    </>
  );
}

/* ============= PRIMITIVES ============= */

function InfoCard({ T, children }) {
  return (
    <div style={{
      background: T.card,
      border: `1px solid ${T.cardBorder}`,
      borderRadius: 12,
      padding: '11px 13px',
      marginBottom: 10,
    }}>
      {children}
    </div>
  );
}

function Row({ T, label, value, last, serif, tabular }) {
  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'baseline',
        justifyContent: 'space-between',
        padding: '6px 0',
      }}>
        <span style={{
          fontFamily: T.font, fontSize: 11, fontWeight: 500,
          color: T.inkMuted,
        }}>{label}</span>
        <span style={{
          fontFamily: serif ? T.serif : T.font,
          fontSize: 13, fontWeight: 500,
          color: T.ink,
          fontVariantNumeric: tabular ? 'tabular-nums' : undefined,
        }}>{value}</span>
      </div>
      {!last && (
        <div style={{ height: 1, background: T.cardBorder, margin: '0 -1px' }} />
      )}
    </>
  );
}

function Pill({ bg, border, color, children, T }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 8px', borderRadius: 20,
      background: bg, border: `1px solid ${border}`,
      fontFamily: T.font, fontSize: 10.5, fontWeight: 600, color,
    }}>
      {children}
    </span>
  );
}

function Btn({ onClick, disabled, bg, border, color, children, T, style: extra }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '11px 14px', borderRadius: 12,
        background: bg, border: border || 'none', color,
        fontFamily: T.font, fontSize: 13, fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        textAlign: 'center',
        width: '100%',
        ...extra,
      }}
    >
      {children}
    </button>
  );
}

function Field({ T, label, children, last }) {
  return (
    <div style={{ marginBottom: last ? 0 : 14 }}>
      <div style={{
        fontFamily: T.font, fontSize: 9, fontWeight: 700,
        letterSpacing: '0.5px', textTransform: 'uppercase',
        color: T.inkMuted, marginBottom: 5,
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function iStyle(T) {
  return {
    background: T.card,
    border: `1.5px solid ${T.cardBorder}`,
    borderRadius: 8,
    padding: '9px 11px',
    fontFamily: T.font,
    color: T.ink,
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
  };
}

function SeriesPicker({ show, onChoice, onCancel, busy, T, mode }) {
  if (!show) return null;

  return (
    <div style={{
      background: T.hero, borderRadius: 16, padding: '14px 16px', marginBottom: 12,
      position: 'relative', overflow: 'hidden', border: '1.5px solid rgba(233,30,106,0.35)',
    }}>
      <div style={{ position: 'absolute', top: -30, right: -20, width: 90, height: 90, borderRadius: '50%', background: `radial-gradient(circle,${T.pinkGlow} 0%,transparent 70%)`, pointerEvents: 'none' }} />
      <div style={{ position: 'relative' }}>
        <div style={{ fontFamily: T.font, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: '#FF78B0', marginBottom: 4 }}>
          ✦ Recurring Series
        </div>
        <div style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 500, color: 'white', marginBottom: 12, letterSpacing: '-0.2px' }}>
          Apply changes to...
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <SeriesBtn onClick={() => onChoice('this')} disabled={busy} T={T}>Just this visit</SeriesBtn>
          <SeriesBtn onClick={() => onChoice('future')} disabled={busy} T={T}>This and future visits</SeriesBtn>
          <SeriesBtn onClick={() => onChoice('all')} disabled={busy} T={T}>All visits in series</SeriesBtn>
          <button 
            onClick={onCancel}
            style={{ 
              background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)',
              fontFamily: T.font, fontSize: 11, fontWeight: 600, marginTop: 4, cursor: 'pointer' 
            }}
          >Cancel</button>
        </div>
      </div>
    </div>
  );
}

function SeriesBtn({ onClick, disabled, T, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 10, padding: '10px 12px', textAlign: 'left',
        fontFamily: T.font, fontSize: 12.5, fontWeight: 600, color: 'white',
        cursor: disabled ? 'wait' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function PrepNoteCard({ job, T, business, onDeepPrep }) {
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
    }}>
      <div style={{
        position: 'absolute', top: -30, right: -20, width: 90, height: 90, borderRadius: '50%',
        background: 'radial-gradient(circle,rgba(233,30,106,0.22) 0%,transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
        position: 'relative', zIndex: 1
      }}>
        <div style={{
          fontFamily: T.font, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.1px',
          textTransform: 'uppercase', color: '#FF78B0',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ fontSize: 12 }}>✦</span> Command Brief
        </div>
        <button 
          onClick={handleToggleSpeak}
          style={{ 
            background: isSpeaking ? '#E91E6A' : 'rgba(255,255,255,0.1)', 
            border: 'none', borderRadius: 20, padding: '4px 10px',
            display: 'flex', alignItems: 'center', gap: 6,
            cursor: 'pointer'
          }}
        >
          <span style={{ fontSize: 10 }}>{isSpeaking ? '⏹' : '▶'}</span>
          <span style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, color: 'white' }}>
            {isSpeaking ? 'STOP' : 'LISTEN'}
          </span>
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', zIndex: 1 }}>
        {brief.bullets.map((b, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 14 }}>{b.icon}</span>
            <span style={{ fontFamily: T.font, fontSize: 12, color: 'rgba(255,255,255,0.9)', lineHeight: 1.5 }}>{b.text}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
        <button
          onClick={(e) => { e.stopPropagation(); onDeepPrep?.(); }}
          style={{
            background: 'none',
            border: 'none',
            color: '#FFB2D1',
            fontFamily: T.font,
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: '0.4px',
            textTransform: 'uppercase',
            cursor: 'pointer',
            padding: '4px 8px',
          }}
        >
          ✦ Full Briefing & History
        </button>
      </div>
    </div>
  );
}

/* ============= MEDIA COMPONENTS ============= */

function MediaCard({ job, T, mode, onUpdate }) {
  const [photoUrls, setPhotoUrls] = useState([]);
  const [voiceUrl, setVoiceUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const photoPaths = (job.photo_links || '').split(',').filter(Boolean);

  useEffect(() => {
    let alive = true;
    if (photoPaths.length > 0) {
      getSignedUrls(photoPaths).then(urls => {
        if (alive) setPhotoUrls(urls);
      });
    }
    if (job.voice_note) {
      getSignedUrl(job.voice_note).then(url => {
        if (alive) setVoiceUrl(url);
      });
    }
    return () => { alive = false; };
  }, [job.photo_links, job.voice_note]);

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = await uploadFile(job.id, file, 'photo');
      const newLinks = [...photoPaths, path].join(',');
      await onUpdate({ photo_links: newLinks });
    } catch (err) {
      console.error('Photo upload failed:', err);
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleVoiceUpload(blob) {
    setUploading(true);
    try {
      const path = await uploadFile(job.id, blob, 'voice');
      const updatedAiContext = { ...(job.ai_context || {}), voice_note: path };
      await onUpdate({ ai_context: updatedAiContext });
    } catch (err) {
      console.error('Voice upload failed:', err);
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <InfoCard T={T}>
      <div style={{
        fontFamily: T.font, fontSize: 9, fontWeight: 700,
        letterSpacing: '0.5px', textTransform: 'uppercase',
        color: T.inkMuted, marginBottom: 6,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <span>Media</span>
        {uploading && <span style={{ color: T.pink, fontSize: 8 }}>Uploading...</span>}
      </div>

      {photoUrls.length > 0 && (
        <div className="sm-scroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 8 }}>
          {photoUrls.map((url, i) => (
            url ? <img key={i} src={url} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, flexShrink: 0, border: `1px solid ${T.cardBorder}` }} /> : null
          ))}
        </div>
      )}

      {voiceUrl && (
        <div style={{ marginBottom: 12 }}>
          <audio controls src={voiceUrl} style={{ width: '100%', height: 32 }} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <input type="file" accept="image/*" ref={fileInputRef} onChange={handlePhotoUpload} style={{ display: 'none' }} />
        <Btn onClick={() => fileInputRef.current?.click()} disabled={uploading} bg={mode === 'dark' ? 'rgba(255,255,255,0.05)' : T.pinkTint} color={T.pink} T={T} style={{ flex: 1, padding: '8px 0', fontSize: 11.5 }}>
          📸 Add Photo
        </Btn>
        <VoiceRecorder T={T} mode={mode} onRecordComplete={handleVoiceUpload} disabled={uploading} />
      </div>
    </InfoCard>
  );
}

function VoiceRecorder({ T, mode, onRecordComplete, disabled }) {
  const [recording, setRecording] = useState(false);
  const mediaRecorder = useRef(null);
  const chunks = useRef([]);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      chunks.current = [];
      mediaRecorder.current.ondataavailable = e => chunks.current.push(e.data);
      mediaRecorder.current.onstop = () => {
        const blob = new Blob(chunks.current, { type: 'audio/webm' });
        onRecordComplete(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorder.current.start();
      setRecording(true);
    } catch (err) {
      console.error('Mic error:', err);
      alert('Microphone access denied or unavailable.');
    }
  }

  function stopRecording() {
    mediaRecorder.current?.stop();
    setRecording(false);
  }

  if (recording) {
    return (
      <Btn onClick={stopRecording} bg="#E91E6A" color="white" T={T} style={{ flex: 1, padding: '8px 0', fontSize: 11.5 }}>
        ⏹ Stop Recording
      </Btn>
    );
  }

  return (
    <Btn onClick={startRecording} disabled={disabled} bg={mode === 'dark' ? 'rgba(255,255,255,0.05)' : T.pinkTint} color={T.pink} T={T} style={{ flex: 1, padding: '8px 0', fontSize: 11.5 }}>
      🎙 Voice Note
    </Btn>
  );
}
