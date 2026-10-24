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

function StatCard({ label, value, color, icon }: { label: string; value: number | string; color: string; icon: string }) {
  return (
    <div
      className="glass-card"
      style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16, transition: 'border-color 0.2s', borderColor: 'transparent' }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = color)}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'transparent')}
    >
      <div style={{ width: 48, height: 48, borderRadius: 12, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4, fontWeight: 500 }}>{label}</div>
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

  const fetchStats = useCallback(async () => {
    try {
      const [schRes, sentRes] = await Promise.all([
        emailsApi.getScheduled(1, 1),
        emailsApi.getSent(1, 1),
      ]);
      // Count failed by searching with status=failed
      const failedRes = await emailsApi.search({ status: 'failed', page: 1, pageSize: 1 });
      setStats({
        scheduled: schRes.total,
        sent: sentRes.total - failedRes.total,
        failed: failedRes.total,
      });
    } catch {
      // ignore
    }
  }, [refresh]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleSuccess = () => {
    setRefresh((r) => r + 1);
    setTab('scheduled');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse at 20% 0%, rgba(139,92,246,0.08) 0%, transparent 50%), var(--bg-primary)' }}>
      {/* Nav */}
      <nav style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(10,10,15,0.8)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 60 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>✉️</span>
            <span className="gradient-text" style={{ fontWeight: 800, fontSize: '1.1rem' }}>ReachInbox</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {user?.name}
            </span>
            <button
              id="nav-logout"
              className="btn-secondary"
              onClick={logout}
              style={{ padding: '6px 14px', fontSize: '0.8rem' }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Email Campaigns
            </h1>
            <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Monitor and manage your scheduled email campaigns
            </p>
          </div>
          <button
            id="open-schedule-modal"
            className="btn-primary"
            onClick={() => setShowModal(true)}
            style={{ padding: '12px 24px', fontSize: '0.95rem' }}
          >
            + New Campaign
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
          <StatCard label="Scheduled / Pending" value={stats.scheduled} color="#3b82f6" icon="📅" />
          <StatCard label="Successfully Sent" value={stats.sent} color="#10b981" icon="✅" />
          <StatCard label="Failed" value={stats.failed} color="#ef4444" icon="❌" />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {(['scheduled', 'sent', 'search'] as Tab[]).map((t) => (
            <button
              key={t}
              id={`tab-${t}`}
              className={`tab ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'scheduled' ? '📅 Scheduled' : t === 'sent' ? '✅ Sent / Failed' : '🔍 Search'}
            </button>
          ))}
          <button
            id="refresh-emails"
            className="tab"
            onClick={() => setRefresh((r) => r + 1)}
            style={{ marginLeft: 'auto' }}
          >
            ↺ Refresh
          </button>
        </div>

        {/* Table */}
        <EmailsTable mode={tab} refresh={refresh} />
      </div>

      {showModal && (
        <ScheduleModal onClose={() => setShowModal(false)} onSuccess={handleSuccess} />
      )}
    </div>
  );
}
