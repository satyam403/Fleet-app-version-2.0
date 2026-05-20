import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * Route guard. Redirects unauthenticated users to /login while preserving
 * the attempted path in `location.state.from` for post-login redirect.
 *
 * Waits for AuthContext to hydrate (read cookies on mount) before deciding —
 * this avoids the "flash of /login" that logged-in users used to see on
 * first paint.
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isHydrated } = useAuth();
  const location = useLocation();

  if (!isHydrated) {
    // Minimal full-viewport placeholder; matches Layout background.
    return (
      <div
        aria-busy="true"
        aria-live="polite"
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f5f5f7',
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: '3px solid rgba(0,0,0,0.08)',
            borderTopColor: '#1d1d1f',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
