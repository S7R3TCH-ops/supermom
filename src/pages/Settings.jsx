import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAppTheme } from '../context/AppThemeContext';
import { useAuth } from '../context/AuthContext';
import { notifyDataChanged, useBusiness } from '../data/useData';
import { useToast } from '../context/ToastContext';
import { getCurrentBusinessId } from '../data/currentBusiness';
import { uploadAsset, getSignedUrl } from '../lib/storage';
import { useKeyboardFocus } from '../hooks/useKeyboardFocus';
import { SectionLabel } from '../components/ui/typography';
import WorkerCatalogSheet from '../components/sheets/WorkerCatalogSheet';

function ToggleBtn({ show, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={show ? 'Hide password' : 'Show password'}
      style={{
        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
        background: 'transparent', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '14px', color: 'var(--ink-muted)',
        minWidth: 44, minHeight: 44,
      }}
    >
      {show ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  );
}

function ToggleSwitch({ checked, onChange, pink, inkMuted }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 44, height: 26, borderRadius: 13,
        background: checked ? pink : inkMuted,
        border: 'none', cursor: 'pointer', position: 'relative',
        transition: 'background 0.2s',
        flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute',
        top: 3, left: checked ? 21 : 3,
        width: 20, height: 20, borderRadius: '50%',
        background: 'white',
        transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        display: 'block',
      }} />
    </button>
  );
}

