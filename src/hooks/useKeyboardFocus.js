import { useState, useEffect } from 'react';

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
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
        setIsFocused(true);
      }
    };

    const handleFocusOut = () => {
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
