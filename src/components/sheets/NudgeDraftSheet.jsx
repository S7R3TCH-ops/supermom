import { useRef, useState } from 'react';
import { useAppTheme } from '../../context/AppThemeContext';
import { useJobs, useClients } from '../../data/useData';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import GrabBar from '../ui/GrabBar';

export default function NudgeDraftSheet({ isOpen, onClose }) {
  const { T } = useAppTheme();
  const { jobs } = useJobs();
  const { clients } = useClients();
  const sheetRef = useRef(null);
  useFocusTrap(sheetRef, isOpen, onClose);

  const [selectedClient, setSelectedClient] = useState(null);
  const [draft, setDraft] = useState('');

  const clientsWithUnpaid = (clients || []).filter(c => {
    const clientJobs = (jobs || []).filter(j => j.client_id === c.id);
    return clientJobs.some(j => j.job_status === 'Completed' && j.payment_status !== 'Paid');
  });

  // Adjusting state during render for selectedClient and draft
  const [lastOpen, setLastOpen] = useState(false);
  if (isOpen && !lastOpen) {
    setLastOpen(true);
    if (clientsWithUnpaid.length > 0 && !selectedClient) {
      setSelectedClient(clientsWithUnpaid[0]);
    }
  } else if (!isOpen && lastOpen) {
    setLastOpen(false);
  }

  // Update draft when selectedClient changes - adjusting state during render
  const [prevSelectedClientId, setPrevSelectedClientId] = useState(null);
  if (selectedClient && selectedClient.id !== prevSelectedClientId) {
    setPrevSelectedClientId(selectedClient.id);
    const clientJobs = (jobs || []).filter(j => j.client_id === selectedClient.id && j.job_status === 'Completed' && j.payment_status !== 'Paid');
    const amt = clientJobs.reduce((s, j) => s + Number(j.total_amount || 0), 0);
    const firstName = selectedClient.first_name || 'there';
    const personalNote = selectedClient.personal ? ` Hope everything is going well with ${selectedClient.personal.toLowerCase()}!` : " Hope you're having a great week!";
    const text = `Hi ${firstName}, just a quick reminder about the $${amt} for our recent job.${personalNote} - Sandra`;
    setDraft(text);
  }

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(draft);
    alert('Draft copied to clipboard!');
  };

  const handleSend = () => {
    const phone = selectedClient?.phone?.replace(/\D/g, '');
    if (phone) {
      window.open(`sms:${phone}?body=${encodeURIComponent(draft)}`);
    } else {
      alert('Client has no phone number saved.');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.5)' }}>
      <div ref={sheetRef} style={{ background: T.bg, borderRadius: '24px 24px 0 0', padding: '16px 20px 40px', maxWidth: 500, margin: '0 auto', width: '100%', boxShadow: '0 -8px 30px rgba(0,0,0,0.2)' }}>
        <GrabBar onDismiss={onClose} />
        
        <h2 style={{ fontFamily: T.serif, fontSize: 20, marginBottom: 4, color: T.ink }}>Gentle Nudge</h2>
        <div style={{ fontSize: 13, color: T.inkMuted, marginBottom: 24 }}>Draft a quick reminder for an outstanding payment.</div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: T.inkMuted, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Select Client</label>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }} className="sm-scroll">
            {clientsWithUnpaid.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedClient(c)}
                style={{
                  padding: '8px 16px', borderRadius: 12, border: `1.5px solid ${selectedClient?.id === c.id ? T.pink : T.cardBorder}`,
                  background: selectedClient?.id === c.id ? T.pinkTint : T.card,
                  color: selectedClient?.id === c.id ? T.pink : T.ink,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap'
                }}
              >
                {c.first_name} {c.last_name?.[0]}.
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: T.inkMuted, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Message Preview</label>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            style={{
              width: '100%', height: 120, padding: 14, borderRadius: 16,
              background: T.card, border: `1.5px solid ${T.cardBorder}`,
              color: T.ink, fontSize: 14, lineHeight: 1.5, outline: 'none', resize: 'none',
              fontFamily: T.font
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={handleCopy} style={{ flex: 1, padding: '14px', borderRadius: 14, background: 'transparent', border: `1.5px solid ${T.cardBorder}`, color: T.ink, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>COPY</button>
          <button onClick={handleSend} style={{ flex: 1, padding: '14px', borderRadius: 14, background: T.pink, border: 'none', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 12px rgba(233,30,106,0.3)' }}>SEND SMS</button>
        </div>
      </div>
    </div>
  );
}
