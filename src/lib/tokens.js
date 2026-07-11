/**
 * Supermom V2 Theme System
 * 
 * To change a palette, simply update the values in LIGHT_PALETTE or DARK_PALETTE.
 * The smTokens function maps these palettes to the semantic names used across the app.
 */

const LIGHT_PALETTE = {
  name: 'Brand Rose',
  bg: '#FFEFF4',          // Sandra's official light pink background
  surface: '#FFF5F8',     // Soft white-pink surface
  card: '#FFFFFF',
  cardBorder: '#FFD9EC',  // Soft pink border
  navBg: '#FFEFF4',
  navBorder: '#FFD9EC',
  pink: '#FC4693',        // Sandra's official brand pink
  pinkLight: '#FFA8CC',
  pinkLabel: '#FC4693',
  pinkGlow: 'rgba(252,70,147,0.15)',
  pinkTint: '#FFF0F7',
  amberBg: '#FEF3C7',
  amberBorder: 'rgba(245,158,11,0.4)',
  amberFg: '#92400E',
  redBg: '#FFF1F1',
  redBorder: '#FCA5A540',
  errorFg: '#991B1B',
  greenBg: '#DCFCE7',
  greenFg: '#14532D',
  ink: '#2D2D2D',         // Neutral near-black
  inkSub: '#606060',      // Sandra's official gray
  inkMuted: '#8A8A8A',    // Neutral muted gray — passes WCAG AA for large/UI text
  secLabel: '#888888',
  status: {
    scheduled: { border: '#1E40AF', bg: '#EFF6FF', pill: '#BFDBFE', text: '#1E3A8A' },
    attention:  { border: '#A16207', bg: '#FEFCE8', pill: '#FEF08A', text: '#713F12' },
    unpaid:     { border: '#BE123C', bg: '#BE123C', pill: '#FECDD3', text: '#9F1239', fg: '#FFFFFF' },
    overdue:    { border: '#991B1B', bg: '#991B1B', pill: '#FCA5A5', text: '#7F1D1D', fg: '#FFFFFF' },
    partial:    { border: '#9A3412', bg: '#9A3412', pill: '#FDBA74', text: '#7C2D12', fg: '#FFFFFF' },
    paid:       { border: '#15803D', bg: '#F0FDF4', pill: '#86EFAC', text: '#14532D' },
  },
};

const DARK_PALETTE = {
  name: 'Deep Midnight',
  bg: '#0A0A0A',          // Pure Black
  surface: '#1C1C1E',     // Dark Gray
  card: '#2C2C2E',
  cardBorder: 'rgba(255,112,166,0.2)',
  navBg: '#0A0A0A',
  navBorder: 'rgba(255,112,166,0.2)',
  pink: '#FF70A6',        // Shared Vibrant Pink
  pinkLight: '#FF94BC',
  pinkLabel: '#FF78B0',
  pinkGlow: 'rgba(255,112,166,0.2)',
  pinkTint: 'rgba(255,112,166,0.1)',
  amberBg: 'rgba(245,158,11,0.1)',
  amberBorder: 'rgba(245,158,11,0.28)',
  amberFg: '#FBBF24',
  redBg: 'rgba(220,38,38,0.08)',
  redBorder: 'rgba(220,38,38,0.22)',
  errorFg: '#EF4444',
  greenBg: 'rgba(34,197,94,0.12)',
  greenFg: '#4ADE80',
  ink: '#FFFFFF',         // White Ink
  inkSub: 'rgba(255,255,255,0.65)',
  inkMuted: 'rgba(255,255,255,0.55)',
  secLabel: 'rgba(255,112,166,0.85)',
  status: {
    scheduled: { border: '#3B82F6', bg: 'rgba(59,130,246,0.12)',  pill: 'rgba(59,130,246,0.25)',  text: '#93C5FD' },
    attention:  { border: '#D97706', bg: 'rgba(217,119,6,0.15)',   pill: 'rgba(217,119,6,0.25)',   text: '#FCD34D' },
    unpaid:     { border: '#F43F5E', bg: '#9F1239',  pill: 'rgba(244,63,94,0.25)',   text: '#FDA4AF', fg: '#FFFFFF' },
    overdue:    { border: '#EF4444', bg: '#7F1D1D',  pill: 'rgba(239,68,68,0.30)',   text: '#FCA5A5', fg: '#FFFFFF' },
    partial:    { border: '#F97316', bg: '#7C2D12',  pill: 'rgba(249,115,22,0.25)',  text: '#FDBA74', fg: '#FFFFFF' },
    paid:       { border: '#22C55E', bg: 'rgba(34,197,94,0.10)',   pill: 'rgba(34,197,94,0.22)',   text: '#4ADE80' },
  },
};

export function smTokens(mode) {
  const isDark = mode !== 'warm';
  const p = isDark ? DARK_PALETTE : LIGHT_PALETTE;

  return {
    ...p,
    // Shared structural/style tokens that adapt to mode
    hero: isDark 
      ? 'linear-gradient(145deg,#1C1C1E 0%,#2C2C2E 100%)' 
      : `linear-gradient(to bottom, ${p.pinkLight} 0%, ${p.bg} 100%)`, // Seamless transition from LogoBar
    font: "'Inter', system-ui, sans-serif",
    serif: "'Fraunces', Georgia, serif",
  };
}
