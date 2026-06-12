// Resolves the current user's business_id by looking up their row in the
// `users` table (linked to auth.users via id). Cached after first call so
// subsequent repo queries don't roundtrip every time.

import { supabase } from '../lib/supabase';

let cachedBusinessId = null;
let cachedAuthId = null;
let cachedRole = null;
// cachedEffectiveId: the resolved business ID actually returned (covers admin override too).
// Cleared by clearBusinessCache() and setSuperOverride() so the override is always fresh.
let cachedEffectiveId = null;
let superOverrideId = sessionStorage.getItem('superViewId') || null;
// In-flight resolution promise — all concurrent callers share one DB roundtrip on cold start.
let resolutionPromise = null;

export function setSuperOverride(id) {
  superOverrideId = id;
  cachedEffectiveId = null;
  resolutionPromise = null;
  if (id) sessionStorage.setItem('superViewId', id);
  else sessionStorage.removeItem('superViewId');
}

export async function getCurrentBusinessId() {
  // Fast path: getSession() reads from localStorage — no network call.
  if (cachedEffectiveId !== null && cachedAuthId) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id === cachedAuthId) {
      return cachedEffectiveId;
    }
    // Auth user changed — drop cache and re-resolve.
    clearBusinessCache();
  }

  // Deduplicate: if a slow-path resolution is already in flight (e.g. 8 hooks
  // mounting simultaneously), all callers share the same promise instead of
  // each firing their own getUser() + users-table query.
  if (resolutionPromise) return resolutionPromise;

  resolutionPromise = (async () => {
    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      if (!user) throw new Error('Not signed in');

      const { data, error } = await supabase
        .from('users')
        .select('business_id, role')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;

      cachedAuthId = user.id;
      cachedRole = data?.role;

      if (data?.role === 'admin') {
        const overrideId = superOverrideId || sessionStorage.getItem('superViewId') || window.__SUPER_VIEW_ID;
        if (overrideId && overrideId !== 'null') {
          cachedEffectiveId = overrideId;
          return overrideId;
        }
        if (!data?.business_id) return null; // Global Admin, no viewpoint selected — don't cache null
        cachedEffectiveId = data.business_id;
        return data.business_id;
      }

      if (!data?.business_id) {
        throw new Error(`User ${user.email} has no linked business — run scripts/seed.mjs to provision`);
      }

      cachedBusinessId = data.business_id;
      cachedEffectiveId = data.business_id;
      return data.business_id;
    } finally {
      resolutionPromise = null;
    }
  })();

  return resolutionPromise;
}

export async function getBusinessProfile() {
  const bid = await getCurrentBusinessId();
  if (!bid) return null; // Safe fallback for Global Admins

  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', bid)
    .single();
  if (error) throw error;
  return data;
}

export async function updateBusinessProfile(patch) {
  const bid = await getCurrentBusinessId();
  const { data, error } = await supabase
    .from('businesses')
    .update(patch)
    .eq('id', bid)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export function clearBusinessCache() {
  cachedBusinessId = null;
  cachedAuthId = null;
  cachedRole = null;
  cachedEffectiveId = null;
}
