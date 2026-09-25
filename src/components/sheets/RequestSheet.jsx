import { useState, useRef, useEffect } from 'react';
import GrabBar from '../ui/GrabBar';
import { useAppTheme } from '../../context/AppThemeContext';
import { submitRequest } from '../../data/requestsRepo';
import { logClientError } from '../../lib/errorTracking';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useKeyboardFocus } from '../../hooks/useKeyboardFocus';
import { useBackClose } from '../../hooks/useBackClose';
import { triggerHaptic } from '../../lib/haptics';

const KINDS = [
  { key: 'bug',  icon: '🛠', label: "Something's broken" },
  { key: 'idea', icon: '💡', label: 'An idea' },
];

const PLACEHOLDERS = {
  bug: 'What happened, and what did you expect? Which screen were you on?',
  idea: 'What would make your day easier?',
};

export default function RequestSheet({ isOpen, onClose }) {
  const { T, mode } = useAppTheme();
  const isKeyboardFocused = useKeyboardFocus();
  const sheetRef = useRef(null);
  useFocusTrap(sheetRef, isOpen, onClose);
  useBackClose(isOpen, onClose);

  const [kind, setKind] = useState(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [saveErr, setSaveErr] = useState(null);
  const [sent, setSent] = useState(false);

  function reset() {
    setKind(null);
    setBody('');
    setSaveErr(null);
    setSent(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSend() {
    if (!kind || !body.trim()) return;
    setSending(true);
    setSaveErr(null);
    triggerHaptic('medium');
    try {
      await submitRequest({ kind, body });
      setSent(true);
    } catch (e) {
      logClientError(e, { type: 'client_request_insert' });
      setSaveErr("That didn't send. Try again in a moment — or text Joel like usual.");
    } finally {
      setSending(false);
    }
  }

  // Auto-close a few seconds after the confirmation state shows.
  useEffect(() => {
    if (!sent) return;
    const t = setTimeout(handleClose, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sent]);

  if (!isOpen) return null;

  return (
    <div
      ref={sheetRef}
      role="dialog"
      aria-modal="true"
      aria-label="Tell Joel"
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        background: 'rgba(0,0,0,0.5)',
        animation: 'reqFade 180ms ease-out',
      }}
      onClick={handleClose}
    >
      <style>{`
        @keyframes reqFade  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes reqSlide { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>

      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: T.bg, color: T.ink,
          borderRadius: '24px 24px 0 0',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.38)',
          maxHeight: 'calc(var(--app-height, 100dvh) * 0.92)', display: 'flex', flexDirection: 'column',
          animation: 'reqSlide 260ms cubic-bezier(0.2,0.8,0.2,1)',
          border: `1px solid ${T.cardBorder}`, borderBottom: 'none',
        }}
      >
        <GrabBar onDismiss={handleClose} />

        {/* Header */}
        <div style={{ padding: '6px 18px 14px' }}>
          <div style={{ fontFamily: T.font, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: T.inkMuted, marginBottom: 3 }}>Tell Joel</div>
          <div style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 500, color: T.ink }}>
            {sent ? 'Got it.' : "What's going on?"}
          </div>
        </div>

        {sent ? (
          <div style={{ padding: '10px 18px 40px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>✓</div>
            <div style={{ fontFamily: T.font, fontSize: 13, color: T.inkSub, lineHeight: 1.5 }}>
              Joel will see this today. His reply shows up under My requests.
            </div>
          </div>
        ) : (
          <>
            {/* Body */}
            <div className="sm-scroll-sheet" style={{
              flex: '0 1 auto',
              minHeight: 0,
              overflowY: 'auto',
              padding: `0 18px ${isKeyboardFocused ? `${isKeyboardFocused}px` : '6px'}`,
              transition: 'padding-bottom 0.2s ease-out',
            }}>
              <div id="req-kind-label" style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, letterSpacing: '0.7px', textTransform: 'uppercase', color: T.inkMuted, marginBottom: 8 }}>Kind</div>
              <div role="radiogroup" aria-labelledby="req-kind-label" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                {KINDS.map(k => {
                  const on = kind === k.key;
                  return (
                    <button key={k.key} role="radio" aria-checked={on} onClick={() => setKind(k.key)} style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                      padding: '14px 8px', borderRadius: 14,
                      border: `1.5px solid ${on ? '#FC4693' : T.cardBorder}`,
                      background: on ? '#FC4693' : T.card,
                      cursor: 'pointer',
                    }}>
                      <span style={{ fontSize: 20 }}>{k.icon}</span>
                      <span style={{ fontFamily: T.font, fontSize: 12, fontWeight: 700, color: on ? 'white' : T.ink }}>{k.label}</span>
                    </button>
                  );
                })}
              </div>

              <label htmlFor="req-body" style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, letterSpacing: '0.7px', textTransform: 'uppercase', color: T.inkMuted, marginBottom: 8, display: 'block' }}>
                {kind === 'idea' ? 'Your idea' : 'What happened'}
              </label>
              <div style={{ background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 12, padding: '10px 14px', marginBottom: 10 }}>
                <textarea
                  id="req-body"
                  className="sm-input"
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder={PLACEHOLDERS[kind] || 'Tell Joel what\'s going on…'}
                  style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontFamily: T.font, fontSize: 16, color: T.ink, resize: 'none', minHeight: 120, lineHeight: 1.45 }}
                />
              </div>

              <div style={{ fontFamily: T.font, fontSize: 11, color: T.inkMuted, marginBottom: 12, lineHeight: 1.4 }}>
                We'll include the screen you're on and the app version — nothing else.
              </div>

              {saveErr && (
                <div style={{ padding: '8px 12px', borderRadius: 8, background: T.redBg, border: `1px solid ${T.redBorder}`, fontFamily: T.font, fontSize: 11.5, color: T.errorFg, marginBottom: 12 }}>
                  {saveErr}
                </div>
              )}
            </div>

            {/* Footer */}
            {!isKeyboardFocused && (
              <div style={{ padding: '10px 18px 24px', borderTop: `1px solid ${T.cardBorder}`, display: 'flex', gap: 10, background: T.bg }}>
                <button
                  onClick={handleClose}
                  style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: `1.5px solid ${T.cardBorder}`, background: T.card, color: T.inkSub, fontFamily: T.font, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSend}
                  disabled={sending || !kind || !body.trim()}
                  style={{
                    flex: 2, padding: '12px 0', borderRadius: 12, border: 'none',
                    background: (sending || !kind || !body.trim()) ? '#F9C5DB' : '#FC4693',
                    color: 'white', fontFamily: T.font, fontSize: 13, fontWeight: 700,
                    cursor: (sending || !kind || !body.trim()) ? 'default' : 'pointer',
                    boxShadow: (sending || !kind || !body.trim()) ? 'none' : '0 4px 12px rgba(233,30,106,0.3)',
                  }}
                >
                  {sending ? 'Sending…' : 'Send to Joel'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
