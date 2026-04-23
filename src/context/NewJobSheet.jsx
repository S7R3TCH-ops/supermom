import { useCallback, useMemo, useState } from 'react';
import { NewJobSheetContext } from './NewJobSheetContext';
import NewJobSheet from '../components/sheets/NewJobSheet';

export function NewJobSheetProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [prefillClientId, setPrefillClientId] = useState(null);

  const openFor = useCallback(id => {
    setPrefillClientId(id || null);
    setOpen(true);
  }, []);
  const openBlank = useCallback(() => {
    setPrefillClientId(null);
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);

  const value = useMemo(() => ({
    open, prefillClientId, openFor, openBlank, close,
  }), [open, prefillClientId, openFor, openBlank, close]);

  return (
    <NewJobSheetContext.Provider value={value}>
      {children}
      {open && <NewJobSheet prefillClientId={prefillClientId} onClose={close} />}
    </NewJobSheetContext.Provider>
  );
}
