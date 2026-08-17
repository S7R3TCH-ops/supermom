import { useState, useEffect } from 'react';

const FIELD_TAGS = ['INPUT', 'TEXTAREA', 'SELECT'];
const KEYBOARD_DELTA_PX = 150;

/** Pure: mirrors appHeight.js's resolveViewportHeight keyboard heuristic (same
 * threshold). Kept local/duplicated here rather than imported — consolidating
 * both call sites behind one shared export is a separate, reviewed change (F2). */
export function isKeyboardOpen(win = window) {
  const vv = win.visualViewport;
  if (!vv || vv.height == null) return false;
  return win.innerHeight - vv.height > KEYBOARD_DELTA_PX;
}

export function useKeyboardFocus() {
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;

    if (vv) {
      // Stateless signal — NOT a captured baseline. A frozen `fullHeight` read once
      // at mount goes stale on any legitimate non-keyboard resize (rotation, nav-bar
      // show/hide) and then latches `isFocused` wrong for this component's lifetime.
      const handleResize = () => {
        setIsFocused(isKeyboardOpen(window));
      };

      vv.addEventListener('resize', handleResize);
      return () => vv.removeEventListener('resize', handleResize);
    }

    // Fallback for non-iOS: focus events
    const handleFocusIn = (e) => {
      if (FIELD_TAGS.includes(e.target.tagName)) {
        setIsFocused(true);
      }
    };

    const handleFocusOut = () => {
      setTimeout(() => {
        if (!FIELD_TAGS.includes(document.activeElement?.tagName)) {
          setIsFocused(false);
        }
      }, 50);
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
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

  return isFocused;
}
