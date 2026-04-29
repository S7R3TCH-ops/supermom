const FONT = "'Inter', system-ui, sans-serif";
const SERIF = "'Fraunces', Georgia, serif";
const PINK = '#E91E6A';
const PINK_LIGHT = '#FF5A9D';
const PINK_MID = '#B01550';
const PINK_BORDER = '#FFD6E8';
const PINK_TINT = '#FFF0F7';
const GREEN = '#16A34A';
const GREEN_LIGHT = '#DCFCE7';
const AMBER = '#F59E0B';
const AMBER_LIGHT = '#FEF3C7';

const OPTIONS = {
  a: {
    label: 'Warm & Bold',
    tagline: 'Dark headers, warm undertone',
    bg: '#F5EEE6',
    surface: '#EDE5DA',
    card: '#FDFAF6',
    navBg: '#F5EEE6',
    cardBorder: PINK_BORDER,
    hero: 'linear-gradient(145deg, #1E1912 0%, #2A241A 100%)',
    heroInk: '#FFFFFF',
    heroSubInk: 'rgba(255,255,255,0.7)',
    heroLabelInk: '#FF78B0',
    heroStatBg: 'rgba(255,255,255,0.06)',
    heroStatBorder: 'rgba(255,255,255,0.09)',
    glow: 'rgba(233,30,106,0.22)',
    ink: '#1C1C1E',
    inkSub: '#4A4A4A',
    inkMuted: '#8A8A8E',
  },
  b: {
    label: 'Soft & Bright',
    tagline: 'Light headers, brand beige',
    bg: '#F5EEE6',
    surface: '#EDE5DA',
    card: '#FDFAF6',
    navBg: '#F5EEE6',
    cardBorder: PINK_BORDER,
    hero: 'linear-gradient(145deg, #EDE5DA 0%, #E5DDD0 100%)',
    heroInk: '#1C1C1E',
    heroSubInk: '#4A4A4A',
    heroLabelInk: PINK,
    heroStatBg: 'rgba(233,30,106,0.06)',
    heroStatBorder: 'rgba(233,30,106,0.14)',
    glow: 'rgba(233,30,106,0.12)',
    ink: '#1C1C1E',
    inkSub: '#4A4A4A',
    inkMuted: '#8A8A8E',
  },
};

function LogoBarMock() {
  return (
    <div style={{
      background: `linear-gradient(110deg, #FF4D96 0%, ${PINK} 45%, ${PINK_MID} 100%)`,
      padding: '9px 14px 10px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <img src="/branding/logo-final.png" alt="Supermom for Hire" height="26" style={{ objectFit: 'contain' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 28, height: 16, borderRadius: 100,
          background: 'rgba(255,255,255,0.25)',
          position: 'relative', display: 'flex', alignItems: 'center', padding: '0 2px',
        }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'white', marginLeft: 'auto' }} />
        </div>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: 'white', fontFamily: FONT,
        }}>S</div>
      </div>
    </div>
  );
}

