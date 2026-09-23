import { supabase, authHeaders } from '../lib/supabase';
import { getCurrentBusinessId } from './currentBusiness';
import { logClientError } from '../lib/errorTracking';
import { deriveTitle, captureContext } from '../lib/requestFormatting';

export { deriveTitle, captureContext };

/**
 * Insert is awaited and gates the confirmation state; the notify is
 * fire-and-forget with both branches logged (never blocks success).
 */
export async function submitRequest({ kind, body }) {
  const businessId = await getCurrentBusinessId();
  const { data: { user } } = await supabase.auth.getUser();
  const title = deriveTitle(body);
  const context = captureContext();

  const { data: row, error } = await supabase
    .from('client_requests')
    .insert({
      business_id: businessId,
      submitted_by: user?.id ?? null,
      kind,
      title,
      body: body.trim(),
      context,
    })
    .select()
    .single();
  if (error) throw error;

  fetch('/api/ai/notify-request', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ requestId: row.id }),
  })
    .then(res => {
      if (!res.ok) logClientError(new Error(`notify-request ${res.status}`), { type: 'notify-request', requestId: row.id });
    })
    .catch(e => logClientError(e, { type: 'notify-request', requestId: row.id }));

  return row;
}

/** Admin-only (RLS): last 50 requests across every business. */
export async function listRequestsAdmin() {
  const { data, error } = await supabase
    .from('client_requests')
    .select('id, business_id, kind, title, body, context, status, admin_notes, notified_at, exported_at, created_at, businesses(name)')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}

/**
 * The current business's own requests ("My requests" sheet). Filtered by
 * business_id, not submitted_by, so Joel "viewing as" Sandra sees her list.
 * RLS (client_requests_select) already scopes owners to their business.
 */
export async function listMyRequests() {
  const businessId = await getCurrentBusinessId();
  if (!businessId) return [];
  const { data, error } = await supabase
    .from('client_requests')
    .select('id, kind, title, body, status, admin_notes, created_at, updated_at')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}

/**
 * Admin-only (RLS): save a request's triage status and reply together.
 * NOTE: admin_notes is CLIENT-VISIBLE — it renders as "Joel's reply" in the
 * owner's My requests sheet. Never put private triage notes here.
 * Blank/whitespace notes are stored as null so no empty reply block shows.
 */
export async function updateRequestAdmin(id, { status, admin_notes }) {
  const notes = (admin_notes || '').trim();
  const { error } = await supabase
    .from('client_requests')
    .update({ status, admin_notes: notes || null, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}
