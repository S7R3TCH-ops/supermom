// Pure helpers for grouping error_logs in Admin view (tasks.md #12).
// Groups identical errors by `source + message` client-side so high-frequency
// errors (e.g. Gemini 429s) don't bury other errors.

/**
 * Groups an array of raw error log rows by `source + message`.
 * Preserves all error IDs in each group so they can be bulk-resolved.
 *
 * @param {Array<Object>} errorRows
 * @returns {Array<{
 *   key: string,
 *   source: string,
 *   message: string,
 *   severity: string,
 *   count: number,
 *   ids: string[],
 *   latestCreatedAt: string|null,
 *   newestId: string
 * }>} sorted by latestCreatedAt descending (newest first)
 */
export function groupErrors(errorRows = []) {
  if (!Array.isArray(errorRows)) return [];

  const groups = new Map();

  for (const err of errorRows) {
    if (!err) continue;
    const source = err.source || 'unknown';
    const message = err.message || '(no message)';
    const key = `${source}::${message}`;

    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        source,
        message,
        severity: err.severity || 'error',
        count: 0,
        ids: [],
        latestCreatedAt: err.created_at || null,
        newestId: err.id,
      };
      groups.set(key, group);
    }

    group.count += 1;
    if (err.id) {
      group.ids.push(err.id);
    }

    if (err.created_at) {
      if (!group.latestCreatedAt || new Date(err.created_at).getTime() > new Date(group.latestCreatedAt).getTime()) {
        group.latestCreatedAt = err.created_at;
        group.newestId = err.id;
        if (err.severity) group.severity = err.severity;
      }
    }
  }

  return Array.from(groups.values()).sort((a, b) => {
    const timeA = a.latestCreatedAt ? new Date(a.latestCreatedAt).getTime() : 0;
    const timeB = b.latestCreatedAt ? new Date(b.latestCreatedAt).getTime() : 0;
    return timeB - timeA;
  });
}

/**
 * Formats a timestamp into a compact "last seen" time label.
 */
export function formatErrorLastSeen(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleString('en-CA', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
