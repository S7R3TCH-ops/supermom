import { useRef } from 'react';
import { useAppTheme } from '../../context/AppThemeContext';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useJobDetailSheet } from '../../context/JobDetailSheetContext';
import AmtCell from '../ui/AmtCell';
import GrabBar from '../ui/GrabBar';

function fmtShortDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Toronto' });
}

export default function FinanceDetailSheet({ title, items, type, onClose }) {
  const { T, mode, privacyOn } = useAppTheme();
  const sheetRef = useRef(null);
  useFocusTrap(sheetRef, true, onClose);
  const { openJob } = useJobDetailSheet();

  const total = items.reduce((s, i) => s + Number(i.total || i.amount || 0), 0);

  return (
    <div ref={sheetRef} role="dialog" aria-modal="true" aria-label={title} style={{
      position: 'fixed', inset: 0, zIndex: 70,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      background: 'rgba(4,1,12,0.62)', animation: 'njFade 180ms ease-out',
    }}>
      <style>{`
        @keyframes njFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes njSlide { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
      <div onClick={onClose} style={{ flex: 1, minHeight: 40 }} />
      
      <div onClick={e => e.stopPropagation()} style={{
        background: T.bg, color: T.ink,
        borderRadius: '24px 24px 0 0',
        boxShadow: '0 -10px 40px rgba(0,0,0,0.38)',
        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        animation: 'njSlide 260ms cubic-bezier(0.2,0.8,0.2,1)',
        border: `1px solid ${T.cardBorder}`, borderBottom: 'none',
      }}>
        <GrabBar onDismiss={onClose} />

        <div style={{ padding: '14px 18px 14px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: `1px solid ${T.cardBorder}` }}>
          <div>
            <div style={{ fontFamily: T.font, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: '#FF78B0', marginBottom: 2 }}>✦ Details</div>
            <div style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 500, letterSpacing: '-0.4px', color: T.ink }}>{title}</div>
            <div style={{ fontFamily: T.font, fontSize: 11.5, color: T.inkMuted, marginTop: 4 }}>
              {items.length} item{items.length !== 1 && 's'} · Total: {privacyOn ? '•••' : `$${total.toFixed(0)}`}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{
            width: 30, height: 30, borderRadius: 9,
            background: mode === 'dark' ? 'rgba(255,255,255,0.07)' : T.pinkTint,
            border: `1px solid ${T.cardBorder}`, color: T.inkSub, cursor: 'pointer', padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 18px 24px' }}>
          {items.length === 0 ? (
             <div style={{ padding: '24px 0', textAlign: 'center', color: T.inkMuted, fontFamily: T.font, fontSize: 13 }}>
               No items found.
             </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map(item => {
                if (type === 'jobs') {
                  const amt = `$${Number(item.total || 0).toFixed(0)}`;
                  return (
                    <div key={item.id} onClick={() => { onClose(); openJob(item.id); }} style={{
                      background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 12,
                      padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10,
                      cursor: 'pointer'
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: T.serif, fontSize: 14, fontWeight: 500, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.client_name}
                        </div>
                        <div style={{ fontFamily: T.font, fontSize: 10, color: T.inkMuted, marginTop: 2 }}>
                          {fmtShortDate(item.scheduled_at)} · {item.service_name}
                        </div>
                      </div>
                      <AmtCell amount={privacyOn ? '•••' : amt} size={14} />
                    </div>
                  );
                } else if (type === 'expenses') {
                  const amt = `$${Number(item.amount || 0).toFixed(0)}`;
                  return (
                    <div key={item.id} style={{
                      background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 12,
                      padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: T.serif, fontSize: 14, fontWeight: 500, color: T.ink }}>
                          {item.category}
                        </div>
                        <div style={{ fontFamily: T.font, fontSize: 10, color: T.inkMuted, marginTop: 2 }}>
                          {fmtShortDate(item.expense_date)} {item.notes && `· ${item.notes}`}
                        </div>
                      </div>
                      <AmtCell amount={privacyOn ? '•••' : amt} size={14} />
                    </div>
                  );
                }
                return null;
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
