import { useState, useCallback, lazy, Suspense } from 'react';
import { RequestSheetContext } from './RequestSheetContext';
const RequestSheet = lazy(() => import('../components/sheets/RequestSheet'));
const MyRequestsSheet = lazy(() => import('../components/sheets/MyRequestsSheet'));

export function RequestSheetProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  
  const [isMineOpen, setIsMineOpen] = useState(false);
  const [isMineClosing, setIsMineClosing] = useState(false);

  const [refreshToken, setRefreshToken] = useState(0);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
      setRefreshToken(t => t + 1);
    }, 260);
  }, []);
  
  const openMine = useCallback(() => setIsMineOpen(true), []);
  const closeMine = useCallback(() => {
    setIsMineClosing(true);
    setTimeout(() => {
      setIsMineOpen(false);
      setIsMineClosing(false);
    }, 260);
  }, []);

  return (
    <RequestSheetContext.Provider value={{ open, close, isOpen, openMine, closeMine, isMineOpen }}>
      {children}
      {(isMineOpen || isMineClosing) && (
        <Suspense fallback={null}>
          <MyRequestsSheet 
            refreshToken={refreshToken} 
            isOpen={true} 
            isClosing={isMineClosing}
            onClose={isMineClosing ? () => {} : closeMine} 
            onNewRequest={open} 
          />
        </Suspense>
      )}
      {(isOpen || isClosing) && (
        <Suspense fallback={null}>
          <RequestSheet 
            isOpen={true} 
            isClosing={isClosing}
            onClose={isClosing ? () => {} : close} 
          />
        </Suspense>
      )}
    </RequestSheetContext.Provider>
  );
}
