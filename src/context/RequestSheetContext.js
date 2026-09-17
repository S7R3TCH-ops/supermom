import { createContext, useContext } from 'react';

export const RequestSheetContext = createContext();

export function useRequestSheet() {
  return useContext(RequestSheetContext);
}
