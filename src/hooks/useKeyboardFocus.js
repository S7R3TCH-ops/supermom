import { useState, useEffect } from 'react';

const FIELD_TAGS = ['INPUT', 'TEXTAREA', 'SELECT'];

export function useKeyboardFocus() {
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;

    if (vv) {
      const fullHeight = vv.height;

      const handleResize = () => {
        setIsFocused(vv.height < fullHeight - 100);
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
      setTimeout(() => el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 300);
    };

    document.addEventListener('focusin', handleFocusIn);
    return () => document.removeEventListener('focusin', handleFocusIn);
  }, []);

  return isFocused;
}
