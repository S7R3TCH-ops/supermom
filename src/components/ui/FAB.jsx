import { useNewJobSheet } from '../../context/NewJobSheetContext';

export default function FAB() {
  const { openBlank, open } = useNewJobSheet();
  if (open) return null;

  return (
    <button
      onClick={openBlank}
      aria-label="Book new job"
      style={{
        position: 'absolute',
        bottom: 14,
        right: 14,
        width: 52, height: 52,
        borderRadius: '50%',
        background: 'linear-gradient(135deg,#1C1C1E 0%,#E91E6A 100%)',
        border: '2px solid white',
        boxShadow: '0 8px 22px rgba(233,30,106,0.45), 0 2px 6px rgba(0,0,0,0.25)',
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
