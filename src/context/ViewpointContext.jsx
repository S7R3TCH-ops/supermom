import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { clearBusinessCache } from '../data/currentBusiness';

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
