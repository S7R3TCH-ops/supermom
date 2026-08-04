import { useEffect, useRef } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function useFocusTrap(ref, isActive, onClose) {
  // Ref, not a dep — an inline onClose from the parent must not restart
  // the effect (and the 350ms autofocus timer) on every re-render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isActive || !ref.current) return;

    const el = ref.current;
    const getFocusable = () => Array.from(el.querySelectorAll(FOCUSABLE));

    // Focus appropriate element on open
    let focusTimer;
    const focusable = getFocusable();
    if (focusable.length && !el.contains(document.activeElement)) {
      // Prioritize inputs/textareas over close buttons
      const priority = focusable.find(f => ['INPUT', 'TEXTAREA', 'SELECT'].includes(f.tagName)) || focusable[0];

      // 350ms delay to ensure animations (like njSlide) are finished
      focusTimer = setTimeout(() => {
        if (el.contains(document.activeElement)) return;
        priority.focus();
      }, 350);
    }

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current?.();
        return;
      }
      if (e.key !== 'Tab') return;

      const focusable = getFocusable();
      if (!focusable.length) { e.preventDefault(); return; }

      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    }

    // Keydown listener attaches unconditionally — previously it was gated
    // behind the autofocus branch's early return, so Escape/Tab-wrap were
    // dead whenever a sheet autofocused (i.e. almost always).
    el.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(focusTimer);
      el.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActive, ref]);
}
