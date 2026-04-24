import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppThemeProvider } from './context/AppTheme';
import { useAppTheme } from './context/AppThemeContext';
import { AuthProvider } from './context/Auth';
import { useAuth } from './context/AuthContext';
import { NewJobSheetProvider } from './context/NewJobSheet';
import { JobDetailSheetProvider } from './context/JobDetailSheet';
import LogoBar from './components/layout/LogoBar';
import BottomNav from './components/layout/BottomNav';
import FAB from './components/ui/FAB';

const Home = lazy(() => import('./pages/Home'));
const Calendar = lazy(() => import('./pages/Calendar'));
const Clients = lazy(() => import('./pages/Clients'));
const ClientProfile = lazy(() => import('./pages/ClientProfile'));
const Finance = lazy(() => import('./pages/Finance'));
const Login = lazy(() => import('./pages/Login'));

function AuthedShell() {
  const { T } = useAppTheme();
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100svh', width: '100%',
      background: T.bg, color: T.ink, overflow: 'hidden',
    }}>
      <LogoBar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        <Suspense fallback={<div style={{ padding: 20, color: T.inkMuted, fontFamily: T.font, fontSize: 13 }}>Loading...</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/clients/:id" element={<ClientProfile />} />
            <Route path="/finance" element={<Finance />} />
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
    <NewJobSheetProvider>
      <JobDetailSheetProvider>
        <AuthedShell />
      </JobDetailSheetProvider>
    </NewJobSheetProvider>
  );
}

export default function App() {
  return (
    <AppThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Gate />
        </AuthProvider>
      </BrowserRouter>
    </AppThemeProvider>
  );
}
