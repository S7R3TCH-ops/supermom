import { useNavigate, useLocation } from 'react-router-dom';
import { useAppTheme } from '../../context/AppThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useViewpoint } from '../../context/ViewpointContext';
import { useBusiness } from '../../data/useData';

export default function LogoBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { T, mode, toggleMode, privacyOn, togglePrivacy } = useAppTheme();
  const { user } = useAuth();
  const { business } = useBusiness();
  const { isSuperAdmin } = useViewpoint();

  const onAvatarClick = () => {
    if (user) {
      if (isSuperAdmin) navigate('/admin');
      else navigate('/settings');
    }
  };

  const displayName = business?.owner_name || user?.email || 'User';
  const initial = displayName.charAt(0).toUpperCase();

  const topLevelRoutes = ['/', '/calendar', '/clients', '/finance', '/admin'];
  const isTopLevel = topLevelRoutes.includes(location.pathname) || location.pathname.startsWith('/login');

  return (
    <div style={{
      background: mode === 'dark' 
        ? '#0A0A0A' 
        : `linear-gradient(to bottom, ${T.pink} 0%, ${T.pinkLight} 100%)`,
      padding: '10px 18px 12px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexShrink: 0, minHeight: 64,
      borderBottom: mode === 'dark' ? `1px solid ${T.navBorder}` : 'none'
    }}>
      {isTopLevel ? (
        <img
          src="/branding/logo-final.png"
          alt="Supermom for Hire"
          style={{ 
            height: 72, 
            width: 'auto',
            filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.2))',
            margin: '-10px 0', // Pull up/down to exceed standard padding slightly if needed
          }}
        />
      ) : (
        <button onClick={() => navigate(-1)} style={{ 
          background: 'none', border: 'none', color: 'white', 
          display: 'flex', alignItems: 'center', gap: 4, 
          fontFamily: T.font, fontSize: 15, fontWeight: 600, 
          cursor: 'pointer', padding: '4px 8px 4px 0' 
        }}>
          <span style={{ fontSize: 20, lineHeight: 1, marginTop: -2 }}>‹</span> Back
        </button>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <button
          role="switch"
          aria-checked={mode === 'dark'}
          aria-label="Toggle Theme"
          onClick={toggleMode}
          title="Toggle Light/Dark Mode"
          style={{
            width: 38, height: 22, borderRadius: 11, 
            border: '1px solid rgba(255,255,255,0.28)',
            background: mode === 'dark' ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.15)',
            position: 'relative', transition: 'background 0.2s', cursor: 'pointer',
            padding: 0, flexShrink: 0, outline: 'none'
          }}
        >
          <span style={{
            position: 'absolute', top: 1, left: mode === 'dark' ? 17 : 1,
            width: 18, height: 18, borderRadius: '50%', background: 'white',
            transition: 'left 0.2s cubic-bezier(0.4, 0.0, 0.2, 1)', 
            boxShadow: '0 1px 4px rgba(0,0,0,0.3)', display: 'block'
          }} />
        </button>

        <button
          onClick={togglePrivacy}
          aria-label={privacyOn ? 'Privacy mode on — tap to show info' : 'Privacy mode off — tap to hide info'}
          aria-pressed={privacyOn}
          title="Privacy mode"
          style={{
            width: 28, height: 28, borderRadius: 7,
            background: privacyOn ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.28)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 12,
          }}>{privacyOn ? '🙈' : '👁'}</button>
        <button
          onClick={onAvatarClick}
          aria-label="Settings"
          title={user ? `Settings (${user.email})` : 'Settings'}
          style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'rgba(255,255,255,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Fraunces',Georgia,serif", fontSize: 13, fontWeight: 600, color: 'white',
            border: '1.5px solid rgba(255,255,255,0.38)',
            cursor: user ? 'pointer' : 'default', padding: 0,
          }}>{initial}</button>
      </div>
    </div>
  );
}
