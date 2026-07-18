import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { getFirstAllowedRoute } from '../lib/permissions.js';
import Dashboard from '../pages/Dashboard.jsx';

export default function AuthorizedHome() {
  const { can } = useAuth();

  if (can('dashboard', 'visualizar')) {
    return <Dashboard />;
  }

  const allowedRoute = getFirstAllowedRoute(can);
  return <Navigate to={allowedRoute || '/acesso-negado'} replace />;
}
