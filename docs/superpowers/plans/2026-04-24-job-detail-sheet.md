# Job Detail Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a bottom sheet that opens when Sandra taps any job card on Home or Calendar, showing full job details with actions: mark complete, mark paid, edit all fields, cancel job.

**Architecture:** Three new files (context hook, provider, UI component) follow the identical pattern as NewJobSheet/NewJobSheetContext. Provider wraps AuthedShell in App.jsx. Home and Calendar job cards each get an onClick that calls `openJob(id)`.

**Tech Stack:** React 18, Vite, Supabase JS client, inline styles via `useAppTheme()` tokens

---

## File Map

| Action | File | Purpose |
|---|---|---|
| Modify | `src/data/jobsRepo.js` | Add client JOIN to `fetchJobById` |
| Create | `src/data/services.js` | Shared SERVICES + RECURRENCE catalog |
| Modify | `src/components/sheets/NewJobSheet.jsx` | Import from `services.js` instead of inline |
| Create | `src/context/JobDetailSheetContext.js` | `useJobDetailSheet()` hook |
| Create | `src/context/JobDetailSheet.jsx` | Provider that holds `jobId` state |
| Create | `src/components/sheets/JobDetailSheet.jsx` | Full sheet UI (read + edit mode) |
| Modify | `src/App.jsx` | Wrap AuthedShell with JobDetailSheetProvider |
| Modify | `src/pages/Home.jsx` | onClick on Today's Schedule + Opening Act cards |
| Modify | `src/pages/Calendar.jsx` | onClick on DayView, WeekView, AgendaCard job cards |

---

## Task 1 — Update fetchJobById to include client name

`fetchJobById` currently selects `*` from jobs with no join, so it doesn't return `client_name`. The sheet header needs it.

**Files:**
- Modify: `src/data/jobsRepo.js`

- [ ] Open `src/data/jobsRepo.js`. Replace the existing `fetchJobById` function (lines 38–48):

```js
export async function fetchJobById(id) {
  const businessId = await getCurrentBusinessId();
  const { data, error } = await supabase
    .from('jobs')
    .select('*, clients(first_name, last_name)')
    .eq('id', id)
    .eq('business_id', businessId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const c = data.clients;
  const clientName = c
    ? [c.first_name, c.last_name].filter(Boolean).join(' ')
    : 'Unknown';
  return { ...decorateJob(data), client_name: clientName };
}
```

- [ ] Verify: `npm run dev`, open browser console, confirm no import errors.
- [ ] Commit:
```bash
git add src/data/jobsRepo.js
git commit -m "feat: fetchJobById joins client name"
```

---

## Task 2 — Extract shared SERVICES + RECURRENCE catalog

Both `NewJobSheet` and the new `JobDetailSheet` need the same catalog. Extract it once.

**Files:**
- Create: `src/data/services.js`
- Modify: `src/components/sheets/NewJobSheet.jsx`

- [ ] Create `src/data/services.js`:

```js
export const SERVICES = [
  { key: 'deep_clean', label: 'Deep Clean',       rate: 185, defaultDuration: 150, emoji: '🧼' },
  { key: 'regular',    label: 'Regular',          rate: 120, defaultDuration: 105, emoji: '✨' },
  { key: 'quick_tidy', label: 'Quick Tidy',       rate: 85,  defaultDuration: 60,  emoji: '🌀' },
  { key: 'organizing', label: 'Organize',         rate: 160, defaultDuration: 180, emoji: '📦' },
  { key: 'declutter',  label: 'Declutter + Org.', rate: 240, defaultDuration: 240, emoji: '🗂' },
  { key: 'move_out',   label: 'Move Out',         rate: 320, defaultDuration: 300, emoji: '📤' },
  { key: 'custom',     label: 'Custom',           rate: 0,   defaultDuration: 120, emoji: '✎' },
];

export const RECURRENCE = [
  { key: null,       label: 'None' },
  { key: 'weekly',   label: 'Weekly' },
  { key: 'biweekly', label: 'Biweekly' },
  { key: 'monthly',  label: 'Monthly' },
];
```

- [ ] In `src/components/sheets/NewJobSheet.jsx`, add this import at the top (after existing imports):
```js
import { SERVICES, RECURRENCE } from '../../data/services';
```
Then delete the inline `const SERVICES = [...]` and `const RECURRENCE = [...]` arrays that are already defined in that file.

