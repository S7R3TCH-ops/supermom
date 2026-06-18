import { useCallback, useMemo, useState, lazy, Suspense } from 'react';
import { NewJobSheetContext } from './NewJobSheetContext';
const NewJobSheet = lazy(() => import('../components/sheets/NewJobSheet'));

export function NewJobSheetProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [prefillClientId, setPrefillClientId] = useState(null);
  const [prefillData, setPrefillData] = useState(null);

  const openFor = useCallback(id => {
    setPrefillClientId(id || null);
    setPrefillData(null);
    setOpen(true);
  }, []);
  const openWithPrefill = useCallback(data => {
    setPrefillData(data || null);
    setPrefillClientId(null);
    setOpen(true);
  }, []);
  const openBlank = useCallback(() => {
    setPrefillClientId(null);
    setPrefillData(null);
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);

  const value = useMemo(() => ({
    open, prefillClientId, prefillData, openFor, openWithPrefill, openBlank, close,
  }), [open, prefillClientId, prefillData, openFor, openWithPrefill, openBlank, close]);

  return (
    <NewJobSheetContext.Provider value={value}>
      {children}
      {open && <Suspense fallback={null}><NewJobSheet prefillClientId={prefillClientId} prefillData={prefillData} onClose={close} /></Suspense>}
    </NewJobSheetContext.Provider>
  );
}
