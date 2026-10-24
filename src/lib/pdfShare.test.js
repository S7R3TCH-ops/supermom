import { describe, it, expect, vi, afterEach } from 'vitest';
import { isStandalonePwa, fetchPdfFile, canShareFile, shareFile } from './pdfShare';

function setNavigator(props) {
  vi.stubGlobal('navigator', props);
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('isStandalonePwa', () => {
  it('is true when iOS navigator.standalone is true', () => {
    setNavigator({ standalone: true });
    expect(isStandalonePwa()).toBe(true);
  });

  it('is false for display-mode: standalone alone (Android/desktop installed PWA)', () => {
    setNavigator({});
    vi.stubGlobal('window', { matchMedia: vi.fn(() => ({ matches: true })) });
    expect(isStandalonePwa()).toBe(false);
  });

  it('is false in a normal browser tab', () => {
    setNavigator({ standalone: false });
    expect(isStandalonePwa()).toBe(false);
  });

  it('is false (no throw) when navigator is missing', () => {
    vi.stubGlobal('navigator', undefined);
    vi.stubGlobal('window', undefined);
    expect(isStandalonePwa()).toBe(false);
  });
});

describe('fetchPdfFile', () => {
  const okRes = (type = 'application/pdf') => ({
    ok: true,
    status: 200,
    headers: { get: (h) => (h.toLowerCase() === 'content-type' ? type : null) },
    blob: async () => new Blob(['%PDF-1.4'], { type }),
  });

  it('returns a PDF File with the given name', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => okRes()));
    const file = await fetchPdfFile('/api/invoice?id=1', 'Doe_Invoice_INV-1.pdf');
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('Doe_Invoice_INV-1.pdf');
    expect(file.type).toBe('application/pdf');
    expect(fetch).toHaveBeenCalledWith('/api/invoice?id=1');
  });

  it('throws on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, headers: { get: () => null } })));
    await expect(fetchPdfFile('/x', 'a.pdf')).rejects.toThrow(/404/);
  });

  it('throws when the body is not a PDF', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => okRes('application/json')));
    await expect(fetchPdfFile('/x', 'a.pdf')).rejects.toThrow(/not a PDF/);
  });
});

describe('canShareFile', () => {
  const file = new File(['x'], 'a.pdf', { type: 'application/pdf' });

  it('is true when share and canShare exist and accept the file', () => {
    const canShare = vi.fn(() => true);
    setNavigator({ share: vi.fn(), canShare });
    expect(canShareFile(file)).toBe(true);
    expect(canShare).toHaveBeenCalledWith({ files: [file] });
  });

  it('is false when canShare rejects the file', () => {
    setNavigator({ share: vi.fn(), canShare: () => false });
    expect(canShareFile(file)).toBe(false);
  });

  it('is false when share is unsupported', () => {
    setNavigator({});
    expect(canShareFile(file)).toBe(false);
    setNavigator({ canShare: () => true });
    expect(canShareFile(file)).toBe(false);
  });

  it('is false when canShare throws', () => {
    setNavigator({ share: vi.fn(), canShare: () => { throw new Error('boom'); } });
    expect(canShareFile(file)).toBe(false);
  });
});

describe('shareFile', () => {
  const file = new File(['x'], 'a.pdf', { type: 'application/pdf' });
  const err = (name) => Object.assign(new Error(name), { name });

  it("returns 'shared' on success and passes files + title", async () => {
    const share = vi.fn(async () => {});
    setNavigator({ share });
    await expect(shareFile(file, 'Doe Invoice')).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith({ files: [file], title: 'Doe Invoice' });
  });

  it("treats AbortError (user dismissed the sheet) as 'cancelled'", async () => {
    setNavigator({ share: vi.fn(async () => { throw err('AbortError'); }) });
    await expect(shareFile(file, 't')).resolves.toBe('cancelled');
  });

  it("returns 'needs-tap' on NotAllowedError", async () => {
    setNavigator({ share: vi.fn(async () => { throw err('NotAllowedError'); }) });
    await expect(shareFile(file, 't')).resolves.toBe('needs-tap');
  });

  it('rethrows any other error', async () => {
    setNavigator({ share: vi.fn(async () => { throw err('DataError'); }) });
    await expect(shareFile(file, 't')).rejects.toThrow('DataError');
  });

  it('turns a synchronous throw from share into the same outcomes', async () => {
    setNavigator({ share: vi.fn(() => { throw err('NotAllowedError'); }) });
    await expect(shareFile(file, 't')).resolves.toBe('needs-tap');
  });

  it('calls navigator.share synchronously (keeps user activation)', () => {
    const share = vi.fn(async () => {});
    setNavigator({ share });
    shareFile(file, 't');
    expect(share).toHaveBeenCalledTimes(1);
  });
});
