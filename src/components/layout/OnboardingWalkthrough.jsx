import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAppTheme } from '../../context/AppThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useBusiness } from '../../data/useData';
import { getCurrentBusinessId } from '../../data/currentBusiness';

const SUPER_ADMIN_EMAILS = ['jlundie@gmail.com', 'joel@supermomforhire.com'];

export default function OnboardingWalkthrough() {
  const { T } = useAppTheme();
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const { business, update, loading } = useBusiness();
  const [step, setStep] = useState(0);
  const [emailFreq, setEmailFreq] = useState('daily');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [localComplete, setLocalComplete] = useState(() => localStorage.getItem('sm_onboarding_complete') === 'true');

  const [pwForm, setPwForm] = useState({ pw: '', pw2: '' });
  const [pwError, setPwError] = useState(null);

  const bizInitialized = useRef(false);
  const [bizForm, setBizForm] = useState({ name: '', first_name: '', last_name: '', phone: '', city: '', postal_code: '', tax_enabled: false, hst_number: '' });
  const [bizFieldErrors, setBizFieldErrors] = useState({});
  const [bizSaving, setBizSaving] = useState(false);
  const [bizError, setBizError] = useState(null);


  const requiresPasswordChange = user?.user_metadata?.requires_password_change === true;
  const isSuperAdmin = profile?.email && SUPER_ADMIN_EMAILS.includes(profile.email);

  useEffect(() => {
    if (business && !bizInitialized.current) {
      setBizForm({
        name:        business.name        ?? '',
        first_name:  profile?.first_name  ?? '',
        last_name:   profile?.last_name   ?? '',
        phone:       business.phone       ?? '',
        city:        business.city        ?? '',
        postal_code: business.postal_code ?? '',
        tax_enabled: business.tax_enabled ?? false,
        hst_number:  business.hst_number  ?? '',
      });
      bizInitialized.current = true;
    }
  }, [business]);


  if (loading || !business || profile?.role !== 'owner' || isSuperAdmin || (business.ai_profile?.onboarding_complete && !requiresPasswordChange) || (localComplete && !requiresPasswordChange) || window.__SKIP_ONBOARDING) {
    return null;
  }

  const handlePasswordUpdate = async () => {
    if (!pwForm.pw || pwForm.pw.length < 8) { setPwError('Password must be at least 8 characters.'); return; }
    if (pwForm.pw !== pwForm.pw2) { setPwError('Passwords do not match.'); return; }
    setIsSaving(true); setPwError(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwForm.pw, data: { requires_password_change: false } });
      if (error) throw error;
      setTimeout(() => window.location.reload(), 500);
    } catch (err) {
      setPwError(err.message || 'Failed to update password.');
      setIsSaving(false);
    }
  };

  if (requiresPasswordChange) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(26,10,18,0.7)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: 'var(--grad-hero)', border: '2px solid var(--pink)', borderRadius: 24, width: '100%', maxWidth: 400, padding: '32px 24px', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -100, right: -100, width: 250, height: 250, borderRadius: '50%', background: 'radial-gradient(circle, rgba(233,30,106,0.2) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'white', margin: '0 0 12px', fontWeight: 500 }}>Welcome!</h2>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, marginBottom: 24 }}>
            Please set a new, secure password for your account to continue.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            <input type="password" placeholder="New Password (min 8 chars)" value={pwForm.pw} onChange={e => setPwForm(p => ({ ...p, pw: e.target.value }))} style={{ width: '100%', padding: '12px', borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }} />
            <input type="password" placeholder="Confirm Password" value={pwForm.pw2} onChange={e => setPwForm(p => ({ ...p, pw2: e.target.value }))} style={{ width: '100%', padding: '12px', borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }} />
          </div>
          {pwError && <div style={{ color: '#fca5a5', fontSize: 12, marginBottom: 16, textAlign: 'left', padding: '8px', background: 'rgba(239,68,68,0.1)', borderRadius: 8 }}>{pwError}</div>}
          <button onClick={handlePasswordUpdate} disabled={isSaving} style={{ width: '100%', padding: '16px', borderRadius: 16, background: isSaving ? 'var(--pink-mid)' : 'var(--grad-pink)', color: 'white', border: 'none', fontSize: 15, fontWeight: 700, cursor: isSaving ? 'default' : 'pointer', boxShadow: '0 4px 15px rgba(233,30,106,0.3)' }}>
            {isSaving ? 'Saving...' : 'Set Password & Continue'}
          </button>
        </div>
      </div>
    );
  }

  function advance() {
    setStep(s => s + 1);
  }

  async function handleBizSave() {
    const errs = {};
    if (!bizForm.name.trim())       errs.name = true;
    if (!bizForm.first_name.trim()) errs.first_name = true;
    if (!bizForm.last_name.trim())  errs.last_name = true;
    if (!bizForm.phone.trim())      errs.phone = true;
    if (!bizForm.city.trim())       errs.city = true;
    if (bizForm.tax_enabled && !bizForm.hst_number.trim()) errs.hst_number = true;
    if (Object.keys(errs).length) { setBizFieldErrors(errs); return; }
    setBizFieldErrors({});
    setBizSaving(true); setBizError(null);
    try {
      const bid = await getCurrentBusinessId();
      const [bizRes, userRes] = await Promise.all([
        supabase.from('businesses').update({
          name:        bizForm.name.trim(),
          owner_name:  `${bizForm.first_name.trim()} ${bizForm.last_name.trim()}`,
          phone:       bizForm.phone.trim(),
          city:        bizForm.city.trim(),
          postal_code: bizForm.postal_code.trim() || null,
          tax_enabled: bizForm.tax_enabled,
          hst_number:  bizForm.hst_number.trim() || null,
        }).eq('id', bid),
        supabase.from('users').update({
          first_name: bizForm.first_name.trim(),
          last_name:  bizForm.last_name.trim(),
        }).eq('id', user.id),
      ]);
      if (bizRes.error) throw bizRes.error;
      if (userRes.error) throw userRes.error;
      advance();
    } catch (err) {
      setBizError(err.message || 'Failed to save.');
    } finally {
      setBizSaving(false);
    }
  }

  const handleFinish = async () => {
    setIsSaving(true); setError(null);
    try {
      const ai_profile = { ...(business.ai_profile || {}), onboarding_complete: true, email_frequency: emailFreq };
      await update({ ai_profile }).catch(err => {
        console.warn('Onboarding DB save failed, falling back to local only:', err);
      });
      localStorage.setItem('sm_onboarding_complete', 'true');
      setLocalComplete(true);
      navigate('/settings');
    } catch (err) {
      console.error('Onboarding finish failed:', err);
      setError(err.message || 'Failed to complete onboarding. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const firstName = business.owner_name?.split(' ')[0] || 'there';
  const totalDots = 5;
  const dotIndex = step;

  const inputStyle = {
    width: '100%', padding: '11px 12px', borderRadius: 10,
    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
    color: 'white', fontSize: 14, outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle = {
    fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 5,
  };
  const primaryBtn = (disabled) => ({
    width: '100%', padding: '16px', borderRadius: 16,
    background: disabled ? 'var(--pink-mid)' : 'var(--grad-pink)',
    color: 'white', border: 'none', fontSize: 15, fontWeight: 700,
    fontFamily: 'var(--font-ui)', cursor: disabled ? 'default' : 'pointer',
    boxShadow: '0 4px 15px rgba(233,30,106,0.3)', opacity: disabled ? 0.8 : 1,
  });
  const skipBtn = {
    background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
    fontSize: 12, cursor: 'pointer', padding: '4px 8px', marginTop: 6,
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(26,10,18,0.7)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'var(--grad-hero)', border: '2px solid var(--pink)', borderRadius: 24, width: '100%', maxWidth: 400, padding: '32px 24px', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -100, right: -100, width: 250, height: 250, borderRadius: '50%', background: 'radial-gradient(circle, rgba(233,30,106,0.2) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Step 0 — Welcome */}
        {step === 0 && (
          <>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--grad-action)', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(233,30,106,0.4)', border: '2px solid rgba(255,255,255,0.2)' }}>
              <span style={{ fontSize: 32 }}>🦸‍♀️</span>
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'white', margin: '0 0 12px', fontWeight: 500, letterSpacing: '-0.5px' }}>
              Your Executive Assistant is Ready
            </h2>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, margin: '0 0 16px' }}>
              I'm here to handle the prep, tracking, and details so you can focus on the work.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', marginBottom: 28, textAlign: 'left' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--grad-pink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>👤</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>{business.owner_name}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{business.email}</div>
              </div>
            </div>
            <button onClick={advance} style={primaryBtn(false)}>Let's get started</button>
          </>
        )}

        {/* Step 1 — Business info */}
        {step === 1 && (
          <>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'white', margin: '0 0 4px', fontWeight: 500, letterSpacing: '-0.5px' }}>Your Business</h2>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, margin: '0 0 16px' }}>
              This shows on invoices. All fields required.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14, textAlign: 'left' }}>
              <div>
                <label style={{ ...labelStyle, color: bizFieldErrors.name ? '#fca5a5' : labelStyle.color }}>Business Name</label>
                <input value={bizForm.name} onChange={e => setBizForm(f => ({ ...f, name: e.target.value }))} placeholder="Supermom for Hire" style={{ ...inputStyle, borderColor: bizFieldErrors.name ? 'rgba(252,165,165,0.6)' : inputStyle.border }} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ ...labelStyle, color: bizFieldErrors.first_name ? '#fca5a5' : labelStyle.color }}>First Name</label>
                  <input value={bizForm.first_name} onChange={e => setBizForm(f => ({ ...f, first_name: e.target.value }))} placeholder="Sandra" style={{ ...inputStyle, borderColor: bizFieldErrors.first_name ? 'rgba(252,165,165,0.6)' : inputStyle.border }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ ...labelStyle, color: bizFieldErrors.last_name ? '#fca5a5' : labelStyle.color }}>Last Name</label>
                  <input value={bizForm.last_name} onChange={e => setBizForm(f => ({ ...f, last_name: e.target.value }))} placeholder="Smith" style={{ ...inputStyle, borderColor: bizFieldErrors.last_name ? 'rgba(252,165,165,0.6)' : inputStyle.border }} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <div style={{ ...inputStyle, color: 'rgba(255,255,255,0.4)', userSelect: 'none' }}>{user?.email}</div>
              </div>
              <div>
                <label style={{ ...labelStyle, color: bizFieldErrors.phone ? '#fca5a5' : labelStyle.color }}>Phone</label>
                <input value={bizForm.phone} onChange={e => setBizForm(f => ({ ...f, phone: e.target.value }))} placeholder="(416) 555-0100" style={{ ...inputStyle, borderColor: bizFieldErrors.phone ? 'rgba(252,165,165,0.6)' : inputStyle.border }} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ ...labelStyle, color: bizFieldErrors.city ? '#fca5a5' : labelStyle.color }}>City</label>
                  <input value={bizForm.city} onChange={e => setBizForm(f => ({ ...f, city: e.target.value }))} placeholder="Georgetown" style={{ ...inputStyle, borderColor: bizFieldErrors.city ? 'rgba(252,165,165,0.6)' : inputStyle.border }} />
                </div>
                <div style={{ width: 110 }}>
                  <label style={labelStyle}>Postal Code</label>
                  <input value={bizForm.postal_code} onChange={e => setBizForm(f => ({ ...f, postal_code: e.target.value }))} placeholder="L7G 4S5" style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <span style={{ fontSize: 13, color: 'white' }}>Charge HST (13%)</span>
                <input type="checkbox" checked={bizForm.tax_enabled} onChange={e => setBizForm(f => ({ ...f, tax_enabled: e.target.checked }))} style={{ width: 18, height: 18, cursor: 'pointer' }} />
              </div>
              {bizForm.tax_enabled && (
                <div>
                  <label style={{ ...labelStyle, color: bizFieldErrors.hst_number ? '#fca5a5' : labelStyle.color }}>HST Registration #</label>
                  <input value={bizForm.hst_number} onChange={e => setBizForm(f => ({ ...f, hst_number: e.target.value }))} placeholder="123456789 RT0001" style={{ ...inputStyle, borderColor: bizFieldErrors.hst_number ? 'rgba(252,165,165,0.6)' : inputStyle.border }} />
                </div>
              )}
            </div>
            {bizError && <div style={{ color: '#fca5a5', fontSize: 12, marginBottom: 10, textAlign: 'left', padding: '8px', background: 'rgba(239,68,68,0.1)', borderRadius: 8 }}>{bizError}</div>}
            {Object.keys(bizFieldErrors).length > 0 && !bizError && (
              <div style={{ color: '#fca5a5', fontSize: 12, marginBottom: 10, textAlign: 'left' }}>Please fill in all required fields.</div>
            )}
            <button onClick={handleBizSave} disabled={bizSaving} style={primaryBtn(bizSaving)}>
              {bizSaving ? 'Saving...' : 'Save & Continue'}
            </button>
          </>
        )}

        {/* Step 2 — Quick start tips */}
        {step === 2 && (
          <>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'white', margin: '0 0 8px', fontWeight: 500, letterSpacing: '-0.5px' }}>A few quick tips</h2>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, margin: '0 0 20px' }}>Here's how to get the most out of the app.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28, textAlign: 'left' }}>
              {[
                { icon: '📅', title: 'Sync your calendar', desc: 'Settings → Integrations → Connect Google Calendar. Your jobs will appear automatically.' },
                { icon: '👤', title: 'Add your first client', desc: 'Tap the + button on the Home screen to add a client and book their first job.' },
                { icon: '💼', title: 'Booking a job', desc: 'Pick a service, set the date and time, and I\'ll track everything from there.' },
              ].map(tip => (
                <div key={tip.title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{tip.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'white', marginBottom: 3 }}>{tip.title}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.4 }}>{tip.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={advance} style={primaryBtn(false)}>Got it</button>
          </>
        )}

        {/* Step 3 — Email preference */}
        {step === 3 && (
          <>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(255,255,255,0.08)', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, border: '1.5px solid rgba(255,255,255,0.15)' }}>
              📬
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'white', margin: '0 0 8px', fontWeight: 500, letterSpacing: '-0.5px' }}>Daily briefing email</h2>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, margin: '0 0 20px' }}>
              Every morning I'll send you a rundown of the day — jobs, outstanding balances, and a little something to start the day right.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
              {[
                { value: 'daily', label: 'Daily', desc: 'Every morning with today\'s jobs and a quick summary' },
                { value: 'weekly', label: 'Weekly', desc: 'Monday mornings with a full week-ahead overview' },
              ].map(opt => (
                <div
                  key={opt.value}
                  onClick={() => setEmailFreq(opt.value)}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 14, background: emailFreq === opt.value ? 'rgba(233,30,106,0.15)' : 'rgba(255,255,255,0.05)', border: `1.5px solid ${emailFreq === opt.value ? 'var(--pink)' : 'rgba(255,255,255,0.1)'}`, cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left' }}
                >
                  <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${emailFreq === opt.value ? 'var(--pink)' : 'rgba(255,255,255,0.3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {emailFreq === opt.value && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--pink)' }} />}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>{opt.label}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{opt.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={advance} style={primaryBtn(false)}>Continue</button>
          </>
        )}

        {/* Step 4 — Done */}
        {step === 4 && (
          <>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--grad-action)', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(233,30,106,0.4)', border: '2px solid rgba(255,255,255,0.2)' }}>
              <span style={{ fontSize: 32 }}>🚀</span>
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'white', margin: '0 0 12px', fontWeight: 500, letterSpacing: '-0.5px' }}>
              You're all set, {firstName}!
            </h2>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, margin: '0 0 16px' }}>
              I'll take you to Settings first — a couple of things worth knowing:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24, textAlign: 'left' }}>
              {[
                { icon: '🌙', text: 'Dark mode — toggle in the top right of Settings' },
                { icon: '👁', text: 'Privacy mode — tap the eye icon to hide all amounts' },
                { icon: '📅', text: 'Connect Google Calendar — Settings → Integrations' },
              ].map(item => (
                <div key={item.text} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.4 }}>{item.text}</span>
                </div>
              ))}
            </div>
            <button onClick={handleFinish} disabled={isSaving} style={primaryBtn(isSaving)}>
              {isSaving ? 'Saving...' : 'Go to Settings'}
            </button>
            {error && (
              <div style={{ marginTop: 16, padding: '10px 12px', borderRadius: 12, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', fontSize: 12, lineHeight: 1.4, textAlign: 'left' }}>
                <strong>Error:</strong> {error}
                <div style={{ marginTop: 4, fontSize: 11, opacity: 0.8 }}>This usually means the database schema needs updating.</div>
              </div>
            )}
          </>
        )}

        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 24 }}>
          {Array.from({ length: totalDots }).map((_, i) => (
            <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i === dotIndex ? 'var(--pink)' : 'rgba(255,255,255,0.2)', transition: 'background 0.3s' }} />
          ))}
        </div>
      </div>
    </div>
  );
}
