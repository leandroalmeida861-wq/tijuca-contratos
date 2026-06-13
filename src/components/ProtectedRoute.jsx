import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function ProtectedRoute({ children }) {
  const { loading, user, authorized, configured } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-100 text-sm font-semibold text-slate-600">
        Carregando sistema...
      </div>
    );
  }

  if (!configured || !user || !authorized) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
