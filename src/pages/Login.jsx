import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppTheme } from '../context/AppThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

export default function Login() {
  const { T } = useAppTheme();
  const navigate = useNavigate();
  const { signIn, configured } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setErr(''); setInfo('');
    setBusy(true);
    const { error } = await signIn(email.trim(), password);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    navigate('/');
  }

  async function onForgot() {
    setErr(''); setInfo('');
    const addr = email.trim();
    if (!addr) { setErr('Enter your email above first, then tap Forgot password.'); return; }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(addr, {
      redirectTo: `${window.location.origin}/`,
    });
    setBusy(false);
    if (error) setErr(error.message);
    else setInfo(`Password reset link sent to ${addr}.`);
  }

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 12,
    border: `1.5px solid ${T.cardBorder}`,
    background: T.card,
    color: T.ink,
    font: `15px/1.3 ${T.font}`,
  };

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      justifyContent: 'center', padding: '24px',
      background: T.bg,
    }}>
      <div style={{ maxWidth: 360, width: '100%', margin: '0 auto' }}>
        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'center' }}>
          <img src="/branding/logo-banner.png" alt="Supermom for Hire" style={{ height: 48, objectFit: 'contain' }} />
        </div>
        <h1 style={{
          font: `600 28px/1.1 ${T.serif}`,
          color: T.ink, margin: '0 0 6px',
        }}>
          Welcome back
        </h1>
        <p style={{ font: `14px/1.4 ${T.font}`, color: T.inkSub, margin: '0 0 24px' }}>
          Sign in to your Supermom account.
        </p>

        {!configured && (
          <div style={{
            padding: 12, borderRadius: 10, marginBottom: 16,
            background: T.amberBg, border: `1px solid ${T.amberBorder}`,
            font: `13px/1.4 ${T.font}`, color: T.ink,
          }}>
            Supabase is not configured yet. Copy <code>.env.example</code> to <code>.env</code> and fill in your project URL and anon key.
          </div>
        )}

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ font: `12px/1 ${T.font}`, color: T.secLabel, letterSpacing: 0.5 }}>
            Email
            <input
              type="email" required autoComplete="email"
              value={email} onChange={e => setEmail(e.target.value)}
              className="sm-input"
              style={{ ...inputStyle, marginTop: 6 }}
            />
          </label>
          <label style={{ font: `12px/1 ${T.font}`, color: T.secLabel, letterSpacing: 0.5 }}>
            Password
            <div style={{ position: 'relative', marginTop: 6 }}>
              <input
                type={showPassword ? "text" : "password"} required autoComplete="current-password"
                value={password} onChange={e => setPassword(e.target.value)}
                className="sm-input"
                style={{ ...inputStyle, paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 44, height: 44, color: T.inkMuted,
                }}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </label>

          {err && (
            <div aria-live="assertive" role="alert" style={{
              padding: 10, borderRadius: 8,
              background: T.redBg, border: `1px solid ${T.redBorder}`,
              font: `13px/1.3 ${T.font}`, color: T.ink,
            }}>{err}</div>
          )}
          {info && (
            <div aria-live="polite" style={{
              padding: 10, borderRadius: 8,
              background: T.card, border: `1px solid ${T.cardBorder}`,
              font: `13px/1.3 ${T.font}`, color: T.ink,
            }}>{info}</div>
          )}

          <button
            type="submit" disabled={busy || !configured}
            style={{
              marginTop: 4, padding: '14px 16px', borderRadius: 12, border: 'none',
              background: T.pink, color: '#fff',
              font: `600 15px/1 ${T.font}`,
              opacity: busy || !configured ? 0.5 : 1,
              cursor: busy || !configured ? 'not-allowed' : 'pointer',
            }}
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <button
            type="button" onClick={onForgot} disabled={busy || !configured}
            style={{
              marginTop: 8, padding: '10px 4px', background: 'transparent',
              border: 'none', color: T.inkSub,
              font: `13px/1.2 ${T.font}`,
              cursor: busy || !configured ? 'not-allowed' : 'pointer',
              textAlign: 'center',
            }}
          >
            Forgot password?
          </button>
        </form>
      </div>
    </div>
  );
}
