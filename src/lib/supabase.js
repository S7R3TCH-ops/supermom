import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn(
    '[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — copy .env.example to .env and fill in values.'
  );
}

export const supabase = createClient(url ?? '', anonKey ?? '', {
  auth: { persistSession: true, autoRefreshToken: true },
});

export const hasSupabaseConfig = Boolean(url && anonKey);

/** Current session's access token, for Authorization headers on /api/* calls. */
export async function getAccessToken() {
  const { data: { session } = {} } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

/** Standard JSON + Bearer headers for authenticated /api/* fetches. */
export async function authHeaders() {
  const token = await getAccessToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
