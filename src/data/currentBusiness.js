// Resolves the current user's business_id by looking up their row in the
// `users` table (linked to auth.users via id). Cached after first call so
// subsequent repo queries don't roundtrip every time.

import { supabase } from '../lib/supabase';

let cachedBusinessId = null;
let cachedAuthId = null;

export async function getCurrentBusinessId() {
  // Super Admin Viewpoint Override
  const overrideId = window.__SUPER_VIEW_ID;
  if (overrideId) return overrideId;

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr) throw authErr;
  if (!user) throw new Error('Not signed in');

  if (cachedBusinessId && cachedAuthId === user.id) return cachedBusinessId;

  const { data, error } = await supabase
    .from('users')
    .select('business_id, role')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;

  if (data?.role === 'admin' && !data?.business_id) {
    // Global Admin - return null to allow app to load
    return null;
  }

  if (!data?.business_id) {
    throw new Error(`User ${user.email} has no linked business — run scripts/seed.mjs to provision`);
  }
  cachedAuthId = user.id;
  cachedBusinessId = data.business_id;
  return cachedBusinessId;
}

export async function getBusinessProfile() {
  const bid = await getCurrentBusinessId();
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
}
