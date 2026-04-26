import { useNavigate } from 'react-router-dom';
import { useAppTheme } from '../../context/AppThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useViewpoint } from '../../context/ViewpointContext';

export default function LogoBar() {
  const navigate = useNavigate();
  const { mode, toggleMode, privacyOn, togglePrivacy } = useAppTheme();
  const { user } = useAuth();
  const { isSuperAdmin } = useViewpoint();

  const onAvatarClick = () => {
    if (user) {
      if (isSuperAdmin) navigate('/admin');
      else navigate('/settings');
    }
  };
  const initial = (user?.email || 'S').charAt(0).toUpperCase();
  return (
    <div style={{
      background: 'linear-gradient(110deg,#FF4D96 0%,#E91E6A 45%,#B01550 100%)',
      padding: '6px 14px 7px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexShrink: 0, minHeight: 46,
    }}>
      <img
        src="/branding/logo-final.png"
        alt="Supermom for Hire"
        style={{ height: 30, objectFit: 'contain', objectPosition: 'left center' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
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
          onClick={toggleMode}
          aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title="Toggle theme"
          style={{
            width: 28, height: 28, borderRadius: 7,
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.28)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 12,
          }}>{mode === 'dark' ? '☀️' : '🌙'}</button>
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
