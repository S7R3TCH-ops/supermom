import { useEffect, useRef } from 'react';

// Module-level LIFO stack — one listener shared across all open sheets.
// Prevents double-close when nested sheets (e.g. NewJobSheet → NewClientSheet) are both mounted.
const backStack = [];
let listenerAttached = false;
// Suppresses the next popstate when we fired history.back() ourselves (cleanup path).
// Without this, React StrictMode's double-invoke causes the cleanup's history.back() to
// fire a popstate AFTER the re-mount's new entry is on the stack, closing the sheet.
let suppressNextPopState = false;

function handlePopState() {
  if (suppressNextPopState) {
    suppressNextPopState = false;
    return;
  }
  const top = backStack[backStack.length - 1];
  if (!top || top.consumed) return;
  top.consumed = true;
  backStack.pop();
  top.onClose();
}

function attachListener() {
  if (listenerAttached) return;
  listenerAttached = true;
  window.addEventListener('popstate', handlePopState);
}

export function useBackClose(isOpen, onClose) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    attachListener();

    // Push a synthetic history entry at the same URL. Preserve React Router's
    // history state (idx/key) so its popstate listener doesn't lose position.
    const entryHref = window.location.href;
    history.pushState(window.history.state, '', window.location.href);

    const entry = {
      onClose: () => onCloseRef.current(),
      consumed: false,
    };
    backStack.push(entry);

    return () => {
      const idx = backStack.indexOf(entry);
      if (idx !== -1) {
        // Sheet closed via UI (swipe, button, Escape) — remove from stack
        // and consume the synthetic history entry we pushed.
        backStack.splice(idx, 1);
        entry.consumed = true;
        // Only go back if we're still on the same page. If navigate() fired
        // (e.g. clicking a client name to open ClientProfile), the URL has
        // already changed and history.back() would undo that navigation.
        if (window.location.href === entryHref) {
          suppressNextPopState = true;
          history.back();
        }
      }
    };
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps
}
