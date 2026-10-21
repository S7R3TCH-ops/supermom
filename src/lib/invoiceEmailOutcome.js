// Latest (max) invoice/receipt sent-at across an invoice's jobs. Deterministic: the
// embedded invoice_jobs order is not guaranteed, and jobs can carry different stamps
// (e.g. one that was on an earlier invoice), so never pick "the first one".
export function latestSentStamps(inv) {
  const jobs = (inv?.invoice_jobs || []).map(ij => ij.jobs).filter(Boolean);
  const latest = (field) => jobs.reduce((best, j) => {
    const v = j[field];
    if (!v) return best;
    return !best || Date.parse(v) > Date.parse(best) ? v : best;
  }, null);
  return { invoiceSentAt: latest('invoice_sent_at'), receiptSentAt: latest('receipt_sent_at') };
}

// Decides what the Email button should say after a POST /api/invoice that did not
// come back as a clean 200. The server only stamps invoice_sent_at / receipt_sent_at
// after sendMail resolves, so a changed stamp proves the email went out even when the
// response was lost (iOS PWA fetch abort, timeout, flaky network). Compare against a
// snapshot taken before the request, never against the client clock (skew).

// Gateway/timeout statuses: the platform answered, not our handler, so the server may
// still have finished the send. Treat like "no response" rather than a real failure.
const AMBIGUOUS_STATUSES = new Set([408, 502, 503, 504]);

/**
 * @param {object} p
 * @param {{invoiceSentAt: ?string, receiptSentAt: ?string}} p.before - stamps before the request
 * @param {?{invoiceSentAt: ?string, receiptSentAt: ?string}} p.after - stamps re-read after the
 *   failure, or null if the re-read itself failed
 * @param {?number} p.status - HTTP status if a response arrived, else null (network-level error)
 * @returns {'sent' | 'error' | 'unsure'}
 */
export function resolveEmailFailureOutcome({ before, after, status = null }) {
  if (after) {
    // The server decides receipt vs invoice, so either stamp moving means it was sent.
    const changed = (after.invoiceSentAt || null) !== (before.invoiceSentAt || null)
      || (after.receiptSentAt || null) !== (before.receiptSentAt || null);
    if (changed) return 'sent';
  }
  const hadRealResponse = status != null && !AMBIGUOUS_STATUSES.has(status);
  // A genuine server error response ("Failed — retry") is trustworthy; anything else
  // (no response, gateway timeout) might have sent, so warn before she resends.
  return hadRealResponse ? 'error' : 'unsure';
}
