import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppTheme } from '../../context/AppThemeContext';
import { fetchClientById, updateClient, softDeleteClient } from '../../data/clientsRepo';
import { notifyDataChanged } from '../../data/useData';
import { useToast } from '../../context/ToastContext';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useKeyboardFocus } from '../../hooks/useKeyboardFocus';
import { RECURRENCE } from '../../data/services';
import GrabBar from '../ui/GrabBar';

const STATUS_OPTIONS = [
  { value: 'active',   label: 'Active' },
  { value: 'lead',     label: 'Lead' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'archived', label: 'Archived' },
];

// Tags managed by other fields — keep out of the free-text editor
const SYSTEM_TAGS = ['Lead', 'VIP ★', '⚠ Overdue'];

export default function EditClientSheet({ clientId, onClose }) {
  const { T, mode } = useAppTheme();
  const toast = useToast();
  const navigate = useNavigate();
  const isKeyboardFocused = useKeyboardFocus();
  const sheetRef = useRef(null);
  useFocusTrap(sheetRef, true, onClose);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [err, setErr] = useState('');

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
  const [rawAiContext, setRawAiContext] = useState({});

  useEffect(() => {
    fetchClientById(clientId)
      .then(raw => {
        if (!raw) return;
        setFirst(raw.first_name || '');
        setLast(raw.last_name || '');
        setPhone(raw.phone || '');
        setEmail(raw.email || '');
        setStreet(raw.street || '');
        setCity(raw.city || '');
        setPostalCode(raw.postal_code || '');
        setStatus(raw.status || 'active');
        setVip(!!raw.ai_context?.vip);
        setRecurrence(raw.ai_context?.recurrence || null);
        setTags(Array.isArray(raw.tags) ? raw.tags.filter(t => !SYSTEM_TAGS.includes(t)) : []);
        setNotes(raw.notes || '');
        setPrefs(raw.ai_context?.prefs || '');
        setAccess(raw.ai_context?.access || '');
        setComms(raw.ai_context?.comms || '');
        setPersonal(raw.ai_context?.personal || '');
        setRawAiContext(raw.ai_context || {});
      })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [clientId]);

  function addTag() {
    const t = tagInput.trim();
    if (!t || tags.includes(t) || SYSTEM_TAGS.includes(t)) return;
    setTags(prev => [...prev, t]);
    setTagInput('');
  }

  function removeTag(t) {
    setTags(prev => prev.filter(x => x !== t));
  }

  async function handleSave() {
    if (!first.trim()) { setErr('First name is required'); return; }
    setBusy(true); setErr('');
    try {
      await updateClient(clientId, {
        first_name: first.trim(),
        last_name: last.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        street: street.trim() || null,
        city: city.trim() || null,
        postal_code: postalCode.trim().toUpperCase() || null,
        status,
        notes: notes.trim() || null,
        tags,
        ai_context: {
          ...rawAiContext,
          vip,
          recurrence,
          prefs: prefs.trim() || null,
          access: access.trim() || null,
          comms: comms.trim() || null,
          personal: personal.trim() || null,
        },
      });
      notifyDataChanged();
      toast.success('Client updated!');
      onClose();
    } catch (e) {
      const msg = e.message || String(e);
      setErr(msg);
      toast.error(msg);
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await softDeleteClient(clientId);
      notifyDataChanged();
      toast.success('Client deleted');
      onClose();
      navigate('/clients');
    } catch (e) {
      const msg = e.message || String(e);
      toast.error(msg);
      setBusy(false);
    }
  }

  const inputBg = mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#fff';
  const inputStyle = {
    width: '100%', background: inputBg, color: T.ink,
    border: `1.5px solid ${T.cardBorder}`, borderRadius: 12,
    padding: '10px 11px', fontFamily: T.font, fontSize: 13, fontWeight: 500,
    outline: 'none',
  };
  const labelStyle = {
    fontFamily: T.font, fontSize: 9, fontWeight: 700, letterSpacing: '0.5px',
    textTransform: 'uppercase', color: T.inkMuted, marginBottom: 4, display: 'block',
  };

  return (
    <div
      ref={sheetRef}
      role="dialog"
      aria-modal="true"
      aria-label="Edit client"
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        background: 'rgba(4,1,12,0.62)',
      }}
    >
      <div onClick={onClose} style={{ flex: 1, minHeight: 40 }} />
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: T.bg, color: T.ink,
          borderRadius: '24px 24px 0 0',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.38)',
          maxHeight: '92vh', display: 'flex', flexDirection: 'column',
          border: `1px solid ${T.cardBorder}`, borderBottom: 'none',
          }}
          >
          <GrabBar onDismiss={onClose} />

          {/* Header */}
          <div style={{ padding: '10px 18px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: T.font, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: '#FF78B0' }}>✦ Edit Client</div>
            <div style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 500, letterSpacing: '-0.4px', color: T.ink, marginTop: 2 }}>
              {first || '…'}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 30, height: 30, borderRadius: 9,
              background: mode === 'dark' ? 'rgba(255,255,255,0.07)' : T.pinkTint,
              border: `1px solid ${T.cardBorder}`, color: T.inkSub, cursor: 'pointer', padding: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: T.inkMuted, fontFamily: T.font, fontSize: 13 }}>Loading…</div>
        ) : (
          <div
            className="sm-scroll"
            style={{
              flex: 1, overflowY: 'auto',
              padding: '0 18px 14px',
              display: 'flex', flexDirection: 'column', gap: 10,
            }}
          >
            {/* Name */}
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>FIRST NAME *</label>
                <input style={inputStyle} value={first} onChange={e => setFirst(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>LAST NAME</label>
                <input style={inputStyle} value={last} onChange={e => setLast(e.target.value)} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>PHONE</label>
              <input style={inputStyle} type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="6475550100" />
            </div>
            <div>
              <label style={labelStyle}>EMAIL</label>
              <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>STREET</label>
              <input style={inputStyle} value={street} onChange={e => setStreet(e.target.value)} placeholder="12 Main St" />
            </div>
            <div>
              <label style={labelStyle}>CITY</label>
              <input style={inputStyle} value={city} onChange={e => setCity(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>POSTAL CODE</label>
              <input style={inputStyle} value={postalCode} onChange={e => setPostalCode(e.target.value)} placeholder="L7G 4S5" />
            </div>

            {/* Status */}
            <div>
              <label style={labelStyle}>STATUS</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                style={{ ...inputStyle, width: '100%' }}
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* Recurrence */}
            <div>
              <div style={labelStyle}>RECURRENCE</div>
              <div style={{ display: 'flex', background: mode === 'dark' ? 'rgba(255,255,255,0.04)' : T.pinkTint, borderRadius: 10, padding: 3 }}>
                {RECURRENCE.map(r => {
                  const on = r.key === recurrence;
                  return (
                    <button
                      key={r.label}
                      type="button"
                      onClick={() => setRecurrence(r.key)}
                      style={{
                        flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
                        background: on ? '#E91E6A' : 'transparent',
                        fontFamily: T.font, fontSize: 11, fontWeight: 600,
                        color: on ? 'white' : T.inkSub, cursor: 'pointer',
                      }}
                    >{r.label}</button>
                  );
                })}
              </div>
            </div>

            {/* VIP */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: T.font, fontSize: 12, color: T.ink }}>
              <input type="checkbox" checked={vip} onChange={e => setVip(e.target.checked)} />
              Mark as VIP ★
            </label>

            {/* Tags */}
            <div>
              <div style={labelStyle}>TAGS</div>
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
                  style={{ ...inputStyle, flex: 1 }}
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

            {/* Intel section */}
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
                  <label style={labelStyle}>{f.label}</label>
                  <textarea
                    value={f.value}
                    onChange={e => f.set(e.target.value)}
                    placeholder={`Enter ${f.label.toLowerCase()}…`}
                    rows={2}
                    style={{ ...inputStyle, minHeight: 44, resize: 'none' }}
                  />
                </div>
              ))}
            </div>

            {err && (
              <div style={{ padding: 10, borderRadius: 8, background: T.redBg, border: `1px solid ${T.redBorder}`, fontFamily: T.font, fontSize: 13, color: T.ink }}>{err}</div>
            )}

            <button
              onClick={handleSave}
              disabled={busy}
              style={{
                marginTop: 4, padding: '14px 16px', borderRadius: 12, border: 'none',
                background: T.pink, color: '#fff', fontFamily: T.font, fontSize: 14, fontWeight: 600,
                opacity: busy ? 0.5 : 1, cursor: busy ? 'not-allowed' : 'pointer',
              }}
            >{busy ? 'Saving…' : 'Save changes'}</button>

            {/* Delete zone */}
            <div style={{ borderTop: `1px solid ${T.cardBorder}`, paddingTop: 16, marginTop: 6 }}>
              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  style={{
                    width: '100%', padding: '11px 0', borderRadius: 12,
                    background: 'transparent', border: `1.5px solid rgba(233,30,106,0.3)`,
                    color: '#E91E6A', fontFamily: T.font, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >Delete Client</button>
              ) : (
                <div style={{ background: 'rgba(233,30,106,0.07)', borderRadius: 12, padding: '12px 14px', border: '1px solid rgba(233,30,106,0.25)' }}>
                  <div style={{ fontFamily: T.font, fontSize: 13, fontWeight: 600, color: T.ink, marginBottom: 10 }}>
                    Delete {first}? This can't be undone. Jobs will be preserved.
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: T.card, border: `1px solid ${T.cardBorder}`, color: T.inkSub, fontFamily: T.font, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                    >Keep</button>
                    <button
                      onClick={handleDelete}
                      disabled={busy}
                      style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: '#E91E6A', border: 'none', color: 'white', fontFamily: T.font, fontSize: 13, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
                    >{busy ? 'Deleting…' : 'Yes, delete'}</button>
                  </div>
                </div>
              )}
            </div>

            <div style={{ height: isKeyboardFocused ? 260 : 14, transition: 'height 0.2s ease-out' }} />
          </div>
        )}
      </div>
    </div>
  );
}
