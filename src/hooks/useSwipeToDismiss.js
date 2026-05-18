import { useRef } from 'react';

/**
 * Full-sheet swipe-to-dismiss. Uses DOM mutation for live drag feedback
 * (no React re-render on every pixel). Only activates when scroll container
 * is scrolled to the top, so normal scrolling is never interrupted.
 *
 * Usage:
 *   const { panelRef, scrollRef, handlers } = useSwipeToDismiss(onClose);
 *   <div ref={panelRef} {...handlers}>
 *     <div ref={scrollRef} style={{ overflowY: 'auto' }}> ... </div>
 *   </div>
 */
export function useSwipeToDismiss(onDismiss, threshold = 120) {
  const panelRef = useRef(null);
  const scrollRef = useRef(null);
  const startY = useRef(null);
  const dragY = useRef(0);
  const active = useRef(false);

  function onTouchStart(e) {
    const scrollTop = scrollRef.current?.scrollTop ?? 0;
    if (scrollTop > 8) return; // not at top — let scroll handle it
    startY.current = e.touches[0].clientY;
    dragY.current = 0;
    active.current = false;
  }

  function onTouchMove(e) {
    if (startY.current === null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy < 0) {
      // upward swipe — cancel tracking, let scroll take over
      startY.current = null;
      if (panelRef.current) {
        panelRef.current.style.transition = 'transform 0.3s cubic-bezier(0.2,0.8,0.2,1)';
        panelRef.current.style.transform = 'translateY(0px)';
      }
      return;
    }
    active.current = true;
    dragY.current = dy;
    if (panelRef.current) {
      panelRef.current.style.transition = 'none';
      panelRef.current.style.transform = `translateY(${dy}px)`;
    }
  }

  function onTouchEnd() {
    if (!active.current || startY.current === null) {
      startY.current = null;
      return;
    }
    startY.current = null;
    const dy = dragY.current;
    dragY.current = 0;
    active.current = false;

    if (dy >= threshold) {
      // Animate out then dismiss
      if (panelRef.current) {
        panelRef.current.style.transition = 'transform 0.28s cubic-bezier(0.4,0,1,1)';
        panelRef.current.style.transform = 'translateY(100%)';
      }
      setTimeout(() => onDismiss?.(), 260);
    } else {
      // Spring back
      if (panelRef.current) {
        panelRef.current.style.transition = 'transform 0.35s cubic-bezier(0.2,0.8,0.2,1)';
        panelRef.current.style.transform = 'translateY(0px)';
      }
    }
  }

  return {
    panelRef,
    scrollRef,
    handlers: { onTouchStart, onTouchMove, onTouchEnd },
  };
}
