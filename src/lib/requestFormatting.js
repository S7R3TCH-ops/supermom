// Pure helpers for the in-app request pipeline (RequestSheet / requestsRepo / Admin).
// Kept separate from requestsRepo.js so they're unit-testable without pulling
// in supabase.js/currentBusiness.js's module-level browser globals (matches
// financialMath.js/selectors.ts's split from the *Repo.js files).

/** First line or first 80 chars of the body, trimmed — the DB/email/file headline. */
export function deriveTitle(body) {
  const trimmed = (body || '').trim();
  const firstLine = trimmed.split('\n')[0].trim();
  const src = firstLine || trimmed;
  return src.length > 80 ? `${src.slice(0, 79)}…` : (src || 'Untitled');
}

/** Route/build/device context auto-captured with every submission — nothing personal beyond it. */
export function captureContext() {
  let standalone = false;
  try {
    standalone = window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator?.standalone || false;
  } catch { /* matchMedia unavailable — leave false */ }

  let theme = 'warm';
  try { theme = localStorage.getItem('supermom-theme') || 'warm'; } catch { /* private mode etc. */ }

  const appHeight = document.documentElement.style.getPropertyValue('--app-height') || null;

  return {
    route: window.location.pathname,
    commit: typeof __COMMIT_SHA__ !== 'undefined' ? __COMMIT_SHA__ : 'dev',
    user_agent: navigator.userAgent,
    theme,
    standalone,
    viewport: { w: window.innerWidth, h: window.innerHeight },
    app_height: appHeight,
  };
}

/** Every value the client_requests.status check constraint allows, in triage order. */
export const REQUEST_STATUSES = ['new', 'triaged', 'planned', 'done', 'declined'];

/** Active statuses that need attention in admin. */
export const ACTIVE_STATUSES = ['new', 'triaged', 'planned'];

/** Finished statuses that auto-hide after 72h. */
export const FINISHED_STATUSES = ['done', 'declined'];

export function isActiveRequest(statusOrRequest) {
  const status = typeof statusOrRequest === 'string' ? statusOrRequest : statusOrRequest?.status;
  return ACTIVE_STATUSES.includes(status);
}

export function isFinishedRequest(statusOrRequest) {
  const status = typeof statusOrRequest === 'string' ? statusOrRequest : statusOrRequest?.status;
  return FINISHED_STATUSES.includes(status);
}

/** 72 hours in milliseconds for finished request auto-hide cutoff. */
export const FINISHED_AUTO_HIDE_MS = 72 * 60 * 60 * 1000;

/**
 * Returns ISO timestamp string for 72h cutoff relative to now (or given date).
 */
export function getFinishedCutoffDate(now = new Date()) {
  const nowDate = now instanceof Date ? now : new Date(now);
  return new Date(nowDate.getTime() - FINISHED_AUTO_HIDE_MS).toISOString();
}

/**
 * Check if a finished request was updated within the last 72h.
 */
export function isFinishedWithinCutoff(request, now = new Date()) {
  if (!request) return false;
  const updatedAt = request.updated_at ? new Date(request.updated_at).getTime() : 0;
  const nowDate = now instanceof Date ? now : new Date(now);
  const cutoff = nowDate.getTime() - FINISHED_AUTO_HIDE_MS;
  return updatedAt >= cutoff;
}

/**
 * Determines if a request should be visible in Admin (active always, finished within 72h).
 */
export function isRequestVisibleInAdmin(request, now = new Date()) {
  if (!request) return false;
  if (isActiveRequest(request)) return true;
  if (isFinishedRequest(request)) return isFinishedWithinCutoff(request, now);
  return false;
}

const STATUS_PRIORITY = {
  new: 0,
  triaged: 1,
  planned: 2,
  done: 3,
  declined: 4,
};

/**
 * Sorts Needs Attention requests:
 * 1. Status: 'new' first, then 'triaged', then 'planned'
 * 2. Oldest-first within a status (by created_at asc so nothing rots)
 */
export function sortNeedsAttentionRequests(requests) {
  if (!Array.isArray(requests)) return [];
  return [...requests].sort((a, b) => {
    const prioA = STATUS_PRIORITY[a.status] ?? 99;
    const prioB = STATUS_PRIORITY[b.status] ?? 99;
    if (prioA !== prioB) return prioA - prioB;
    const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return timeA - timeB;
  });
}

/**
 * Owner-facing badge per status (MyRequestsSheet). Plain words — Sandra never
 * sees the raw triage vocabulary. Colors follow DESIGN.md's badge table.
 */
export const REQUEST_STATUS_BADGES = {
  new:      { label: 'Sent',          bg: '#FFE0EC', fg: '#9B0D3A' },
  triaged:  { label: 'Seen by Joel',  bg: '#EEF2FF', fg: '#3730A3' },
  planned:  { label: 'On the list',   bg: '#F5F3FF', fg: '#5B21B6' },
  done:     { label: 'Done ✓',        bg: '#DCFCE7', fg: '#14532D' },
  declined: { label: 'Not doing',     bg: '#F3F4F6', fg: '#4B5563' },
};

/**
 * Admin-facing status pills for request headers in Admin.jsx.
 * New (pink fill), Triaged (amber), Planned (blue/neutral), ✓ Done (green), Declined (gray).
 */
export const ADMIN_STATUS_PILLS = {
  new:      { label: 'New',      bg: 'rgba(252,70,147,0.2)',  fg: '#FDA4AF', border: 'rgba(252,70,147,0.4)' },
  triaged:  { label: 'Triaged',  bg: 'rgba(245,158,11,0.2)',  fg: '#FCD34D', border: 'rgba(245,158,11,0.4)' },
  planned:  { label: 'Planned',  bg: 'rgba(59,130,246,0.2)',  fg: '#93C5FD', border: 'rgba(59,130,246,0.4)' },
  done:     { label: '✓ Done',   bg: 'rgba(34,197,94,0.2)',   fg: '#86EFAC', border: 'rgba(34,197,94,0.4)' },
  declined: { label: 'Declined', bg: 'rgba(156,163,175,0.2)', fg: '#D1D5DB', border: 'rgba(156,163,175,0.4)' },
};

export function getAdminStatusPill(status) {
  return ADMIN_STATUS_PILLS[status] || {
    label: status || 'Unknown',
    bg: 'rgba(255,255,255,0.1)',
    fg: 'rgba(255,255,255,0.7)',
    border: 'rgba(255,255,255,0.2)',
  };
}
