import { useNewJobSheet } from '../../context/NewJobSheetContext';
import { useAppTheme } from '../../context/AppThemeContext';

export default function FAB() {
  const { openBlank, open } = useNewJobSheet();
  const { T } = useAppTheme();
  if (open) return null;

  return (
    <button
      onClick={openBlank}
      aria-label="Book new job"
      style={{
        position: 'absolute',
        bottom: 56,
        right: 14,
        width: 52, height: 52,
        borderRadius: '50%',
        background: T.pink,
        border: '2px solid white',
        boxShadow: '0 8px 22px rgba(255,112,166,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', padding: 0, zIndex: 20,
      }}
    >
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M11 3v16M3 11h16" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </button>
  );
}
