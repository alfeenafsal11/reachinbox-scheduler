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
        background: 'radial-gradient(ellipse at 30% 20%, rgba(139,92,246,0.12) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(59,130,246,0.08) 0%, transparent 60%), var(--bg-primary)',
        padding: 16,
      }}
    >
      {/* Decorative glow orbs */}
      <div style={{ position: 'fixed', top: '15%', left: '10%', width: 300, height: 300, borderRadius: '50%', background: 'rgba(139,92,246,0.06)', filter: 'blur(80px)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: '10%', right: '8%', width: 250, height: 250, borderRadius: '50%', background: 'rgba(59,130,246,0.05)', filter: 'blur(70px)', pointerEvents: 'none' }} />

      <div className="glass-card fade-in" style={{ width: '100%', maxWidth: 420, padding: 40 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 60, height: 60, borderRadius: 16, background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', marginBottom: 16, boxShadow: '0 8px 32px rgba(124,58,237,0.3)' }}>
            <span style={{ fontSize: 28 }}>✉️</span>
          </div>
          <h1 className="gradient-text" style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800 }}>
            ReachInbox
          </h1>
          <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Email Scheduler Dashboard
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle} htmlFor="login-name">Display Name</label>
            <input
              id="login-name"
              className="input-field"
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label style={labelStyle} htmlFor="login-email">Email Address</label>
            <input
              id="login-email"
              className="input-field"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <button
            id="login-submit"
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', marginTop: 8, padding: '12px 20px', fontSize: '1rem' }}
          >
            {loading ? 'Signing in…' : '→ Sign In (Dev Mode)'}
          </button>
        </form>

        <p style={{ marginTop: 24, textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Development mode · No password required
        </p>
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
