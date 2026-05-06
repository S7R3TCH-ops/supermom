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

    // Focus appropriate element on open
    const focusable = getFocusable();
    if (focusable.length && !el.contains(document.activeElement)) {
      // Prioritize inputs/textareas over close buttons
      const priority = focusable.find(f => ['INPUT', 'TEXTAREA', 'SELECT'].includes(f.tagName)) || focusable[0];
      
      // 350ms delay to ensure animations (like njSlide) are finished
      const timer = setTimeout(() => {
        if (el.contains(document.activeElement)) return;
        priority.focus();
      }, 350);
      return () => clearTimeout(timer);
    }

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
