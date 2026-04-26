import { useState } from 'react';
import { useAppTheme } from '../../context/AppThemeContext';
import { useBusiness } from '../../data/useData';

export default function OnboardingWalkthrough() {
  const { T } = useAppTheme();
  const { business, update, loading } = useBusiness();
  const [step, setStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [localComplete, setLocalComplete] = useState(() => localStorage.getItem('sm_onboarding_complete') === 'true');

  if (loading || !business || business.ai_profile?.onboarding_complete || localComplete || window.__SKIP_ONBOARDING) return null;

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
      title: `Welcome, ${business.owner_name?.split(' ')[0] || 'there'}!`,
      desc: "Let's get your mission control ready. You're about to become a solo-operating superhero.",
      btn: 'Start the mission',
    },
    {
      title: 'Your AI Sidekick',
      desc: "I'm here to help you prep, estimate, and nudge. You can choose how I speak to you in Settings.",
      btn: 'Sounds good',
    },
    {
      title: "You're All Set",
      desc: "Tap the + to add your first client or book a job. Your calendar is waiting.",
      btn: "Let's Go!",
      action: handleFinish,
    }
  ];

  const current = steps[step];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(26,10,18,0.92)',
      backdropFilter: 'blur(8px)',
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
