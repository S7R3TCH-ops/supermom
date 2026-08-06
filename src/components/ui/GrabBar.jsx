import { useRef } from 'react';
import { useAppTheme } from '../../context/AppThemeContext';

export default function GrabBar({ onDismiss }) {
  const { mode } = useAppTheme();
  const startY = useRef(null);

  const onTouchStart = (e) => { startY.current = e.touches[0].clientY; };
  const onTouchEnd = (e) => {
    if (startY.current === null) return;
    const dy = e.changedTouches[0].clientY - startY.current;
    startY.current = null;
    if (dy > 90 && onDismiss) onDismiss();
  };

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{
        width: '100%',
        height: 28,
        paddingTop: 'env(safe-area-inset-top, 0px)',
        boxSizing: 'content-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        cursor: 'grab',
        touchAction: 'none',
      }}
    >
      <div style={{
        width: 36,
        height: 5,
        borderRadius: 3,
        background: mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
      }} />
    </div>
  );
}
