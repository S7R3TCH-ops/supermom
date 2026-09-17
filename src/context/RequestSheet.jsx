import { useState, useCallback, lazy, Suspense } from 'react';
import { RequestSheetContext } from './RequestSheetContext';
const RequestSheet = lazy(() => import('../components/sheets/RequestSheet'));

export function RequestSheetProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <RequestSheetContext.Provider value={{ open, close, isOpen }}>
      {children}
      {isOpen && (
        <Suspense fallback={null}>
          <RequestSheet isOpen={isOpen} onClose={close} />
        </Suspense>
      )}
    </RequestSheetContext.Provider>
  );
}
