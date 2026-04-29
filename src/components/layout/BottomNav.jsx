import { NavLink } from 'react-router-dom';
import { useAppTheme } from '../../context/AppThemeContext';

const items = [
  { to: '/',         k: 'home',     icon: '⌂', label: 'Home' },
  { to: '/calendar', k: 'schedule', icon: '◫', label: 'Schedule' },
  { to: '/clients',  k: 'clients',  icon: '◉', label: 'Clients' },
  { to: '/finance',  k: 'finance',  icon: '$', label: 'Finance' },
];

export default function BottomNav() {
  const { T } = useAppTheme();
  return (
    <nav style={{
      display: 'flex',
      background: T.navBg,
      borderTop: `1.5px solid ${T.navBorder}`,
      padding: '8px 0 22px',
      flexShrink: 0,
    }}>
      {items.map(({ to, k, icon, label }) => (
        <NavLink
          key={k}
          to={to}
          end={to === '/'}
          aria-label={label}
          style={({ isActive }) => ({
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 3,
            color: isActive ? T.pink : T.inkMuted,
            textDecoration: 'none',
          })}
        >
          {({ isActive }) => (
            <>
              <div aria-hidden="true" style={{ 
                fontSize: 17, 
                lineHeight: 1,
                textShadow: isActive ? '0 0 12px rgba(233,30,106,0.3)' : 'none',
                transition: 'all 0.3s'
              }}>{icon}</div>
              <div style={{
                fontFamily: T.font,
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: '0.3px',
              }}>{label}</div>
              <div style={{
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: T.pink,
                marginTop: -1,
                opacity: isActive ? 1 : 0,
                boxShadow: isActive ? '0 0 8px rgba(233,30,106,0.6)' : 'none',
                transition: 'all 0.3s'
              }} />
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
