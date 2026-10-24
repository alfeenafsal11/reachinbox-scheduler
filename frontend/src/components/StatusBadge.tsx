import type { EmailStatus } from '../types';

const STATUS_CONFIG: Record<EmailStatus, { label: string; className: string; dot: string }> = {
  scheduled:  { label: 'Scheduled',  className: 'badge badge-scheduled',  dot: '#60a5fa' },
  delayed:    { label: 'Delayed',    className: 'badge badge-delayed',    dot: '#fbbf24' },
  processing: { label: 'Processing', className: 'badge badge-processing', dot: '#a78bfa' },
  sent:       { label: 'Sent',       className: 'badge badge-sent',       dot: '#34d399' },
  failed:     { label: 'Failed',     className: 'badge badge-failed',     dot: '#f87171' },
};

export function StatusBadge({ status }: { status: EmailStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.scheduled;
  return (
    <span className={cfg.className}>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: cfg.dot,
          display: 'inline-block',
          flexShrink: 0,
          ...(status === 'processing' ? { animation: 'pulse 1.4s ease infinite' } : {}),
        }}
      />
      {cfg.label}
    </span>
  );
}
