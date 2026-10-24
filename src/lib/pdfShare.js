// Helpers for saving/sharing a server-generated PDF from an installed iOS PWA.
// In an iOS home-screen PWA there is no browser chrome, so navigating to the PDF URL
// strands the user on a bare PDF with no back button. Fetch it and hand it to the
// native share sheet instead.

/**
 * True only for an iOS home-screen PWA (`navigator.standalone`, an iOS-Safari-only flag).
 * Deliberately NOT `display-mode: standalone`: Android/desktop installed PWAs have their own
 * download handling and keep the plain anchor.
 */
export function isStandalonePwa() {
  try {
    return typeof navigator !== 'undefined' && navigator.standalone === true;
  } catch {
    return false;
  }
}

/** Fetch a PDF and wrap it as a File. Throws on a non-2xx response or a non-PDF body. */
export async function fetchPdfFile(url, filename) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`PDF fetch failed (${res.status})`);
  const type = res.headers?.get?.('content-type') || '';
  if (!type.toLowerCase().includes('application/pdf')) throw new Error('Response was not a PDF');
  const blob = await res.blob();
  return new File([blob], filename, { type: 'application/pdf' });
}

/** True when the browser can share this file via the native share sheet. */
export function canShareFile(file) {
  if (typeof navigator === 'undefined') return false;
  if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files: [file] }) === true;
  } catch {
    return false;
  }
}

/**
 * Open the share sheet for a file. Resolves 'shared' or 'cancelled' (user dismissed the sheet,
 * not an error); 'needs-tap' when the browser refused for lack of user activation (retry from a
 * fresh tap). Anything else throws.
 *
 * navigator.share is invoked synchronously (no await before it) so a tap handler can call this
 * and keep its user activation.
 */
export function shareFile(file, title) {
  let pending;
  try {
    pending = navigator.share({ files: [file], title });
  } catch (e) {
    pending = Promise.reject(e);
  }
  return Promise.resolve(pending).then(
    () => 'shared',
    (e) => {
      if (e?.name === 'AbortError') return 'cancelled';
      if (e?.name === 'NotAllowedError') return 'needs-tap';
      throw e;
    },
  );
}
