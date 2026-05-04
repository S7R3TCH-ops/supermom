import { Component, lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { AppThemeProvider } from './context/AppTheme';
import { useAppTheme } from './context/AppThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/Auth';
import { useAuth } from './context/AuthContext';
import { ViewpointProvider, useViewpoint } from './context/ViewpointContext';
import { NewJobSheetProvider } from './context/NewJobSheet';
import { NewClientSheetProvider } from './context/NewClientSheet';
import { JobDetailSheetProvider } from './context/JobDetailSheet';
import { FinanceDetailSheetProvider } from './context/FinanceDetailSheet';
import { PostJobSheetProvider } from './context/PostJobSheet';
import { GeofenceProvider } from './context/GeofenceContext';
import LogoBar from './components/layout/LogoBar';
import BottomNav from './components/layout/BottomNav';
import OnboardingWalkthrough from './components/layout/OnboardingWalkthrough';
import FAB from './components/ui/FAB';
import { useRealtimeSync } from './data/useData';
import { useLocation } from 'react-router-dom';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px 20px', textAlign: 'center', background: '#04010C', color: '#fff',
          height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center'
        }}>
          <div style={{ fontSize: 40, marginBottom: 20 }}>👩‍🔧</div>
          <h2 style={{ fontFamily: 'serif', fontSize: 24, marginBottom: 10 }}>Ouch! Something went wrong.</h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginBottom: 24 }}>
            The app hit an unexpected glitch. Joel has been notified.
          </p>
          <pre style={{
            background: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 8,
            fontSize: 10, color: '#fca5a5', overflowX: 'auto', textAlign: 'left',
            marginBottom: 24
          }}>
            {this.state.error?.toString()}
          </pre>
          <button
            onClick={() => window.location.href = '/'}
            style={{
              background: '#E91E6A', color: 'white', border: 'none',
              padding: '12px 24px', borderRadius: 12, fontWeight: 700, cursor: 'pointer'
            }}
          >
            Restart Supermom
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const PalettePreview = lazy(() => import('./pages/PalettePreview'));
const Home = lazy(() => import('./pages/Home'));
const Calendar = lazy(() => import('./pages/Calendar'));
const Clients = lazy(() => import('./pages/Clients'));
const ClientProfile = lazy(() => import('./pages/ClientProfile'));
const Finance = lazy(() => import('./pages/Finance'));
const Login = lazy(() => import('./pages/Login'));
const Settings = lazy(() => import('./pages/Settings'));
const Admin = lazy(() => import('./pages/Admin'));
const InvoiceView = lazy(() => import('./pages/InvoiceView'));

function ViewpointBanner() {
  const { viewingAsName, reset } = useViewpoint();
  if (!viewingAsName) return null;
  return (
    <div style={{
      background: '#1a0a0a', color: '#fca5a5', padding: '6px 12px',
      fontSize: 11, fontWeight: 700, display: 'flex', justifyContent: 'space-between',
      alignItems: 'center', borderBottom: '1px solid #7f1d1d', zIndex: 1100
    }}>
      <span>✦ VIEWING AS: {viewingAsName.toUpperCase()}</span>
      <button onClick={reset} style={{
        background: '#7f1d1d', color: 'white', border: 'none',
        padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 800, cursor: 'pointer'
      }}>RESET</button>
    </div>
  );
}

