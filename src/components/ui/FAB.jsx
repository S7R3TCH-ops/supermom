import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useNewJobSheet } from '../../context/NewJobSheetContext';
import { useNewClientSheet } from '../../context/NewClientSheetContext';
import { useAppTheme } from '../../context/AppThemeContext';
import { triggerHaptic } from '../../lib/haptics';

export default function FAB() {
  const { openBlank, open: jobSheetOpen } = useNewJobSheet();
  const { open: openNewClient } = useNewClientSheet();
  const { T } = useAppTheme();
  const location = useLocation();
  const [expanded, setExpanded] = useState(false);

  if (jobSheetOpen) return null;

  const onClientsPage = location.pathname.startsWith('/clients');

  const options = onClientsPage
    ? [
        { label: '+ New Client', action: () => { openNewClient(); } },
        { label: '+ New Job',    action: () => { openBlank(); } },
      ]
    : [
        { label: '+ New Job',    action: () => { openBlank(); } },
        { label: '+ New Client', action: () => { openNewClient(); } },
      ];

  const handleOptionTap = (action) => {
    triggerHaptic('light');
    setExpanded(false);
    action();
  };

  const handleFabTap = () => {
    triggerHaptic('light');
    setExpanded(prev => !prev);
  };

  return (
    <>
      {expanded && (
        <div
          onClick={() => setExpanded(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 19 }}
        />
      )}

      <div style={{ position: 'absolute', bottom: 56, right: 14, zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
        {options.map((opt, i) => (
          <button
            key={opt.label}
            onClick={() => handleOptionTap(opt.action)}
            style={{
              padding: '10px 16px',
              borderRadius: 24,
              background: i === 0 ? T.pink : T.card,
              color: i === 0 ? 'white' : T.ink,
              border: i === 0 ? 'none' : `1.5px solid ${T.cardBorder}`,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: i === 0 ? '0 4px 14px rgba(233,30,106,0.35)' : '0 2px 8px rgba(0,0,0,0.12)',
              whiteSpace: 'nowrap',
              opacity: expanded ? 1 : 0,
              transform: expanded ? 'translateY(0) scale(1)' : `translateY(${(options.length - i) * 12}px) scale(0.9)`,
              transition: `opacity 0.18s ease ${i * 0.04}s, transform 0.18s ease ${i * 0.04}s`,
              pointerEvents: expanded ? 'auto' : 'none',
            }}
          >
            {opt.label}
          </button>
        ))}

        <button
          onClick={handleFabTap}
          aria-label={expanded ? 'Close menu' : 'New item'}
          style={{
            width: 52, height: 52,
            borderRadius: '50%',
            background: T.pink,
            border: '2px solid white',
            boxShadow: '0 8px 22px rgba(255,112,166,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', padding: 0,
          }}
        >
          <svg
            width="22" height="22" viewBox="0 0 22 22" fill="none"
            style={{ transition: 'transform 0.2s ease', transform: expanded ? 'rotate(45deg)' : 'none' }}
          >
            <path d="M11 3v16M3 11h16" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </>
  );
}
