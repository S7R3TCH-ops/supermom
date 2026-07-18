/**
 * Viewport-height correction for the CSS `--app-height` custom property.
 *
 * Why this exists: `100vh`/`100dvh` misreport the real visible area on some
 * engines (older iOS standalone PWA, Android nav-bar show/hide transitions).
 * We pin `--app-height` to the actual visible height (visualViewport when
 * present) as the top of the CSS fallback chain in `index.css`
 * (`height: 100vh → 100dvh → var(--app-height, 100dvh)`).
 *
 * Cold-launch iOS caveat (the v0.13.25 fix): on a standalone PWA cold launch,
 * iOS reports a transient viewport height at first script execution and then
 * settles its final chrome-less / safe-area layout a beat later WITHOUT firing
 * a `resize` event. A single synchronous read at module-eval time therefore
 * sticks at a stale value (the "white bar at the bottom on first load") until
 * some later genuine VisualViewport event — e.g. the iOS Reachability pull-down
 * gesture — happens to fire and recompute it. `installAppHeight` re-reads at the
 * settle points a cold standalone launch actually honors: next paint (double
 * rAF), `load`, `pageshow`, and two short post-mount delays that cover iOS
 * settling with NO event at all. It also listens to visualViewport `scroll`
 * (Reachability and Safari toolbar show/hide fire scroll, not always resize),
 * which is the exact signal that was already fixing it manually.
 */

/** Pure: the real visible viewport height in px. visualViewport wins over innerHeight. */
export function resolveViewportHeight(win = window) {
  return win.visualViewport?.height ?? win.innerHeight
}

/** Writes the resolved height onto the `--app-height` custom property. Returns the value used. */
export function applyAppHeight(win = window, doc = document) {
  const h = resolveViewportHeight(win)
  doc.documentElement.style.setProperty('--app-height', `${h}px`)
  return h
}

/**
 * iOS standalone-only: force WebKit to (re)compute viewport-fit=cover geometry.
 * On a cold standalone launch WebKit can lay the canvas out at safe-area height
 * and never recompute (white native bar below the canvas) until a real geometry
 * change — e.g. the Reachability gesture. Toggling viewport-fit cover->auto->cover
 * across two frames triggers that recomputation programmatically.
 */
export function kickViewportGeometry(win = window, doc = document) {
  if (!win.navigator?.standalone) return
  const meta = doc.querySelector('meta[name="viewport"]')
  const original = meta?.getAttribute('content')
  if (!original?.includes('viewport-fit=cover')) return
  meta.setAttribute('content', original.replace('viewport-fit=cover', 'viewport-fit=auto'))
  win.requestAnimationFrame(() => {
    meta.setAttribute('content', original)
    win.requestAnimationFrame(() => applyAppHeight(win, doc))
  })
}

/** Sets `--app-height` now and keeps it correct across the cold-launch and ongoing events. */
export function installAppHeight(win = window, doc = document) {
  const set = () => applyAppHeight(win, doc)

  // Initial synchronous read — correct on desktop and warm/already-settled loads.
  set()

  // iOS standalone cold-launch: WebKit sometimes lays the canvas out at safe-area
  // height and never applies viewport-fit=cover geometry, leaving a native white
  // bar below the canvas that no CSS/height fix can reach — only a real geometry
  // change (the Reachability gesture) fixes it. Kick that recomputation now and
  // once more after the launch settles. No-op off iOS standalone.
  kickViewportGeometry(win, doc)
  win.setTimeout?.(() => kickViewportGeometry(win, doc), 350)

  // Re-read at the settle points a cold iOS standalone PWA launch actually honors.
  // Double rAF = after the first real layout/paint; load/pageshow = the app became
  // visible; the short timeouts cover the iOS case where the viewport settles to its
  // final safe-area size while firing NO resize event (the root cause of the bug).
  win.requestAnimationFrame?.(() => win.requestAnimationFrame?.(set))
  win.addEventListener('load', set)
  win.addEventListener('pageshow', set)
  win.setTimeout?.(set, 150)
  win.setTimeout?.(set, 300)

  // Ongoing corrections through rotation, keyboard, and nav-bar show/hide.
  win.addEventListener('resize', set)
  win.addEventListener('orientationchange', set)
  win.visualViewport?.addEventListener('resize', set)
  win.visualViewport?.addEventListener('scroll', set) // Reachability / iOS toolbar transitions
}
