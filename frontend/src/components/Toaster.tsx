import { useState, useCallback, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// ─── Simple hook-based toast ──────────────────────────────────────────────────

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
  const error   = useCallback((message: string) => _addToast?.({ message, type: 'error' }), []);

  return { toast, success, error };
}

// ─── Toaster Provider (mount once at root) ────────────────────────────────────

export function Toaster(_props: { children?: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    _addToast = (t) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { ...t, id }]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4000);
    };
    return () => { _addToast = null; };
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
        gap: 10,
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
                ? 'rgba(16, 185, 129, 0.15)'
                : t.type === 'error'
                ? 'rgba(239, 68, 68, 0.15)'
                : 'rgba(59, 130, 246, 0.15)',
            border: `1px solid ${
              t.type === 'success'
                ? 'rgba(16,185,129,0.3)'
                : t.type === 'error'
                ? 'rgba(239,68,68,0.3)'
                : 'rgba(59,130,246,0.3)'
            }`,
            borderRadius: 12,
            padding: '12px 20px',
            color:
              t.type === 'success' ? '#34d399' : t.type === 'error' ? '#f87171' : '#60a5fa',
            fontWeight: 500,
            fontSize: '0.875rem',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            maxWidth: 360,
            animation: 'fadeIn 0.25s ease',
          }}
        >
          {t.type === 'success' ? '✓ ' : t.type === 'error' ? '✕ ' : 'ℹ '}{t.message}
        </div>
      ))}
    </div>,
    document.body
  );
}
