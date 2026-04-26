import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppThemeProvider } from './context/AppTheme';
import { useAppTheme } from './context/AppThemeContext';
import { AuthProvider } from './context/Auth';
import { useAuth } from './context/AuthContext';
import { ViewpointProvider, useViewpoint } from './context/ViewpointContext';
import { NewJobSheetProvider } from './context/NewJobSheet';
import { JobDetailSheetProvider } from './context/JobDetailSheet';
import { PostJobSheetProvider } from './context/PostJobSheet';
import { GeofenceProvider } from './context/GeofenceContext';
import LogoBar from './components/layout/LogoBar';
import BottomNav from './components/layout/BottomNav';
import OnboardingWalkthrough from './components/layout/OnboardingWalkthrough';
import FAB from './components/ui/FAB';
import { useRealtimeSync } from './data/useData';
import { useEffect } from 'react';

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
  useRealtimeSync();

  useEffect(() => {
    window.__SUPER_VIEW_ID = viewingAsId;
  }, [viewingAsId]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100svh', width: '100%',
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
        <FAB />
      </div>
      <BottomNav />
    </div>
  );
}

function LoginShell() {
  const { T } = useAppTheme();
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100svh', width: '100%',
      background: T.bg, color: T.ink, overflow: 'hidden',
    }}>
      <LogoBar />
      <Suspense fallback={<div style={{ padding: 20, color: T.inkMuted, fontFamily: T.font, fontSize: 13 }}>Loading...</div>}>
        <Login />
      </Suspense>
    </div>
  );
}

function Gate() {
  const { T } = useAppTheme();
  const { session, loading, configured } = useAuth();

  if (loading) {
    return (
      <div style={{
        height: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: T.bg, color: T.inkSub, font: `14px/1 ${T.font}`,
      }}>Loading…</div>
    );
  }
  if (!session || !configured) return <LoginShell />;
  return (
    <PostJobSheetProvider>
      <NewJobSheetProvider>
        <JobDetailSheetProvider>
          <GeofenceProvider>
            <AuthedShell />
          </GeofenceProvider>
        </JobDetailSheetProvider>
      </NewJobSheetProvider>
    </PostJobSheetProvider>
  );
}

export default function App() {
  return (
    <AppThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <ViewpointProvider>
            <Suspense fallback={null}>
              <Routes>
                <Route path="/i/:id" element={<InvoiceView />} />
                <Route path="*" element={<Gate />} />
              </Routes>
            </Suspense>
          </ViewpointProvider>
        </AuthProvider>
      </BrowserRouter>
    </AppThemeProvider>
  );
}
