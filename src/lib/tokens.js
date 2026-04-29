export function smTokens(mode) {
  const dk = mode !== 'warm';
  return {
    bg:          dk ? '#0A0A0A' : '#FAF3F6',
    surface:     dk ? '#1C1C1E' : '#F3E5EE',
    card:        dk ? '#2C2C2E' : '#FFFFFF',
    cardBorder:  dk ? 'rgba(233,30,106,0.2)' : '#FFD6E8',
    hero:        'linear-gradient(145deg,#1C1C1E 0%,#2C2C2E 100%)',
    navBg:       dk ? '#0A0A0A' : '#FFF5F9',
    navBorder:   dk ? 'rgba(233,30,106,0.2)' : '#FFD6E8',
    pink:        '#E91E6A',
    pinkLight:   '#FF5A9D',
    pinkLabel:   '#FF78B0',
    pinkGlow:    'rgba(233,30,106,0.2)',
    pinkTint:    dk ? 'rgba(233,30,106,0.1)' : '#FFF0F7',
    amberBg:     dk ? 'rgba(245,158,11,0.1)' : '#FEF3C7',
    amberBorder: dk ? 'rgba(245,158,11,0.28)' : 'rgba(245,158,11,0.4)',
    redBg:       dk ? 'rgba(220,38,38,0.08)' : '#FFF1F1',
    redBorder:   dk ? 'rgba(220,38,38,0.22)' : '#FCA5A540',
    ink:         dk ? '#FFFFFF'                : '#1C1C1E',
    inkSub:      dk ? 'rgba(255,255,255,0.65)' : '#4A4A4A',
    inkMuted:    dk ? 'rgba(255,255,255,0.55)' : '#8A8A8E',
    secLabel:    dk ? 'rgba(255,120,176,0.85)' : '#8A8A8E',
    font:        "'Inter', system-ui, sans-serif",
    serif:       "'Fraunces', Georgia, serif",
  };
}
