import { useState, useEffect, useCallback } from 'react';
import { emailsApi } from '../api/emails';
import { StatusBadge } from '../components/StatusBadge';
import type { Email, PaginatedResponse, EmailStatus } from '../types';

const PAGE_SIZE = 20;

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

const GRID = '1.2fr 1.6fr 1.2fr 1.1fr 120px';

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
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 350);
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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset page when mode / filter changes
  useEffect(() => {
    setPage(1);
  }, [mode, debouncedQ, statusFilter]);

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  const copyEmail = (text: string, id: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="glass-card fade-in" style={{ overflow: 'hidden' }}>
      {/* Search & Filter Toolbar (Visible in Search tab) */}
      {mode === 'search' && (
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'rgba(13, 16, 28, 0.5)',
            display: 'flex',
            gap: 14,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: 400 }}>
            <span
              style={{
                position: 'absolute',
                left: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                pointerEvents: 'none',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              id="email-search-input"
              className="input-field"
              placeholder="Search by subject, recipient, body snippet…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ paddingLeft: 40 }}
            />
          </div>

          <div style={{ minWidth: 170 }}>
            <select
              id="email-status-filter"
              className="input-field"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as EmailStatus | '')}
              style={{ cursor: 'pointer' }}
            >
              <option value="">All Statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="delayed">Delayed</option>
              <option value="processing">Processing</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {data && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>
              {data.total} {data.total === 1 ? 'match found' : 'matches found'}
            </span>
          )}
        </div>
      )}

      {/* Table Column Headers */}
      <div
        className="table-row"
        style={{
          gridTemplateColumns: GRID,
          background: 'rgba(17, 21, 36, 0.7)',
          borderBottom: '1px solid var(--border-subtle)',
          fontWeight: 700,
          fontSize: '0.74rem',
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          userSelect: 'none',
        }}
      >
        <span>Recipient</span>
        <span>Subject</span>
        <span>Sender Mailbox</span>
        <span>{mode === 'sent' ? 'Delivered At' : 'Target Schedule'}</span>
        <span style={{ textAlign: 'right' }}>Status</span>
      </div>

      {/* Table Body */}
      {loading ? (
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 48, width: '100%' }} />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <div style={{ padding: '72px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-subtle)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              color: 'var(--text-muted)',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="16" x="2" y="4" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </div>
          <h3 style={{ margin: '0 0 6px', fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {mode === 'search' ? 'No emails match your query' : 'No campaign emails found'}
          </h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: 360, marginInline: 'auto' }}>
            {mode === 'search'
              ? 'Try adjusting your search terms or clearing the status filter.'
              : 'Click "+ Schedule Campaign" above to enqueue delayed email batches.'}
          </p>
        </div>
      ) : (
        <div>
          {data.items.map((email) => (
            <div
              key={email.id}
              className="table-row"
              style={{
                gridTemplateColumns: GRID,
                gap: 16,
                padding: '16px 24px',
              }}
            >
              {/* Recipient */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  overflow: 'hidden',
                  cursor: 'pointer',
                }}
                onClick={() => copyEmail(email.toEmail, email.id)}
                title="Click to copy email address"
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 6,
                    background: 'rgba(139, 92, 246, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#a78bfa',
                    flexShrink: 0,
                    fontSize: '0.75rem',
                  }}
                >
                  @
                </div>
                <span
                  className="font-mono"
                  style={{
                    fontSize: '0.825rem',
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontWeight: 500,
                  }}
                >
                  {email.toEmail}
                </span>
                {copiedId === email.id && (
                  <span style={{ fontSize: '0.7rem', color: '#34d399', fontWeight: 600 }}>Copied!</span>
                )}
              </div>

              {/* Subject */}
              <div style={{ overflow: 'hidden' }}>
                <div
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={email.subject}
                >
                  {email.subject}
                </div>
                {email.body && (
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginTop: 2,
                    }}
                  >
                    {email.body.slice(0, 60)}
                  </div>
                )}
              </div>

              {/* Sender */}
              <div style={{ overflow: 'hidden' }}>
                <span
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    display: 'block',
                  }}
                  title={email.sender?.email ?? 'Unknown Sender'}
                >
                  {email.sender?.email ?? '—'}
                </span>
              </div>

              {/* Date */}
              <div>
                <span
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatDate(mode === 'sent' ? email.sentAt : email.scheduledAt)}
                </span>
              </div>

              {/* Status */}
              <div style={{ textAlign: 'right', display: 'flex', justifyContent: 'flex-end' }}>
                <StatusBadge status={email.status} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Footer */}
      {data && data.total > PAGE_SIZE && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 24px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'rgba(13, 16, 28, 0.4)',
          }}
        >
          <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            Showing <strong>{Math.min(data.total, (page - 1) * PAGE_SIZE + 1)}–{Math.min(data.total, page * PAGE_SIZE)}</strong> of <strong>{data.total}</strong> emails
          </span>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginRight: 4 }}>
              Page {page} of {totalPages}
            </span>
            <button
              id="email-table-prev"
              className="btn-secondary"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              style={{ padding: '7px 14px', fontSize: '0.8rem' }}
            >
              ← Previous
            </button>
            <button
              id="email-table-next"
              className="btn-secondary"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
              style={{ padding: '7px 14px', fontSize: '0.8rem' }}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
