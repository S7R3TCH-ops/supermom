export default function PhotoLightbox({ url, onClose }) {
  if (!url) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.9)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <img
        src={url}
        alt=""
        onClick={onClose}
        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8, cursor: 'pointer' }}
      />
      <button
        onClick={onClose}
        aria-label="Close"
        style={{
          position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 14px)', right: 14,
          width: 36, height: 36, borderRadius: '50%', border: 'none',
          background: 'rgba(255,255,255,0.15)', color: 'white', fontSize: 18,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        ✕
      </button>
    </div>
  );
}
