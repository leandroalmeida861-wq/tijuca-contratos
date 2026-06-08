import { Navigate } from 'react-router-dom';
import { AUTHORIZED_EMAIL, useAuth } from '../contexts/AuthContext.jsx';

export default function ProtectedRoute({ children }) {
  const { loading, user, configured } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-100 text-sm font-semibold text-slate-600">
        Carregando sistema...
      </div>
    );
  }

  if (!configured || !user || user.email !== AUTHORIZED_EMAIL) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
