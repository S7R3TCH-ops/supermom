import { createContext, useContext } from 'react';

export const NewJobSheetContext = createContext(null);

export function useNewJobSheet() {
  const ctx = useContext(NewJobSheetContext);
  if (!ctx) throw new Error('useNewJobSheet must be used inside NewJobSheetProvider');
  return ctx;
}
