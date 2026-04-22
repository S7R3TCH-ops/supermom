export function smTokens(mode) {
  const dk = mode !== 'warm';
  return {
    bg:          dk ? '#06020E' : '#FAF3F6',
    surface:     dk ? '#110720' : '#F3E5EE',
    card:        dk ? '#1A0A2E' : '#FFFFFF',
    cardBorder:  dk ? 'rgba(233,30,106,0.2)' : '#FFD6E8',
    hero:        'linear-gradient(145deg,#0E0520 0%,#1C0830 100%)',
    navBg:       dk ? '#0E0520' : '#FFF5F9',
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
    ink:         dk ? '#FFFFFF'                : '#1A0A12',
    inkSub:      dk ? 'rgba(255,255,255,0.65)' : '#5A3040',
    inkMuted:    dk ? 'rgba(255,255,255,0.36)' : '#9B5A70',
    secLabel:    dk ? 'rgba(255,120,176,0.6)'  : '#9B5A70',
    font:        "'Inter', system-ui, sans-serif",
    serif:       "'Fraunces', Georgia, serif",
  };
}
