import { describe, it, expect, vi, afterEach } from 'vitest';
import { openInvoice } from './openInvoice';

function setup() {
  const calls = [];
  const open = vi.fn((...a) => calls.push(['open', ...a]));
  vi.stubGlobal('window', { open });
  const navigate = vi.fn((...a) => calls.push(['navigate', ...a]));
  const onClose = vi.fn(() => calls.push(['close']));
  return { calls, open, navigate, onClose };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('openInvoice - standalone (installed iOS PWA)', () => {
  it('closes the sheet, then navigates in-app (replace); never window.open', () => {
    const { calls, open, navigate, onClose } = setup();
    openInvoice({ invoiceId: 'abc', navigate, onClose, isStandalone: () => true });
    expect(open).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/i/abc', { replace: true });
    expect(calls).toEqual([['close'], ['navigate', '/i/abc', { replace: true }]]);
  });

  it('closeAfterOpen does not change the standalone path (single close, before navigate)', () => {
    const { calls, navigate, onClose } = setup();
    openInvoice({ invoiceId: 'abc', navigate, onClose, closeAfterOpen: true, isStandalone: () => true });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(calls.map((c) => c[0])).toEqual(['close', 'navigate']);
  });

  it('works without onClose', () => {
    const { navigate } = setup();
    openInvoice({ invoiceId: 'abc', navigate, isStandalone: () => true });
    expect(navigate).toHaveBeenCalledWith('/i/abc', { replace: true });
  });
});

describe('openInvoice - browser / Android / desktop', () => {
  it('JobDetailSheet shape: window.open(_blank) only, no close, no navigate', () => {
    const { open, navigate, onClose } = setup();
    openInvoice({ invoiceId: 'abc', navigate, onClose, isStandalone: () => false });
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith('/i/abc', '_blank');
    expect(navigate).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('PostJobSheet shape: window.open(_blank) THEN onClose', () => {
    const { calls, navigate, onClose } = setup();
    openInvoice({ invoiceId: 'abc', navigate, onClose, closeAfterOpen: true, isStandalone: () => false });
    expect(navigate).not.toHaveBeenCalled();
    expect(calls).toEqual([['open', '/i/abc', '_blank'], ['close']]);
  });

  it('closeAfterOpen without onClose does not throw', () => {
    const { open, navigate } = setup();
    expect(() => openInvoice({ invoiceId: 'abc', navigate, closeAfterOpen: true, isStandalone: () => false })).not.toThrow();
    expect(open).toHaveBeenCalledWith('/i/abc', '_blank');
  });
});

describe('openInvoice - default detection reads real navigator.standalone', () => {
  it('navigator.standalone === true -> in-app navigate', () => {
    const { open, navigate, onClose } = setup();
    vi.stubGlobal('navigator', { standalone: true });
    openInvoice({ invoiceId: 'x1', navigate, onClose });
    expect(navigate).toHaveBeenCalledWith('/i/x1', { replace: true });
    expect(open).not.toHaveBeenCalled();
  });

  it('navigator.standalone === false -> window.open', () => {
    const { open, navigate } = setup();
    vi.stubGlobal('navigator', { standalone: false });
    openInvoice({ invoiceId: 'x1', navigate });
    expect(open).toHaveBeenCalledWith('/i/x1', '_blank');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('display-mode: standalone alone (Android installed PWA) -> window.open', () => {
    const { open, navigate } = setup();
    vi.stubGlobal('navigator', {});
    openInvoice({ invoiceId: 'x1', navigate });
    expect(open).toHaveBeenCalledWith('/i/x1', '_blank');
    expect(navigate).not.toHaveBeenCalled();
  });
});
