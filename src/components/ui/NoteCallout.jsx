// High-contrast pink callout for job_notes/completion_notes — was plain italic muted text, easy to miss (Sandra's "more in my face" ask).
export default function NoteCallout({ T, mode, label, text, compact = false, onDark = false }) {
  if (compact) {
    return (
      <div style={{
        marginTop: 5, padding: '5px 8px', borderRadius: 8,
        background: onDark ? 'rgba(255,255,255,0.15)' : T.pinkTint,
        border: `1px solid ${onDark ? 'rgba(255,255,255,0.35)' : T.pink}`,
        display: 'flex', alignItems: 'flex-start', gap: 5,
      }}>
        <span style={{ fontSize: 10, color: onDark ? '#fff' : T.pink, flexShrink: 0, lineHeight: 1.4 }}>✦</span>
        <span style={{
          fontSize: 11, fontWeight: 500, color: onDark ? '#fff' : T.ink, lineHeight: 1.4,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {text}
        </span>
      </div>
    );
  }
  return (
    <div style={{ background: T.pinkTint, border: `1.5px solid ${T.pink}`, borderRadius: 12, padding: '11px 13px', marginBottom: 10 }}>
      <div style={{ fontFamily: T.font, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: mode === 'dark' ? '#FF78B0' : T.pink, marginBottom: 6 }}>✦ {label}</div>
      <div style={{ fontFamily: T.font, fontSize: 13, fontWeight: 500, color: T.ink, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{text}</div>
    </div>
  );
}
