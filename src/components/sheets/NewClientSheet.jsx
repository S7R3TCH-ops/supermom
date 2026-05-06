import { useState, useRef } from 'react';
import { useAppTheme } from '../../context/AppThemeContext';
import { createClient } from '../../data/clientsRepo';
import { RECURRENCE } from '../../data/services';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useKeyboardFocus } from '../../hooks/useKeyboardFocus';
import { useToast } from '../../context/ToastContext';
import GrabBar from '../ui/GrabBar';

export default function NewClientSheet({ onClose, onCreated }) {
  const { T, mode } = useAppTheme();
  const toast = useToast();
  const isKeyboardFocused = useKeyboardFocus();
  const sheetRef = useRef(null);
  useFocusTrap(sheetRef, true, onClose);
  
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('Georgetown');
  const [vip, setVip] = useState(false);
  const [isLead, setIsLead] = useState(false);
  const [recurrence, setRecurrence] = useState(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const inputBg = mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#fff';
  const input = {
    width: '100%', background: inputBg, color: T.ink,
    border: `1.5px solid ${T.cardBorder}`, borderRadius: 12,
    padding: '10px 11px', fontFamily: T.font, fontSize: 13, fontWeight: 500,
    outline: 'none',
  };
  const label = { fontFamily: T.font, fontSize: 9, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: T.inkMuted, marginBottom: 4 };

  async function submit(e) {
    e.preventDefault();
    if (!first.trim()) { setErr('First name required'); return; }
    setBusy(true); setErr('');
    try {
      const created = await createClient({
        first_name: first.trim(),
        last_name: last.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        street: street.trim() || null,
        city: city.trim() || null,
        province: 'ON',
        status: isLead ? 'lead' : 'active',
        notes: notes.trim() || null,
        ai_context: { vip, recurrence },
      });
      toast.success(`${first.trim()} added!`);
      if (onCreated) onCreated(created);
      onClose();
    } catch (e2) {
      const msg = e2.message || String(e2);
      setErr(msg);
      toast.error(msg);
      setBusy(false);
    }
  }

  return (
    <div ref={sheetRef} role="dialog" aria-modal="true" aria-label="Add new client" style={{
      position: 'fixed', inset: 0, zIndex: 60,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      background: 'rgba(4,1,12,0.62)',
    }}>
      <div onClick={onClose} style={{ flex: 1, minHeight: 40 }} />
      <div onClick={e => e.stopPropagation()} style={{
        background: T.bg, color: T.ink,
        borderRadius: '24px 24px 0 0',
        boxShadow: '0 -10px 40px rgba(0,0,0,0.38)',
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        border: `1px solid ${T.cardBorder}`, borderBottom: 'none',
      }}>
        <GrabBar onDismiss={onClose} />
        <div style={{ padding: '10px 18px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: T.font, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: '#FF78B0' }}>✦ New Client</div>
            <div style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 500, letterSpacing: '-0.4px', color: T.ink, marginTop: 2 }}>Add to roster</div>
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

        <form onSubmit={submit} className="sm-scroll" style={{ 
          flex: 1, 
          overflowY: 'auto', 
          padding: '0 18px 14px', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 10,
        }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="nc-first" style={label}>FIRST NAME *</label>
              <input id="nc-first" required style={input} value={first} onChange={e => setFirst(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label htmlFor="nc-last" style={label}>LAST NAME</label>
              <input id="nc-last" style={input} value={last} onChange={e => setLast(e.target.value)} />
            </div>
          </div>
          <div>
            <label htmlFor="nc-phone" style={label}>PHONE</label>
            <input id="nc-phone" style={input} type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="6475550100" />
          </div>
          <div>
            <label htmlFor="nc-email" style={label}>EMAIL</label>
            <input id="nc-email" style={input} type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label htmlFor="nc-street" style={label}>STREET</label>
            <input id="nc-street" style={input} value={street} onChange={e => setStreet(e.target.value)} placeholder="12 Main St" />
          </div>
          <div>
            <label htmlFor="nc-city" style={label}>CITY</label>
            <input id="nc-city" style={input} value={city} onChange={e => setCity(e.target.value)} />
          </div>

          <div>
            <div id="nc-recurrence-label" style={label}>RECURRENCE</div>
            <div role="group" aria-labelledby="nc-recurrence-label" style={{ display: 'flex', background: mode === 'dark' ? 'rgba(255,255,255,0.04)' : T.pinkTint, borderRadius: 10, padding: 3 }}>
              {RECURRENCE.map(r => {
                const on = r.key === recurrence;
                return (
                  <button type="button" key={r.label} role="radio" aria-checked={on} onClick={() => setRecurrence(r.key)} style={{
                    flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
                    background: on ? '#E91E6A' : 'transparent',
                    fontFamily: T.font, fontSize: 11, fontWeight: 600,
                    color: on ? 'white' : T.inkSub, cursor: 'pointer',
                  }}>{r.label}</button>
                );
              })}
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: T.font, fontSize: 12, color: T.ink }}>
            <input type="checkbox" checked={vip} onChange={e => setVip(e.target.checked)} />
            Mark as VIP ★
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: T.font, fontSize: 12, color: T.ink }}>
            <input type="checkbox" checked={isLead} onChange={e => setIsLead(e.target.checked)} />
            Mark as Lead
          </label>

          <div>
            <div style={label}>NOTES</div>
            <textarea style={{ ...input, minHeight: 60, resize: 'vertical' }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Quirks, access info, dog name…" />
          </div>

          {err && (
            <div style={{ padding: 10, borderRadius: 8, background: T.redBg, border: `1px solid ${T.redBorder}`, font: `13px/1.3 ${T.font}`, color: T.ink }}>{err}</div>
          )}

          <button type="submit" disabled={busy} style={{
            marginTop: 4, padding: '14px 16px', borderRadius: 12, border: 'none',
            background: T.pink, color: '#fff', font: `600 14px/1 ${T.font}`,
            opacity: busy ? 0.5 : 1, cursor: busy ? 'not-allowed' : 'pointer',
          }}>{busy ? 'Saving…' : 'Save client'}</button>

          <div style={{ height: isKeyboardFocused ? 260 : 14, transition: 'height 0.2s ease-out' }} />
        </form>
      </div>
    </div>
  );
}
