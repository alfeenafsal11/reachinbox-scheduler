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

    if (!recipients.length) { error('Add at least one recipient'); return; }
    if (!form.startAt) { error('Select a start time'); return; }
    if (!form.subject.trim()) { error('Subject is required'); return; }
    if (!form.body.trim()) { error('Body is required'); return; }

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
      success(`Scheduled ${res.scheduled} emails (campaign ${res.campaignId.slice(0, 8)}…)`);
      onSuccess();
      onClose();
    } catch (err: any) {
      error(err.message || 'Failed to schedule emails');
    } finally {
      setLoading(false);
    }
  };

  // Min datetime is now+1min
  const minDatetime = new Date(Date.now() + 61_000).toISOString().slice(0, 16);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Schedule Campaign
            </h2>
            <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Bulk-schedule emails with per-sender rate limiting
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20, padding: 0, lineHeight: 1 }}
          >×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Subject */}
          <div>
            <label style={labelStyle}>Subject</label>
            <input
              id="schedule-subject"
              className="input-field"
              placeholder="Your email subject…"
              value={form.subject}
              onChange={(e) => set('subject', e.target.value)}
              required
            />
          </div>

          {/* Body */}
          <div>
            <label style={labelStyle}>Body</label>
            <textarea
              id="schedule-body"
              className="input-field"
              placeholder="Your email body (plain text or HTML)…"
              value={form.body}
              onChange={(e) => set('body', e.target.value)}
              rows={4}
              style={{ resize: 'vertical', minHeight: 100 }}
              required
            />
          </div>

          {/* Recipients */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={labelStyle}>Recipients</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className={`tab ${recipientMode === 'text' ? 'active' : ''}`} style={{ padding: '4px 12px', fontSize: '0.75rem' }} onClick={() => setRecipientMode('text')}>Text</button>
                <button type="button" className={`tab ${recipientMode === 'csv' ? 'active' : ''}`} style={{ padding: '4px 12px', fontSize: '0.75rem' }} onClick={() => { setRecipientMode('csv'); fileRef.current?.click(); }}>CSV</button>
              </div>
            </div>
            <textarea
              id="schedule-recipients"
              className="input-field"
              placeholder="one@example.com&#10;two@example.com"
              value={form.recipients}
              onChange={(e) => set('recipients', e.target.value)}
              rows={3}
              style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '0.8rem' }}
            />
            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleCSVUpload} />
            <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {form.recipients.split(/[\n,]+/).filter(s => s.trim()).length} recipients entered
            </p>
          </div>

          {/* Start At */}
          <div>
            <label style={labelStyle}>Start At</label>
            <input
              id="schedule-start-at"
              type="datetime-local"
              className="input-field"
              min={minDatetime}
              value={form.startAt}
              onChange={(e) => set('startAt', e.target.value)}
              required
            />
          </div>

          {/* Delay & Hourly */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Delay Between Sends (ms)</label>
              <input
                id="schedule-delay-ms"
                type="number"
                className="input-field"
                min={MIN_DELAY}
                step={1000}
                value={form.delayMs}
                onChange={(e) => set('delayMs', e.target.value)}
              />
              <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>min 60 000 ms (1 min)</p>
            </div>
            <div>
              <label style={labelStyle}>Hourly Rate Limit</label>
              <input
                id="schedule-hourly-limit"
                type="number"
                className="input-field"
                min={1}
                max={500}
                value={form.hourlyLimit}
                onChange={(e) => set('hourlyLimit', e.target.value)}
              />
              <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>emails per hour</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            <button type="button" className="btn-secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading} style={{ flex: 2 }}>
              {loading ? 'Scheduling…' : '🚀 Schedule Campaign'}
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
  fontSize: '0.8rem',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};
