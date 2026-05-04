import { useState, useEffect } from 'react';

/**
 * Returns true if an input, textarea, or select is currently focused.
 * Useful for adjusting UI layout when the mobile keyboard is likely visible.
 */
export function useKeyboardFocus() {
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    const handleFocusIn = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
        setIsFocused(true);
      }
    };

    const handleFocusOut = () => {
      // Small timeout to prevent flicker during focus transition
      setTimeout(() => {
        if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
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

  return isFocused;
}