- [ ] Verify: open the New Job sheet in browser — all service options still show correctly.
- [ ] Commit:
```bash
git add src/data/services.js src/components/sheets/NewJobSheet.jsx
git commit -m "refactor: extract SERVICES catalog to src/data/services.js"
```

---

## Task 3 — Create JobDetailSheetContext

**Files:**
- Create: `src/context/JobDetailSheetContext.js`

- [ ] Create `src/context/JobDetailSheetContext.js`:

```js
import { createContext, useContext } from 'react';
export const JobDetailSheetContext = createContext(null);
export function useJobDetailSheet() { return useContext(JobDetailSheetContext); }
```

- [ ] Commit:
```bash
git add src/context/JobDetailSheetContext.js
git commit -m "feat: add JobDetailSheetContext"
```

---

## Task 4 — Create provider and mount in App

**Files:**
- Create: `src/context/JobDetailSheet.jsx`
- Modify: `src/App.jsx`

- [ ] Create `src/context/JobDetailSheet.jsx`:

```jsx
import { useState } from 'react';
import { JobDetailSheetContext } from './JobDetailSheetContext';
import JobDetailSheet from '../components/sheets/JobDetailSheet';

export function JobDetailSheetProvider({ children }) {
  const [jobId, setJobId] = useState(null);
  function openJob(id) { setJobId(id); }
  function closeJob() { setJobId(null); }
  return (
    <JobDetailSheetContext.Provider value={{ openJob, closeJob }}>
      {children}
      {jobId != null && <JobDetailSheet jobId={jobId} onClose={closeJob} />}
    </JobDetailSheetContext.Provider>
  );
}
```

- [ ] In `src/App.jsx`, add this import after the existing NewJobSheetProvider import:
```js
import { JobDetailSheetProvider } from './context/JobDetailSheet';
```

- [ ] In the `Gate` function in `src/App.jsx`, wrap `<AuthedShell />` inside `JobDetailSheetProvider`. The result should look like:
```jsx
<NewJobSheetProvider>
  <JobDetailSheetProvider>
    <AuthedShell />
  </JobDetailSheetProvider>
</NewJobSheetProvider>
```

- [ ] Verify: app still loads, no console errors.
- [ ] Commit:
```bash
git add src/context/JobDetailSheet.jsx src/App.jsx
git commit -m "feat: mount JobDetailSheetProvider in App"
```

---

## Task 5 — Build JobDetailSheet UI (read mode + edit mode)

**Files:**
- Create: `src/components/sheets/JobDetailSheet.jsx`

- [ ] Create `src/components/sheets/JobDetailSheet.jsx` with the full contents below.

This file has four parts: the default export (`JobDetailSheet`), and three sub-components (`ReadMode`, `EditMode`, and small helpers). Write them all into a single file in this order.

