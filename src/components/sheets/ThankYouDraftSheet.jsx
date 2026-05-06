import { useState, useEffect, useRef } from 'react';
import { useAppTheme } from '../../context/AppThemeContext';
import { useBusiness } from '../../data/useData';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import GrabBar from '../ui/GrabBar';

export default function ThankYouDraftSheet({ isOpen, onClose, jobId }) {
  const { T, mode } = useAppTheme();
  const { business } = useBusiness();
  const sheetRef = useRef(null);
  useFocusTrap(sheetRef, isOpen, onClose);
  const [type, setType] = useState('thank-you');
  const [draft, setDraft] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [clientFirstName, setClientFirstName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !jobId) return;
    setLoading(true);
    setError(null);
    setDraft('');

    fetch('/api/ai/thank-you-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, type, businessProfile: business }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setDraft(data.draft);
        setPhone(data.phone || '');
        setEmail(data.email || '');
        setClientFirstName(data.clientFirstName || '');
      })
      .catch(e => {
        setError(e.message);
        const fallback = type === 'receipt' 
          ? `Hi ${clientFirstName || 'there'}, this is Sandra. Just confirming receipt of your payment. Thank you so much!`
          : `Hi ${clientFirstName || 'there'}, just wanted to say thank you so much for today — it was a pleasure working for you!\n\n- Sandra`;
        setDraft(fallback);
      })
      .finally(() => setLoading(false));
  }, [isOpen, jobId, type, business]);

  if (!isOpen) return null;

  const handleSendSMS = () => {
    if (phone) {
      window.location.href = `sms:${phone}?body=${encodeURIComponent(draft)}`;
    } else {
      navigator.clipboard?.writeText(draft);
    }
    onClose();
  };

  const handleSendEmail = () => {
    const subject = type === 'receipt' ? 'Receipt from Supermom for Hire' : 'Thank you from Supermom for Hire';
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(draft)}`;
    onClose();
  };

  return (
    <div
      ref={sheetRef}
      role="dialog"
      aria-modal="true"
      aria-label="Draft message"
      style={{
        position: 'fixed', inset: 0, zIndex: 400,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        background: 'rgba(0,0,0,0.55)',
        animation: 'tyFade 180ms ease-out',
      }}
      onClick={onClose}
    >
      <style>{`
        @keyframes tyFade  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes tySlide { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>

      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: T.bg, color: T.ink,
          borderRadius: '24px 24px 0 0',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.38)',
          maxHeight: '82svh', display: 'flex', flexDirection: 'column',
          animation: 'tySlide 260ms cubic-bezier(0.2,0.8,0.2,1)',
          border: `1px solid ${T.cardBorder}`, borderBottom: 'none',
        }}
      >
        <GrabBar onDismiss={onClose} />

        {/* Header */}
        <div style={{ padding: '6px 18px 14px' }}>
          <div style={{ fontFamily: T.font, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: '#FF78B0', marginBottom: 3 }}>✦ AI Draft</div>
          <div style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 500, color: T.ink }}>
            {type === 'receipt' ? 'Send a receipt' : `Thank ${clientFirstName || 'your client'}`}
          </div>
        </div>

        {/* Toggle */}
        <div style={{ padding: '0 18px 14px' }}>
          <div style={{
            display: 'flex',
            background: mode === 'dark' ? 'rgba(255,255,255,0.04)' : '#FFF0F7',
            borderRadius: 10, padding: 3,
          }}>
            {[
              { id: 'thank-you', label: 'Thank You' },
              { id: 'receipt', label: 'Receipt' },
            ].map(m => {
              const on = type === m.id;
              return (
                <button key={m.id} onClick={() => setType(m.id)} style={{
                  flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
                  background: on ? '#E91E6A' : 'transparent',
                  fontFamily: T.font, fontSize: 11.5, fontWeight: 600,
                  color: on ? 'white' : T.inkSub, cursor: 'pointer',
                  transition: 'all 0.2s',
                }}>{m.label}</button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0 18px 6px' }}>
          {loading && (
            <div style={{ padding: '28px 0', textAlign: 'center' }}>
              <div style={{ fontFamily: T.font, fontSize: 11, color: '#FF78B0', letterSpacing: '0.5px', marginBottom: 6 }}>✦ Drafting your message…</div>
              <div style={{ fontFamily: T.font, fontSize: 11, color: T.inkMuted }}>Claude is writing for you</div>
            </div>
          )}

          {error && !loading && (
            <div style={{ padding: '8px 10px', borderRadius: 8, background: '#FEF3C7', border: '1px solid #FCD34D', fontFamily: T.font, fontSize: 11, color: '#78350F', marginBottom: 12 }}>
              Couldn't reach AI — showing a template instead.
            </div>
          )}

          {!loading && (
            <>
              <div style={{ background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 14, padding: 14, marginBottom: 16 }}>
                <textarea
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  style={{
                    width: '100%', border: 'none', background: 'transparent',
                    fontFamily: T.font, fontSize: 14, color: T.ink,
                    lineHeight: 1.55, resize: 'none', outline: 'none',
                    minHeight: 110,
                  }}
                />
              </div>
              {(!phone || !email) && (
                <div style={{ fontFamily: T.font, fontSize: 10.5, color: T.inkMuted, marginBottom: 12 }}>
                  {!phone && !email && 'No contact info — copy text manually.'}
                  {!phone && email && 'No phone number — email only or copy text.'}
                  {phone && !email && 'No email on file — text only or copy text.'}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && (
          <div style={{ padding: '10px 18px 24px', borderTop: `1px solid ${T.cardBorder}`, display: 'flex', flexDirection: 'column', gap: 10, background: T.bg }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleSendSMS}
                style={{ flex: 1, padding: '13px 0', borderRadius: 12, border: 'none', background: '#E91E6A', color: 'white', fontFamily: T.font, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(233,30,106,0.3)' }}
              >
                {phone ? 'Send via SMS' : 'Copy Text'}
              </button>
              <button
                onClick={handleSendEmail}
                disabled={!email}
                style={{ 
                  flex: 1, padding: '13px 0', borderRadius: 12, border: `1.5px solid ${T.cardBorder}`, 
                  background: email ? T.card : T.pinkTint, 
                  color: email ? T.ink : T.pinkMid, 
                  fontFamily: T.font, fontSize: 13, fontWeight: 700, 
                  cursor: email ? 'pointer' : 'default',
                  opacity: email ? 1 : 0.5
                }}
              >
                Send via Email
              </button>
            </div>
            <button
              onClick={onClose}
              style={{ width: '100%', padding: '10px 0', borderRadius: 12, border: 'none', background: 'transparent', color: T.inkMuted, fontFamily: T.font, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
