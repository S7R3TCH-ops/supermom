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
    .select('id, business_id, kind, title, body, status, admin_notes, created_at, updated_at')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}

/**
 * Thread messages for a request (both Joel and reporter replies).
 */
export async function listRequestMessages(requestId) {
  if (!requestId) return [];
  const { data, error } = await supabase
    .from('request_messages')
    .select('id, request_id, author_role, author_id, body, created_at')
    .eq('request_id', requestId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

/**
 * Owner reply to a request.
 * Database trigger automatically reopens status from 'done' to 'triaged'.
 * Only ever called from a 'done' request's reply box (MyRequestsSheet), so
 * every call here is a reopen — Joel gets a fire-and-forget email alert since
 * the status flip is otherwise invisible unless he's in Admin.
 */
export async function replyToRequest(requestId, businessId, body) {
  if (!body?.trim()) return null;
  const trimmed = body.trim();
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('request_messages')
    .insert({
      request_id: requestId,
      business_id: businessId,
      author_role: 'owner',
      author_id: user?.id ?? null,
      body: trimmed,
    })
    .select()
    .single();
  if (error) throw error;

  fetch('/api/ai/notify-request-reopened', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ requestId, replyBody: trimmed }),
  }).catch(e => logClientError(e, { type: 'notify-request-reopened', requestId }));

  return data;
}

/**
 * Combined Admin save action:
 * 1. Inserts replyBody to request_messages if non-empty
 * 2. Updates client_requests.status if changed (leaving admin_notes untouched)
 * 3. Dispatches exactly one notification (done or reply) if applicable
 */
export async function saveRequestAdmin(id, businessId, { status, oldStatus, replyBody }) {
  const trimmedReply = replyBody?.trim();
  if (trimmedReply) {
    const { data: { user } } = await supabase.auth.getUser();
    const { error: msgErr } = await supabase
      .from('request_messages')
      .insert({
        request_id: id,
        business_id: businessId,
        author_role: 'admin',
        author_id: user?.id ?? null,
        body: trimmedReply,
      });
    if (msgErr) throw msgErr;
  }

  if (status && status !== oldStatus) {
    const { error: reqErr } = await supabase
      .from('client_requests')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (reqErr) throw reqErr;
  }

  if (status === 'done' && oldStatus !== 'done') {
    fetch('/api/ai/notify-request-done', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ requestId: id, replyBody: trimmedReply || null }),
    }).catch(e => logClientError(e, { type: 'notify-request-done', requestId: id }));
  } else if (trimmedReply) {
    fetch('/api/ai/notify-request-reply', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ requestId: id, replyBody: trimmedReply }),
    }).catch(e => logClientError(e, { type: 'notify-request-reply', requestId: id }));
  }
}

export async function nudgeRequest(id, oldBody) {
  const newBody = oldBody + '\n\n[Follow up]: Can I get an update on this?';
  const { error } = await supabase
    .from('client_requests')
    .update({ body: newBody, updated_at: new Date().toISOString() })
    .eq('id', id);
    
  if (error) throw error;
  
  fetch('/api/ai/notify-request', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ requestId: id, nudge: true }),
  }).catch(() => {});
}
