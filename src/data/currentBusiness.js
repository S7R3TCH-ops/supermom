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

export function setSuperOverride(id) {
  superOverrideId = id;
  cachedEffectiveId = null; // force re-resolve on next call
  if (id) sessionStorage.setItem('superViewId', id);
  else sessionStorage.removeItem('superViewId');
}

export async function getCurrentBusinessId() {
  // Fast path: getSession() reads from localStorage — no network call.
  // If the cached user still matches, return the cached effective ID immediately.
  if (cachedEffectiveId !== null && cachedAuthId) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id === cachedAuthId) {
      return cachedEffectiveId;
    }
    // Auth user changed (sign-out / sign-in) — drop the cache and re-resolve.
    clearBusinessCache();
  }

  // Slow path: validate with server and look up role + business in DB.
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

  // Only admins can use the Super Admin viewpoint override.
  if (data?.role === 'admin') {
    const overrideId = superOverrideId || sessionStorage.getItem('superViewId') || window.__SUPER_VIEW_ID;
    if (overrideId && overrideId !== 'null') {
      cachedEffectiveId = overrideId;
      return overrideId;
    }
    // Global Admin with no viewpoint selected — don't cache null so they can pick one.
    if (!data?.business_id) return null;
    cachedEffectiveId = data.business_id;
    return data.business_id;
  }

  if (!data?.business_id) {
    throw new Error(`User ${user.email} has no linked business — run scripts/seed.mjs to provision`);
  }

  cachedBusinessId = data.business_id;
  cachedEffectiveId = data.business_id;
  return data.business_id;
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
