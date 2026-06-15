export default function MissionIntel({ prepNote, T, theme }) {
  if (!prepNote) return null;
  return (
    <div style={{
      background: T.surface || 'rgba(0,0,0,0.03)',
      borderRadius: 12,
      padding: '10px 12px',
      border: `1px solid ${theme.accent || T.pink}30`,
      marginBottom: 10
    }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 9.5, fontWeight: 700, color: '#FF78B0', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '1.1px' }}>✦ Good to know</span>
        <span style={{ fontSize: 11, color: T.inkMuted, lineHeight: 1.4, fontWeight: 500 }}>{prepNote}</span>
      </div>
    </div>
  );
}
