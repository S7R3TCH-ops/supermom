import { useAppTheme } from '../../context/AppThemeContext';

export default function GrabBar() {
  const { mode } = useAppTheme();
  return (
    <div style={{
      width: '100%',
      height: 24,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      <div style={{
        width: 36,
        height: 5,
        borderRadius: 3,
        background: mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
      }} />
    </div>
  );
}
