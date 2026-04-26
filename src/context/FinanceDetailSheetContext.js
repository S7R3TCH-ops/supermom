import { createContext, useContext } from 'react';

export const FinanceDetailSheetContext = createContext();

export function useFinanceDetailSheet() {
  return useContext(FinanceDetailSheetContext);
}
