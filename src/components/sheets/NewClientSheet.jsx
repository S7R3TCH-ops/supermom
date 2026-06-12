import { useState, useRef } from 'react';
import { useAppTheme } from '../../context/AppThemeContext';
import { createClient } from '../../data/clientsRepo';
import { RECURRENCE } from '../../data/services';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useKeyboardFocus } from '../../hooks/useKeyboardFocus';
import { useToast } from '../../context/ToastContext';
import GrabBar from '../ui/GrabBar';

const STATUS_OPTIONS = [
  { value: 'active',   label: 'Active' },
  { value: 'lead',     label: 'Lead' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'archived', label: 'Archived' },
];

const SYSTEM_TAGS = ['Lead', 'VIP ★', '⚠ Overdue'];

export default function NewClientSheet({ onClose, onCreated }) {
  const { T, mode } = useAppTheme();
  const toast = useToast();
  const isKeyboardFocused = useKeyboardFocus();
  const sheetRef = useRef(null);
  const submittingRef = useRef(false);
  useFocusTrap(sheetRef, true, onClose);

  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [status, setStatus] = useState('active');
  const [vip, setVip] = useState(false);
  const [recurrence, setRecurrence] = useState(null);
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [notes, setNotes] = useState('');
  const [prefs, setPrefs] = useState('');
  const [access, setAccess] = useState('');
  const [comms, setComms] = useState('');
  const [personal, setPersonal] = useState('');
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

  function addTag() {
    const t = tagInput.trim();
    if (!t || tags.includes(t) || SYSTEM_TAGS.includes(t)) return;
    setTags(prev => [...prev, t]);
    setTagInput('');
  }

  function removeTag(t) {
    setTags(prev => prev.filter(x => x !== t));
  }

  async function submit(e) {
    e.preventDefault();
    if (submittingRef.current) return;
    if (!first.trim()) { setErr('First name required'); return; }
    submittingRef.current = true;
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
        postal_code: postalCode.trim().toUpperCase() || null,
        status,
        notes: notes.trim() || null,
        tags,
        ai_context: {
          vip,
          recurrence,
          prefs: prefs.trim() || null,
          access: access.trim() || null,
          comms: comms.trim() || null,
          personal: personal.trim() || null,
        },
      });
      toast.success(`${first.trim()} added!`);
      if (onCreated) onCreated(created);
      onClose();
    } catch (e2) {
      const msg = e2.message || String(e2);
      setErr(msg);
      toast.error(msg);
      submittingRef.current = false;
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
            <label htmlFor="nc-postal" style={label}>POSTAL CODE</label>
            <input id="nc-postal" style={input} value={postalCode} onChange={e => setPostalCode(e.target.value)} placeholder="L7G 4S5" />
          </div>

          <div>
            <div style={label}>STATUS</div>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              style={{ ...input, width: '100%' }}
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
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

          <div>
            <div style={label}>TAGS</div>
            {tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {tags.map(t => (
                  <span
                    key={t}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      background: mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(233,30,106,0.08)',
                      border: `1px solid ${T.cardBorder}`,
                      borderRadius: 20, padding: '3px 10px 3px 10px',
                      fontFamily: T.font, fontSize: 11, color: T.ink,
                    }}
                  >
                    {t}
                    <button
                      type="button"
                      onClick={() => removeTag(t)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: T.inkMuted, lineHeight: 1, fontSize: 13 }}
                    >×</button>
                  </span>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                style={{ ...input, flex: 1 }}
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                placeholder="Add tag…"
              />
              <button
                type="button"
                onClick={addTag}
                style={{
                  padding: '0 14px', borderRadius: 12, border: 'none',
                  background: T.pink, color: 'white',
                  fontFamily: T.font, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}
              >Add</button>
            </div>
          </div>

          <div style={{ borderTop: `1px solid ${T.cardBorder}`, paddingTop: 10, marginTop: 4 }}>
            <div style={{ fontFamily: T.font, fontSize: 9.5, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#FF78B0', marginBottom: 10 }}>✦ Intel</div>
            {[
              { label: 'NOTES', value: notes, set: setNotes },
              { label: 'PREFS', value: prefs, set: setPrefs },
              { label: 'ACCESS', value: access, set: setAccess },
              { label: 'COMMS', value: comms, set: setComms },
              { label: 'PERSONAL', value: personal, set: setPersonal },
            ].map(f => (
              <div key={f.label} style={{ marginBottom: 10 }}>
                <div style={label}>{f.label}</div>
                <textarea
                  value={f.value}
                  onChange={e => f.set(e.target.value)}
                  placeholder={`Enter ${f.label.toLowerCase()}…`}
                  rows={2}
                  style={{ ...input, minHeight: 44, resize: 'none' }}
                />
              </div>
            ))}
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
