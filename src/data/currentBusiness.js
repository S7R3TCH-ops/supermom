// Resolves the current user's business_id by looking up their row in the
// `users` table (linked to auth.users via id). Cached after first call so
// subsequent repo queries don't roundtrip every time.

import { supabase } from '../lib/supabase';

let cachedBusinessId = null;
let cachedAuthId = null;
let cachedRole = null;
let superOverrideId = sessionStorage.getItem('superViewId') || null;

export function setSuperOverride(id) {
  superOverrideId = id;
  if (id) sessionStorage.setItem('superViewId', id);
  else sessionStorage.removeItem('superViewId');
}

export async function getCurrentBusinessId() {
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr) throw authErr;
  if (!user) throw new Error('Not signed in');

  // Fast path: non-admin users always use their own business_id, never the super override
  if (cachedBusinessId && cachedAuthId === user.id && cachedRole && cachedRole !== 'admin') {
    return cachedBusinessId;
  }

  const { data, error } = await supabase
    .from('users')
    .select('business_id, role')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;

  // Only admins can use the Super Admin viewpoint override
  if (data?.role === 'admin') {
    const overrideId = superOverrideId || sessionStorage.getItem('superViewId') || window.__SUPER_VIEW_ID;
    if (overrideId && overrideId !== 'null') return overrideId;
    if (!data?.business_id) return null; // Global Admin with no viewpoint selected
  }

  if (!data?.business_id) {
    throw new Error(`User ${user.email} has no linked business — run scripts/seed.mjs to provision`);
  }

  cachedAuthId = user.id;
  cachedBusinessId = data.business_id;
  cachedRole = data.role;
  return cachedBusinessId;
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
}
