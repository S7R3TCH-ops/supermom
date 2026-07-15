import { useRef, useState, useCallback } from 'react';
import { triggerHaptic } from '../lib/haptics';
import { decideSwipeAxis, resolveSwipeCommit, SNAP_MS } from '../lib/daySwipeGesture';

/**
 * Horizontal swipe-to-step gesture — same decide/threshold/snap/haptic shape
 * as WeekStrip's week-swipe (variant='home'), extracted so any content area
 * (the agenda list) can drive the same day-stepping behavior without
 * reimplementing the touch handling. onCommit(delta) fires with -1/+1 after
 * the release-snap animation settles.
 */
export function useDaySwipeGesture(onCommit) {
  const [liveOffset, setLiveOffset] = useState(0);
  const [isSnapping, setIsSnapping] = useState(false);
  const liveOffsetRef = useRef(0);
  const isSnappingRef = useRef(false);
  const containerRef = useRef(null);
  const touchRef = useRef({ startX: 0, startY: 0, active: false, scrolling: false, decided: false });

  const handleTouchStart = useCallback((e) => {
    if (isSnappingRef.current) return;
    touchRef.current = {
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      active: true,
      scrolling: false,
      decided: false,
    };
  }, []);

  const handleTouchMove = useCallback((e) => {
    const t = touchRef.current;
    if (!t.active || t.scrolling || isSnappingRef.current) return;
    if (e.touches.length > 1) return; // ignore multi-touch (pinch/zoom gestures)

    let dx = e.touches[0].clientX - t.startX;
    const dy = e.touches[0].clientY - t.startY;

    if (!t.decided) {
      const axis = decideSwipeAxis(dx, dy);
      if (axis === 'vertical') {
        t.scrolling = true;
        liveOffsetRef.current = 0;
        setLiveOffset(0);
        return;
      }
      if (axis === 'horizontal') {
        t.decided = true;
        // Re-baseline so content doesn't jump by the decide-threshold on engage.
        t.startX = e.touches[0].clientX;
        t.startY = e.touches[0].clientY;
        dx = 0;
      } else {
        return;
      }
    }

    liveOffsetRef.current = dx;
    setLiveOffset(dx);
  }, []);

  const handleTouchEnd = useCallback((e) => {
    const t = touchRef.current;
    t.active = false;
    if (t.scrolling || isSnappingRef.current || !t.decided) return;

    const { committed, delta } = resolveSwipeCommit(liveOffsetRef.current);
    const panelWidth = containerRef.current?.offsetWidth ?? window.innerWidth;

    if (committed) {
      const snapTarget = delta > 0 ? -panelWidth : panelWidth;
      isSnappingRef.current = true;
      setIsSnapping(true);
      setLiveOffset(snapTarget);
      liveOffsetRef.current = snapTarget;
      triggerHaptic('medium');
      e.stopPropagation();

      setTimeout(() => {
        onCommit(delta);
        isSnappingRef.current = false;
        setIsSnapping(false);
        setLiveOffset(0);
        liveOffsetRef.current = 0;
      }, SNAP_MS);
    } else {
      // Under threshold — spring back
      isSnappingRef.current = true;
      setIsSnapping(true);
      setLiveOffset(0);
      liveOffsetRef.current = 0;
      setTimeout(() => {
        isSnappingRef.current = false;
        setIsSnapping(false);
      }, SNAP_MS);
    }
  }, [onCommit]);

  const handleTouchCancel = useCallback(() => {
    // iOS fires this on notification pulls / system-gesture takeover mid-drag —
    // without a handler the gesture sticks. Reset to committed state cleanly.
    touchRef.current.active = false;
    isSnappingRef.current = true;
    setIsSnapping(true);
    setLiveOffset(0);
    liveOffsetRef.current = 0;
    setTimeout(() => {
      isSnappingRef.current = false;
      setIsSnapping(false);
    }, SNAP_MS);
  }, []);

  return {
    containerRef,
    liveOffset,
    isSnapping,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchCancel,
    },
  };
}
