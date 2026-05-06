import { useState, useCallback } from 'react';
import { EditClientSheetContext } from './EditClientSheetContext';
import EditClientSheet from '../components/sheets/EditClientSheet';

export function EditClientSheetProvider({ children }) {
  const [clientId, setClientId] = useState(null);

  const open = useCallback((id) => setClientId(id), []);
  const close = useCallback(() => setClientId(null), []);

  return (
    <EditClientSheetContext.Provider value={{ open, close }}>
      {children}
      {clientId && <EditClientSheet clientId={clientId} onClose={close} />}
    </EditClientSheetContext.Provider>
  );
}
