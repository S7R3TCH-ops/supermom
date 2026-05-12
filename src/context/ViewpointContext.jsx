/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { clearBusinessCache, setSuperOverride } from '../data/currentBusiness';

const ViewpointContext = createContext(null);

export function ViewpointProvider({ children }) {
  const { profile } = useAuth();
  const [allBusinesses, setAllBusinesses] = useState([]);
  const [viewingAsId, setViewingAsId] = useState(null);
  const [viewingAsName, setViewingAsName] = useState(null);

  const isSuperAdmin = profile?.email === 'jlundie@gmail.com' || profile?.email === 'joel@supermom.io';

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('businesses').select('*').order('name').then(({ data }) => {
        if (data) setAllBusinesses(data);
      });
    }
  }, [isSuperAdmin]);

  const switchTo = (id, name) => {
    setViewingAsId(id);
    setViewingAsName(name);
    setSuperOverride(id);
    clearBusinessCache();
    window.location.reload(); // Force full reload to ensure context propagates
  };

  const reset = () => {
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
