import { NavLink } from 'react-router-dom';
import { useAppTheme } from '../../context/AppThemeContext';
import { triggerHaptic } from '../../lib/haptics';

const items = [
  { to: '/',         k: 'home',     icon: '⌂', label: 'Week' },
  { to: '/calendar', k: 'schedule', icon: '◫', label: 'Schedule' },
  { to: '/search',   k: 'search',   center: true },
  { to: '/clients',  k: 'clients',  icon: '◉', label: 'Clients' },
  { to: '/finance',  k: 'finance',  icon: '$', label: 'Finance' },
];

export default function BottomNav() {
  const { T, mode } = useAppTheme();
  return (
    <nav style={{
      display: 'flex',
      background: T.navBg,
      borderTop: `1.5px solid ${T.navBorder}`,
      padding: '8px 0',
      paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)',
      flexShrink: 0,
      overflow: 'visible',
      position: 'relative',
    }}>
      {items.map(({ to, k, icon, label, center }) => (
        <NavLink
          key={k}
          to={to}
          end={to === '/'}
          onClick={() => triggerHaptic('light')}
          aria-label={label || 'Search'}
          style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', textDecoration: 'none' }}
        >
          {({ isActive }) => center ? (
            <div style={{
              width: 46,
              height: 46,
              borderRadius: '50%',
              background: isActive ? '#B5004E' : T.pink,
              border: `3px solid ${mode === 'dark' ? '#0A0A0A' : T.navBg}`,
              boxShadow: '0 4px 16px rgba(233,30,106,0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: 'translateY(-14px)',
              flexShrink: 0,
            }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="7.5" cy="7.5" r="5.5" stroke="white" strokeWidth="2" />
                <path d="M11.5 11.5L15 15" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
          ) : (
            <>
              <div aria-hidden="true" style={{
                fontSize: 17,
                lineHeight: 1,
                color: isActive ? T.pink : T.inkMuted,
                textShadow: isActive ? '0 0 12px rgba(233,30,106,0.3)' : 'none',
                transition: 'all 0.3s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
              }}>
                <span>{icon}</span>
                <span style={{
                  fontFamily: T.font,
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: '0.3px',
                  color: isActive ? T.pink : T.inkMuted,
                }}>{label}</span>
                <div style={{
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  background: T.pink,
                  opacity: isActive ? 1 : 0,
                  boxShadow: isActive ? '0 0 8px rgba(233,30,106,0.6)' : 'none',
                  transition: 'all 0.3s',
                }} />
              </div>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
