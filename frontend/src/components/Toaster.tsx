import { useState, useCallback, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

let _addToast: ((toast: Omit<Toast, 'id'>) => void) | null = null;

export function useToast() {
  const toast = useCallback((message: string, type: Toast['type'] = 'info') => {
    _addToast?.({ message, type });
  }, []);

  const success = useCallback((message: string) => _addToast?.({ message, type: 'success' }), []);
  const error = useCallback((message: string) => _addToast?.({ message, type: 'error' }), []);

  return { toast, success, error };
}

export function Toaster(_props: { children?: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    _addToast = (t) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { ...t, id }]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4200);
    };
    return () => {
      _addToast = null;
    };
  }, []);

  const dismiss = (id: string) => setToasts((prev) => prev.filter((x) => x.id !== id));

  return createPortal(
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => dismiss(t.id)}
          style={{
            pointerEvents: 'all',
            cursor: 'pointer',
            background:
              t.type === 'success'
                ? 'rgba(6, 78, 59, 0.9)'
                : t.type === 'error'
                ? 'rgba(136, 19, 55, 0.9)'
                : 'rgba(30, 41, 59, 0.9)',
            border: `1px solid ${
              t.type === 'success'
                ? 'rgba(52, 211, 153, 0.4)'
                : t.type === 'error'
                ? 'rgba(251, 113, 133, 0.4)'
                : 'rgba(56, 189, 248, 0.4)'
            }`,
            borderRadius: 14,
            padding: '12px 18px',
            color: '#f8fafc',
            fontWeight: 500,
            fontSize: '0.875rem',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            boxShadow:
              t.type === 'success'
                ? '0 12px 30px -4px rgba(16, 185, 129, 0.35)'
                : t.type === 'error'
                ? '0 12px 30px -4px rgba(244, 63, 94, 0.35)'
                : '0 12px 30px -4px rgba(0, 0, 0, 0.5)',
            maxWidth: 380,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            animation: 'fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              background:
                t.type === 'success'
                  ? 'rgba(52, 211, 153, 0.2)'
                  : t.type === 'error'
                  ? 'rgba(251, 113, 133, 0.2)'
                  : 'rgba(56, 189, 248, 0.2)',
              color:
                t.type === 'success'
                  ? '#34d399'
                  : t.type === 'error'
                  ? '#fb7185'
                  : '#38bdf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontSize: '0.75rem',
              fontWeight: 700,
            }}
          >
            {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'}
          </div>
          <span style={{ flex: 1, lineHeight: 1.4 }}>{t.message}</span>
        </div>
      ))}
    </div>,
    document.body
  );
}
