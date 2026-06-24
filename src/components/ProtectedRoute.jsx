import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function ProtectedRoute({ children, menu }) {
  const { loading, user, authorized, configured, can } = useAuth();

  if (loading && (!user || !authorized)) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-100 px-4">
        <div className="flex w-full max-w-sm flex-col items-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl">
          <img src="/agroflow-symbol.png" alt="" className="h-16 w-16 object-contain" />
          <div className="mt-5 h-1.5 w-40 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-1/2 animate-[loadingBar_1s_ease-in-out_infinite] rounded-full bg-emerald-500" />
          </div>
          <p className="mt-4 text-sm font-bold text-slate-700">Preparando seu acesso...</p>
          <p className="mt-1 text-xs font-medium text-slate-500">Conferindo sessão e permissões.</p>
        </div>
      </div>
    );
  }

  if (!configured || !user || !authorized) {
    return <Navigate to="/login" replace />;
  }

  if (menu && !can(menu, 'visualizar')) {
    return <Navigate to="/acesso-negado" replace />;
  }

  return children;
}
