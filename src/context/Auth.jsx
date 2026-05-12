import { useEffect, useMemo, useState } from 'react';
import { supabase, hasSupabaseConfig } from '../lib/supabase';
import { AuthContext } from './AuthContext';
import { clearBusinessCache } from '../data/currentBusiness';

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(hasSupabaseConfig);
  const [recoveryMode, setRecoveryMode] = useState(false);

  useEffect(() => {
    if (!hasSupabaseConfig) {
      return;
    }

    const fetchProfile = async (u) => {
      if (!u) { setProfile(null); return; }
      const { data } = await supabase.from('users').select('*').eq('id', u.id).maybeSingle();
      setProfile(data);
    };

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) fetchProfile(data.session.user);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true);
      } else if (recoveryMode) {
        setRecoveryMode(false);
      }
      setSession(s);
      if (s?.user) fetchProfile(s.user);
      else setProfile(null);
    });

    return () => sub.subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    profile,
    loading,
    configured: hasSupabaseConfig,
    recoveryMode,
    clearRecoveryMode: () => setRecoveryMode(false),
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signUp: (email, password) => supabase.auth.signUp({ email, password }),
    signOut: async () => { clearBusinessCache(); return supabase.auth.signOut(); },
  }), [session, profile, loading, recoveryMode]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
