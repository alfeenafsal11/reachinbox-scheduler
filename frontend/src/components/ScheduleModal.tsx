import { useState, useRef } from 'react';
import { useToast } from './Toaster';
import { emailsApi } from '../api/emails';
import type { ScheduleEmailPayload } from '../types';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

const MIN_DELAY = 60_000; // 1 min
const DEFAULT_HOURLY = 50;

export function ScheduleModal({ onClose, onSuccess }: Props) {
  const { success, error } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    subject: '',
    body: '',
    recipients: '',
    startAt: '',
    delayMs: String(MIN_DELAY),
    hourlyLimit: String(DEFAULT_HOURLY),
  });

  const [recipientMode, setRecipientMode] = useState<'text' | 'csv'>('text');

  const set = (field: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const parseCSV = (text: string): string[] => {
    const lines = text.split(/\r?\n/);
    const emails: string[] = [];
    for (const line of lines) {
      const cols = line.split(',');
      for (const col of cols) {
        const trimmed = col.trim().toLowerCase();
        if (trimmed.includes('@')) emails.push(trimmed);
      }
    }
    return emails;
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const emails = parseCSV(text);
      set('recipients', emails.join('\n'));
      setRecipientMode('text');
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const recipients = form.recipients
      .split(/[\n,]+/)
      .map((r) => r.trim().toLowerCase())
      .filter(Boolean);

    if (!recipients.length) {
      error('Add at least one recipient');
      return;
    }
    if (!form.startAt) {
      error('Select a start time');
      return;
    }
    if (!form.subject.trim()) {
      error('Subject is required');
      return;
    }
    if (!form.body.trim()) {
      error('Body is required');
      return;
    }

    const payload: ScheduleEmailPayload = {
      subject: form.subject,
      body: form.body,
      recipients,
      startAt: new Date(form.startAt).toISOString(),
      delayMs: Math.max(MIN_DELAY, Number(form.delayMs) || MIN_DELAY),
      hourlyLimit: Math.max(1, Number(form.hourlyLimit) || DEFAULT_HOURLY),
    };

    setLoading(true);
    try {
      const res = await emailsApi.schedule(payload);
      success(`Scheduled ${res.scheduled} emails (Campaign ${res.campaignId.slice(0, 8)}…)`);
      onSuccess();
      onClose();
    } catch (err: any) {
      error(err.message || 'Failed to schedule emails');
    } finally {
      setLoading(false);
    }
  };

  // Min datetime is now + 1 min
  const minDatetime = new Date(Date.now() + 61_000).toISOString().slice(0, 16);

  const recipientCount = form.recipients
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean).length;

  const delaySeconds = Math.round(Number(form.delayMs) / 1000) || 60;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-panel">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'rgba(139, 92, 246, 0.15)',
                  color: '#a78bfa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Create Email Campaign
              </h2>
            </div>
            <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Enqueues persistent BullMQ jobs with atomic sender rate limiting.
            </p>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 16,
              width: 32,
              height: 32,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.1)';
              (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.05)';
              (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
            }}
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Subject */}
          <div>
            <label style={labelStyle}>Campaign Subject</label>
            <input
              id="schedule-subject"
              className="input-field"
              placeholder="e.g. Welcome to the ReachInbox Beta"
              value={form.subject}
              onChange={(e) => set('subject', e.target.value)}
              required
            />
          </div>

          {/* Email Body */}
          <div>
            <label style={labelStyle}>Email Body</label>
            <textarea
              id="schedule-body"
              className="input-field"
              placeholder="Write your email content (supports HTML tags or plain text)…"
              value={form.body}
              onChange={(e) => set('body', e.target.value)}
              rows={4}
              style={{ resize: 'vertical', minHeight: 90 }}
              required
            />
          </div>

          {/* Recipients */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Target Recipients</label>
                {recipientCount > 0 && (
                  <span
                    style={{
                      background: 'rgba(56, 189, 248, 0.1)',
                      color: '#38bdf8',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 9999,
                      border: '1px solid rgba(56, 189, 248, 0.25)',
                    }}
                  >
                    {recipientCount} {recipientCount === 1 ? 'email' : 'emails'}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  className={`tab ${recipientMode === 'text' ? 'active' : ''}`}
                  style={{ padding: '4px 10px', fontSize: '0.75rem', height: 28 }}
                  onClick={() => setRecipientMode('text')}
                >
                  Manual Text
                </button>
                <button
                  type="button"
                  className={`tab ${recipientMode === 'csv' ? 'active' : ''}`}
                  style={{ padding: '4px 10px', fontSize: '0.75rem', height: 28 }}
                  onClick={() => {
                    setRecipientMode('csv');
                    fileRef.current?.click();
                  }}
                >
                  Upload CSV
                </button>
              </div>
            </div>

            <textarea
              id="schedule-recipients"
              className="input-field font-mono"
              placeholder="alice@company.com&#10;bob@company.com, charlie@startup.io"
              value={form.recipients}
              onChange={(e) => set('recipients', e.target.value)}
              rows={3}
              style={{ resize: 'vertical', fontSize: '0.8rem', lineHeight: 1.5 }}
            />
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={handleCSVUpload}
            />
            <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Separate recipients with new lines or commas. CSV columns with email addresses are auto-parsed.
            </p>
          </div>

          {/* Schedule Time */}
          <div>
            <label style={labelStyle}>Initial Send Time</label>
            <input
              id="schedule-start-at"
              type="datetime-local"
              className="input-field"
              min={minDatetime}
              value={form.startAt}
              onChange={(e) => set('startAt', e.target.value)}
              required
            />
            <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              First email will dispatch at or after this time in your local timezone.
            </p>
          </div>

          {/* Rate Limiting Parameters */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>Delay Between Sends</label>
              <input
                id="schedule-delay-ms"
                type="number"
                className="input-field"
                min={MIN_DELAY}
                step={1000}
                value={form.delayMs}
                onChange={(e) => set('delayMs', e.target.value)}
              />
              <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {delaySeconds} seconds ({Math.round(delaySeconds / 60)} min) min 60s
              </p>
            </div>

            <div>
              <label style={labelStyle}>Max Sends / Hour</label>
              <input
                id="schedule-hourly-limit"
                type="number"
                className="input-field"
                min={1}
                max={500}
                value={form.hourlyLimit}
                onChange={(e) => set('hourlyLimit', e.target.value)}
              />
              <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Atomic rolling Redis rate limit
              </p>
            </div>
          </div>

          {/* Dialog Action Buttons */}
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              style={{ flex: 1, padding: '12px 18px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{ flex: 2, padding: '12px 20px' }}
            >
              {loading ? 'Dispatching to Queue…' : 'Schedule Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 6,
  fontSize: '0.75rem',
  fontWeight: 700,
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};
