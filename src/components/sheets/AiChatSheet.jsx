import { useState, useRef, useEffect } from 'react';
import { useAppTheme } from '../../context/AppThemeContext';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useBackClose } from '../../hooks/useBackClose';
import { getCurrentBusinessId } from '../../data/currentBusiness';
import { authHeaders } from '../../lib/supabase';
import GrabBar from '../ui/GrabBar';

export default function AiChatSheet({ onClose, context = {} }) {
  const { T, mode } = useAppTheme();
  const sheetRef = useRef(null);
  const scrollRef = useRef(null);
  useFocusTrap(sheetRef, true, onClose);
  useBackClose(true, onClose);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [businessId, setBusinessId] = useState(null);

  useEffect(() => {
    getCurrentBusinessId().then(id => setBusinessId(id));
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setError(null);
    const next = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setLoading(true);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          messages: next.slice(-20),
          businessId,
          clientId: context.clientId,
          jobId: context.jobId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get response');
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const assistantBg = mode === 'dark' ? '#2C2C2E' : '#F5F5F7';

  const headerLabel = context.clientId ? 'Client chat' : context.jobId ? 'Job chat' : 'Ask me anything';

  return (
    <div
      ref={sheetRef}
      role="dialog"
      aria-modal="true"
      aria-label="AI assistant"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        background: 'rgba(0,0,0,0.5)',
        animation: 'aichatFade 180ms ease-out',
      }}
      onClick={onClose}
    >
      <style>{`
        @keyframes aichatFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes aichatSlide { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .aichat-input:focus { border-color: var(--pink) !important; outline: none; }
        .aichat-input { field-sizing: content; }
      `}</style>

      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: T.card,
          borderRadius: '24px 24px 0 0',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.38)',
          maxHeight: 'calc(var(--app-height, 100dvh) * 0.85)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'aichatSlide 260ms cubic-bezier(0.2,0.8,0.2,1)',
          overflow: 'hidden',
        }}
      >
        <GrabBar onDismiss={onClose} />

        {/* Header */}
        <div style={{
          background: T.hero,
          padding: '12px 20px 16px',
          flexShrink: 0,
        }}>
          <div style={{
            fontFamily: T.font, fontSize: 10, fontWeight: 700,
            letterSpacing: '1.2px', textTransform: 'uppercase',
            color: '#FF78B0', marginBottom: 4,
          }}>
            ✦ AI assistant
          </div>
          <div style={{
            fontFamily: T.serif, fontSize: 22, fontWeight: 500,
            color: 'white', letterSpacing: '-0.3px',
          }}>
            {headerLabel}
          </div>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="sm-scroll"
          style={{
            flex: 1, overflowY: 'auto',
            padding: '16px 14px 8px',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}
        >
          {messages.length === 0 && !loading && (
            <div style={{
              textAlign: 'center', padding: '32px 20px',
              color: T.inkMuted, fontFamily: T.font, fontSize: 14,
              lineHeight: 1.6,
            }}>
              <div style={{ fontSize: 22, marginBottom: 10, color: '#FF78B0' }}>✦</div>
              Ask about your clients, schedule, invoices, or anything on your mind.
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} style={{
              display: 'flex',
              justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
            }}>
              <div style={{
                maxWidth: '84%',
                padding: '10px 14px',
                borderRadius: m.role === 'user'
                  ? '18px 18px 4px 18px'
                  : '18px 18px 18px 4px',
                background: m.role === 'user' ? 'var(--grad-pink)' : assistantBg,
                color: m.role === 'user' ? '#fff' : T.ink,
                fontFamily: T.font,
                fontSize: 15,
                lineHeight: 1.55,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                border: m.role === 'assistant' ? `1px solid ${T.cardBorder}` : 'none',
              }}>
                {m.content}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{
                padding: '12px 16px',
                borderRadius: '18px 18px 18px 4px',
                background: assistantBg,
                border: `1px solid ${T.cardBorder}`,
                color: '#FF78B0', fontFamily: T.font, fontSize: 18,
              }}>
                <span className="sm-pulse">✦</span>
              </div>
            </div>
          )}

          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 12,
              background: 'rgba(176,21,80,0.06)',
              border: '1px solid rgba(176,21,80,0.15)',
              color: '#B01550', fontFamily: T.font, fontSize: 13,
              lineHeight: 1.4,
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Input bar */}
        <div style={{
          padding: '8px 12px 14px',
          borderTop: `1px solid ${T.cardBorder}`,
          display: 'flex', gap: 8, alignItems: 'flex-end',
          flexShrink: 0,
          background: T.card,
        }}>
          <textarea
            className="aichat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask anything…"
            rows={1}
            style={{
              flex: 1, resize: 'none',
              padding: '10px 14px',
              borderRadius: 14,
              border: `1.5px solid ${T.cardBorder}`,
              background: T.bg, color: T.ink,
              fontFamily: T.font, fontSize: 15, lineHeight: 1.4,
              maxHeight: 100, overflowY: 'auto',
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={send}
            disabled={!input.trim() || loading}
            aria-label="Send message"
            title={!input.trim() && !loading ? 'Type a message first' : 'Send message'}
            style={{
              width: 44, height: 44, borderRadius: 14,
              border: 'none',
              background: input.trim() && !loading ? 'var(--grad-pink)' : T.cardBorder,
              color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
              flexShrink: 0,
              transition: 'background 0.15s',
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
