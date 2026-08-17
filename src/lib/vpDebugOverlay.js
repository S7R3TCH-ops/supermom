/**
 * TEMPORARY diagnostic overlay for the iOS standalone white-bar bug (v0.13.27).
 *
 * Gated entirely behind the `?vpdebug=1` query param — renders nothing and wires
 * nothing when absent, so it has zero effect on normal users (including Sandra).
 * Shows the live viewport numbers so the fix can be verified on-device by reading
 * real values instead of eyeballing whether a white bar is visible.
 *
 * Reads the `env(safe-area-inset-bottom)` inset via a 0-sized off-screen probe
 * element (JS can't read `env()` directly — only through a computed style).
 * Remove this file and its `installVpDebugOverlay()` call once the fix is verified.
 */
export function installVpDebugOverlay(win = window, doc = document) {
  const qp = new URLSearchParams(win.location.search).get('vpdebug')
  // manifest start_url ('/') drops query params on standalone launch, so the
  // Safari session that first visits ?vpdebug=1 persists a flag that survives
  // into the installed PWA (localStorage is shared cross-launch, same origin).
  if (qp === '1') win.localStorage?.setItem('vpdebug', '1')
  if (qp === '0') win.localStorage?.removeItem('vpdebug')
  if (qp !== '1' && win.localStorage?.getItem('vpdebug') !== '1') return

  // 0-sized probe whose padding resolves env(safe-area-inset-bottom) for readback.
  const probe = doc.createElement('div')
  probe.style.cssText =
    'position:fixed;left:0;bottom:0;width:0;height:0;padding-bottom:env(safe-area-inset-bottom);pointer-events:none;visibility:hidden;'
  doc.body.appendChild(probe)

  const box = doc.createElement('div')
  box.style.cssText =
    'position:fixed;top:0;left:0;z-index:99999;padding:4px 6px;margin:2px;' +
    'font:10px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;' +
    'color:#0f0;background:rgba(0,0,0,0.72);border-radius:4px;' +
    'pointer-events:none;white-space:pre;max-width:60vw;'
  doc.body.appendChild(box)

  const render = () => {
    const vv = win.visualViewport
    const inset = win.getComputedStyle(probe).paddingBottom
    box.textContent =
      `build    ${typeof __COMMIT_SHA__ !== 'undefined' ? __COMMIT_SHA__ : '—'}\n` +
      `innerH   ${win.innerHeight}\n` +
      `vvH      ${vv ? Math.round(vv.height * 100) / 100 : '—'}\n` +
      `screenH  ${win.screen?.height ?? '—'}\n` +
      `safe-bot ${inset}\n` +
      `standaln ${win.navigator?.standalone ? 'yes' : 'no'}`
  }

  render()
  const interval = win.setInterval(render, 500)
  win.addEventListener('resize', render)
  win.visualViewport?.addEventListener('resize', render)
  win.visualViewport?.addEventListener('scroll', render)

  return interval
}
