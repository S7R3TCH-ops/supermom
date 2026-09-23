import { useState, useCallback, lazy, Suspense } from 'react';
import { RequestSheetContext } from './RequestSheetContext';
const RequestSheet = lazy(() => import('../components/sheets/RequestSheet'));
const MyRequestsSheet = lazy(() => import('../components/sheets/MyRequestsSheet'));

export function RequestSheetProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMineOpen, setIsMineOpen] = useState(false);
  // Bumped when the compose sheet closes so an open My requests list refetches
  // and shows what was just sent. A prop, not a React key: remounting would
  // re-run useBackClose's history pop/push pair.
  const [refreshToken, setRefreshToken] = useState(0);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => {
    setIsOpen(false);
    setRefreshToken(t => t + 1);
  }, []);
  const openMine = useCallback(() => setIsMineOpen(true), []);
  const closeMine = useCallback(() => setIsMineOpen(false), []);

  // Compose opens stacked on top of the list rather than swapping — closing
  // one sheet and opening another in the same tick races useBackClose's
  // history.back()/pushState pair; nested sheets are the supported path.
  return (
    <RequestSheetContext.Provider value={{ open, close, isOpen, openMine, closeMine, isMineOpen }}>
      {children}
      {isMineOpen && (
        <Suspense fallback={null}>
          <MyRequestsSheet refreshToken={refreshToken} isOpen={isMineOpen} onClose={closeMine} onNewRequest={open} />
        </Suspense>
      )}
      {isOpen && (
        <Suspense fallback={null}>
          <RequestSheet isOpen={isOpen} onClose={close} />
        </Suspense>
      )}
    </RequestSheetContext.Provider>
  );
}
