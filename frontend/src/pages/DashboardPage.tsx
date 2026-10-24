import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { emailsApi } from '../api/emails';
import { ScheduleModal } from '../components/ScheduleModal';
import { EmailsTable } from '../components/EmailsTable';

type Tab = 'scheduled' | 'sent' | 'search';

interface StatsData {
  scheduled: number;
  sent: number;
  failed: number;
}

function StatCard({
  label,
  value,
  sublabel,
  color,
  icon,
}: {
  label: string;
  value: number | string;
  sublabel: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="glass-card"
      style={{
        padding: '24px',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: 140,
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = `${color}40`;
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
      }}
    >
      {/* Background glow accent */}
      <div
        style={{
          position: 'absolute',
          top: -30,
          right: -30,
          width: 100,
          height: 100,
          borderRadius: '50%',
          background: color,
          opacity: 0.1,
          filter: 'blur(30px)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {label}
          </span>
          <div style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1, marginTop: 8, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
            {value}
          </div>
        </div>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: `${color}15`,
            border: `1px solid ${color}30`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: color,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 16 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>
          {sublabel}
        </span>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<Tab>('scheduled');
  const [showModal, setShowModal] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [stats, setStats] = useState<StatsData>({ scheduled: 0, sent: 0, failed: 0 });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const [schRes, sentRes] = await Promise.all([
        emailsApi.getScheduled(1, 1),
        emailsApi.getSent(1, 1),
      ]);
      const failedRes = await emailsApi.search({ status: 'failed', page: 1, pageSize: 1 });
      setStats({
        scheduled: schRes.total,
        sent: Math.max(0, sentRes.total - failedRes.total),
        failed: failedRes.total,
      });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats, refresh]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    setRefresh((r) => r + 1);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const handleSuccess = () => {
    setRefresh((r) => r + 1);
    setTab('scheduled');
  };

  // User initials avatar
  const initials = user?.name
    ? user.name
        .split(' ')
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'U';

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at 15% 0%, rgba(139, 92, 246, 0.12) 0%, transparent 45%), radial-gradient(circle at 85% 10%, rgba(56, 189, 248, 0.08) 0%, transparent 40%), var(--bg-primary)',
      }}
    >
      {/* Top Navigation */}
      <nav
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          background: 'rgba(7, 8, 14, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            padding: '0 28px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            height: 68,
          }}
        >
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(124, 58, 237, 0.35)',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="gradient-text" style={{ fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-0.02em' }}>
                  ReachInbox
                </span>
                <span
                  style={{
                    background: 'rgba(139, 92, 246, 0.15)',
                    color: '#c084fc',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 9999,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  Scheduler
                </span>
              </div>
            </div>
          </div>

          {/* Right Header Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {/* Live Status indicator */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 14px',
                borderRadius: 9999,
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                fontSize: '0.78rem',
                color: '#34d399',
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: '#10b981',
                  boxShadow: '0 0 8px #10b981',
                }}
              />
              System Healthy
            </div>

            {/* User Profile */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 9999,
                  background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: '#e2e8f0',
                }}
                title={user?.email}
              >
                {initials}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                  {user?.name}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {user?.email}
                </span>
              </div>
              <button
                id="nav-logout"
                className="btn-secondary"
                onClick={logout}
                style={{ padding: '7px 14px', fontSize: '0.8rem', marginLeft: 8 }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '36px 28px' }}>
        {/* Page Title & Action Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginBottom: 36,
            flexWrap: 'wrap',
            gap: 20,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                Campaign Overview
              </h1>
            </div>
            <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: 600 }}>
              Orchestrate delayed bulk campaigns with distributed BullMQ scheduling, atomic rate limiting, and delivery analytics.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              id="open-schedule-modal"
              className="btn-primary"
              onClick={() => setShowModal(true)}
              style={{ padding: '12px 24px', fontSize: '0.925rem' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Schedule Campaign
            </button>
          </div>
        </div>

        {/* Metric Cards Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 20,
            marginBottom: 36,
          }}
        >
          <StatCard
            label="In Delayed Queue"
            value={stats.scheduled}
            sublabel="BullMQ delayed jobs awaiting trigger"
            color="#38bdf8"
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            }
          />
          <StatCard
            label="Delivered Successfully"
            value={stats.sent}
            sublabel="Sent via Ethereal fake SMTP"
            color="#10b981"
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            }
          />
          <StatCard
            label="Failed / Bounced"
            value={stats.failed}
            sublabel="Rate limit or SMTP delivery errors"
            color="#f43f5e"
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            }
          />
        </div>

        {/* Control Bar: Segmented Tabs + Refresh Action */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              background: 'rgba(13, 16, 28, 0.7)',
              padding: 4,
              borderRadius: 14,
              border: '1px solid var(--border-subtle)',
              gap: 4,
            }}
          >
            {(
              [
                { id: 'scheduled', label: 'Scheduled Queue', count: stats.scheduled },
                { id: 'sent', label: 'Delivery Log', count: stats.sent },
                { id: 'search', label: 'Search & Filters' },
              ] as { id: Tab; label: string; count?: number }[]
            ).map((t) => (
              <button
                key={t.id}
                id={`tab-${t.id}`}
                className={`tab ${tab === t.id ? 'active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                <span>{t.label}</span>
                {t.count !== undefined && (
                  <span
                    style={{
                      background: tab === t.id ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                      fontSize: '0.72rem',
                      padding: '2px 7px',
                      borderRadius: 9999,
                      fontWeight: 600,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <button
            id="refresh-emails"
            className="btn-secondary"
            onClick={handleManualRefresh}
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            title="Refresh email status"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transition: 'transform 0.5s ease',
                transform: isRefreshing ? 'rotate(360deg)' : 'none',
              }}
            >
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M8 16H3v5" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Table Content */}
        <EmailsTable mode={tab} refresh={refresh} />
      </main>

      {/* Campaign Scheduling Modal */}
      {showModal && (
        <ScheduleModal onClose={() => setShowModal(false)} onSuccess={handleSuccess} />
      )}
    </div>
  );
}
