import { fmtTimeRange, dateBrief } from '../../lib/dateUtils';
import { useBusiness } from '../../data/useData';
import { getWorkerLabel } from '../../lib/labels';
import NoteCallout from '../ui/NoteCallout';
import { isNoteOpen, isNoteDone } from '../../lib/noteState';

export default function JobCard({
  job: j, T, onClick, total = 0, privacyOn = false, label,
  wrapUp = false, remaining = null, staleness = null, paidSoFar = 0, stale = false,
}) {
  const { business } = useBusiness();
  const isCompleted = j.status === 'Completed';
  const isPaid = j.payment_status === 'Paid';
  const isPartial = j.payment_status === 'Partial';
  const isUnpaid = isCompleted && !isPaid;
  const isOwing = isUnpaid || isPartial;

  // wrapUp: job's scheduled end has passed but it hasn't been marked Completed yet
  // (Home's "Needs attention" section). Styled like scheduled (light, non-bold) —
  // there's no formal $ owed until the job is wrapped up and finalized.
  const S = wrapUp ? T.status.attention
    : isPartial ? T.status.partial
    : isUnpaid ? (stale ? T.status.overdue : T.status.unpaid)
    : isPaid ? T.status.paid
    : T.status.scheduled;
  const statusLabel = label || (wrapUp ? 'WRAP UP' : isPartial ? 'PARTIAL' : isUnpaid ? 'UNPAID' : isPaid ? 'PAID ✓' : 'SCHEDULED');

  // Once a job is Completed, its pre-job note (job_notes) is stale — swap to the
  // post-job note (completion_notes) so a card never shows both or the wrong one.
  // Highlighted note disappears entirely once paid in full (Joel's call, 2026-09-15) —
  // full detail (both notes) is still always in JobDetailSheet.
  const noteText = isCompleted ? (isPaid ? null : j.completion_notes) : j.notes;
  // job-note visibility v2: open/done state only applies to the pre-job note
  // on a not-yet-completed job — noteState.js's helpers read the raw jobs-row
  // shape (job.raw), status-gated on job_status === 'Scheduled' (design doc
  // §3.1). NoteCallout hides itself entirely for compact+'done' (handled
  // notes drop off cards — full detail stays in the sheet).
  const noteStatus = !isCompleted ? (isNoteOpen(j.raw) ? 'open' : isNoteDone(j.raw) ? 'done' : null) : null;

  const timeRange = j.start && j.end ? fmtTimeRange(j.start, j.end) : '—';
  const dateLabel = j.start ? dateBrief(j.start) + (staleness ? ` · ${staleness}` : '') : '';

  // Outstanding balance takes priority over the gross total once something's owed —
  // that's the actionable number. Wrap-up jobs show no $ at all (nothing's final yet).
  const amountToShow = wrapUp ? 0 : (isOwing && remaining != null) ? remaining : total;

  // Owing cards (unpaid/overdue/partial) get a bold solid fill — switch body text to white for contrast
  const nameColor = isOwing ? S.fg : T.ink;
  const dateColor = isOwing ? 'rgba(255,255,255,0.85)' : T.inkSub;
  const mutedColor = isOwing ? 'rgba(255,255,255,0.75)' : T.inkMuted;
  const amountColor = isOwing ? S.fg : S.text;

  return (
    <div
      onClick={onClick}
      style={{
        background: S.bg,
        border: `1.5px solid ${S.border}`,
        borderLeft: `4px solid ${S.border}`,
        borderRadius: 16,
        padding: '10px 14px 10px 10px',
        marginBottom: 8,
        cursor: 'pointer',
      }}
    >
      {/* Row 1: name · bold time | status pill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <div style={{
          fontFamily: T.serif, fontSize: 16, fontWeight: 600, color: nameColor,
          flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          letterSpacing: '-0.3px',
        }}>
          {j.client_name}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: amountColor, whiteSpace: 'nowrap', flexShrink: 0, letterSpacing: '-0.3px' }}>
          {timeRange}
        </div>
        <span style={{
          fontFamily: T.font, fontSize: 9, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.3px',
          background: S.pill, color: S.text,
          padding: '2px 6px', borderRadius: 4, flexShrink: 0, whiteSpace: 'nowrap',
        }}>
          {statusLabel}
        </span>
      </div>

      {/* Row 2: date | amount */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: dateColor }}>{dateLabel}</div>
        {amountToShow > 0 && (
          <div style={{
            fontFamily: T.serif, fontSize: 14,
            fontWeight: isOwing ? 700 : 600,
            color: amountColor, fontVariantNumeric: 'tabular-nums',
          }}>
            {privacyOn ? '•••' : `$${amountToShow.toFixed(0)}`}
          </div>
        )}
      </div>

      {/* Partial: what's already been paid, next to the outstanding figure above */}
      {isPartial && paidSoFar > 0 && !privacyOn && (
        <div style={{ fontSize: 10.5, fontWeight: 600, color: mutedColor, marginTop: -3, marginBottom: 5 }}>
          ${paidSoFar.toFixed(0)} paid already
        </div>
      )}

      {/* Row 3: service tag */}
      <div style={{
        fontFamily: T.font, fontSize: 9, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.4px',
        background: S.pill, color: S.text,
        padding: '2px 6px', borderRadius: 4, display: 'inline-block', marginBottom: 3,
      }}>
        {j.service_name}
      </div>

      {/* Worker */}
      {j.worker_name && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10.5, color: mutedColor, fontFamily: T.font }}>
            {getWorkerLabel(business, j.assignee_type)}: {j.worker_name}
          </span>
          {isPaid && Number(j.worker_pay) > 0 && !j.worker_paid && (
            <span style={{ fontSize: 8.5, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: T.status.attention.pill, color: T.status.attention.text, textTransform: 'uppercase', letterSpacing: '0.3px', flexShrink: 0 }}>
              $ Unpaid
            </span>
          )}
        </div>
      )}

      {/* Overpaid → credit issued */}
      {Number(j.issued_credit) > 0.009 && (
        <div style={{ marginTop: 4 }}>
          <span style={{
            fontSize: 8.5, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
            background: T.pink, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.3px',
          }}>
            ✦ Overpaid — {privacyOn ? '•••' : `$${Number(j.issued_credit).toFixed(2)}`} credited
          </span>
        </div>
      )}

      {/* Notes */}
      {noteText && (
        <NoteCallout T={T} text={noteText} compact onDark={isOwing} status={noteStatus} />
      )}
    </div>
  );
}
