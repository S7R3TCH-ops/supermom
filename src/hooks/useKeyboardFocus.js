import { useState, useEffect } from 'react';
import { getKeyboardInset, isKeyboardOpen } from '../lib/appHeight';

const FIELD_TAGS = ['INPUT', 'TEXTAREA', 'SELECT'];

// Re-exported for import-path stability (existing test imports it from here).
// Source of truth is appHeight.js (F2) — Strategy A means visualViewport is
// always present on this app's target browsers, so there is no non-iOS
// focus-event fallback path left to maintain.
export { isKeyboardOpen };

/** Returns the measured keyboard inset in px (0 when the keyboard isn't open),
 * not just a boolean — callers use it directly as spacer/padding height (F3)
 * instead of a hardcoded per-component guess. Gated on isKeyboardOpen()'s
 * threshold, not raw getKeyboardInset(), so small non-keyboard deltas (iOS
 * toolbar collapse, safe-area changes) stay 0 and don't trigger a spacer. */
export function useKeyboardFocus() {
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    // Stateless signal — NOT a captured baseline. A frozen `fullHeight` read once
    // at mount goes stale on any legitimate non-keyboard resize (rotation, nav-bar
    // show/hide) and then latches the inset wrong for this component's lifetime.
    const handleResize = () => {
      setKeyboardInset(isKeyboardOpen(window) ? getKeyboardInset(window) : 0);
    };

    vv.addEventListener('resize', handleResize);
    return () => vv.removeEventListener('resize', handleResize);
  }, []);

  // Keeps the field being typed into clear of the keyboard. iOS `position:fixed`
  // sheets/pages don't resize/reflow on their own when the keyboard opens — the
  // focused field can end up hidden behind it. `block: 'nearest'` (not 'center')
  // so this only nudges the nearest scrollable ancestor, not the whole page.
  useEffect(() => {
    const handleFocusIn = (e) => {
      if (!FIELD_TAGS.includes(e.target.tagName)) return;
      const el = e.target;
      setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
    };

    document.addEventListener('focusin', handleFocusIn);
    return () => document.removeEventListener('focusin', handleFocusIn);
  }, []);

  return keyboardInset;
}
