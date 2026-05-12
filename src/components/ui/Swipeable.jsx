import { useState, useRef } from 'react';
import { useAppTheme } from '../../context/AppThemeContext';
import { triggerHaptic } from '../../lib/haptics';

export default function Swipeable({ children, onDelete, threshold = 80 }) {
  const { T } = useAppTheme();
  const [startX, setStartX] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [hapticTriggered, setHapticTriggered] = useState(false);
  const containerRef = useRef(null);

  const onTouchStart = (e) => {
    setStartX(e.touches[0].clientX);
    setSwiping(true);
    setHapticTriggered(false);
  };

  const onTouchMove = (e) => {
    if (!swiping) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - startX;
    // Only allow left swipe
    if (diff < 0) {
      const off = Math.max(diff, -120);
      setOffsetX(off);
      
      if (off < -threshold && !hapticTriggered) {
        triggerHaptic('light');
        setHapticTriggered(true);
      } else if (off >= -threshold && hapticTriggered) {
        setHapticTriggered(false);
      }
    } else {
      setOffsetX(0);
    }
  };

  const onTouchEnd = () => {
    setSwiping(false);
    if (offsetX < -threshold) {
      triggerHaptic('medium');
      if (onDelete) onDelete();
    }
    setOffsetX(0);
    setHapticTriggered(false);
  };

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 12 }}>
      {/* Delete Action Background */}
      <div style={{
        position: 'absolute', inset: 0,
        background: '#EF4444',
        display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
        paddingRight: 24, borderRadius: 12,
        opacity: offsetX < 0 ? 1 : 0,
        transition: 'opacity 0.2s'
      }}>
        <div style={{ color: 'white', fontWeight: 800, fontSize: 12, textTransform: 'uppercase' }}>Delete</div>
      </div>

      {/* Content */}
      <div
        ref={containerRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: swiping ? 'none' : 'transform 0.3s cubic-bezier(0.2,0.8,0.2,1)',
          position: 'relative',
          zIndex: 2,
        }}
      >
        {children}
      </div>
    </div>
  );
}
