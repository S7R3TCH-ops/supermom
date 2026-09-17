// High-contrast pink callout for job_notes/completion_notes — was plain italic muted text, easy to miss (Sandra's "more in my face" ask).
//
// Job-note visibility v2 (2026-09-18): gains `status` ('open' | 'done' | null)
// and `onToggleDone`. `status` is null for every existing caller (Completed
// jobs' notes, client-level notes elsewhere) — that path is pixel-identical
// to before. 'open'/'done' are for a Scheduled job's job_notes only (see
// src/lib/noteState.js). `onToggleDone`, when passed, renders a Done/Undo
// control — omit it to render the callout with no interactive control (e.g.
// JobCard's compact notes, which are deliberately non-interactive).
const TODO_PILL = { background: '#FC4693' /* T.pink, but pill stays one color regardless of onDark/theme per design doc §3.2 "one state color everywhere" */ };

export default function NoteCallout({ T, mode, label, text, compact = false, onDark = false, status = null, onToggleDone }) {
  const isOpen = status === 'open';
  const isDone = status === 'done';

  function handleToggle(e) {
    e.stopPropagation();
    onToggleDone?.();
  }

  if (compact) {
    // Handled state disappears from cards entirely — consistent with the
    // existing "highlighted note disappears once paid" rule (JobCard.jsx).
    // Full detail is always still in JobDetailSheet.
    if (isDone) return null;

    const pillBorder = isOpen ? T.pink : (onDark ? 'rgba(255,255,255,0.35)' : T.pink);
    const pillBorderWidth = isOpen ? 1.5 : 1;
    const textColor = onDark ? '#fff' : T.ink;

    return (
      <div style={{
        marginTop: 5, padding: '5px 8px', borderRadius: 8,
        background: onDark ? 'rgba(255,255,255,0.15)' : T.pinkTint,
        border: `${pillBorderWidth}px solid ${pillBorder}`,
        display: 'flex', flexDirection: 'column', gap: 5,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5 }}>
          {isOpen ? (
            <span style={{
              flexShrink: 0, fontFamily: T.font, fontSize: 8, fontWeight: 700,
              letterSpacing: '0.4px', textTransform: 'uppercase',
              background: TODO_PILL.background, color: '#fff',
              padding: '1px 5px', borderRadius: 4, lineHeight: 1.5,
            }}>☐ To do</span>
          ) : (
            <span style={{ fontSize: 10, color: onDark ? '#fff' : T.pink, flexShrink: 0, lineHeight: 1.4 }}>✦</span>
          )}
          <span style={{
            fontSize: 11, fontWeight: 500, color: textColor, lineHeight: 1.4,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {text}
          </span>
        </div>
        {isOpen && onToggleDone && (
          <button
            type="button"
            onClick={handleToggle}
            style={{
              alignSelf: 'flex-start', minHeight: 32, padding: '5px 12px',
              borderRadius: 8, border: 'none', background: T.pink, color: '#fff',
              fontFamily: T.font, fontSize: 11, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Done ✓
          </button>
        )}
      </div>
    );
  }

  if (isOpen) {
    return (
      <div style={{ background: T.pinkTint, border: `2px solid ${T.pink}`, borderRadius: 12, padding: '11px 13px', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
          <span style={{
            fontFamily: T.font, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.4px',
            textTransform: 'uppercase', background: TODO_PILL.background, color: '#fff',
            padding: '3px 9px', borderRadius: 5,
          }}>☐ To do</span>
          {onToggleDone && (
            <button
              type="button"
              onClick={handleToggle}
              aria-label="Mark this note done"
              style={{
                minWidth: 44, minHeight: 44, padding: '8px 14px', flexShrink: 0,
                borderRadius: 10, border: 'none', background: T.pink, color: '#fff',
                fontFamily: T.font, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Done ✓
            </button>
          )}
        </div>
        <div style={{ fontFamily: T.font, fontSize: 13, fontWeight: 500, color: T.ink, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{text}</div>
      </div>
    );
  }

  if (isDone) {
    return (
      <div style={{ background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 12, padding: '11px 13px', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
          <span style={{ fontFamily: T.font, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: T.inkMuted }}>✓ Done</span>
          {onToggleDone && (
            <button
              type="button"
              onClick={handleToggle}
              style={{
                minHeight: 32, padding: '4px 2px', border: 'none', background: 'transparent',
                color: T.inkMuted, fontFamily: T.font, fontSize: 11.5, fontWeight: 600,
                textDecoration: 'underline', cursor: 'pointer',
              }}
            >
              Undo
            </button>
          )}
        </div>
        <div style={{ fontFamily: T.font, fontSize: 13, fontWeight: 500, color: T.inkSub, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{text}</div>
      </div>
    );
  }

  // status === null — exactly today's plain callout (Completed jobs' notes,
  // and every other existing caller). Unchanged.
  return (
    <div style={{ background: T.pinkTint, border: `1.5px solid ${T.pink}`, borderRadius: 12, padding: '11px 13px', marginBottom: 10 }}>
      <div style={{ fontFamily: T.font, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: mode === 'dark' ? '#FF78B0' : T.pink, marginBottom: 6 }}>✦ {label}</div>
      <div style={{ fontFamily: T.font, fontSize: 13, fontWeight: 500, color: T.ink, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{text}</div>
    </div>
  );
}
