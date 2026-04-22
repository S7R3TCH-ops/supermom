import { createContext, useContext } from 'react';

export const AppThemeContext = createContext(null);

export function useAppTheme() {
  const ctx = useContext(AppThemeContext);
  if (!ctx) throw new Error('useAppTheme must be used inside AppThemeProvider');
  return ctx;
}
