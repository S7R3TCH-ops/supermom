import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAppTheme } from '../../context/AppThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useBusiness } from '../../data/useData';

export default function OnboardingWalkthrough() {
  const { T } = useAppTheme();
  const { profile, user } = useAuth();
  const { business, update, loading } = useBusiness();
  const [step, setStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [localComplete, setLocalComplete] = useState(() => localStorage.getItem('sm_onboarding_complete') === 'true');

  const [pwForm, setPwForm] = useState({ pw: '', pw2: '' });
  const [pwError, setPwError] = useState(null);

  const requiresPasswordChange = user?.user_metadata?.requires_password_change === true;

  const handlePasswordUpdate = async () => {
    if (!pwForm.pw || pwForm.pw.length < 8) {
      setPwError('Password must be at least 8 characters.');
      return;
    }
    if (pwForm.pw !== pwForm.pw2) {
      setPwError('Passwords do not match.');
      return;
    }
    setIsSaving(true);
    setPwError(null);
    try {
      const { error } = await supabase.auth.updateUser({ 
        password: pwForm.pw,
        data: { requires_password_change: false } 
      });
      if (error) throw error;
      // Small delay to ensure metadata is reflected, then reload or just proceed
      setTimeout(() => window.location.reload(), 500);
    } catch (err) {
      setPwError(err.message || 'Failed to update password.');
      setIsSaving(false);
    }
  };

  // Only show onboarding to the business owner, not admins/workers
  // CRITICAL: Super Admins (Joel) should NEVER see this.
  const SUPER_ADMIN_EMAILS = ['jlundie@gmail.com', 'joel@supermomforhire.com'];
  const isSuperAdmin = profile?.email && SUPER_ADMIN_EMAILS.includes(profile.email);

  if (loading || !business || profile?.role !== 'owner' || isSuperAdmin || (business.ai_profile?.onboarding_complete && !requiresPasswordChange) || (localComplete && !requiresPasswordChange) || window.__SKIP_ONBOARDING) {
    return null;
  }

  if (requiresPasswordChange) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(26,10,18,0.7)',
        backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}>
        <div style={{
          background: 'var(--grad-hero)',
          border: '2px solid var(--pink)',
          borderRadius: 24,
          width: '100%', maxWidth: 400,
          padding: '32px 24px',
          textAlign: 'center',
          boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
          position: 'relative', overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', top: -100, right: -100, width: 250, height: 250, borderRadius: '50%', background: 'radial-gradient(circle, rgba(233,30,106,0.2) 0%, transparent 70%)', pointerEvents: 'none' }} />

          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'white', margin: '0 0 12px', fontWeight: 500 }}>Welcome!</h2>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, marginBottom: 24 }}>
            Please set a new, secure password for your account to continue.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            <input 
              type="password" 
              placeholder="New Password (min 8 chars)" 
              value={pwForm.pw} 
              onChange={e => setPwForm(p => ({ ...p, pw: e.target.value }))} 
              style={{ width: '100%', padding: '12px', borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }} 
            />
            <input 
              type="password" 
              placeholder="Confirm Password" 
              value={pwForm.pw2} 
              onChange={e => setPwForm(p => ({ ...p, pw2: e.target.value }))} 
              style={{ width: '100%', padding: '12px', borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }} 
            />
          </div>

          {pwError && <div style={{ color: '#fca5a5', fontSize: 12, marginBottom: 16, textAlign: 'left', padding: '8px', background: 'rgba(239,68,68,0.1)', borderRadius: 8 }}>{pwError}</div>}

          <button
            onClick={handlePasswordUpdate}
            disabled={isSaving}
            style={{
              width: '100%', padding: '16px', borderRadius: 16,
              background: isSaving ? 'var(--pink-mid)' : 'var(--grad-pink)', 
              color: 'white', border: 'none', fontSize: 15, fontWeight: 700,
              cursor: isSaving ? 'default' : 'pointer',
              boxShadow: '0 4px 15px rgba(233,30,106,0.3)'
            }}
          >
            {isSaving ? 'Saving...' : 'Set Password & Continue'}
          </button>
        </div>
      </div>
    );
  }

  const handleFinish = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const ai_profile = { ...(business.ai_profile || {}), onboarding_complete: true };
      // Try to save to DB, but don't fail the UI if it crashes (e.g. missing column)
      await update({ ai_profile }).catch(err => {
        console.warn('Onboarding DB save failed, falling back to local only:', err);
      });
      localStorage.setItem('sm_onboarding_complete', 'true');
      setLocalComplete(true);
    } catch (err) {
      console.error('Onboarding finish failed:', err);
      setError(err.message || 'Failed to complete onboarding. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const steps = [
    {
      title: "Your Executive Assistant is Ready",
      desc: `Welcome, ${business.owner_name?.split(' ')[0] || 'there'}. I'm here to handle the prep, tracking, and details so you can focus on the work.`,
      btn: "Let's get started",
    },
    {
      title: "I'll learn as we go",
      desc: "The more jobs we complete, the smarter I get. I'll soon start predicting your drive times and duration for every client.",
      btn: "Understood",
    },
    {
      title: "First Mission: Add a VIP",
      desc: "Tap the button on your Home screen to add your first client. I'll take it from there.",
      btn: "Start the mission",
      action: handleFinish,
    }
  ];

  const current = steps[step];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(26,10,18,0.7)',
      backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        background: 'var(--grad-hero)',
        border: '2px solid var(--pink)',
        borderRadius: 24,
        width: '100%', maxWidth: 400,
        padding: '32px 24px',
        textAlign: 'center',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
        position: 'relative', overflow: 'hidden'
      }}>
        {/* Glow */}
        <div style={{ 
          position: 'absolute', top: -100, right: -100, 
          width: 250, height: 250, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(233,30,106,0.2) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{ 
          width: 64, height: 64, borderRadius: 20, 
          background: 'var(--grad-action)', 
          margin: '0 auto 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(233,30,106,0.4)',
          border: '2px solid rgba(255,255,255,0.2)'
        }}>
          <span style={{ fontSize: 32 }}>🦸‍♀️</span>
        </div>

        <h2 style={{ 
          fontFamily: 'var(--font-display)', fontSize: 28, color: 'white', 
          margin: '0 0 12px', fontWeight: 500, letterSpacing: '-0.5px' 
        }}>
          {current.title}
        </h2>

        <p style={{ 
          fontFamily: 'var(--font-ui)', fontSize: 14, color: 'rgba(255,255,255,0.7)', 
          lineHeight: 1.6, margin: '0 0 32px' 
        }}>
          {current.desc}
        </p>

        <button
          onClick={() => {
            if (isSaving) return;
            if (current.action) current.action();
            else setStep(s => s + 1);
          }}
          disabled={isSaving}
          style={{
            width: '100%', padding: '16px', borderRadius: 16,
            background: isSaving ? 'var(--pink-mid)' : 'var(--grad-pink)', 
            color: 'white',
            border: 'none', fontSize: 15, fontWeight: 700,
            fontFamily: 'var(--font-ui)', cursor: isSaving ? 'default' : 'pointer',
            boxShadow: '0 4px 15px rgba(233,30,106,0.3)',
            opacity: isSaving ? 0.8 : 1
          }}
        >
          {isSaving ? 'Saving...' : current.btn}
        </button>

        {error && (
          <div style={{ 
            marginTop: 16, padding: '10px 12px', borderRadius: 12, 
            background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#fca5a5', fontSize: 12, lineHeight: 1.4, textAlign: 'left'
          }}>
            <strong>Error:</strong> {error}
            <div style={{ marginTop: 4, fontSize: 11, opacity: 0.8 }}>
              This usually means the database schema needs updating.
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 24 }}>
          {steps.map((_, i) => (
            <div key={i} style={{ 
              width: 6, height: 6, borderRadius: '50%',
              background: i === step ? 'var(--pink)' : 'rgba(255,255,255,0.2)',
              transition: 'background 0.3s'
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}
