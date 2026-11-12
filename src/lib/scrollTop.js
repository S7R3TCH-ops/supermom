// One place that knows how to put the app's main screen back at the top.
// Page scroll lives in `.sm-scroll` containers (not sheets, which use `.sm-scroll-sheet`),
// plus the window itself as a fallback. Used by ScrollToTop (route changes) and by sheets
// when the user completes something (save/book/pay/add) so the screen underneath is at the
// top when the sheet goes away. Plain dismiss does NOT call this (keeps list position).
export function scrollMainToTop() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  window.scrollTo(0, 0);
  document.querySelectorAll('.sm-scroll').forEach(el => { el.scrollTop = 0; });
}
