import { useAppTheme } from '../../context/AppThemeContext';

export default function OfflineMessage({ onRetry }) {
  const { T } = useAppTheme();
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      flex: 1, padding: '48px 24px', gap: 16, textAlign: 'center',
    }}>
      <div style={{ fontSize: 40 }}>📡</div>
      <div style={{ fontFamily: T.font, fontSize: 16, fontWeight: 700, color: T.ink }}>
        Can't reach the server
      </div>
      <div style={{ fontFamily: T.font, fontSize: 13, color: T.inkMuted, maxWidth: 260, lineHeight: 1.5 }}>
        Check your connection, then try again.
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            marginTop: 8, padding: '12px 28px', borderRadius: 12,
            background: T.pink, border: 'none',
            fontFamily: T.font, fontSize: 14, fontWeight: 700, color: 'white',
            cursor: 'pointer', boxShadow: '0 4px 12px rgba(233,30,106,0.25)',
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}
