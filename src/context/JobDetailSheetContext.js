import { createContext, useContext } from 'react';

export const JobDetailSheetContext = createContext(null);

export function useJobDetailSheet() {
  const ctx = useContext(JobDetailSheetContext);
  if (!ctx) throw new Error('useJobDetailSheet must be used inside JobDetailSheetProvider');
  return ctx;
}
