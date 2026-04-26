import { createContext, useContext } from 'react';

export const NewClientSheetContext = createContext();

export function useNewClientSheet() {
  return useContext(NewClientSheetContext);
}
