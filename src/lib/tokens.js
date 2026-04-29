/**
 * Supermom V2 Theme System
 * 
 * To change a palette, simply update the values in LIGHT_PALETTE or DARK_PALETTE.
 * The smTokens function maps these palettes to the semantic names used across the app.
 */

const LIGHT_PALETTE = {
  name: 'Vibrant Papaya',
  bg: '#FFF9F5',          // Warm Cream
  surface: '#FDF6F0',     // Softer surface
  card: '#FFFFFF',
  cardBorder: '#FFD6E8',  // Refined border
  navBg: '#FFF9F5',
  navBorder: '#FFD6E8',
  pink: '#FF70A6',        // Vibrant Papaya Pink
  pinkLight: '#FF94BC',
  pinkLabel: '#FF78B0',
  pinkGlow: 'rgba(255,112,166,0.2)',
  pinkTint: '#FFF0F7',
  amberBg: '#FEF3C7',
  amberBorder: 'rgba(245,158,11,0.4)',
  redBg: '#FFF1F1',
  redBorder: '#FCA5A540',
  ink: '#1C1C1E',         // Dark Ink
  inkSub: '#4A4A4A',
  inkMuted: '#8A8A8E',
  secLabel: '#8A8A8E',
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
    // Shared structural/style tokens that don't change per theme
    hero: 'linear-gradient(145deg,#1C1C1E 0%,#2C2C2E 100%)',
    font: "'Inter', system-ui, sans-serif",
    serif: "'Fraunces', Georgia, serif",
  };
}
