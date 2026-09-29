import { supabase, authHeaders } from '../lib/supabase';
import { getCurrentBusinessId } from './currentBusiness';
import { logClientError } from '../lib/errorTracking';
import {
  deriveTitle,
  captureContext,
  ACTIVE_STATUSES,
  FINISHED_STATUSES,
  getFinishedCutoffDate,
  sortNeedsAttentionRequests,
} from '../lib/requestFormatting';

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

const ADMIN_LIST_FIELDS = 'id, business_id, kind, title, body, status, admin_notes, notified_at, exported_at, created_at, updated_at, businesses(name)';

/**
 * Admin-only: list active requests (new, triaged, planned; sorted by status priority then oldest-first)
 * and recent finished requests (done, declined within 72h).
 * Drops heavy `context` jsonb from list queries for low network payload on page load.
 */
export async function listRequestsAdmin() {
  const cutoff = getFinishedCutoffDate();

  const [activeRes, finishedRes] = await Promise.all([
    supabase
      .from('client_requests')
      .select(ADMIN_LIST_FIELDS)
      .in('status', ACTIVE_STATUSES)
      .limit(100),
    supabase
      .from('client_requests')
      .select(ADMIN_LIST_FIELDS)
      .in('status', FINISHED_STATUSES)
      .gte('updated_at', cutoff)
      .order('updated_at', { ascending: false })
      .limit(50),
  ]);

  if (activeRes.error) throw activeRes.error;
  if (finishedRes.error) throw finishedRes.error;

  const active = sortNeedsAttentionRequests(activeRes.data || []);
  const finished = finishedRes.data || [];

  return { active, finished };
}

/**
 * On-demand fetch for older finished requests (updated_at < 72h cutoff).
 * Never called on initial page load.
 */
export async function listOlderFinishedRequestsAdmin() {
  const cutoff = getFinishedCutoffDate();
  const { data, error } = await supabase
    .from('client_requests')
    .select(ADMIN_LIST_FIELDS)
    .in('status', FINISHED_STATUSES)
    .lt('updated_at', cutoff)
    .order('updated_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}

/**
 * Lazy-load context for a single request on row expand.
 */
export async function fetchRequestContext(requestId) {
  if (!requestId) return null;
  const { data, error } = await supabase
    .from('client_requests')
    .select('context')
    .eq('id', requestId)
    .single();
  if (error) throw error;
  return data?.context ?? null;
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

  const statusChanged = Boolean(status && status !== oldStatus);
  if (statusChanged || trimmedReply) {
    const patch = { updated_at: new Date().toISOString() };
    if (statusChanged) patch.status = status;
    const { error: reqErr } = await supabase
      .from('client_requests')
      .update(patch)
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