function HeroMock({ p }) {
  return (
    <div style={{
      background: p.hero,
      borderBottom: `3px solid ${PINK}`,
      padding: '14px 15px 16px',
      position: 'relative', overflow: 'hidden', flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute', top: -50, right: -30,
        width: 160, height: 160, borderRadius: '50%',
        background: `radial-gradient(circle, ${p.glow} 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <div style={{ position: 'relative' }}>
        <div style={{ fontFamily: FONT, fontSize: 10, fontWeight: 700, letterSpacing: '0.7px', color: p.heroLabelInk, marginBottom: 3, textTransform: 'uppercase' }}>
          Tuesday, April 29
        </div>
        <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 500, color: p.heroInk, letterSpacing: '-0.4px', lineHeight: 1.2, marginBottom: 2 }}>
          Good morning, Sandra
        </div>
        <div style={{ fontFamily: FONT, fontSize: 11, color: p.heroSubInk, marginBottom: 14 }}>
          3 missions on deck today. Let's go!
        </div>
        <div style={{ height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 2, marginBottom: 14, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: '66%', background: PINK, borderRadius: 2 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {[{ l: "Today's Jobs", v: '3' }, { l: 'Hours', v: '6h' }, { l: 'Revenue', v: '$240' }].map(s => (
            <div key={s.l} style={{
              background: p.heroStatBg, border: `1px solid ${p.heroStatBorder}`,
              borderRadius: 9, padding: '6px 4px', textAlign: 'center',
            }}>
              <div style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 500, color: p.heroInk, letterSpacing: '-0.3px' }}>{s.v}</div>
              <div style={{ fontFamily: FONT, fontSize: 9, color: p.heroSubInk, marginTop: 1 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function JobCardMock({ p }) {
  return (
    <div style={{ padding: '12px 12px 0' }}>
      <div style={{ fontFamily: FONT, fontSize: 9, fontWeight: 700, letterSpacing: '0.7px', color: p.inkMuted, textTransform: 'uppercase', marginBottom: 8 }}>
        Next Up
      </div>
      <div style={{
        background: p.card, border: `1.5px solid ${p.cardBorder}`,
        borderRadius: 12, overflow: 'hidden', marginBottom: 8,
        boxShadow: '0 2px 8px rgba(233,30,106,0.07)',
      }}>
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          <div style={{
            width: 58, flexShrink: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: PINK_TINT, padding: '10px 0',
          }}>
            <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: PINK }}>10</div>
            <div style={{ fontFamily: FONT, fontSize: 8, color: '#8A8A8E', marginTop: 1 }}>AM</div>
            <div style={{ width: 1, height: 10, background: 'rgba(233,30,106,0.2)', margin: '3px 0' }} />
            <div style={{ fontFamily: FONT, fontSize: 10, color: PINK_LIGHT }}>12</div>
            <div style={{ fontFamily: FONT, fontSize: 8, color: '#8A8A8E', marginTop: 1 }}>PM</div>
          </div>
          <div style={{ flex: 1, padding: '10px 11px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: p.ink }}>Declutter — Kitchen</div>
              <span style={{ background: AMBER_LIGHT, color: '#78350F', borderRadius: 4, padding: '2px 6px', fontSize: 9, fontWeight: 700, fontFamily: FONT }}>SCHED</span>
            </div>
            <div style={{ fontFamily: FONT, fontSize: 11, color: p.inkSub }}>Martha Williams</div>
            <div style={{ fontFamily: FONT, fontSize: 10, color: p.inkMuted, marginTop: 2 }}>📍 123 Maple St — 2h est</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <span style={{ fontFamily: SERIF, fontSize: 14, fontWeight: 500, color: p.ink }}>$120</span>
              <span style={{ background: GREEN_LIGHT, color: '#14532D', borderRadius: 4, padding: '2px 6px', fontSize: 9, fontWeight: 700, fontFamily: FONT }}>PAID</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{
        background: p.card, border: `1.5px solid ${p.cardBorder}`,
        borderRadius: 12, overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(233,30,106,0.07)',
      }}>
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          <div style={{
            width: 58, flexShrink: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: PINK_TINT, padding: '10px 0',
          }}>
            <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: PINK }}>2</div>
            <div style={{ fontFamily: FONT, fontSize: 8, color: '#8A8A8E', marginTop: 1 }}>PM</div>
            <div style={{ width: 1, height: 10, background: 'rgba(233,30,106,0.2)', margin: '3px 0' }} />
            <div style={{ fontFamily: FONT, fontSize: 10, color: PINK_LIGHT }}>4</div>
            <div style={{ fontFamily: FONT, fontSize: 8, color: '#8A8A8E', marginTop: 1 }}>PM</div>
          </div>
          <div style={{ flex: 1, padding: '10px 11px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: p.ink }}>Errands + Assist</div>
              <span style={{ background: '#FFF0F7', color: '#9B0D3A', borderRadius: 4, padding: '2px 6px', fontSize: 9, fontWeight: 700, fontFamily: FONT }}>UNPAID</span>
            </div>
            <div style={{ fontFamily: FONT, fontSize: 11, color: p.inkSub }}>Carol Davies</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <span style={{ fontFamily: SERIF, fontSize: 14, fontWeight: 500, color: p.ink }}>$80</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BottomNavMock({ p }) {
  const tabs = [
    { icon: '⌂', label: 'Home', active: true },
    { icon: '◫', label: 'Calendar', active: false },
    { icon: '♡', label: 'Clients', active: false },
    { icon: '$', label: 'Finance', active: false },
  ];
  return (
    <div style={{
      background: p.navBg,
      borderTop: `1px solid ${p.cardBorder}`,
      display: 'flex',
      flexShrink: 0,
      paddingBottom: 8,
    }}>
      {tabs.map(t => (
        <div key={t.label} style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '7px 4px 2px', gap: 3,
        }}>
          <div style={{
            width: 36, height: 26, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: t.active ? PINK_TINT : 'transparent',
            fontSize: 15, color: t.active ? PINK : p.inkMuted,
          }}>{t.icon}</div>
          <span style={{ fontFamily: FONT, fontSize: 9, fontWeight: t.active ? 700 : 500, color: t.active ? PINK : p.inkMuted }}>{t.label}</span>
        </div>
      ))}
    </div>
  );
}

function PhoneMockup({ optionKey }) {
  const p = OPTIONS[optionKey];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div style={{
        width: 300,
        borderRadius: 32,
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.1)',
        border: '6px solid #1C1C1E',
        background: p.bg,
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ height: 18, background: '#1C1C1E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 60, height: 8, background: '#2C2C2E', borderRadius: 100 }} />
        </div>
        <LogoBarMock />
        <div style={{ flex: 1, background: p.bg, display: 'flex', flexDirection: 'column', overflowY: 'hidden' }}>
          <HeroMock p={p} />
          <div style={{ flex: 1, overflowY: 'hidden', paddingBottom: 4 }}>
            <JobCardMock p={p} />
          </div>
        </div>
        <BottomNavMock p={p} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 500, color: '#1C1C1E', letterSpacing: '-0.3px' }}>
          {optionKey === 'a' ? 'A' : 'B'} — {p.label}
        </div>
        <div style={{ fontFamily: FONT, fontSize: 12, color: '#8A8A8E', marginTop: 3 }}>{p.tagline}</div>
      </div>
    </div>
  );
}

export default function PalettePreview() {
  return (
    <div style={{
      minHeight: '100dvh',
      background: '#FAF6F0',
      padding: '40px 20px 60px',
      fontFamily: FONT,
    }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: '#FFF0F7', border: `1px solid ${PINK_BORDER}`,
            borderRadius: 100, padding: '4px 14px', marginBottom: 16,
          }}>
            <span style={{ color: PINK, fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              Supermom for Hire
            </span>
          </div>
          <h1 style={{
            fontFamily: SERIF, fontSize: 28, fontWeight: 500, color: '#1C1C1E',
            margin: '0 0 10px', letterSpacing: '-0.5px', lineHeight: 1.2,
          }}>
            Which vibe fits best, Sandra?
          </h1>
          <p style={{
            fontFamily: FONT, fontSize: 14, color: '#4A4A4A', margin: 0, lineHeight: 1.6, maxWidth: 400, marginInline: 'auto',
          }}>
            Both use your exact brand colors. Pick the one that feels most like you and Joel will set it as your app theme.
          </p>
        </div>

        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 40,
          justifyContent: 'center', alignItems: 'flex-start',
        }}>
          <PhoneMockup optionKey="a" />
          <PhoneMockup optionKey="b" />
        </div>

        <div style={{ textAlign: 'center', marginTop: 50 }}>
          <div style={{
            display: 'inline-block',
            background: 'white',
            border: `1.5px solid ${PINK_BORDER}`,
            borderRadius: 16, padding: '18px 28px',
            maxWidth: 380,
          }}>
            <div style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 500, color: '#1C1C1E', marginBottom: 6 }}>
              Just tell Joel "A" or "B"
            </div>
            <div style={{ fontFamily: FONT, fontSize: 12, color: '#8A8A8E', lineHeight: 1.5 }}>
              He'll set it up instantly. Either way, all your pink accents, cards, and branding stay exactly the same.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
