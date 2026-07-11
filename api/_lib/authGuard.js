// Shared Bearer-JWT auth guard for serverless endpoints that use the
// service-role key (which bypasses RLS). Pattern mirrors api/admin/provision.js.

/**
 * Verifies the request's Authorization: Bearer <supabase jwt> and resolves the
 * caller's business scope from public.users.
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin - service-role client
 * @returns {Promise<{user, businessId, role, isAdmin} | {error: {status, message}}>}
 */
export async function requireUser(req, supabaseAdmin) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return { error: { status: 401, message: 'Missing Authorization header' } };
  }
  const token = authHeader.slice('Bearer '.length);

  const { data: { user } = {}, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    return { error: { status: 401, message: 'Invalid or expired token' } };
  }

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('business_id, role')
    .eq('id', user.id)
    .single();
  if (!profile) {
    return { error: { status: 403, message: 'No user profile found for this account' } };
  }

  return {
    user,
    businessId: profile.business_id,
    role: profile.role,
    isAdmin: profile.role === 'admin',
  };
}

/**
 * Super admins (role 'admin', not linked to a business) may act on any business;
 * everyone else only on their own.
 */
export function canAccessBusiness(auth, businessId) {
  if (auth.isAdmin) return true;
  return Boolean(businessId) && auth.businessId === businessId;
}

/**
 * Verifies the caller may act on the given client. Returns the client's
 * business_id when allowed, or null when the client doesn't exist / is out of scope.
 */
export async function assertClientAccess(supabaseAdmin, auth, clientId) {
  if (!clientId) return null;
  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('business_id')
    .eq('id', clientId)
    .single();
  if (!client || !canAccessBusiness(auth, client.business_id)) return null;
  return client.business_id;
}
