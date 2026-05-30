import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
      style={{
        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
        background: 'transparent', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 4, color: 'var(--ink-muted)',
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

export default function Settings() {
  const { T, mode } = useAppTheme();
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { business, refreshBusiness } = useBusiness();
  const isKeyboardFocused = useKeyboardFocus();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(null);
  const [gcalOn, setGcalOn] = useState(false);
  const [showWorkers, setShowWorkers] = useState(false);

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
      const { data } = await supabase.from('integrations').select('*').eq('business_id', businessId).eq('provider', 'google_calendar').maybeSingle();
      if (data) setGcalOn(true);
    }
    checkIntegration();
  }, [user]);

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
          ai_profile: {
            ...(business?.ai_profile || {}),
            signature: form.signature,
          }
        })
        .eq('id', bid);
      if (err) throw err;
      toast.success('Settings saved!');
      refreshBusiness();
    } catch {
      setError('Failed to save settings.');
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
    if (err) setPwError(err.message);
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
    if (!window.confirm('WARNING: This will delete ALL your data (clients, jobs, expenses). This cannot be undone. Are you sure?')) return;
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
    }
  }

  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    padding: '9px 11px', borderRadius: 'var(--r-input)',
    border: '1.5px solid var(--pink-border)',
    fontSize: 13, color: 'var(--ink)',
    background: 'var(--pink-pale)', outline: 'none',
    fontFamily: 'var(--font-ui)',
  };

  if (!form) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg ?? 'var(--pink-pale)', color: T.ink ?? 'var(--ink)' }}>
      {/* Hero */}
      <div style={{ 
        background: T.hero ?? 'var(--grad-hero)', 
        borderBottom: mode === 'dark' ? '3px solid #E91E6A' : 'none', 
        padding: '13px 15px 15px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', top: -60, right: -40, width: 180, height: 180, borderRadius: '50%', background: `radial-gradient(circle,${T.pinkGlow} 0%,transparent 70%)`, pointerEvents: 'none' }} />
        
        <div style={{ fontFamily: T.font, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: mode === 'dark' ? '#FF78B0' : T.pink, marginBottom: 10, position: 'relative' }}>✦ System Settings</div>

        <h2 style={{ fontFamily: T.serif, fontSize: 24, margin: 0, color: mode === 'dark' ? 'white' : T.ink, position: 'relative' }}>
          Config & Profile
        </h2>
      </div>

      <div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px 14px' }}>
        <SectionLabel style={{ color: mode === 'dark' ? T.pinkLabel : T.pink, marginBottom: 4, position: 'relative' }}>
          ✦ Preferences
        </SectionLabel>
        <div style={{ marginBottom: 20, background: 'white', borderRadius: 'var(--r-card)', border: '1.5px solid var(--pink-border)', padding: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: 14 }}>Personal Profile</span>
          
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
             <div onClick={handleAvatarClick} style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--pink-pale)', border: '2px solid var(--pink-border)', cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                {avatarUrl ? <img src={avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Avatar" /> : <span style={{ fontSize: 24 }}>👤</span>}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.4)', color: 'white', fontSize: 8, fontWeight: 700, textAlign: 'center', padding: '2px 0' }}>EDIT</div>
             </div>
             <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} accept="image/*" />
             
             <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Full Name</label>
                <input value={form.owner_name} onChange={e => setForm({...form, owner_name: e.target.value})} style={inputStyle} />
             </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Business Name</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} style={inputStyle} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Phone</label>
                <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Email</label>
                <input value={form.email} onChange={e => setForm({...form, email: e.target.value})} style={inputStyle} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Base Hourly Rate ($)</label>
              <input type="number" value={form.hourly_rate} onChange={e => setForm({...form, hourly_rate: e.target.value})} style={inputStyle} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid var(--pink-border)', marginTop: 4 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Tax Calculation</div>
                <div style={{ fontSize: 10, color: 'var(--ink-muted)' }}>Automatically add 13% HST to invoices</div>
              </div>
              <input type="checkbox" checked={form.tax_enabled} onChange={e => setForm({...form, tax_enabled: e.target.checked})} style={{ width: 18, height: 18 }} />
            </div>
          </div>
        </div>

        <SectionLabel>Integrations</SectionLabel>
        <div style={{ marginBottom: 20, background: 'white', borderRadius: 'var(--r-card)', border: '1.5px solid var(--pink-border)', padding: 16 }}>
           <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                 <div style={{ width: 32, height: 32, borderRadius: 8, background: '#F1F5FE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📅</div>
                 <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Google Calendar</div>
                    <div style={{ fontSize: 10, color: gcalOn ? '#10B981' : 'var(--ink-muted)', fontWeight: 600 }}>{gcalOn ? 'CONNECTED' : 'NOT CONNECTED'}</div>
                 </div>
              </div>
              <button 
                onClick={() => window.location.href = '/api/auth/google/login'}
                style={{ background: 'transparent', border: '1.5px solid var(--pink-border)', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 700, color: 'var(--pink)', cursor: 'pointer' }}
              >
                {gcalOn ? 'RECONNECT' : 'CONNECT'}
              </button>
           </div>
        </div>

        <SectionLabel>Team</SectionLabel>
        <div style={{ marginBottom: 20, background: 'white', borderRadius: 'var(--r-card)', border: '1.5px solid var(--pink-border)', padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--pink-pale)', border: '1.5px solid var(--pink-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>👥</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Workers</div>
                <div style={{ fontSize: 10, color: 'var(--ink-muted)' }}>Manage who you assign to jobs</div>
              </div>
            </div>
            <button
              onClick={() => setShowWorkers(true)}
              style={{ background: 'transparent', border: '1.5px solid var(--pink-border)', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 700, color: 'var(--pink)', cursor: 'pointer' }}
            >
              MANAGE
            </button>
          </div>
        </div>

        <SectionLabel>Security</SectionLabel>
        <div style={{ marginBottom: 20, background: 'white', borderRadius: 'var(--r-card)', border: '1.5px solid var(--pink-border)', padding: 16 }}>
           <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 14 }}>Password & Access</div>
           
           <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ position: 'relative' }}>
                 <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>New Password</label>
                 <input type={showPw ? "text" : "password"} value={pw} onChange={e => setPw(e.target.value)} placeholder="Min 8 characters" style={inputStyle} />
                 <ToggleBtn show={showPw} onToggle={() => setShowPw(!showPw)} />
              </div>
              {pwError && <div style={{ fontSize: 11, color: '#E91E6A' }}>{pwError}</div>}
              <button type="submit" disabled={pwBusy || !pw} style={{ width: '100%', padding: '10px', borderRadius: 10, background: pwBusy ? 'var(--pink-pale)' : 'var(--pink)', color: 'white', border: 'none', fontWeight: 700, fontSize: 12, cursor: pwBusy ? 'default' : 'pointer' }}>
                 {pwBusy ? 'UPDATING...' : 'UPDATE PASSWORD'}
              </button>
           </form>
        </div>

        <div style={{ padding: '10px 0 40px' }}>
          <button onClick={handleSave} disabled={busy} style={{ width: '100%', padding: '14px', borderRadius: 12, background: busy ? 'var(--pink-pale)' : 'var(--pink)', color: 'white', border: 'none', fontWeight: 700, fontSize: 14, cursor: busy ? 'default' : 'pointer', boxShadow: '0 4px 12px rgba(233,30,106,0.3)' }}>
            {busy ? 'SAVING CHANGES...' : 'SAVE SETTINGS'}
          </button>

          {error && <div style={{ marginTop: 12, textAlign: 'center', color: '#E91E6A', fontSize: 12, fontWeight: 600 }}>{error}</div>}

          <div style={{ marginTop: 40, borderTop: '1px solid var(--pink-border)', paddingTop: 20 }}>
            <SectionLabel>System</SectionLabel>
            <button onClick={handleResetData} style={{ width: '100%', background: 'transparent', border: '1.5px solid #EF4444', color: '#EF4444', padding: '12px', borderRadius: 12, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              RESET ALL DATA
            </button>
            <div style={{ marginTop: 8, fontSize: 10, color: 'var(--ink-muted)', textAlign: 'center' }}>This will permanently delete all clients, jobs, and expenses.</div>
          </div>
        </div>
      </div>
      
      <div style={{ height: isKeyboardFocused ? 260 : 0, transition: 'height 0.2s ease-out' }} />
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
