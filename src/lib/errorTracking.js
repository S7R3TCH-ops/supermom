// Best-effort client error capture into public.error_logs (see
// supabase/migrations/20260710010000_add_error_logs.sql). Never throws —
// logging itself must never be the thing that breaks the app.

import { supabase } from './supabase';
import { getCurrentBusinessId } from '../data/currentBusiness';

export async function logClientError(error, context = {}) {
  try {
    const businessId = await getCurrentBusinessId().catch(() => null);
    const message = String(error?.message ?? error ?? 'Unknown error').slice(0, 2000);
    const stack = error?.stack ? String(error.stack).slice(0, 4000) : null;
    await supabase.from('error_logs').insert({
      business_id: businessId,
      source: 'client',
      severity: context.severity || 'error',
      message,
      stack,
      context: { url: window.location.href, ...context },
    });
  } catch {
    // Swallow — a failed error-log write must not itself surface to the user.
  }
}

// Catches genuinely unhandled errors — the ones Sandra hits without a
// toast.error ever firing, so nobody hears about them unless she happens
// to mention it. Install once at app startup.
export function installGlobalErrorTracking() {
  window.addEventListener('error', (event) => {
    logClientError(event.error ?? new Error(event.message), { type: 'window.onerror' });
  });
  window.addEventListener('unhandledrejection', (event) => {
    logClientError(event.reason, { type: 'unhandledrejection' });
  });
}
