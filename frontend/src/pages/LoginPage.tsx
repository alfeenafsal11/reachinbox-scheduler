import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toaster';

export function LoginPage() {
  const { login } = useAuth();
  const { error } = useToast();
  const [email, setEmail] = useState('demo@reachinbox.ai');
  const [name, setName] = useState('Demo User');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !name.trim()) {
      error('Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), name.trim());
    } catch (err: any) {
      error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'radial-gradient(circle at 50% 20%, rgba(139, 92, 246, 0.15) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(56, 189, 248, 0.08) 0%, transparent 45%), var(--bg-primary)',
        padding: 20,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background Decorative Mesh Grids */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          opacity: 0.35,
          pointerEvents: 'none',
        }}
      />

      <div
        className="glass-card fade-in"
        style={{
          width: '100%',
          maxWidth: 440,
          padding: '44px 36px',
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 54,
              height: 54,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
              marginBottom: 16,
              boxShadow: '0 8px 24px rgba(124, 58, 237, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="16" x="2" y="4" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </div>

          <h1
            className="gradient-text"
            style={{ margin: 0, fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.02em' }}
          >
            ReachInbox
          </h1>
          <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)', fontSize: '0.925rem' }}>
            Enterprise Email Scheduler & Dispatcher
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={labelStyle} htmlFor="login-name">
              Display Name
            </label>
            <input
              id="login-name"
              className="input-field"
              type="text"
              placeholder="e.g. Alex Morgan"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label style={labelStyle} htmlFor="login-email">
              Work Email
            </label>
            <input
              id="login-email"
              className="input-field"
              type="email"
              placeholder="alex@reachinbox.ai"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <button
            id="login-submit"
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{
              width: '100%',
              justifyContent: 'center',
              marginTop: 6,
              padding: '13px 20px',
              fontSize: '0.95rem',
            }}
          >
            {loading ? (
              'Authenticating…'
            ) : (
              <>
                <span>Enter Dashboard</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </>
            )}
          </button>
        </form>

        {/* Security / Dev Note */}
        <div
          style={{
            marginTop: 28,
            padding: '12px 16px',
            borderRadius: 10,
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#34d399',
              boxShadow: '0 0 6px #34d399',
            }}
          />
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Development Environment · Passkey & OAuth bypass enabled
          </span>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 7,
  fontSize: '0.75rem',
  fontWeight: 700,
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};
