import { createContext, useContext } from 'react';

export const EditClientSheetContext = createContext();

export function useEditClientSheet() {
  return useContext(EditClientSheetContext);
}
