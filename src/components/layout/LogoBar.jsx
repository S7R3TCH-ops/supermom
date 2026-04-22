import { useAppTheme } from '../../context/AppThemeContext';

export default function LogoBar() {
  const { mode, toggleMode, privacyOn, togglePrivacy } = useAppTheme();
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
        <button onClick={togglePrivacy} title="Privacy mode" style={{
          width: 28, height: 28, borderRadius: 7,
          background: privacyOn ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)',
          border: '1px solid rgba(255,255,255,0.28)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: 12,
        }}>{privacyOn ? '🙈' : '👁'}</button>
        <button onClick={toggleMode} title="Toggle theme" style={{
          width: 28, height: 28, borderRadius: 7,
          background: 'rgba(255,255,255,0.15)',
          border: '1px solid rgba(255,255,255,0.28)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: 12,
        }}>{mode === 'dark' ? '☀️' : '🌙'}</button>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: 'rgba(255,255,255,0.22)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Fraunces',Georgia,serif", fontSize: 13, fontWeight: 600, color: 'white',
          border: '1.5px solid rgba(255,255,255,0.38)',
        }}>S</div>
      </div>
    </div>
  );
}
