import { createContext, useContext } from 'react';
export const PostJobSheetContext = createContext(null);
export const usePostJobSheet = () => useContext(PostJobSheetContext);
