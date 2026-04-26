import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { clearBusinessCache } from '../data/currentBusiness';

const ViewpointContext = createContext();

const SUPER_ADMIN_EMAIL = 'jlundie@gmail.com';

export function ViewpointProvider({ children }) {
  const [session, setSession] = useState(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [viewingAsId, setViewingAsId] = useState(null);
  const [viewingAsName, setViewingAsName] = useState(null);
  const [allBusinesses, setAllBusinesses] = useState([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsSuperAdmin(session?.user?.email === SUPER_ADMIN_EMAIL);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setIsSuperAdmin(session?.user?.email === SUPER_ADMIN_EMAIL);
      if (!session) {
        setViewingAsId(null);
        setViewingAsName(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('businesses').select('id, name, owner_name').order('name').then(({ data }) => {
        setAllBusinesses(data || []);
      });
    }
  }, [isSuperAdmin]);

  const switchTo = (bizId, ownerName) => {
    if (!isSuperAdmin) return;
    setViewingAsId(bizId);
    setViewingAsName(ownerName);
    clearBusinessCache(); // Force repos to re-resolve business_id
    window.dispatchEvent(new Event('supermom:data-changed'));
  };

  const reset = () => {
    setViewingAsId(null);
    setViewingAsName(null);
    clearBusinessCache();
    window.dispatchEvent(new Event('supermom:data-changed'));
  };

  return (
    <ViewpointContext.Provider value={{ 
      isSuperAdmin, 
      viewingAsId, 
      viewingAsName, 
      switchTo, 
      reset,
      allBusinesses
    }}>
      {children}
    </ViewpointContext.Provider>
  );
}

export const useViewpoint = () => useContext(ViewpointContext);
