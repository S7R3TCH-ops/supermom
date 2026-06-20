import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAppTheme } from '../../context/AppThemeContext';
import { useNewJobSheet } from '../../context/NewJobSheetContext';
import { useNewClientSheet } from '../../context/NewClientSheetContext';
import { triggerHaptic } from '../../lib/haptics';

const NAV_ITEMS = [
  { to: '/',         k: 'home',     icon: '⌂', label: 'Week' },
  { to: '/calendar', k: 'schedule', icon: '◫', label: 'Schedule' },
  { to: '/clients',  k: 'clients',  icon: '◉', label: 'Clients' },
  { to: '/finance',  k: 'finance',  icon: '$',  label: 'Finance' },
];

export default function BottomNav() {
  const { T, mode } = useAppTheme();
  const { openBlank } = useNewJobSheet();
  const { open: openNewClient } = useNewClientSheet();
  const location = useLocation();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  const onClientsPage = location.pathname.startsWith('/clients');

  const options = onClientsPage
    ? [
        { label: '+ New Client', action: () => openNewClient() },
        { label: '+ New Job',    action: () => openBlank() },
        { label: '🔍 Search',    action: () => navigate('/search') },
      ]
    : [
        { label: '+ New Job',    action: () => openBlank() },
        { label: '+ New Client', action: () => openNewClient() },
        { label: '🔍 Search',    action: () => navigate('/search') },
      ];

  const handleOptionTap = (action) => {
    triggerHaptic('light');
    setExpanded(false);
    action();
  };

  const handleCenterTap = () => {
    triggerHaptic('light');
    setExpanded(prev => !prev);
  };

  // Left 2 items, right 2 items, center = + button
  const leftItems  = NAV_ITEMS.slice(0, 2);
  const rightItems = NAV_ITEMS.slice(2);

  return (
    <>
      {expanded && (
        <div
          onClick={() => setExpanded(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 29 }}
        />
      )}

      {/* Options popup — rises from center above nav */}
      <div style={{
        position: 'fixed',
        bottom: 70,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 30,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        pointerEvents: expanded ? 'auto' : 'none',
      }}>
        {options.map((opt, i) => (
          <button
            key={opt.label}
            onClick={() => handleOptionTap(opt.action)}
            style={{
              padding: '11px 22px',
              borderRadius: 24,
              background: i === 0 ? T.pink : T.card,
              color: i === 0 ? 'white' : T.ink,
              border: i === 0 ? 'none' : `1.5px solid ${T.cardBorder}`,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: i === 0
                ? '0 4px 14px rgba(233,30,106,0.35)'
                : '0 2px 8px rgba(0,0,0,0.12)',
              whiteSpace: 'nowrap',
              opacity: expanded ? 1 : 0,
              transform: expanded
                ? 'translateY(0) scale(1)'
                : `translateY(${(options.length - i) * 14}px) scale(0.88)`,
              transition: `opacity 0.18s ease ${i * 0.04}s, transform 0.18s ease ${i * 0.04}s`,
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <nav style={{
        display: 'flex',
        background: T.navBg,
        borderTop: `1.5px solid ${T.navBorder}`,
        padding: '8px 0',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)',
        flexShrink: 0,
        overflow: 'visible',
        position: 'relative',
        zIndex: 20,
      }}>
        {/* Left 2 tabs */}
        {leftItems.map(({ to, k, icon, label }) => (
          <NavLink
            key={k}
            to={to}
            end={to === '/'}
            onClick={() => triggerHaptic('light')}
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
                  transition: 'all 0.3s',
                }}>{icon}</div>
                <div style={{
                  fontFamily: T.font,
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: '0.3px',
                }}>{label}</div>
                <div style={{
                  width: 4, height: 4, borderRadius: '50%',
                  background: T.pink,
                  marginTop: -1,
                  opacity: isActive ? 1 : 0,
                  boxShadow: isActive ? '0 0 8px rgba(233,30,106,0.6)' : 'none',
                  transition: 'all 0.3s',
                }} />
              </>
            )}
          </NavLink>
        ))}

        {/* Center + button */}
        <button
          onClick={handleCenterTap}
          aria-label={expanded ? 'Close menu' : 'Add or search'}
          style={{
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            position: 'relative',
          }}
        >
          <div style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: expanded ? '#B5004E' : T.pink,
            border: `3px solid ${mode === 'dark' ? '#0A0A0A' : T.navBg}`,
            boxShadow: '0 4px 18px rgba(233,30,106,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: 'translateY(-14px)',
            transition: 'background 0.2s',
          }}>
            <svg
              width="20" height="20" viewBox="0 0 22 22" fill="none"
              style={{ transition: 'transform 0.2s ease', transform: expanded ? 'rotate(45deg)' : 'none' }}
            >
              <path d="M11 3v16M3 11h16" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
        </button>

        {/* Right 2 tabs */}
        {rightItems.map(({ to, k, icon, label }) => (
          <NavLink
            key={k}
            to={to}
            end={to === '/'}
            onClick={() => triggerHaptic('light')}
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
                  transition: 'all 0.3s',
                }}>{icon}</div>
                <div style={{
                  fontFamily: T.font,
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: '0.3px',
                }}>{label}</div>
                <div style={{
                  width: 4, height: 4, borderRadius: '50%',
                  background: T.pink,
                  marginTop: -1,
                  opacity: isActive ? 1 : 0,
                  boxShadow: isActive ? '0 0 8px rgba(233,30,106,0.6)' : 'none',
                  transition: 'all 0.3s',
                }} />
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
