import { useRef, useEffect, useCallback } from 'react';
import { nearestIndex, scrollTopForIndex } from '../../lib/wheelPicker';
import { triggerHaptic } from '../../lib/haptics';

const ITEM_HEIGHT = 40;
const VISIBLE_COUNT = 5; // odd, so one item sits dead-center
const PAD_COUNT = (VISIBLE_COUNT - 1) / 2;

/**
 * A single scroll-snap wheel column (iOS-picker style). `values`/`labels` are
 * parallel arrays; `selectedIndex` is controlled, `onChange(index)` fires as
 * the centered item changes while scrolling.
 */
export default function WheelColumn({ labels, selectedIndex, onChange, T, mode }) {
  const scrollRef = useRef(null);
  const rafRef = useRef(null);
  const settleTimerRef = useRef(null);
  const lastReportedRef = useRef(selectedIndex);

  // Keep the column in sync when selectedIndex changes from outside (e.g. sheet open).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const target = scrollTopForIndex(selectedIndex, ITEM_HEIGHT);
    if (Math.abs(el.scrollTop - target) > 1) el.scrollTop = target;
    lastReportedRef.current = selectedIndex;
  }, [selectedIndex]);

  const handleScroll = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (!el) return;
      const idx = nearestIndex(el.scrollTop, ITEM_HEIGHT, labels.length);
      if (idx !== lastReportedRef.current) {
        lastReportedRef.current = idx;
        triggerHaptic('light');
        onChange(idx);
      }
    });

    clearTimeout(settleTimerRef.current);
    settleTimerRef.current = setTimeout(() => {
      const el = scrollRef.current;
      if (!el) return;
      const idx = nearestIndex(el.scrollTop, ITEM_HEIGHT, labels.length);
      const target = scrollTopForIndex(idx, ITEM_HEIGHT);
      if (Math.abs(el.scrollTop - target) > 1) el.scrollTo({ top: target, behavior: 'smooth' });
    }, 120);
  }, [labels.length, onChange]);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    clearTimeout(settleTimerRef.current);
  }, []);

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      style={{
        height: ITEM_HEIGHT * VISIBLE_COUNT,
        overflowY: 'scroll',
        scrollSnapType: 'y mandatory',
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
      }}
      className="wheel-col-hide-scrollbar"
    >
      <div style={{ height: ITEM_HEIGHT * PAD_COUNT }} />
      {labels.map((label, i) => (
        <div
          key={label + i}
          onClick={() => {
            const el = scrollRef.current;
            if (el) el.scrollTo({ top: scrollTopForIndex(i, ITEM_HEIGHT), behavior: 'smooth' });
          }}
          style={{
            height: ITEM_HEIGHT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            scrollSnapAlign: 'center',
            fontFamily: T.serif,
            fontSize: i === selectedIndex ? 20 : 16,
            fontWeight: i === selectedIndex ? 700 : 500,
            color: i === selectedIndex ? T.pink : T.inkMuted,
            transition: 'color 0.1s, font-size 0.1s',
            cursor: 'pointer',
          }}
        >
          {label}
        </div>
      ))}
      <div style={{ height: ITEM_HEIGHT * PAD_COUNT }} />
    </div>
  );
}

export { ITEM_HEIGHT, VISIBLE_COUNT };
