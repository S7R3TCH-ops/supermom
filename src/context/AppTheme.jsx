import { useMemo, useState } from 'react';
import { smTokens } from '../lib/tokens';
import { AppThemeContext } from './AppThemeContext';

export function AppThemeProvider({ children }) {
  const [mode, setMode] = useState('dark');
  const [privacyOn, setPrivacyOn] = useState(false);

  const value = useMemo(() => ({
    mode,
    privacyOn,
    toggleMode: () => setMode(m => (m === 'dark' ? 'warm' : 'dark')),
    togglePrivacy: () => setPrivacyOn(p => !p),
    T: smTokens(mode),
  }), [mode, privacyOn]);

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}
