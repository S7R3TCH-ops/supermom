// Resolves the current user's business_id by looking up their row in the
// `users` table (linked to auth.users via id). Cached after first call so
// subsequent repo queries don't roundtrip every time.

import { supabase } from '../lib/supabase';

let cachedBusinessId = null;
let cachedAuthId = null;

export async function getCurrentBusinessId() {
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr) throw authErr;
  if (!user) throw new Error('Not signed in');

  if (cachedBusinessId && cachedAuthId === user.id) return cachedBusinessId;

  const { data, error } = await supabase
    .from('users')
    .select('business_id')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data?.business_id) {
    throw new Error(`User ${user.email} has no linked business — run scripts/seed.mjs to provision`);
  }
  cachedAuthId = user.id;
  cachedBusinessId = data.business_id;
  return cachedBusinessId;
}

export function clearBusinessCache() {
  cachedBusinessId = null;
  cachedAuthId = null;
}
