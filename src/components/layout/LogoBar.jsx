import { useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppTheme } from '../../context/AppThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useViewpoint } from '../../context/ViewpointContext';
import { useBusiness } from '../../data/useData';
import { AiChatSheetContext } from '../../context/AiChatSheetContext';

export default function LogoBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { T, mode, privacyOn, togglePrivacy } = useAppTheme();
  const { user, profile } = useAuth();
  const { business } = useBusiness();
  const { isSuperAdmin } = useViewpoint();
  const aiChat = useContext(AiChatSheetContext);

  const onAvatarClick = () => {
    if (user) {
      if (isSuperAdmin || profile?.role === 'owner') navigate('/admin');
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
          src="/branding/logo-banner.png"
          alt="Supermom for Hire"
          onClick={() => navigate('/')}
          style={{
            height: 72,
            width: 'auto',
            filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.2))',
            margin: '-10px 0',
            cursor: 'pointer',
          }}
        />
      ) : (
        <button onClick={() => navigate('/')} style={{
          background: 'none', border: 'none', color: 'white', 
          display: 'flex', alignItems: 'center', gap: 4, 
          fontFamily: T.font, fontSize: 15, fontWeight: 600, 
          cursor: 'pointer', padding: '4px 8px 4px 0' 
        }}>
          <span style={{ fontSize: 20, lineHeight: 1, marginTop: -2 }}>‹</span> Back
        </button>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        {aiChat && (
          <button
            type="button"
            onClick={() => aiChat.openChat()}
            aria-label="Open AI assistant"
            title="AI assistant"
            style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.28)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 13, color: 'white',
              fontFamily: "'Inter',sans-serif", fontWeight: 700,
            }}
          >
            ✦
          </button>
        )}
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
            width: 34, height: 34, borderRadius: '50%',
            background: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Fraunces',Georgia,serif", fontSize: 15, fontWeight: 700, color: '#FC4693',
            border: 'none',
            boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
            cursor: user ? 'pointer' : 'default', padding: 0, flexShrink: 0,
          }}>{initial}</button>
      </div>
    </div>
  );
}
