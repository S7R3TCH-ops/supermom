// Pure helpers for the in-app request pipeline (RequestSheet / requestsRepo).
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
