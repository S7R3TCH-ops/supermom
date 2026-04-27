import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(null);

const COLORS = {
  success: { bg: '#DCFCE7', border: '#86EFAC', text: '#14532D', icon: '✓' },
  error:   { bg: '#FFE0EC', border: '#FFB3CC', text: '#9B0D3A', icon: '✕' },
  info:    { bg: '#FFF0F7', border: '#FFD6E8', text: '#E91E6A', icon: '✦' },
};

function ToastItem({ toast, onDismiss }) {
  const c = COLORS[toast.type] || COLORS.info;
  return (
    <div
      onClick={() => onDismiss(toast.id)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 9,
        background: c.bg, border: `1.5px solid ${c.border}`,
        borderRadius: 12, padding: '11px 14px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        cursor: 'pointer', maxWidth: 340, width: '100%',
        animation: 'toastIn 220ms cubic-bezier(0.2,0.8,0.2,1)',
      }}
    >
      <span style={{
        width: 18, height: 18, borderRadius: 9,
        background: c.border, color: c.text,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 800, flexShrink: 0, marginTop: 1,
      }}>{c.icon}</span>
      <span style={{
        fontFamily: "'Inter', system-ui, sans-serif",
        fontSize: 13, fontWeight: 500, color: c.text, lineHeight: 1.4,
      }}>{toast.message}</span>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const push = useCallback((type, message) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => {
      const next = [...prev, { id, type, message }];
      return next.slice(-3); // keep max 3
    });
    timers.current[id] = setTimeout(() => dismiss(id), 3500);
  }, [dismiss]);

  const toast = {
    success: (msg) => push('success', msg),
    error:   (msg) => push('error', msg),
    info:    (msg) => push('info', msg),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(-10px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
      `}</style>
      <div style={{
        position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', flexDirection: 'column', gap: 8,
        zIndex: 9999, pointerEvents: 'none', width: '100%', maxWidth: 360,
        padding: '0 16px',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{ pointerEvents: 'auto' }}>
            <ToastItem toast={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
