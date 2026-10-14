// Which jobs.ai_context keys a client-side job edit may write.
//
// Edits (JobDetailSheet, GeofenceContext, …) build their ai_context patch from a
// snapshot of the job held in memory. That snapshot can be stale or belong to a
// sibling job, so writing it back wholesale can drop or copy keys that are owned
// by the server or by one specific visit. The worst case is gcal_event_id: losing
// it makes the next GCal sync insert a second event, and copying it onto other
// jobs makes the whole series share (and keep moving) a single Google event.

// Written only by the server / series generator. Client edits must never change them.
export const SYSTEM_AI_CONTEXT_KEYS = [
  'gcal_event_id',
  'gcal_sync_status',
  'gcal_last_sync',
  'occurrence_index',
  'template_id',
];

// Belong to one visit, so a series-wide edit must not copy them to sibling jobs.
export const PER_JOB_AI_CONTEXT_KEYS = [
  ...SYSTEM_AI_CONTEXT_KEYS,
  'drive_to',
  'drive_to_live',
  'clock_in_time',
  'clock_out_time',
  'geofence_status',
];

export function omitKeys(ctx, keys) {
  const out = { ...(ctx || {}) };
  for (const k of keys) delete out[k];
  return out;
}

// Single-job save: the caller's ai_context is authoritative for every key except
// the system ones, which always come from the job's current DB value. Omitting a
// non-system key still deletes it (JobDetailSheet clears drive_to on a reschedule
// by leaving it out).
export function mergeAiContextForJobSave(fresh, incoming) {
  const merged = omitKeys(incoming, SYSTEM_AI_CONTEXT_KEYS);
  for (const k of SYSTEM_AI_CONTEXT_KEYS) {
    if (fresh && fresh[k] !== undefined) merged[k] = fresh[k];
  }
  return merged;
}
