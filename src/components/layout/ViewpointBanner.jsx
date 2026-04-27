import { useViewpoint } from '../../context/ViewpointContext';
import { useAppTheme } from '../../context/AppThemeContext';

export default function ViewpointBanner() {
  const { viewingAsName, reset } = useViewpoint();
  const { T } = useAppTheme();

  if (!viewingAsName) return null;

  return (
    <div style={{
      background: '#1a0a0a',
      borderBottom: '1px solid #7f1d1d',
      padding: '6px 14px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      zIndex: 50
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12 }}>🕵️</span>
        <div style={{ fontFamily: T.font, fontSize: 11, fontWeight: 600, color: '#fca5a5' }}>
          Viewing as {viewingAsName}
        </div>
      </div>
      <button 
        onClick={reset}
        style={{
          background: 'transparent',
          border: '1px solid #ef4444',
          color: '#ef4444',
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
