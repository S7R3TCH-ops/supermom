import { useState, useCallback } from 'react';
import { NewClientSheetContext } from './NewClientSheetContext';
import NewClientSheet from '../components/sheets/NewClientSheet';

export function NewClientSheetProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [onCreatedCb, setOnCreatedCb] = useState(null);

  const open = useCallback((onCreated) => {
    setOnCreatedCb(() => onCreated);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setOnCreatedCb(null);
  }, []);

  return (
    <NewClientSheetContext.Provider value={{ open, close, isOpen }}>
      {children}
      {isOpen && (
        <NewClientSheet 
          onClose={close} 
          onCreated={(c) => {
            if (onCreatedCb) onCreatedCb(c);
            close();
          }} 
        />
      )}
    </NewClientSheetContext.Provider>
  );
}
