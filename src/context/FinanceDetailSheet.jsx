import { useState, useCallback } from 'react';
import { FinanceDetailSheetContext } from './FinanceDetailSheetContext';
import FinanceDetailSheetComponent from '../components/sheets/FinanceDetailSheet';

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
        <FinanceDetailSheetComponent 
          title={sheetProps.title}
          items={sheetProps.items}
          type={sheetProps.type}
          onClose={close} 
        />
      )}
    </FinanceDetailSheetContext.Provider>
  );
}
