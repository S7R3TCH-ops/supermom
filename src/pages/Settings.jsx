import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { getCurrentBusinessId } from '../data/currentBusiness';
import { useBusiness } from '../data/useData';
import { useAppTheme } from '../context/AppThemeContext';
import { uploadAsset, getSignedUrl } from '../lib/storage';

const SUPER_ADMIN_EMAIL = 'jlundie@gmail.com';

// FK-safe deletion order: leaf tables first so no constraint violations
const RESET_TABLES = [
  'audit_log',
  'communication_log',
  'notification_log',
  'payments',
  'invoice_jobs',
  'invoices',
  'template_schedule',
  'jobs',
  'job_templates',
  'expense_log',
  'clients',
  'services',
];

const FIELDS = [
  { key: 'name',        label: 'Business name',  type: 'text' },
  { key: 'owner_name',  label: 'Your name',       type: 'text' },
  { key: 'phone',       label: 'Phone',           type: 'tel'  },
  { key: 'email',       label: 'Email',           type: 'email'},
  { key: 'address',     label: 'Street address',  type: 'text' },
  { key: 'city',        label: 'City',            type: 'text' },
  { key: 'postal_code', label: 'Postal code',     type: 'text' },
];

export default function Settings() {
  const { T } = useAppTheme();
  const { user, signOut } = useAuth();
  const { business, update } = useBusiness();
  const [searchParams] = useSearchParams();
  const [integration, setIntegration] = useState(null);

  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [resetPhase, setResetPhase] = useState(null); // null | 'confirm' | 'deleting' | 'done' | 'error'
  const [resetError, setResetError] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (business && !form) {
      setForm({
        name:        business.name        ?? '',
        owner_name:  business.owner_name  ?? '',
        phone:       business.phone       ?? '',
        email:       business.email       ?? '',
        address:     business.address     ?? '',
        city:        business.city        ?? '',
        postal_code: business.postal_code ?? '',
        hourly_rate: business.hourly_rate != null ? String(business.hourly_rate) : '',
        tax_enabled: business.tax_enabled ?? false,
        signature:   business.ai_profile?.signature ?? '',
      });
      
      if (business.logo_url) {
        getSignedUrl(business.logo_url).then(setAvatarUrl);
      }
    }
  }, [business, form]);

  useEffect(() => {
    async function checkIntegration() {
      if (!user) return;
      const { data } = await supabase
        .from('integrations')
        .select('*')
        .eq('service_name', 'google_calendar')
        .maybeSingle();
      setIntegration(data);
    }
    checkIntegration();
  }, [user]);

  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSaving(true);
    try {
      const businessId = await getCurrentBusinessId();
      const path = await uploadAsset(businessId, file, 'avatars');
      await update({ logo_url: path });
      const url = await getSignedUrl(path);
      setAvatarUrl(url);
    } catch (err) {
      console.error('Avatar upload failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const connectGoogle = async () => {
    const businessId = await getCurrentBusinessId();
    window.location.href = `/api/auth/google/login?business_id=${businessId}`;
  };

  const handleSave = async () => {
    if (!form.name?.trim() || !form.owner_name?.trim()) {
      setError('Business Name and Owner Name are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const ai_profile = { ...(business.ai_profile || {}), signature: form.signature };
      await update({
        name:        form.name.trim(),
        owner_name:  form.owner_name.trim(),
        phone:       form.phone,
        email:       form.email,
        address:     form.address,
        city:        form.city,
        postal_code: form.postal_code,
        hourly_rate: form.hourly_rate !== '' ? Number(form.hourly_rate) : null,
        tax_enabled: form.tax_enabled,
        ai_profile,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.message || 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAllData = async () => {
    setResetPhase('deleting');
    setResetError(null);
    try {
      const businessId = await getCurrentBusinessId();
      for (const table of RESET_TABLES) {
        const { error } = await supabase.from(table).delete().eq('business_id', businessId);
        if (error) throw new Error(`Failed on ${table}: ${error.message}`);
      }
      setResetPhase('done');
    } catch (err) {
      setResetError(err.message);
      setResetPhase('error');
    }
  };

  const syncSuccess = searchParams.get('sync') === 'success';
  const error = searchParams.get('error');

  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    padding: '9px 11px', borderRadius: 'var(--r-input)',
    border: '1.5px solid var(--pink-border)',
    fontSize: 13, color: 'var(--ink)',
    background: 'var(--pink-pale)', outline: 'none',
    fontFamily: 'var(--font-ui)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg ?? 'var(--pink-pale)', color: T.ink ?? 'var(--ink)' }}>
      {/* Hero */}
      <div style={{ background: T.hero ?? 'var(--grad-hero)', borderBottom: '3px solid #E91E6A', padding: '13px 15px 15px' }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: 'var(--pink-label)', marginBottom: 4 }}>
          ✦ Preferences
        </div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, margin: 0, color: 'white', fontWeight: 500 }}>Settings</h2>
      </div>

      <div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Sandra's Profile */}
        <div style={{ background: 'white', borderRadius: 'var(--r-card)', border: '1.5px solid var(--pink-border)', padding: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: 14 }}>Personal Profile</span>
          
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
            <div 
              onClick={handleAvatarClick}
              style={{ 
                width: 72, height: 72, borderRadius: 20, 
                background: 'var(--grad-action)', 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', overflow: 'hidden', position: 'relative',
                border: '2px solid white', boxShadow: '0 4px 12px rgba(233,30,106,0.2)'
              }}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ color: 'white', fontSize: 28, fontWeight: 600, fontFamily: 'var(--font-display)' }}>
                  {form?.owner_name?.charAt(0) || 'S'}
                </span>
              )}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.4)', color: 'white', fontSize: 8, textAlign: 'center', padding: '2px 0' }}>
                EDIT
              </div>
            </div>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" style={{ display: 'none' }} />
            
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{form?.owner_name || 'Sandra'}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-muted)' }}>{form?.email}</div>
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <label htmlFor="settings-signature" style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-muted)', display: 'block', marginBottom: 4 }}>
              Digital Signature (for receipts)
            </label>
            <input
              id="settings-signature"
              type="text"
              placeholder="e.g. Sandra S."
              value={form?.signature}
              onChange={e => setForm(f => ({ ...f, signature: e.target.value }))}
              style={{ ...inputStyle, fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 16 }}
            />
          </div>
        </div>

        {/* Business Profile */}
        {form && (
          <div style={{ background: 'white', borderRadius: 'var(--r-card)', border: '1.5px solid var(--pink-border)', padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Business Details</span>
              {saved && (
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', color: 'var(--green)', background: 'var(--green-light)', padding: '3px 8px', borderRadius: 'var(--r-badge)' }}>
                  SAVED ✓
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {FIELDS.map(({ key, label, type }) => (
                <div key={key}>
                  <label htmlFor={`settings-${key}`} style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-muted)', display: 'block', marginBottom: 4 }}>
                    {label}
                  </label>
                  <input
                    id={`settings-${key}`}
                    type={type}
                    required={key === 'name' || key === 'owner_name'}
                    value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
              ))}

              {/* Hourly rate */}
              <div>
                <label htmlFor="settings-hourly_rate" style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-muted)', display: 'block', marginBottom: 4 }}>
                  Default hourly rate
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--ink-muted)' }}>$</span>
                  <input
                    id="settings-hourly_rate"
                    type="number"
                    min="0"
                    step="5"
                    value={form.hourly_rate}
                    onChange={e => setForm(f => ({ ...f, hourly_rate: e.target.value }))}
                    style={{ ...inputStyle, paddingLeft: 22 }}
                  />
                </div>
              </div>

              {/* HST toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid var(--pink-border)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>HST (13%)</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-muted)' }}>Add tax to invoices</div>
                </div>
                <button
                  role="switch"
                  aria-checked={form.tax_enabled}
                  aria-label="Toggle HST"
                  onClick={() => setForm(f => ({ ...f, tax_enabled: !f.tax_enabled }))}
                  style={{
                    width: 44, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                    background: form.tax_enabled ? 'var(--pink)' : 'var(--pink-border)',
                    position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 3, left: form.tax_enabled ? 21 : 3,
                    width: 20, height: 20, borderRadius: '50%', background: 'white',
                    transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                </button>
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  marginTop: 4, width: '100%', padding: '12px',
                  background: saving ? 'var(--pink-tint)' : 'var(--pink)',
                  color: saving ? 'var(--pink-mid)' : 'white',
                  border: 'none', borderRadius: 'var(--r-input)',
                  fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer',
                }}
              >
                {saving ? 'Saving…' : 'Save All Changes'}
              </button>
            </div>
          </div>
        )}

        {/* Google Calendar Sync */}
        <div style={{ background: 'white', borderRadius: 'var(--r-card)', border: '1.5px solid var(--pink-border)', padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Google Calendar Sync</span>
            {integration ? (
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.5px', color: 'var(--green-text)', background: 'var(--green-light)', padding: '3px 8px', borderRadius: 'var(--r-badge)' }}>CONNECTED ✓</span>
            ) : (
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.5px', color: 'var(--pink-mid)', background: 'var(--pink-tint)', padding: '3px 8px', borderRadius: 'var(--r-badge)' }}>NOT CONNECTED</span>
            )}
          </div>

          <p style={{ fontSize: 12, color: 'var(--ink-mid)', marginBottom: 16, margin: '0 0 16px' }}>
            {integration
              ? 'Your jobs are automatically synced to your Google Calendar.'
              : 'Connect your Google account to sync your schedule to your personal calendar.'}
          </p>

          <button
            onClick={connectGoogle}
            style={{
              background: integration ? 'var(--pink-tint)' : 'var(--pink)',
              color: integration ? 'var(--pink-mid)' : 'white',
              border: 'none', padding: '12px', borderRadius: 'var(--r-input)',
              fontSize: 13, fontWeight: 700, width: '100%', cursor: 'pointer',
            }}
          >
            {integration ? 'Reconnect Google Calendar' : 'Connect Google Calendar'}
          </button>
        </div>

        {syncSuccess && (
          <div aria-live="polite" style={{ padding: 10, background: 'var(--green-light)', borderRadius: 8, fontSize: 12, color: 'var(--green-text)', textAlign: 'center' }}>
            Successfully connected to Google Calendar!
          </div>
        )}

        {error && (
          <div aria-live="polite" style={{ padding: 10, background: '#FEE2E2', borderRadius: 8, fontSize: 12, color: '#991B1B', textAlign: 'center' }}>
            Error: {error}
          </div>
        )}

        {/* Danger Zone — super admin only */}
        {user?.email === SUPER_ADMIN_EMAIL && (
          <div style={{ background: '#1a0a0a', borderRadius: 'var(--r-card)', border: '1.5px solid #7f1d1d', padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#fca5a5' }}>Danger Zone</span>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.8px', color: '#ef4444', background: 'rgba(239,68,68,0.15)', padding: '2px 7px', borderRadius: 'var(--r-badge)', border: '1px solid #7f1d1d' }}>SUPER ADMIN</span>
            </div>
            <p style={{ fontSize: 12, color: '#f87171', margin: '0 0 14px', lineHeight: 1.5 }}>
              Permanently deletes all jobs, clients, expenses, invoices, payments, and logs for this business. The business account and service catalog are wiped too. This cannot be undone.
            </p>

            {resetPhase === null && (
              <button
                onClick={() => setResetPhase('confirm')}
                style={{ width: '100%', padding: '11px', background: 'transparent', border: '1.5px solid #7f1d1d', borderRadius: 'var(--r-input)', color: '#f87171', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                Delete All Data…
              </button>
            )}

            {resetPhase === 'confirm' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#fca5a5', margin: 0, textAlign: 'center' }}>
                  Are you absolutely sure? There is no undo.
                </p>
                <button
                  onClick={handleDeleteAllData}
                  style={{ width: '100%', padding: '11px', background: '#991b1b', border: 'none', borderRadius: 'var(--r-input)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  Yes, delete everything
                </button>
                <button
                  onClick={() => setResetPhase(null)}
                  style={{ width: '100%', padding: '11px', background: 'transparent', border: '1px solid #7f1d1d', borderRadius: 'var(--r-input)', color: '#f87171', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            )}

            {resetPhase === 'deleting' && (
              <div style={{ textAlign: 'center', color: '#f87171', fontSize: 12, padding: '8px 0' }}>
                Deleting…
              </div>
            )}

            {resetPhase === 'done' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ textAlign: 'center', color: '#86efac', fontSize: 12, padding: '4px 0' }}>
                  All data deleted.
                </div>
                <button
                  onClick={() => setResetPhase(null)}
                  style={{ width: '100%', padding: '11px', background: 'transparent', border: '1px solid #7f1d1d', borderRadius: 'var(--r-input)', color: '#f87171', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  Dismiss
                </button>
              </div>
            )}

            {resetPhase === 'error' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ color: '#fca5a5', fontSize: 12, wordBreak: 'break-word' }}>
                  Error: {resetError}
                </div>
                <button
                  onClick={() => setResetPhase(null)}
                  style={{ width: '100%', padding: '11px', background: 'transparent', border: '1px solid #7f1d1d', borderRadius: 'var(--r-input)', color: '#f87171', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>
        )}

        <div style={{ paddingTop: 8, paddingBottom: 16 }}>
          <button
            onClick={signOut}
            style={{ width: '100%', padding: '12px', background: 'transparent', border: '1px solid var(--pink-border)', borderRadius: 'var(--r-input)', color: 'var(--ink-muted)', fontSize: 12, fontWeight: 600 }}
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