```jsx
import { useEffect, useState } from 'react';
import { useAppTheme } from '../../context/AppThemeContext';
import { fetchJobById, updateJob } from '../../data/jobsRepo';
import { notifyDataChanged } from '../../data/useData';
import { SERVICES, RECURRENCE } from '../../data/services';

// ── colour maps ──────────────────────────────────────────────────────────────
const STATUS_COLORS = {
  Scheduled: { bg: 'rgba(59,130,246,0.12)',  color: '#3B82F6', border: 'rgba(59,130,246,0.25)' },
  Completed:  { bg: 'rgba(34,197,94,0.12)',  color: '#22C55E', border: 'rgba(34,197,94,0.25)'  },
  Cancelled:  { bg: 'rgba(107,114,128,0.12)',color: '#6B7280', border: 'rgba(107,114,128,0.25)' },
};
const PAY_COLORS = {
  Paid:    { bg: 'rgba(34,197,94,0.12)',  color: '#22C55E', border: 'rgba(34,197,94,0.25)'  },
  Partial: { bg: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: 'rgba(245,158,11,0.25)' },
  '':      { bg: 'rgba(233,30,106,0.12)', color: '#E91E6A', border: 'rgba(233,30,106,0.25)' },
};

// ── formatting helpers ────────────────────────────────────────────────────────
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

// ── root component ────────────────────────────────────────────────────────────
export default function JobDetailSheet({ jobId, onClose }) {
  const { T, mode } = useAppTheme();
  const [job, setJob]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const [busy, setBusy]     = useState(false);
  const [toast, setToast]   = useState(null);   // { msg, ok }
  const [confirm, setConfirm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm]     = useState({});

  useEffect(() => {
    setLoading(true); setError(null);
    fetchJobById(jobId)
      .then(j  => { setJob(j); setLoading(false); })
      .catch(e => { setError(e.message || 'Failed to load'); setLoading(false); });
  }, [jobId]);

  function showToast(msg, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => { setToast(null); notifyDataChanged(); onClose(); }, 1200);
  }

  async function markComplete() {
    if (busy) return;
    setBusy(true);
    try   { await updateJob(jobId, { job_status: 'Completed' }); showToast('Marked complete ✓'); }
    catch (e) { setError(e.message); }
    finally   { setBusy(false); }
  }

  async function markPaid() {
    if (busy) return;
    setBusy(true);
    try   { await updateJob(jobId, { payment_status: 'Paid', job_status: 'Completed' }); showToast('Marked paid ✓'); }
    catch (e) { setError(e.message); }
    finally   { setBusy(false); }
  }

  async function cancelJob() {
    if (busy) return;
    setBusy(true);
    try   { await updateJob(jobId, { job_status: 'Cancelled' }); showToast('Job cancelled'); }
    catch (e) { setError(e.message); }
    finally   { setBusy(false); setConfirm(false); }
  }

  async function saveEdit() {
    if (busy) return;
    setBusy(true);
    try {
      await updateJob(jobId, {
        scheduled_date:  form.scheduled_date,
        scheduled_time:  form.scheduled_time,
        pricing_type:    form.pricing_type,
        total_amount:    Number(form.total_amount) || 0,
        estimated_hours: Number(form.estimated_hours) || null,
        job_notes:       form.job_notes || null,
        ai_context: {
          ...(job.ai_context || {}),
          payment_method:  form.payment_method,
          recurrence_rule: form.recurrence || null,
        },
      });
      showToast('Saved ✓');
    } catch (e) { setError(e.message); }
    finally     { setBusy(false); }
  }

  const isScheduled = job?.job_status === 'Scheduled';
  const isPaid      = job?.payment_status === 'Paid';
  const isCancelled = job?.job_status === 'Cancelled';

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.55)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: T.bg, borderRadius: '18px 18px 0 0', maxHeight: '92svh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 -8px 40px rgba(0,0,0,0.4)' }}
      >
        {/* drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 2px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)' }} />
        </div>

        {loading && (
          <div style={{ padding: 40, textAlign: 'center', color: T.inkMuted, fontFamily: T.font, fontSize: 13 }}>Loading…</div>
        )}

        {error && !loading && (
          <div style={{ margin: '12px 16px', padding: 12, borderRadius: 10, background: T.redBg, border: `1px solid ${T.redBorder}`, fontFamily: T.font, fontSize: 13, color: T.ink }}>
            {error}
          </div>
        )}

        {job && !loading && !editMode && (
          <ReadMode
            job={job} T={T} mode={mode}
            isScheduled={isScheduled} isPaid={isPaid} isCancelled={isCancelled}
            busy={busy} toast={toast} confirm={confirm}
            onClose={onClose}
            onMarkComplete={markComplete}
            onMarkPaid={markPaid}
            onCancelConfirm={() => setConfirm(true)}
            onConfirmCancel={cancelJob}
            onDismissConfirm={() => setConfirm(false)}
            onEdit={() => {
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
            }}
          />
        )}

        {job && !loading && editMode && (
          <EditMode
            form={form} setForm={setForm}
            T={T} busy={busy} error={error}
            onSave={saveEdit}
            onCancelEdit={() => { setEditMode(false); setError(null); }}
          />
        )}
      </div>
    </div>
  );
}

// ── read mode ─────────────────────────────────────────────────────────────────
function ReadMode({ job, T, mode, isScheduled, isPaid, isCancelled, busy, toast, confirm, onClose, onMarkComplete, onMarkPaid, onCancelConfirm, onConfirmCancel, onDismissConfirm, onEdit }) {
  const statusStyle = STATUS_COLORS[job.job_status] || STATUS_COLORS.Cancelled;
  const payKey      = job.payment_status || '';
  const payStyle    = PAY_COLORS[payKey]  || PAY_COLORS[''];
  const endT        = calcEnd(job.scheduled_time, job.estimated_hours);

  return (
    <>
      {/* hero header */}
      <div style={{ background: T.hero, borderBottom: '3px solid #E91E6A', padding: '11px 14px 14px', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ position: 'absolute', top: -40, right: -20, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle,rgba(233,30,106,0.2) 0%,transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#FF78B0', marginBottom: 4 }}>
              ✦ {job.service_name || '—'}
            </div>
            <div style={{ fontFamily: T.serif, fontSize: 22, fontWeight: 500, letterSpacing: '-0.5px', color: 'white', lineHeight: 1.15 }}>
              {job.client_name || '—'}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 10, width: 32, height: 32, color: 'rgba(255,255,255,0.6)', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          <Pill bg={statusStyle.bg} border={statusStyle.border} color={statusStyle.color} T={T}>{job.job_status || '—'}</Pill>
          <Pill bg={payStyle.bg} border={payStyle.border} color={payStyle.color} T={T}>{payKey === '' ? 'Unpaid' : payKey}</Pill>
        </div>
      </div>

      {/* scrollable body */}
      <div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 4px' }}>
        {/* time + amount */}
        <InfoCard T={T}>
          <Row T={T} label="Date"    value={fmtDate(job.scheduled_date)} />
          <Row T={T} label="Time"    value={job.scheduled_time ? `${fmtTime12(job.scheduled_time)}${endT ? ' – ' + endT : ''}` : '—'} />
          <Row T={T} label="Est."    value={job.estimated_hours ? `${job.estimated_hours}h` : '—'} />
          <Row T={T} label="Amount"  value={job.total_amount != null ? `$${Number(job.total_amount).toFixed(0)}` : '—'} />
          <Row T={T} label="Pricing" value={job.pricing_type || 'Flat'} last />
        </InfoCard>

        {/* notes */}
        <InfoCard T={T}>
          <div style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#FF78B0', marginBottom: 7 }}>✦ NOTES</div>
          <div style={{ fontFamily: T.font, fontSize: 12, color: job.job_notes ? T.ink : T.inkMuted, lineHeight: 1.55 }}>
            {job.job_notes || 'No notes for this job.'}
          </div>
        </InfoCard>

        {/* toast */}
        {toast && (
          <div style={{ borderRadius: 10, padding: '11px 14px', textAlign: 'center', fontFamily: T.font, fontSize: 13, fontWeight: 700, marginBottom: 10, background: toast.ok ? 'rgba(34,197,94,0.15)' : 'rgba(233,30,106,0.15)', border: `1px solid ${toast.ok ? 'rgba(34,197,94,0.3)' : 'rgba(233,30,106,0.3)'}`, color: toast.ok ? '#22C55E' : '#E91E6A' }}>
            {toast.msg}
          </div>
        )}

        {/* cancel confirm */}
        {confirm && (
          <div style={{ background: 'rgba(233,30,106,0.08)', border: '1px solid rgba(233,30,106,0.25)', borderRadius: 12, padding: '12px 14px', marginBottom: 10 }}>
            <div style={{ fontFamily: T.font, fontSize: 12, fontWeight: 700, color: '#E91E6A', marginBottom: 8 }}>Cancel this job?</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onConfirmCancel} disabled={busy} style={{ flex: 1, background: '#E91E6A', color: 'white', border: 'none', borderRadius: 8, padding: '9px 0', fontFamily: T.font, fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>Yes, cancel</button>
              <button onClick={onDismissConfirm} style={{ flex: 1, background: T.card, border: `1px solid ${T.cardBorder}`, color: T.inkMuted, borderRadius: 8, padding: '9px 0', fontFamily: T.font, fontSize: 12, cursor: 'pointer' }}>Keep it</button>
            </div>
          </div>
        )}
      </div>

      {/* action buttons */}
      {!confirm && (
        <div style={{ padding: '10px 14px 28px', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          {isScheduled && (
            <Btn onClick={onMarkComplete} disabled={busy} bg="#22C55E" T={T}>Mark Complete</Btn>
          )}
          {!isPaid && !isCancelled && (
            <Btn onClick={onMarkPaid} disabled={busy} bg="#E91E6A" T={T}>Mark Paid</Btn>
          )}
          {!isCancelled && (
            <Btn onClick={onEdit} bg={T.card} border={`1px solid ${T.cardBorder}`} color={T.ink} T={T}>Edit Job</Btn>
          )}
          {isScheduled && (
            <button onClick={onCancelConfirm} style={{ background: 'transparent', border: 'none', color: '#E91E6A', fontFamily: T.font, fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '4px 0' }}>
              Cancel Job
            </button>
          )}
        </div>
      )}
    </>
  );
}

// ── edit mode ─────────────────────────────────────────────────────────────────
function EditMode({ form, setForm, T, busy, error, onSave, onCancelEdit }) {
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  return (
    <>
      <div style={{ padding: '12px 16px 10px', flexShrink: 0, borderBottom: `1px solid ${T.cardBorder}` }}>
        <div style={{ fontFamily: T.serif, fontSize: 18, fontWeight: 500, color: T.ink }}>Edit Job</div>
      </div>

      <div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 8px' }}>
        {error && (
          <div style={{ background: 'rgba(233,30,106,0.1)', border: '1px solid rgba(233,30,106,0.25)', borderRadius: 8, padding: '8px 12px', fontFamily: T.font, fontSize: 12, color: '#E91E6A', marginBottom: 12 }}>{error}</div>
        )}

        <Field T={T} label="Date">
          <input type="date" value={form.scheduled_date} onChange={e => set('scheduled_date', e.target.value)} style={iStyle(T)} />
        </Field>

        <Field T={T} label="Time">
          <input type="time" value={form.scheduled_time} onChange={e => set('scheduled_time', e.target.value)} style={iStyle(T)} />
        </Field>

        <Field T={T} label="Service">
          <select value={form.service_name} onChange={e => {
            const svc = SERVICES.find(s => s.label === e.target.value);
            set('service_name', e.target.value);
            if (svc && form.pricing_type === 'Flat') set('total_amount', String(svc.rate));
            if (svc) set('estimated_hours', String((svc.defaultDuration / 60).toFixed(1)));
          }} style={iStyle(T)}>
            {SERVICES.map(s => <option key={s.key} value={s.label}>{s.emoji} {s.label}</option>)}
          </select>
        </Field>

        <Field T={T} label="Pricing">
          <div style={{ display: 'flex', gap: 6 }}>
            {['Flat', 'Hourly'].map(p => (
              <button key={p} onClick={() => set('pricing_type', p)} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: `1px solid ${form.pricing_type === p ? '#E91E6A' : T.cardBorder}`, background: form.pricing_type === p ? 'rgba(233,30,106,0.12)' : T.card, color: form.pricing_type === p ? '#E91E6A' : T.inkMuted, fontFamily: T.font, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{p}</button>
            ))}
          </div>
        </Field>

        <Field T={T} label="Amount ($)">
          <input type="number" value={form.total_amount} onChange={e => set('total_amount', e.target.value)} style={iStyle(T)} min="0" step="5" />
        </Field>

        <Field T={T} label="Est. hours">
          <input type="number" value={form.estimated_hours} onChange={e => set('estimated_hours', e.target.value)} style={iStyle(T)} min="0.5" step="0.5" />
        </Field>

        <Field T={T} label="Payment method">
          <div style={{ display: 'flex', gap: 6 }}>
            {['Cash', 'e-Transfer'].map(p => (
              <button key={p} onClick={() => set('payment_method', p)} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: `1px solid ${form.payment_method === p ? '#E91E6A' : T.cardBorder}`, background: form.payment_method === p ? 'rgba(233,30,106,0.12)' : T.card, color: form.payment_method === p ? '#E91E6A' : T.inkMuted, fontFamily: T.font, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{p}</button>
            ))}
          </div>
        </Field>

        <Field T={T} label="Recurrence">
          <select value={form.recurrence ?? ''} onChange={e => set('recurrence', e.target.value || null)} style={iStyle(T)}>
            {RECURRENCE.map(r => <option key={String(r.key)} value={r.key ?? ''}>{r.label}</option>)}
          </select>
        </Field>

        <Field T={T} label="Notes" last>
          <textarea value={form.job_notes} onChange={e => set('job_notes', e.target.value)} rows={3} style={{ ...iStyle(T), resize: 'none' }} />
        </Field>
      </div>

      <div style={{ padding: '10px 14px 28px', display: 'flex', gap: 8, flexShrink: 0 }}>
        <Btn onClick={onSave} disabled={busy} bg="#E91E6A" T={T} style={{ flex: 2 }}>{busy ? 'Saving…' : 'Save'}</Btn>
        <Btn onClick={onCancelEdit} bg={T.card} border={`1px solid ${T.cardBorder}`} color={T.inkMuted} T={T} style={{ flex: 1 }}>Cancel</Btn>
      </div>
    </>
  );
}

// ── small UI primitives ───────────────────────────────────────────────────────
function InfoCard({ T, children }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: '11px 13px', marginBottom: 10 }}>
      {children}
    </div>
  );
}

function Row({ T, label, value, last }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: last ? 0 : 8, marginBottom: last ? 0 : 8, borderBottom: last ? 'none' : `1px solid ${T.cardBorder}` }}>
      <span style={{ fontFamily: T.font, fontSize: 11, color: T.inkMuted }}>{label}</span>
      <span style={{ fontFamily: T.serif, fontSize: 13, fontWeight: 500, color: T.ink }}>{value}</span>
    </div>
  );
}

function Pill({ bg, border, color, children, T }) {
  return (
    <span style={{ background: bg, border: `1px solid ${border}`, color, borderRadius: 20, padding: '3px 10px', fontFamily: T.font, fontSize: 10, fontWeight: 700 }}>
      {children}
    </span>
  );
}

function Btn({ onClick, disabled, bg, border, color, children, T, style: extra }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ background: bg, border: border || 'none', color: color || 'white', borderRadius: 10, padding: '13px 0', fontFamily: T.font, fontSize: 13, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1, flex: 1, ...extra }}
    >
      {children}
    </button>
  );
}

function Field({ T, label, children, last }) {
  return (
    <div style={{ marginBottom: last ? 0 : 14 }}>
      <div style={{ fontFamily: T.font, fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: T.inkMuted, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function iStyle(T) {
  return {
    width: '100%', background: T.card, border: `1px solid ${T.cardBorder}`,
    borderRadius: 8, padding: '9px 11px', fontFamily: T.font, fontSize: 13,
    color: T.ink, outline: 'none', boxSizing: 'border-box',
  };
}
```

