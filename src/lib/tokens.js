/**
 * Supermom V2 Theme System
 * 
 * To change a palette, simply update the values in LIGHT_PALETTE or DARK_PALETTE.
 * The smTokens function maps these palettes to the semantic names used across the app.
 */

const LIGHT_PALETTE = {
  name: 'Vibrant Papaya',
  bg: '#FFF0F3',          // Soft Rose Cream (Pinker hue)
  surface: '#FCF5EF',     // Soft Sand
  card: '#FFFFFF',
  cardBorder: '#FCE8EF',  // Soft Pink Border
  navBg: '#FFF0F3',
  navBorder: '#FCE8EF',
  pink: '#E91E6A',        // Punchy Pink
  pinkLight: '#FF94BC',
  pinkLabel: '#E91E6A',
  pinkGlow: 'rgba(233,30,106,0.15)',
  pinkTint: '#FFF0F7',
  amberBg: '#FEF3C7',
  amberBorder: 'rgba(245,158,11,0.4)',
  redBg: '#FFF1F1',
  redBorder: '#FCA5A540',
  ink: '#4E342E',         // Warm Cocoa
  inkSub: '#795548',      // Soft Brown
  inkMuted: '#836459',    // Muted Clay — #836459 achieves ~4.9:1 on #FFF0F3 (WCAG AA pass)
  secLabel: '#8D6E63',
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
  redBg: 'rgba(220,38,38,0.08)',
  redBorder: 'rgba(220,38,38,0.22)',
  ink: '#FFFFFF',         // White Ink
  inkSub: 'rgba(255,255,255,0.65)',
  inkMuted: 'rgba(255,255,255,0.55)',
  secLabel: 'rgba(255,112,166,0.85)',
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
