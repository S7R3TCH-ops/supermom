import { useState, useRef, useEffect } from 'react';
import { useAppTheme } from '../../context/AppThemeContext';
import { listMyRequests } from '../../data/requestsRepo';
import { REQUEST_STATUS_BADGES } from '../../lib/requestFormatting';
import { logClientError } from '../../lib/errorTracking';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useBackClose } from '../../hooks/useBackClose';

const KIND_META = {
  bug:  { icon: '🛠', label: 'Problem' },
  idea: { icon: '💡', label: 'Idea' },
};

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Toronto', month: 'short', day: 'numeric' });
}

// Owner-facing list of what they've sent via "Tell Joel", with status and
// Joel's reply (client_requests.admin_notes). Read-only — replies are written
// from Admin → Super Admin: Requests.
export default function MyRequestsSheet({ isOpen, onClose, onNewRequest, refreshToken }) {
  const { T, mode } = useAppTheme();
  const sheetRef = useRef(null);
  useFocusTrap(sheetRef, isOpen, onClose);
  useBackClose(isOpen, onClose);

  const [requests, setRequests] = useState(null);
  const [loadErr, setLoadErr] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    listMyRequests()
      .then(rows => {
        if (cancelled) return;
        setLoadErr(false);
        setRequests(rows);
      })
      .catch(e => {
        logClientError(e, { type: 'client_requests_list' });
        if (!cancelled) setLoadErr(true);
      });
    return () => { cancelled = true; };
  }, [isOpen, refreshToken]);

  if (!isOpen) return null;

  const muted = { fontFamily: T.font, fontSize: 12.5, color: T.inkMuted, textAlign: 'center', padding: '28px 8px', lineHeight: 1.5 };

  return (
    <div
      ref={sheetRef}
      role="dialog"
      aria-modal="true"
      aria-label="My requests"
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        background: 'rgba(0,0,0,0.5)',
        animation: 'myReqFade 180ms ease-out',
      }}
      onClick={onClose}
    >
      <style>{`
        @keyframes myReqFade  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes myReqSlide { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>

      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: T.bg, color: T.ink,
          borderRadius: '24px 24px 0 0',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.38)',
          maxHeight: 'calc(var(--app-height, 100dvh) * 0.92)', display: 'flex', flexDirection: 'column',
          animation: 'myReqSlide 260ms cubic-bezier(0.2,0.8,0.2,1)',
          border: `1px solid ${T.cardBorder}`, borderBottom: 'none',
        }}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8, paddingBottom: 4 }}>
          <div style={{ width: 40, height: 4, background: '#FFD6E8', borderRadius: 4, opacity: mode === 'dark' ? 0.6 : 1 }} />
        </div>

        {/* Header */}
        <div style={{ padding: '6px 18px 14px' }}>
          <div style={{ fontFamily: T.font, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: T.inkMuted, marginBottom: 3 }}>Tell Joel</div>
          <div style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 500, color: T.ink }}>My requests</div>
        </div>

        {/* Body */}
        <div className="sm-scroll-sheet" style={{ flex: '0 1 auto', minHeight: 0, overflowY: 'auto', padding: '0 18px 6px' }}>
          {loadErr ? (
            <div style={{ padding: '8px 12px', borderRadius: 8, background: T.redBg, border: `1px solid ${T.redBorder}`, fontFamily: T.font, fontSize: 11.5, color: T.errorFg, marginBottom: 12 }}>
              Couldn't load your requests. Try again in a moment.
            </div>
          ) : requests === null ? (
            <div style={muted}>Loading…</div>
          ) : requests.length === 0 ? (
            <div style={muted}>Nothing sent yet. Anything you send Joel shows up here, along with his reply.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 8 }}>
              {requests.map(r => {
                const kind = KIND_META[r.kind] || KIND_META.idea;
                const badge = REQUEST_STATUS_BADGES[r.status] || REQUEST_STATUS_BADGES.new;
                const isOpen = expandedId === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setExpandedId(isOpen ? null : r.id)}
                    style={{
                      textAlign: 'left', width: '100%', cursor: 'pointer',
                      background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 13,
                      padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                      <span style={{ fontSize: 13 }}>{kind.icon}</span>
                      <span style={{ fontFamily: T.font, fontSize: 10.5, fontWeight: 600, color: T.inkMuted }}>{kind.label} · {formatDate(r.created_at)}</span>
                      <span style={{
                        marginLeft: 'auto', fontFamily: T.font, fontSize: 9, fontWeight: 700,
                        padding: '2px 7px', borderRadius: 5, letterSpacing: '0.4px', textTransform: 'uppercase',
                        background: badge.bg, color: badge.fg, whiteSpace: 'nowrap',
                      }}>{badge.label}</span>
                    </div>
                    <div style={{
                      width: '100%', fontFamily: T.font, fontSize: 13, fontWeight: 600, color: T.ink,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isOpen ? 'normal' : 'nowrap',
                    }}>{r.title}</div>
                    {isOpen && r.body.trim() !== r.title && (
                      <div style={{ fontFamily: T.font, fontSize: 12.5, color: T.inkSub, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.45 }}>{r.body}</div>
                    )}
                    {r.admin_notes && (
                      <div style={{ width: '100%', boxSizing: 'border-box', marginTop: 2, padding: '9px 12px', borderRadius: 10, background: mode === 'dark' ? 'rgba(255,112,166,0.12)' : '#FFF0F7', borderLeft: `3px solid ${T.pink}` }}>
                        <div style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase', color: T.pink, marginBottom: 3 }}>Joel's reply</div>
                        <div style={{ fontFamily: T.font, fontSize: 12.5, color: T.ink, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.45 }}>{r.admin_notes}</div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 18px 24px', borderTop: `1px solid ${T.cardBorder}`, display: 'flex', gap: 10, background: T.bg }}>
          <button
            type="button"
            onClick={onClose}
            style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: `1.5px solid ${T.cardBorder}`, background: T.card, color: T.inkSub, fontFamily: T.font, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Close
          </button>
          <button
            type="button"
            onClick={onNewRequest}
            style={{ flex: 2, padding: '12px 0', borderRadius: 12, border: 'none', background: '#FC4693', color: 'white', fontFamily: T.font, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(233,30,106,0.3)' }}
          >
            ✎ Tell Joel something
          </button>
        </div>
      </div>
    </div>
  );
}
