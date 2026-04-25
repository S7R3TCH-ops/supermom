import { useState, useEffect } from 'react';
import { useAppTheme } from '../../context/AppThemeContext';

export default function ThankYouDraftSheet({ isOpen, onClose, jobId }) {
  const { T, mode } = useAppTheme();
  const [draft, setDraft] = useState('');
  const [phone, setPhone] = useState('');
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
      body: JSON.stringify({ jobId }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setDraft(data.draft);
        setPhone(data.phone || '');
        setClientFirstName(data.clientFirstName || '');
      })
      .catch(e => {
        setError(e.message);
        setDraft(`Hi, just wanted to say thank you so much for today — it was a pleasure working for you! Looking forward to seeing you again soon.\n\n- Sandra`);
      })
      .finally(() => setLoading(false));
  }, [isOpen, jobId]);

  if (!isOpen) return null;

  const canSend = phone && draft;

  return (
    <div
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
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8, paddingBottom: 4 }}>
          <div style={{ width: 40, height: 4, background: '#FFD6E8', borderRadius: 4, opacity: mode === 'dark' ? 0.35 : 1 }} />
        </div>

        {/* Header */}
        <div style={{ padding: '6px 18px 14px' }}>
          <div style={{ fontFamily: T.font, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: '#FF78B0', marginBottom: 3 }}>✦ AI Draft</div>
          <div style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 500, color: T.ink }}>
            Thank {clientFirstName || 'your client'}
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
              {!phone && (
                <div style={{ fontFamily: T.font, fontSize: 10.5, color: T.inkMuted, marginBottom: 12 }}>
                  No phone number on file — copy the text to send manually.
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && (
          <div style={{ padding: '10px 18px 24px', borderTop: `1px solid ${T.cardBorder}`, display: 'flex', gap: 10, background: T.bg }}>
            <button
              onClick={onClose}
              style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: `1.5px solid ${T.cardBorder}`, background: T.card, color: T.inkSub, fontFamily: T.font, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (canSend) {
                  window.location.href = `sms:${phone}?body=${encodeURIComponent(draft)}`;
                } else {
                  navigator.clipboard?.writeText(draft);
                }
                onClose();
              }}
              style={{ flex: 2, padding: '12px 0', borderRadius: 12, border: 'none', background: '#E91E6A', color: 'white', fontFamily: T.font, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(233,30,106,0.3)' }}
            >
              {canSend ? 'Send via SMS' : 'Copy Text'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
