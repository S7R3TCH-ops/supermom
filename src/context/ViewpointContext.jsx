import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { clearBusinessCache, setSuperOverride } from '../data/currentBusiness';

const ViewpointContext = createContext();

const SUPER_ADMIN_EMAILS = ['jlundie@gmail.com', 'joel@supermom.com', 'joel@supermomforhire.com'];

export function ViewpointProvider({ children }) {
  const [session, setSession] = useState(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [viewingAsId, setViewingAsId] = useState(null);
  const [viewingAsName, setViewingAsName] = useState(null);
  const [allBusinesses, setAllBusinesses] = useState([]);

  useEffect(() => {
    const checkAdmin = async (s) => {
      if (!s?.user) {
        setIsSuperAdmin(false);
        return;
      }
      
      const isEmailAdmin = SUPER_ADMIN_EMAILS.includes(s.user.email);
      if (isEmailAdmin) {
        setIsSuperAdmin(true);
        return;
      }

      // Check DB role
      const { data } = await supabase.from('users').select('role').eq('id', s.user.id).maybeSingle();
      if (data?.role === 'admin') {
        setIsSuperAdmin(true);
      } else {
        setIsSuperAdmin(false);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      checkAdmin(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      checkAdmin(session);
      if (!session) {
        setViewingAsId(null);
        setViewingAsName(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const refresh = () => {
    if (isSuperAdmin) {
      supabase.from('businesses').select('id, name, owner_name, deleted_at').order('name').then(({ data }) => {
        setAllBusinesses(data || []);
      });
    }
  };

  useEffect(() => {
    refresh();
  }, [isSuperAdmin]);

  const switchTo = (bizId, ownerName) => {
    if (!isSuperAdmin) return;
    setViewingAsId(bizId);
    setViewingAsName(ownerName);
    window.__SUPER_VIEW_ID = bizId;
    setSuperOverride(bizId); // New explicit override
    clearBusinessCache(); 
    window.dispatchEvent(new Event('supermom:data-changed'));
  };

  const reset = () => {
    setViewingAsId(null);
    setViewingAsName(null);
    window.__SUPER_VIEW_ID = null;
    setSuperOverride(null); // New explicit reset
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
      allBusinesses,
      refresh
    }}>
      {children}
    </ViewpointContext.Provider>
  );
}

export const useViewpoint = () => useContext(ViewpointContext);
