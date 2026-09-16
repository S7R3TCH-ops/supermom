/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { clearBusinessCache, setSuperOverride } from '../data/currentBusiness';
import { queryClient } from '../lib/queryClient';

const ViewpointContext = createContext(null);

export function ViewpointProvider({ children }) {
  const { profile } = useAuth();
  const [allBusinesses, setAllBusinesses] = useState([]);
  const [viewingAsId, setViewingAsId] = useState(() => sessionStorage.getItem('superViewId'));
  const [viewingAsName, setViewingAsName] = useState(() => sessionStorage.getItem('superViewName'));

  // role === 'admin' is the single source of truth (matches api/_lib/authGuard.js
  // and src/data/currentBusiness.js) — a hardcoded email list drifted out of sync
  // with itself across 3 files (one had a typo'd domain), and this is UI-gating
  // only anyway; RLS is the real enforcement.
  const isSuperAdmin = profile?.role === 'admin';

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('businesses').select('*').order('name').then(({ data }) => {
        if (data) setAllBusinesses(data);
      });
    }
  }, [isSuperAdmin]);

  const switchTo = (id, name) => {
    sessionStorage.setItem('superViewId', id);
    sessionStorage.setItem('superViewName', name);
    setViewingAsId(id);
    setViewingAsName(name);
    setSuperOverride(id);
    clearBusinessCache();
    window.location.href = '/';
  };

  // Like switchTo but no page reload — use for LogoBar quick-switch
  const quickSwitch = (id, name) => {
    sessionStorage.setItem('superViewId', id);
    sessionStorage.setItem('superViewName', name);
    setViewingAsId(id);
    setViewingAsName(name);
    setSuperOverride(id);
    clearBusinessCache();
    queryClient.invalidateQueries();
  };

  const reset = () => {
    sessionStorage.removeItem('superViewId');
    sessionStorage.removeItem('superViewName');
    setViewingAsId(null);
    setViewingAsName(null);
    setSuperOverride(null);
    clearBusinessCache();
    window.location.reload();
  };

  const refresh = () => {
    if (isSuperAdmin) {
      supabase.from('businesses').select('*').order('name').then(({ data }) => {
        if (data) setAllBusinesses(data);
      });
    }
  };

  return (
    <ViewpointContext.Provider value={{
      isSuperAdmin,
      allBusinesses,
      viewingAsId,
      viewingAsName,
      switchTo,
      quickSwitch,
      reset,
      refresh
    }}>
      {children}
    </ViewpointContext.Provider>
  );
}

export function useViewpoint() {
  const ctx = useContext(ViewpointContext);
  if (!ctx) throw new Error('useViewpoint must be used within ViewpointProvider');
  return ctx;
}
