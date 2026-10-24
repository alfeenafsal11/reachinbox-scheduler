import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from './components/Toaster';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';

function AppInner() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16, animation: 'pulse 1.4s ease infinite' }}>✉️</div>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Loading…</p>
        </div>
      </div>
    );
  }

  return user ? <DashboardPage /> : <LoginPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster />
      <AppInner />
    </AuthProvider>
  );
}
