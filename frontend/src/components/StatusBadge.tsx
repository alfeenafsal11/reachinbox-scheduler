import type { EmailStatus } from '../types';

const STATUS_CONFIG: Record<
  EmailStatus,
  { label: string; className: string; dot: string; glow: string }
> = {
  scheduled: {
    label: 'Scheduled',
    className: 'badge badge-scheduled',
    dot: '#38bdf8',
    glow: 'rgba(56, 189, 248, 0.4)',
  },
  delayed: {
    label: 'Delayed',
    className: 'badge badge-delayed',
    dot: '#fbbf24',
    glow: 'rgba(251, 191, 36, 0.4)',
  },
  processing: {
    label: 'Processing',
    className: 'badge badge-processing',
    dot: '#c084fc',
    glow: 'rgba(192, 132, 252, 0.5)',
  },
  sent: {
    label: 'Delivered',
    className: 'badge badge-sent',
    dot: '#34d399',
    glow: 'rgba(52, 211, 153, 0.4)',
  },
  failed: {
    label: 'Failed',
    className: 'badge badge-failed',
    dot: '#fb7185',
    glow: 'rgba(251, 113, 133, 0.4)',
  },
};

export function StatusBadge({ status }: { status: EmailStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.scheduled;
  const isAnimated = status === 'processing';

  return (
    <span className={cfg.className}>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: cfg.dot,
          boxShadow: `0 0 6px ${cfg.glow}`,
          display: 'inline-block',
          flexShrink: 0,
          animation: isAnimated ? 'pulse 1.5s ease-in-out infinite' : undefined,
        }}
      />
      {cfg.label}
    </span>
  );
}
