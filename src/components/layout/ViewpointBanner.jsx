import { useViewpoint } from '../../context/ViewpointContext';
import { useAppTheme } from '../../context/AppThemeContext';

export default function ViewpointBanner() {
  const { viewingAsName, reset } = useViewpoint();
  const { T } = useAppTheme();

  if (!viewingAsName) return null;

  // Uses the app's own overdue/urgent status tokens (T.status.overdue) instead
  // of a one-off "wine" red disconnected from the pink/black/grey theme — also
  // makes this adapt to light mode instead of always rendering near-black
  // (Joel, 2026-07-15: dark palette didn't cohere, this banner was the worst offender).
  const S = T.status.overdue;

  return (
    <div style={{
      background: S.bg,
      borderBottom: `1px solid ${S.border}`,
      padding: '6px 14px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      zIndex: 50
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12 }}>🕵️</span>
        <div style={{ fontFamily: T.font, fontSize: 11, fontWeight: 600, color: S.fg }}>
          Viewing as {viewingAsName}
        </div>
      </div>
      <button
        onClick={reset}
        style={{
          background: 'transparent',
          border: `1px solid ${S.fg}`,
          color: S.fg,
          borderRadius: 6,
          padding: '2px 8px',
          fontSize: 10,
          fontWeight: 700,
          cursor: 'pointer'
        }}
      >
        EXIT
      </button>
    </div>
  );
}
