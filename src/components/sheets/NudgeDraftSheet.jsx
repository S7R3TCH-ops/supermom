import { useState, useEffect, useRef } from 'react';
import { useAppTheme } from '../../context/AppThemeContext';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export default function NudgeDraftSheet({ isOpen, onClose, clientsWithUnpaid }) {
  const { T, mode } = useAppTheme();
  const sheetRef = useRef(null);
  useFocusTrap(sheetRef, isOpen, onClose);
  const [selectedClient, setSelectedClient] = useState(null);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (clientsWithUnpaid?.length > 0 && !selectedClient) {
      setSelectedClient(clientsWithUnpaid[0]);
    }
  }, [clientsWithUnpaid, selectedClient]);

  useEffect(() => {
    if (selectedClient) {
      const amt = selectedClient.unpaidTotal;
      const firstName = selectedClient.name === 'Unknown' ? 'there' : selectedClient.name.split(' ')[0];
      const personalNote = selectedClient.personal ? ` Hope everything is going well with ${selectedClient.personal.toLowerCase()}!` : " Hope you're having a great week!";
      const text = `Hi ${firstName}, just a quick reminder about the $${amt} for our recent job.${personalNote} - Sandra`;
      setDraft(text);
    }
  }, [selectedClient]);

  if (!isOpen) return null;

  return (
    <div
      ref={sheetRef}
      role="dialog"
      aria-modal="true"
      aria-label="Send payment nudge"
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        background: 'rgba(0,0,0,0.5)',
        animation: 'nudgeFade 180ms ease-out',
      }}
      onClick={onClose}
    >
      <style>{`
        @keyframes nudgeFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes nudgeSlide { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>

      <div 
        onClick={e => e.stopPropagation()}
        style={{
          background: T.bg, color: T.ink,
          borderRadius: '24px 24px 0 0',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.38)',
          maxHeight: '80svh', display: 'flex', flexDirection: 'column',
          animation: 'nudgeSlide 260ms cubic-bezier(0.2,0.8,0.2,1)',
          border: `1px solid ${T.cardBorder}`, borderBottom: 'none',
          padding: '8px 0 24px',
        }}
      >
        <div style={{ width: 40, height: 4, background: '#FFD6E8', borderRadius: 4, margin: '0 auto 16px', opacity: mode === 'dark' ? 0.6 : 1 }} />

        <div style={{ padding: '0 18px' }}>
          <div style={{ fontFamily: T.font, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: '#FF78B0', marginBottom: 4 }}>✦ AI Draft</div>
          <div style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 500, color: T.ink, marginBottom: 16 }}>Nudge {selectedClient?.name.split(' ')[0]}</div>

          <div className="sm-scroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 20, paddingBottom: 4 }}>
            {clientsWithUnpaid.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedClient(c)}
                style={{
                  padding: '6px 12px', borderRadius: 12, border: `1.5px solid ${selectedClient?.id === c.id ? '#E91E6A' : T.cardBorder}`,
                  background: selectedClient?.id === c.id ? '#E91E6A' : T.card,
                  color: selectedClient?.id === c.id ? 'white' : T.ink,
                  fontFamily: T.font, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer',
                }}
              >
                {c.name.split(' ')[0]} (${c.unpaidTotal})
              </button>
            ))}
          </div>

          <div style={{ background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 16, padding: 14, marginBottom: 20 }}>
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              style={{
                width: '100%', border: 'none', background: 'transparent',
                fontFamily: T.font, fontSize: 14, color: T.ink,
                lineHeight: 1.5, resize: 'none', outline: 'none',
                minHeight: 100,
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={onClose}
              style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: `1.5px solid ${T.cardBorder}`, background: T.card, color: T.inkSub, fontFamily: T.font, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={() => {
                const url = `sms:${selectedClient.phone}?body=${encodeURIComponent(draft)}`;
                window.location.href = url;
                onClose();
              }}
              style={{ flex: 2, padding: '12px 0', borderRadius: 12, border: 'none', background: '#E91E6A', color: 'white', fontFamily: T.font, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              Send Message
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