export default function Settings() {
  const { T, mode } = useAppTheme();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { business, loading: bizLoading, error: bizError, refresh: refreshBusiness } = useBusiness();
  const isKeyboardFocused = useKeyboardFocus();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(null);
  const [gcalOn, setGcalOn] = useState(false);
  const [gcalBusinessId, setGcalBusinessId] = useState(null);
  const [showWorkers, setShowWorkers] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);

  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const fileInputRef = useRef(null);
  const formInitialized = useRef(false);

  useEffect(() => {
    if (business && !formInitialized.current) {
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
        hst_number:  business.hst_number  ?? '',
        signature:   business.ai_profile?.signature ?? '',
      });
      formInitialized.current = true;

      if (business.logo_url) {
        getSignedUrl(business.logo_url).then(setAvatarUrl);
      }
    }
  }, [business]);

  useEffect(() => {
    async function checkIntegration() {
      if (!user) return;
      const businessId = await getCurrentBusinessId();
      if (!businessId) return;
      setGcalBusinessId(businessId);
      const { data } = await supabase.from('integrations').select('*').eq('business_id', businessId).eq('service_name', 'google_calendar').maybeSingle();
      if (data) setGcalOn(true);
    }
    checkIntegration();
  }, [user]);

  // Handle OAuth callback params (?sync=success or ?error=...)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sync = params.get('sync');
    const oauthError = params.get('error');
    if (!sync && !oauthError) return;

    // Clear URL params immediately
    navigate('/settings', { replace: true });

    if (oauthError) {
      toast.error(`Google Calendar connect failed: ${oauthError}`);
      return;
    }

    if (sync === 'success') {
      toast.success('Google Calendar connected!');
      setGcalOn(true);
      // Trigger sync for upcoming jobs so they appear in GCal immediately
      async function syncUpcomingJobs() {
        const businessId = await getCurrentBusinessId();
        if (!businessId) return;
        const today = new Date().toISOString().slice(0, 10);
        const { data: jobs } = await supabase
          .from('jobs')
          .select('id')
          .eq('business_id', businessId)
          .is('deleted_at', null)
          .gte('scheduled_date', today)
          .order('scheduled_date', { ascending: true })
          .limit(30);
        if (!jobs?.length) return;
        jobs.forEach(j => {
          fetch('/api/sync/gcal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId: j.id, action: 'upsert' }),
          }).catch(err => console.error('GCal re-sync error:', err));
        });
      }
      syncUpcomingJobs();
    }
  }, [location.search]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    if (!form.name.trim()) { setError('Business name is required.'); return; }
    setBusy(true); setError(null);
    try {
      const bid = await getCurrentBusinessId();
      const { error: err } = await supabase
        .from('businesses')
        .update({
          name:        form.name.trim(),
          owner_name:  form.owner_name.trim(),
          phone:       form.phone,
          email:       form.email,
          address:     form.address,
          city:        form.city,
          postal_code: form.postal_code,
          hourly_rate: form.hourly_rate === '' ? null : Number(form.hourly_rate),
          tax_enabled: form.tax_enabled,
          hst_number:  form.hst_number || null,
          ai_profile: {
            ...(business?.ai_profile || {}),
            signature: form.signature,
          }
        })
        .eq('id', bid);
      if (err) throw err;
      formInitialized.current = false; // allow re-init so isDirty resets
      refreshBusiness();
      toast.success('Settings saved!');
    } catch (err) {
      console.error('Settings save error:', err);
      setError('Failed to save settings. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdatePassword(e) {
    e.preventDefault();
    if (pw.length < 8) { setPwError('Password must be at least 8 characters.'); return; }
    setPwBusy(true); setPwError(null);
    const { error: err } = await supabase.auth.updateUser({ password: pw });
    setPwBusy(false);
    if (err) setPwError('Password update failed. Please try again.');
    else { toast.success('Password updated!'); setPw(''); setShowPw(false); }
  }

  async function handleAvatarClick() {
    fileInputRef.current.click();
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const bid = await getCurrentBusinessId();
      const path = await uploadAsset(bid, file, 'avatars');
      const { error: err } = await supabase.from('businesses').update({ logo_url: path }).eq('id', bid);
      if (err) throw err;
      const url = await getSignedUrl(path);
      setAvatarUrl(url);
      toast.success('Avatar updated!');
      refreshBusiness();
    } catch {
      toast.error('Failed to upload avatar.');
    } finally {
      setBusy(false);
    }
  }

  async function handleResetData() {
    const bid = await getCurrentBusinessId();
    if (!bid) return;

    setBusy(true);
    try {
      for (const table of RESET_TABLES) {
        const { error: err } = await supabase.from(table).delete().eq('business_id', bid);
        if (err) console.error(`Error deleting from ${table}:`, err);
      }
      toast.success('Data reset complete.');
      notifyDataChanged();
      navigate('/');
    } catch {
      toast.error('Data reset failed.');
    } finally {
      setBusy(false);
      setResetConfirm(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  const isDirty = form && business && (
    form.name        !== (business.name        ?? '') ||
    form.owner_name  !== (business.owner_name  ?? '') ||
    form.phone       !== (business.phone       ?? '') ||
    form.email       !== (business.email       ?? '') ||
    form.address     !== (business.address     ?? '') ||
    form.city        !== (business.city        ?? '') ||
    form.postal_code !== (business.postal_code ?? '') ||
    form.hourly_rate !== (business.hourly_rate != null ? String(business.hourly_rate) : '') ||
    form.tax_enabled !== (business.tax_enabled ?? false) ||
    form.hst_number  !== (business.hst_number  ?? '') ||
    form.signature   !== (business.ai_profile?.signature ?? '')
  );

  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    padding: '9px 11px', borderRadius: 'var(--r-input)',
    border: `1.5px solid ${T.cardBorder}`,
    fontSize: 13, color: T.ink,
    background: T.surface,
    fontFamily: 'var(--font-ui)',
  };

  const cardStyle = {
    marginBottom: 20,
    background: T.card,
    borderRadius: 'var(--r-card)',
    border: `1.5px solid ${T.cardBorder}`,
    padding: 16,
  };

  const labelStyle = {
    fontSize: 10, fontWeight: 700, color: T.inkMuted,
    textTransform: 'uppercase', display: 'block', marginBottom: 4,
  };

  if (bizLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: T.inkMuted, fontSize: 13 }}>
      Loading…
    </div>
  );

  if (!form) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 32, textAlign: 'center', gap: 12 }}>
      <div style={{ fontSize: 32 }}>⚠️</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>Account not fully set up</div>
      <div style={{ fontSize: 13, color: T.inkMuted, maxWidth: 280 }}>
        This account isn't linked to a business. Ask your admin to provision it via the Admin panel.
      </div>
      {bizError && <div style={{ fontSize: 11, color: '#EF4444', marginTop: 8 }}>Contact support if this persists.</div>}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg, color: T.ink }}>
      {/* Hero */}
      <div style={{
        background: T.hero,
        borderBottom: mode === 'dark' ? '3px solid #E91E6A' : 'none',
        padding: '13px 15px 15px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -60, right: -40, width: 180, height: 180, borderRadius: '50%', background: `radial-gradient(circle,${T.pinkGlow} 0%,transparent 70%)`, pointerEvents: 'none' }} />
        <h2 style={{ fontFamily: T.serif, fontSize: 24, margin: 0, color: mode === 'dark' ? 'white' : T.ink, position: 'relative' }}>
          Settings
        </h2>
      </div>

      {/* Scroll area */}
      <div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px 14px' }}>

        {isDirty && (
          <div style={{
            background: T.pinkTint, border: `1px solid ${T.cardBorder}`,
            borderRadius: 8, padding: '8px 12px', marginBottom: 12,
            fontSize: 12, fontWeight: 600, color: T.pink,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ fontSize: 8 }}>●</span> Unsaved changes
          </div>
        )}

        <SectionLabel style={{ color: T.secLabel, marginBottom: 4 }}>
          Preferences
        </SectionLabel>
        <div style={cardStyle}>
          <span style={{ fontSize: 14, fontWeight: 600, color: T.ink, display: 'block', marginBottom: 14 }}>Personal Profile</span>

          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
            <button
              type="button"
              onClick={handleAvatarClick}
              aria-label="Change avatar photo"
              style={{
                width: 64, height: 64, borderRadius: '50%',
                background: T.surface, border: `2px solid ${T.cardBorder}`,
                cursor: 'pointer', overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative', flexShrink: 0, padding: 0,
              }}
            >
              {avatarUrl ? <img src={avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Avatar" /> : <span style={{ fontSize: 24 }}>👤</span>}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.45)', color: 'white', fontSize: 9, fontWeight: 700, textAlign: 'center', padding: '3px 0', letterSpacing: '0.5px' }}>EDIT</div>
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} accept="image/*" aria-label="Avatar upload" />

            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Full Name</label>
              <input className="sm-input" value={form.owner_name} onChange={e => setForm({...form, owner_name: e.target.value})} style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={labelStyle}>Business Name</label>
              <input className="sm-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} style={inputStyle} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Phone</label>
                <input className="sm-input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input className="sm-input" value={form.email} onChange={e => setForm({...form, email: e.target.value})} style={inputStyle} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Address</label>
              <input className="sm-input" value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="Street address" style={inputStyle} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>City</label>
                <input className="sm-input" value={form.city} onChange={e => setForm({...form, city: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Postal Code</label>
                <input className="sm-input" value={form.postal_code} onChange={e => setForm({...form, postal_code: e.target.value})} placeholder="A1A 1A1" style={inputStyle} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Base Hourly Rate ($)</label>
              <input className="sm-input" type="number" value={form.hourly_rate} onChange={e => setForm({...form, hourly_rate: e.target.value})} onFocus={e => e.target.select()} style={inputStyle} />
            </div>

            <div style={{ borderTop: `1px solid ${T.cardBorder}`, marginTop: 4, paddingTop: 14 }}>
              <label style={labelStyle}>Your personality in words</label>
              <input
                className="sm-input"
                value={form.signature}
                onChange={e => setForm({...form, signature: e.target.value})}
                placeholder="e.g. Warm and organized, calm under pressure"
                style={inputStyle}
              />
              <div style={{ fontSize: 10, color: T.inkMuted, marginTop: 4 }}>How AI describes your style in messages and briefings</div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: `1px solid ${T.cardBorder}`, marginTop: 4 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>Tax Calculation</div>
                <div style={{ fontSize: 10, color: T.inkMuted }}>Automatically add 13% HST to invoices</div>
              </div>
              <ToggleSwitch
                checked={form.tax_enabled}
                onChange={v => setForm({...form, tax_enabled: v})}
                pink={T.pink}
                inkMuted={T.inkMuted}
              />
            </div>
            {form.tax_enabled && (
              <div>
                <label style={labelStyle}>HST Registration #</label>
                <input className="sm-input" value={form.hst_number} onChange={e => setForm({...form, hst_number: e.target.value})} placeholder="123456789 RT0001" style={inputStyle} />
              </div>
            )}
          </div>
        </div>

        <SectionLabel>Integrations</SectionLabel>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: T.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📅</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>Google Calendar</div>
                <div style={{ fontSize: 10, color: gcalOn ? '#10B981' : T.inkMuted, fontWeight: 600 }}>{gcalOn ? 'Connected' : 'Not connected'}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => window.location.href = `/api/auth/google/login?business_id=${gcalBusinessId}`}
              style={{ background: 'transparent', border: `1.5px solid ${T.cardBorder}`, borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 700, color: T.pink, cursor: 'pointer' }}
            >
              {gcalOn ? 'Reconnect' : 'Connect'}
            </button>
          </div>
        </div>

        <SectionLabel>Team</SectionLabel>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: T.surface, border: `1.5px solid ${T.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>👥</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>Workers</div>
                <div style={{ fontSize: 10, color: T.inkMuted }}>Manage who you assign to jobs</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowWorkers(true)}
              style={{ background: 'transparent', border: `1.5px solid ${T.cardBorder}`, borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 700, color: T.pink, cursor: 'pointer' }}
            >
              Manage
            </button>
          </div>
        </div>

        <SectionLabel>Security</SectionLabel>
        <div style={cardStyle}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.ink, marginBottom: 14 }}>Password</div>

          <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ position: 'relative' }}>
              <label style={labelStyle}>New password</label>
              <input className="sm-input" type={showPw ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)} placeholder="Min 8 characters" style={{ ...inputStyle, paddingRight: 44 }} />
              <ToggleBtn show={showPw} onToggle={() => setShowPw(!showPw)} />
            </div>
            {pwError && <div style={{ fontSize: 11, color: '#E91E6A' }}>{pwError}</div>}
            <button type="submit" disabled={pwBusy || !pw} style={{ width: '100%', padding: '10px', borderRadius: 10, background: pwBusy || !pw ? T.surface : T.pink, color: pwBusy || !pw ? T.inkMuted : 'white', border: 'none', fontWeight: 700, fontSize: 12, cursor: pwBusy || !pw ? 'default' : 'pointer' }}>
              {pwBusy ? 'Updating...' : 'Update password'}
            </button>
          </form>
        </div>

        {/* Sign Out — account-level, separate from security */}
        <div style={{ marginBottom: 20 }}>
          <button
            type="button"
            onClick={handleSignOut}
            style={{ width: '100%', background: 'transparent', border: `1.5px solid ${T.cardBorder}`, color: T.inkMuted, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            Sign out
          </button>
        </div>

        {/* Danger zone */}
        <div style={{ borderTop: `2px solid #FCA5A5`, paddingTop: 16, paddingBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span style={{ fontSize: 9, fontWeight: 800, color: '#EF4444', textTransform: 'uppercase', letterSpacing: '1px' }}>Danger zone</span>
          </div>
          <div style={{
            background: 'rgba(239,68,68,0.04)',
            borderRadius: 'var(--r-card)',
            border: '1.5px solid #FCA5A5',
            padding: 16,
          }}>
            {resetConfirm ? (
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#B91C1C', marginBottom: 6 }}>Delete everything?</div>
                <div style={{ fontSize: 12, color: T.inkMid, marginBottom: 14 }}>
                  This permanently deletes all clients, jobs, and expenses. It cannot be undone.
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setResetConfirm(false)}
                    style={{ flex: 1, padding: '10px', borderRadius: 10, background: T.card, border: `1.5px solid ${T.cardBorder}`, color: T.inkMuted, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleResetData}
                    disabled={busy}
                    style={{ flex: 1, padding: '10px', borderRadius: 10, background: '#EF4444', color: 'white', border: 'none', fontWeight: 700, fontSize: 12, cursor: busy ? 'default' : 'pointer' }}
                  >
                    {busy ? 'Deleting...' : 'Yes, delete everything'}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <button
                  type="button"
                  onClick={() => setResetConfirm(true)}
                  style={{ width: '100%', background: 'transparent', border: '1.5px solid #EF4444', color: '#EF4444', padding: '12px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  Reset all data
                </button>
                <div style={{ marginTop: 8, fontSize: 10, color: T.inkMuted, textAlign: 'center' }}>
                  Permanently deletes all clients, jobs, and expenses.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Persistent save footer */}
      <div style={{
        padding: '10px 14px 8px',
        borderTop: `1.5px solid ${T.cardBorder}`,
        background: T.card,
      }}>
        {error && <div style={{ marginBottom: 8, textAlign: 'center', color: '#E91E6A', fontSize: 12, fontWeight: 600 }}>{error}</div>}
        <button
          type="button"
          onClick={handleSave}
          disabled={busy || !isDirty}
          style={{
            width: '100%', padding: '14px', borderRadius: 12,
            background: busy || !isDirty ? T.surface : T.pink,
            color: busy || !isDirty ? T.inkMuted : 'white',
            border: 'none', fontWeight: 700, fontSize: 14,
            cursor: busy || !isDirty ? 'default' : 'pointer',
            boxShadow: !isDirty || busy ? 'none' : '0 4px 12px rgba(233,30,106,0.3)',
          }}
        >
          {busy ? 'Saving...' : isDirty ? 'Save settings' : 'No changes'}
        </button>
      </div>

      <div style={{ height: isKeyboardFocused ? 260 : 0 }} />
      <WorkerCatalogSheet isOpen={showWorkers} onClose={() => setShowWorkers(false)} />
    </div>
  );
}

// FK-safe deletion order: leaf tables first so no constraint violations
const RESET_TABLES = [
  'audit_log',
  'communication_log',
  'notification_log',
  'payments',
  'invoice_jobs',
  'invoices',
  'jobs',
  'job_templates',
  'template_schedule',
  'clients',
  'expense_log',
  'workers',
];
