import { useState, useCallback, lazy, Suspense } from 'react';
import { EditClientSheetContext } from './EditClientSheetContext';
const EditClientSheet = lazy(() => import('../components/sheets/EditClientSheet'));

export function EditClientSheetProvider({ children }) {
  const [clientId, setClientId] = useState(null);

  const open = useCallback((id) => setClientId(id), []);
  const close = useCallback(() => setClientId(null), []);

  return (
    <EditClientSheetContext.Provider value={{ open, close }}>
      {children}
      {clientId && <Suspense fallback={null}><EditClientSheet clientId={clientId} onClose={close} /></Suspense>}
    </EditClientSheetContext.Provider>
  );
}