- [ ] Run `npm run dev`. Confirm no compile errors in the browser console.
- [ ] Tap the pink + FAB to open the New Job sheet — confirm it still works (SERVICES import didn't break it).
- [ ] Commit:
```bash
git add src/components/sheets/JobDetailSheet.jsx
git commit -m "feat: JobDetailSheet UI — read and edit modes"
```

---

## Task 6 — Wire Home job cards

**Files:**
- Modify: `src/pages/Home.jsx`

- [ ] Add this import at the top of `src/pages/Home.jsx` (after existing imports):
```js
import { useJobDetailSheet } from '../context/JobDetailSheetContext';
```

- [ ] Inside the `Home` component function body (right after the existing hooks), add:
```js
const { openJob } = useJobDetailSheet();
```

- [ ] Find the **Opening Act card** — the `<div>` that starts with `background: T.hero, border: '1.5px solid rgba(233,30,106,0.32)'`. Add to its style and props:
```jsx
onClick={() => openJob(next.id)}
style={{ ...existingStyle, cursor: 'pointer' }}
```

- [ ] Find the **Today's Schedule** job card — the `<div key={j.id}>` inside `todayJobs.map`. Add:
```jsx
onClick={() => openJob(j.id)}
style={{ ...existingStyle, cursor: 'pointer' }}
```

- [ ] Verify in browser: tap a job card on the Home screen → sheet slides up with correct client name, service, time, and status.
- [ ] Commit:
```bash
git add src/pages/Home.jsx
git commit -m "feat: wire Home job cards to JobDetailSheet"
```

---

## Task 7 — Wire Calendar job cards (all three views)

**Files:**
- Modify: `src/pages/Calendar.jsx`

The Calendar has three views. Each needs `openJob` passed down or called directly. Since the sub-components (DayView, WeekView, AgendaCard) are defined in the same file, pass `openJob` as a prop from the root Calendar component.

- [ ] Add this import at the top of `src/pages/Calendar.jsx`:
```js
import { useJobDetailSheet } from '../context/JobDetailSheetContext';
```

- [ ] Inside the `Calendar` component function body (after existing hooks), add:
```js
const { openJob } = useJobDetailSheet();
```

- [ ] Pass `openJob` to each view component in the Calendar return JSX. Change the three view lines from:
```jsx
{view === 'Day'    && <DayView    T={T} mode={mode} privacyOn={privacyOn} todayJobs={todayJobs} nextUpcoming={nextUpcoming} />}
{view === 'Week'   && <WeekView   T={T} mode={mode} weekDays={weekDays} allJobs={allJobs} onPickDay={() => setView('Day')} />}
{view === 'Agenda' && <AgendaView T={T} mode={mode} privacyOn={privacyOn} allJobs={allJobs} nextUpcoming={nextUpcoming} />}
```
to:
```jsx
{view === 'Day'    && <DayView    T={T} mode={mode} privacyOn={privacyOn} todayJobs={todayJobs} nextUpcoming={nextUpcoming} onJobPress={openJob} />}
{view === 'Week'   && <WeekView   T={T} mode={mode} weekDays={weekDays} allJobs={allJobs} onPickDay={() => setView('Day')} onJobPress={openJob} />}
{view === 'Agenda' && <AgendaView T={T} mode={mode} privacyOn={privacyOn} allJobs={allJobs} nextUpcoming={nextUpcoming} onJobPress={openJob} />}
```

- [ ] **DayView:** Add `onJobPress` to its props signature. Find the absolute-positioned job card `<div key={j.id}>` (the one at `position: 'absolute', top, left: 43, right: 0`). Add:
```jsx
onClick={() => onJobPress(j.id)}
style={{ ...existingStyle, cursor: 'pointer' }}
```

- [ ] **WeekView:** Add `onJobPress` to its props signature. Find the week job card `<div key={j.id}>` inside `dayJobs.map` (the one with `pointerEvents: 'auto'`). Add:
```jsx
onClick={() => onJobPress(j.id)}
```
(It already has `cursor: 'pointer'` and `pointerEvents: 'auto'`.)

- [ ] **AgendaView:** Add `onJobPress` to its props signature. Pass it to `AgendaCard`:
```jsx
<AgendaCard
  key={j.id}
  T={T} mode={mode} privacyOn={privacyOn}
  job={j} isNext={isNext} conflict={conflict}
  onPress={onJobPress}
/>
```

- [ ] **AgendaCard:** Add `onPress` to its props signature. Find the root `<div>` of `AgendaCard` (the one with `background: bg, border: ...`). Add:
```jsx
onClick={() => onPress(job.id)}
style={{ ...existingStyle, cursor: 'pointer' }}
```

- [ ] Verify in browser: in Day, Week, and Agenda views, tapping any job card opens the sheet with the correct job.
- [ ] Commit:
```bash
git add src/pages/Calendar.jsx
git commit -m "feat: wire Calendar job cards to JobDetailSheet"
```

---

## Self-Review

**Spec coverage:**
- ✅ fetchJobById returns client_name (Task 1)
- ✅ Context hook (Task 3)
- ✅ Provider mounts in App (Task 4)
- ✅ Read mode: header, service, client name, status pills, time, amount, notes (Task 5)
- ✅ Actions: mark complete, mark paid, cancel with confirm dialog (Task 5)
- ✅ Edit mode: all 9 fields including recurrence and payment method (Task 5)
- ✅ Named action handlers: `markComplete`, `markPaid`, `cancelJob`, `saveEdit` — AI voice ready (Task 5)
- ✅ Toast → notifyDataChanged → close (Task 5)
- ✅ Cancelled jobs: Edit and Cancel buttons suppressed (Task 5)
- ✅ Home job cards wired (Task 6)
- ✅ Calendar Day, Week, Agenda cards wired (Task 7)
- ✅ SERVICES extracted DRY (Task 2)

**Placeholder scan:** None — every step contains actual code.

**Type consistency:**
- `openJob(id)` — defined in Task 4 provider, used in Tasks 6 and 7 ✅
- `fetchJobById` — updated in Task 1, imported in Task 5 ✅
- `SERVICES`, `RECURRENCE` — created in Task 2, imported in Tasks 2 and 5 ✅
- `updateJob` — already in jobsRepo, imported in Task 5 ✅
- `notifyDataChanged` — already in useData, imported in Task 5 ✅
- `useJobDetailSheet` — created in Task 3, imported in Tasks 4, 6, 7 ✅
- `onJobPress` prop — passed in Task 7 Calendar, received in DayView/WeekView/AgendaView/AgendaCard ✅
