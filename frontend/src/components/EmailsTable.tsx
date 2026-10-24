import { useState, useEffect, useCallback } from 'react';
import { emailsApi } from '../api/emails';
import { StatusBadge } from '../components/StatusBadge';
import type { Email, PaginatedResponse, EmailStatus } from '../types';

const PAGE_SIZE = 20;

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

const GRID = '1fr 1.6fr 1fr 1fr 1fr';

export function EmailsTable({
  mode,
  refresh,
}: {
  mode: 'scheduled' | 'sent' | 'search';
  refresh: number;
}) {
  const [data, setData] = useState<PaginatedResponse<Email> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<EmailStatus | ''>('');
  const [debouncedQ, setDebouncedQ] = useState('');

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 400);
    return () => clearTimeout(t);
  }, [q]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let res: PaginatedResponse<Email>;
      if (mode === 'scheduled') {
        res = await emailsApi.getScheduled(page, PAGE_SIZE);
      } else if (mode === 'sent') {
        res = await emailsApi.getSent(page, PAGE_SIZE);
      } else {
        res = await emailsApi.search({
          q: debouncedQ || undefined,
          status: statusFilter || undefined,
          page,
          pageSize: PAGE_SIZE,
        });
      }
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [mode, page, debouncedQ, statusFilter, refresh]);

  useEffect(() => { fetchData(); }, [fetchData]);
  // Reset page when mode / filter changes
  useEffect(() => { setPage(1); }, [mode, debouncedQ, statusFilter]);

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  return (
    <div className="glass-card fade-in" style={{ overflow: 'hidden' }}>
      {/* Search bar (search mode) */}
      {mode === 'search' && (
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <input
            id="email-search-input"
            className="input-field"
            placeholder="Search subject, recipient, body…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ maxWidth: 340 }}
          />
          <select
            id="email-status-filter"
            className="input-field"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as EmailStatus | '')}
            style={{ maxWidth: 160 }}
          >
            <option value="">All statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="delayed">Delayed</option>
            <option value="processing">Processing</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      )}

      {/* Header */}
      <div
        className="table-row"
        style={{
          gridTemplateColumns: GRID,
          background: 'var(--bg-elevated)',
          borderBottom: '1px solid var(--border-accent)',
          fontWeight: 600,
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        <span>Recipient</span>
        <span>Subject</span>
        <span>Sender</span>
        <span>{mode === 'sent' ? 'Sent At' : 'Scheduled At'}</span>
        <span>Status</span>
      </div>

      {/* Rows */}
      {loading ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 20px' }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 44, borderRadius: 8 }} />
            ))}
          </div>
        </div>
      ) : !data || data.items.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <p style={{ margin: 0 }}>{mode === 'search' ? 'No results found' : 'Nothing here yet'}</p>
        </div>
      ) : (
        data.items.map((email) => (
          <div key={email.id} className="table-row" style={{ gridTemplateColumns: GRID }}>
            <span style={{ fontSize: '0.85rem', fontFamily: 'monospace', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {email.toEmail}
            </span>
            <span style={{ fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }} title={email.subject}>
              {email.subject}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {email.sender?.email ?? '—'}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {formatDate(mode === 'sent' ? email.sentAt : email.scheduledAt)}
            </span>
            <StatusBadge status={email.status} />
          </div>
        ))
      )}

      {/* Pagination */}
      {data && data.total > PAGE_SIZE && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderTop: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {data.total} total · Page {page} of {totalPages}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              id="email-table-prev"
              className="btn-secondary"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              style={{ padding: '6px 14px', fontSize: '0.8rem' }}
            >← Prev</button>
            <button
              id="email-table-next"
              className="btn-secondary"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
              style={{ padding: '6px 14px', fontSize: '0.8rem' }}
            >Next →</button>
          </div>
        </div>
      )}
    </div>
  );
}
