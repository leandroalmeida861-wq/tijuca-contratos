import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/AppLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { AuthProvider } from './contexts/AuthContext.jsx';
import BackupPage from './pages/BackupPage.jsx';
import AdminSolicitacoes from './pages/AdminSolicitacoes.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Login from './pages/Login.jsx';
import ManagementPage from './pages/ManagementPage.jsx';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="fornecedores" element={<ManagementPage type="fornecedores" />} />
            <Route path="fabricas" element={<ManagementPage type="fabricas" />} />
            <Route path="produtos" element={<ManagementPage type="produtos" />} />
            <Route path="contratos" element={<ManagementPage type="contratos" />} />
            <Route path="notas-fiscais" element={<ManagementPage type="notas_fiscais" />} />
            <Route path="frete" element={<ManagementPage type="fretes" />} />
            <Route path="documentos" element={<ManagementPage type="documentos" />} />
            <Route path="rel-financeiro" element={<ManagementPage type="financeiro" />} />
            <Route path="backup" element={<BackupPage />} />
            <Route path="admin/solicitacoes" element={<AdminSolicitacoes />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
