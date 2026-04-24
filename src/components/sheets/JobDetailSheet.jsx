import { useEffect, useState } from 'react';
import { useAppTheme } from '../../context/AppThemeContext';
import { fetchJobById, updateJob, softDeleteJob, recordPayment } from '../../data/jobsRepo';
import { notifyDataChanged } from '../../data/useData';
import { SERVICES, RECURRENCE } from '../../data/services';

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
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);       // fetch errors — blocks sheet body
  const [mutErr, setMutErr] = useState(null);     // mutation errors — shown inline
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({});

  useEffect(() => {
    if (!jobId) return;
    let alive = true;
    setLoading(true);
    setError(null);
    fetchJobById(jobId)
      .then(j => { if (alive) { setJob(j); setLoading(false); } })
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

  async function markPaid() {
    setBusy(true); setMutErr(null);
    try {
      const amt = Number(job.total_amount ?? job.flat_rate ?? 0);
      const method = job.ai_context?.payment_method || 'Cash';
      await recordPayment(job.id, amt, method);
      showToast('Payment recorded');
    } catch (e) { setMutErr(e.message || String(e)); setBusy(false); }
  }

  async function deleteJob() {
    setBusy(true); setMutErr(null);
    try {
      await softDeleteJob(job.id);
      setConfirm(false);
      showToast('Job deleted');
    } catch (e) { setMutErr(e.message || String(e)); setBusy(false); }
  }

  async function saveEdit() {
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
      });
      showToast('Job updated');
    } catch (e) { setMutErr(e.message || String(e)); setBusy(false); }
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
      role="dialog"
      aria-modal="true"
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
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8, paddingBottom: 4 }}>
          <div style={{
            width: 40, height: 4, borderRadius: 4,
            background: '#FFD6E8', opacity: mode === 'dark' ? 0.35 : 1,
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
            job={job} T={T} mode={mode}
            isScheduled={isScheduled} isPaid={isPaid} isCancelled={isCancelled}
            busy={busy} toast={toast} confirm={confirm} mutErr={mutErr}
            onClose={onClose}
            onMarkComplete={markComplete}
            onMarkPaid={markPaid}
            onCancelConfirm={() => setConfirm(true)}
            onConfirmDelete={deleteJob}
            onDismissConfirm={() => setConfirm(false)}
            onEdit={openEditMode}
          />
        )}

        {!loading && !error && job && editMode && (
          <EditMode
            form={form} setForm={setForm}
            T={T} busy={busy} mutErr={mutErr}
            onSave={saveEdit}
            onCancelEdit={() => { setEditMode(false); setMutErr(null); }}
          />
        )}
      </div>
    </div>
  );
}

/* ============= READ MODE ============= */
function ReadMode({
  job, T, mode, isScheduled, isPaid, isCancelled,
  busy, toast, confirm, mutErr,
  onClose, onMarkComplete, onMarkPaid, onCancelConfirm, onConfirmDelete, onDismissConfirm, onEdit,
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
        </div>
      )}
    </>
  );
}

/* ============= EDIT MODE ============= */
function EditMode({ form, setForm, T, busy, mutErr, onSave, onCancelEdit }) {
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