function AuthedShell() {
  const { T } = useAppTheme();
  const { viewingAsId } = useViewpoint();
  const location = useLocation();
  useRealtimeSync();

  useEffect(() => {
    window.__SUPER_VIEW_ID = viewingAsId;
  }, [viewingAsId]);

  const hideFAB = ['/settings', '/admin'].includes(location.pathname);

  return (
    <ErrorBoundary>
      <div style={{
        display: 'flex', flexDirection: 'column',
        height: '100dvh', width: '100%',
        background: T.bg, color: T.ink, overflow: 'hidden',
      }}>
        <ViewpointBanner />
        <OnboardingWalkthrough />
        <LogoBar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
          <Suspense fallback={<div style={{ padding: 20, color: T.inkMuted, fontFamily: T.font, fontSize: 13 }}>Loading...</div>}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/clients/:id" element={<ClientProfile />} />
              <Route path="/finance" element={<Finance />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/admin" element={<Admin />} />
            </Routes>
          </Suspense>
          {!hideFAB && <FAB />}
        </div>
        <BottomNav />
      </div>
    </ErrorBoundary>
  );
}

function LoginShell() {
  const { T } = useAppTheme();
  return (
    <ErrorBoundary>
      <div style={{
        display: 'flex', flexDirection: 'column',
        height: '100dvh', width: '100%',
        background: T.bg, color: T.ink, overflow: 'hidden',
      }}>
        <LogoBar />
        <Suspense fallback={<div style={{ padding: 20, color: T.inkMuted, fontFamily: T.font, fontSize: 13 }}>Loading...</div>}>
          <Login />
        </Suspense>
      </div>
    </ErrorBoundary>
  );
}

function SetNewPasswordShell() {
  const { T } = useAppTheme();
  const { clearRecoveryMode } = useAuth();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr('');
    if (pw.length < 8) { setErr('Password must be at least 8 characters.'); return; }
    if (pw !== pw2) { setErr('Passwords do not match.'); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setDone(true);
    setTimeout(() => clearRecoveryMode(), 1500);
  }

  const inputStyle = {
    width: '100%', padding: '12px 14px', borderRadius: 12,
    border: `1px solid ${T.cardBorder}`, background: T.card, color: T.ink,
    font: `15px/1.3 ${T.font}`, outline: 'none',
  };

  const ToggleBtn = ({ show, onToggle }) => (
    <button
      type="button"
      onClick={onToggle}
      style={{
        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
        background: 'transparent', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 4, color: T.inkMuted,
      }}
    >
      {show ? (
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
  );

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100dvh', width: '100%',
      background: T.bg, color: T.ink, overflow: 'hidden',
    }}>
      <LogoBar />
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '24px',
      }}>
        <div style={{ maxWidth: 360, width: '100%', margin: '0 auto' }}>
          <h1 style={{ font: `600 28px/1.1 ${T.serif}`, color: T.ink, margin: '0 0 6px' }}>
            Set new password
          </h1>
          <p style={{ font: `14px/1.4 ${T.font}`, color: T.inkSub, margin: '0 0 24px' }}>
            Choose a new password for your account.
          </p>
          {done ? (
            <div style={{
              padding: 14, borderRadius: 10,
              background: T.card, border: `1px solid ${T.cardBorder}`,
              font: `14px/1.4 ${T.font}`, color: T.ink, textAlign: 'center',
            }}>
              Password updated! Signing you in…
            </div>
          ) : (
            <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ font: `12px/1 ${T.font}`, color: T.secLabel, letterSpacing: 0.5 }}>
                NEW PASSWORD
                <div style={{ position: 'relative', marginTop: 6 }}>
                  <input
                    type={showPw ? "text" : "password"} required autoComplete="new-password"
                    value={pw} onChange={e => setPw(e.target.value)}
                    style={{ ...inputStyle, paddingRight: 40 }}
                  />
                  <ToggleBtn show={showPw} onToggle={() => setShowPw(!showPw)} />
                </div>
              </label>
              <label style={{ font: `12px/1 ${T.font}`, color: T.secLabel, letterSpacing: 0.5 }}>
                CONFIRM PASSWORD
                <div style={{ position: 'relative', marginTop: 6 }}>
                  <input
                    type={showPw2 ? "text" : "password"} required autoComplete="new-password"
                    value={pw2} onChange={e => setPw2(e.target.value)}
                    style={{ ...inputStyle, paddingRight: 40 }}
                  />
                  <ToggleBtn show={showPw2} onToggle={() => setShowPw2(!showPw2)} />
                </div>
              </label>
              {err && (
                <div role="alert" style={{
                  padding: 10, borderRadius: 8,
                  background: T.redBg, border: `1px solid ${T.redBorder}`,
                  font: `13px/1.3 ${T.font}`, color: T.ink,
                }}>{err}</div>
              )}
              <button
                type="submit" disabled={busy}
                style={{
                  marginTop: 4, padding: '14px 16px', borderRadius: 12, border: 'none',
                  background: T.pink, color: '#fff',
                  font: `600 15px/1 ${T.font}`,
                  opacity: busy ? 0.5 : 1,
                  cursor: busy ? 'not-allowed' : 'pointer',
                }}
              >
                {busy ? 'Saving…' : 'Set password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function Gate() {
  const { T } = useAppTheme();
  const { session, loading, configured, recoveryMode } = useAuth();

  if (loading) {
    return (
      <div style={{
        height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: T.bg, color: T.inkSub, font: `14px/1 ${T.font}`,
      }}>Loading…</div>
    );
  }
  if (recoveryMode) return <SetNewPasswordShell />;
  if (!session || !configured) return <LoginShell />;
  return (
    <PostJobSheetProvider>
      <NewJobSheetProvider>
        <NewClientSheetProvider>
          <JobDetailSheetProvider>
            <FinanceDetailSheetProvider>
              <GeofenceProvider>
                <AuthedShell />
              </GeofenceProvider>
            </FinanceDetailSheetProvider>
          </JobDetailSheetProvider>
        </NewClientSheetProvider>
      </NewJobSheetProvider>
    </PostJobSheetProvider>
  );
}

export default function App() {
  return (
    <AppThemeProvider>
      <ToastProvider>
      <BrowserRouter>
        <AuthProvider>
          <ViewpointProvider>
            <Suspense fallback={null}>
              <Routes>
                <Route path="/i/:id" element={<InvoiceView />} />
                <Route path="/preview" element={<PalettePreview />} />
                <Route path="*" element={<Gate />} />
              </Routes>
            </Suspense>
          </ViewpointProvider>
        </AuthProvider>
      </BrowserRouter>
      </ToastProvider>
    </AppThemeProvider>
  );
}
