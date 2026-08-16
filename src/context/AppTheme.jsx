import { useMemo, useState, useEffect } from 'react';
import { smTokens } from '../lib/tokens';
import { AppThemeContext } from './AppThemeContext';

export function AppThemeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    return localStorage.getItem('supermom-theme') || 'warm';
  });
  const [privacyOn, setPrivacyOn] = useState(false);

  useEffect(() => {
    localStorage.setItem('supermom-theme', mode);
    if (mode === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [mode]);

  const value = useMemo(() => ({
    mode,
    privacyOn,
    toggleMode: () => setMode(m => (m === 'dark' ? 'warm' : 'dark')),
    togglePrivacy: () => setPrivacyOn(p => !p),
    T: smTokens(mode),
  }), [mode, privacyOn]);

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}
