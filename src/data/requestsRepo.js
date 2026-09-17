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
    .select('id, business_id, kind, title, body, context, status, notified_at, exported_at, created_at, businesses(name)')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}

/** Admin-only (RLS): change a request's triage status. */
export async function updateRequestStatus(id, status) {
  const { error } = await supabase
    .from('client_requests')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}
