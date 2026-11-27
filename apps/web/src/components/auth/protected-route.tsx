import { Navigate, Outlet } from 'react-router';
import { useAuth } from '@/features/auth/auth-context';

export function ProtectedRoute() {
  const { accessToken, isLoading, isRestoring } = useAuth();

  if (isRestoring || isLoading) {
    return <div className="p-6 text-sm text-muted">Loading...</div>;
  }

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
