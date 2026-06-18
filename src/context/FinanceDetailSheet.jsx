import { useState, useCallback, lazy, Suspense } from 'react';
import { FinanceDetailSheetContext } from './FinanceDetailSheetContext';
const FinanceDetailSheetComponent = lazy(() => import('../components/sheets/FinanceDetailSheet'));

export function FinanceDetailSheetProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [sheetProps, setSheetProps] = useState({ title: '', items: [], type: 'jobs' });

  // type: 'jobs' | 'expenses'
  // items: array of decorated jobs or expenses
  const open = useCallback((title, items, type = 'jobs') => {
    setSheetProps({ title, items, type });
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    // Optional: delay clearing props for out-animation
    setTimeout(() => setSheetProps({ title: '', items: [], type: 'jobs' }), 300);
  }, []);

  return (
    <FinanceDetailSheetContext.Provider value={{ open, close, isOpen }}>
      {children}
      {isOpen && (
        <Suspense fallback={null}>
          <FinanceDetailSheetComponent
            title={sheetProps.title}
            items={sheetProps.items}
            type={sheetProps.type}
            onClose={close}
          />
        </Suspense>
      )}
    </FinanceDetailSheetContext.Provider>
  );
}
