import { useEffect } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function useFocusTrap(ref, isActive, onClose) {
  useEffect(() => {
    if (!isActive || !ref.current) return;

    const el = ref.current;
    const getFocusable = () => Array.from(el.querySelectorAll(FOCUSABLE));

    // Focus first focusable element on open
    const first = getFocusable()[0];
    if (first) first.focus();

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
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

    el.addEventListener('keydown', handleKeyDown);
    return () => el.removeEventListener('keydown', handleKeyDown);
  }, [isActive, ref, onClose]);
}
