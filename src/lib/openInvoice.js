import { isStandalonePwa } from './pdfShare';

// Open the public invoice page (/i/:id) from a sheet.
//
// Installed iOS PWA (navigator.standalone): window.open(_blank) may open a separate webview
// with different storage/standalone state (WebKit bugs 247270/250651), so navigate in-app
// instead. onClose() runs first so the sheet is gone; navigate uses { replace: true } because
// the open sheet's useBackClose pushed a synthetic same-URL history entry. Replacing it makes
// the invoice's "Back" (navigate(-1)) land on the page the sheet was opened from, with no dead
// extra Back press. useBackClose sees the URL change and skips its own history.back().
//
// Everything else (desktop, Android, browser tabs): exactly the old behavior,
// window.open('/i/<id>', '_blank'). closeAfterOpen keeps each caller's existing browser-path
// close semantics: JobDetailSheet never closed (default false), PostJobSheet closed right after
// opening (true).
export function openInvoice({ invoiceId, navigate, onClose, closeAfterOpen = false, isStandalone = isStandalonePwa }) {
  const path = `/i/${invoiceId}`;
  if (isStandalone()) {
    onClose?.();
    navigate(path, { replace: true });
    return;
  }
  window.open(path, '_blank');
  if (closeAfterOpen) onClose?.();
}
