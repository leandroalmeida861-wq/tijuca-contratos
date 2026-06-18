import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppErrorBoundary from './components/AppErrorBoundary.jsx';
import AppLayout from './components/AppLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { AuthProvider } from './contexts/AuthContext.jsx';
import BackupPage from './pages/BackupPage.jsx';
import AccessDenied from './pages/AccessDenied.jsx';
import AdminAccessPage from './pages/AdminAccessPage.jsx';
import AdminSolicitacoes from './pages/AdminSolicitacoes.jsx';
import AuditLogsPage from './pages/AuditLogsPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Login from './pages/Login.jsx';
import ManagementPage from './pages/ManagementPage.jsx';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/acesso-negado" element={<AccessDenied />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<ProtectedRoute menu="dashboard"><Dashboard /></ProtectedRoute>} />
            <Route path="fornecedores" element={<ProtectedRoute menu="fornecedores"><ManagementPage type="fornecedores" /></ProtectedRoute>} />
            <Route path="fabricas" element={<ProtectedRoute menu="fabricas"><ManagementPage type="fabricas" /></ProtectedRoute>} />
            <Route path="produtos" element={<ProtectedRoute menu="produtos"><ManagementPage type="produtos" /></ProtectedRoute>} />
            <Route path="contratos" element={<ProtectedRoute menu="contratos"><ManagementPage type="contratos" /></ProtectedRoute>} />
            <Route path="notas-fiscais" element={<ProtectedRoute menu="notas_fiscais"><ManagementPage type="notas_fiscais" /></ProtectedRoute>} />
            <Route path="frete" element={<ProtectedRoute menu="fretes"><ManagementPage type="fretes" /></ProtectedRoute>} />
            <Route path="documentos" element={<ProtectedRoute menu="documentos"><ManagementPage type="documentos" /></ProtectedRoute>} />
            <Route path="rel-financeiro" element={<ProtectedRoute menu="financeiro"><ManagementPage type="financeiro" /></ProtectedRoute>} />
            <Route path="backup" element={<ProtectedRoute menu="backup"><BackupPage /></ProtectedRoute>} />
            <Route path="admin/solicitacoes" element={<ProtectedRoute menu="usuarios"><AdminSolicitacoes /></ProtectedRoute>} />
            <Route path="admin/acessos" element={<ProtectedRoute menu="usuarios"><AdminAccessPage /></ProtectedRoute>} />
            <Route path="admin/auditoria" element={<ProtectedRoute menu="auditoria"><AuditLogsPage /></ProtectedRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  </React.StrictMode>,
);
