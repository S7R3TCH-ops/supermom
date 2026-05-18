import { useState, useRef } from 'react';
import { useAppTheme } from '../../context/AppThemeContext';
import { triggerHaptic } from '../../lib/haptics';

export default function Swipeable({ children, onDelete, threshold = 80 }) {
  const { T } = useAppTheme();
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const [hapticTriggered, setHapticTriggered] = useState(false);
  const containerRef = useRef(null);

  const onTouchStart = (e) => {
    setStartX(e.touches[0].clientX);
    setStartY(e.touches[0].clientY);
    setSwiping(true);
    setScrolling(false);
    setHapticTriggered(false);
  };

  const onTouchMove = (e) => {
    if (!swiping || scrolling) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - startX;
    const diffY = currentY - startY;

    // If user is scrolling vertically, don't intercept
    if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > 10) {
      setScrolling(true);
      setSwiping(false);
      setOffsetX(0);
      return;
    }

    // Only allow left swipe (delete gesture)
    if (diffX < 0) {
      const off = Math.max(diffX, -120);
      setOffsetX(off);
      if (Math.abs(off) > threshold && !hapticTriggered) {
        triggerHaptic('light');
        setHapticTriggered(true);
      } else if (Math.abs(off) <= threshold && hapticTriggered) {
        setHapticTriggered(false);
      }
    }
  };

  const onTouchEnd = () => {
    if (scrolling) {
      setSwiping(false);
      setScrolling(false);
      return;
    }

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
      {onDelete && (
        <div style={{
          position: 'absolute', inset: 0,
          background: '#EF4444',
          display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
          paddingRight: 24, borderRadius: 12,
          opacity: offsetX < 0 ? 1 : 0,
          transition: 'opacity 0.2s',
        }}>
          <div style={{ color: 'white', fontWeight: 800, fontSize: 12, textTransform: 'uppercase' }}>Delete</div>
        </div>
      )}
      <div
        ref={containerRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: swiping ? 'none' : 'transform 0.4s cubic-bezier(0.2,0.8,0.2,1)',
          position: 'relative',
          zIndex: 2,
          touchAction: 'pan-y',
        }}
      >
        {children}
      </div>
    </div>
  );
}
