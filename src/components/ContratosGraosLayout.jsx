import { BarChart3, ClipboardList, FileArchive, Grid2X2, Receipt, Truck } from 'lucide-react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import ContratosGraosHeaderNavigation from './ContratosGraosHeaderNavigation.jsx';

export const CONTRATOS_GRAOS_TABS = [
  { to: '/', label: 'Dashboard', icon: Grid2X2, menu: 'dashboard' },
  { to: '/contratos', label: 'Contratos', icon: ClipboardList, menu: 'contratos' },
  { to: '/notas-fiscais', label: 'Notas Fiscais', icon: Receipt, menu: 'notas_fiscais' },
  { to: '/frete', label: 'Frete', icon: Truck, menu: 'fretes' },
  { to: '/documentos', label: 'Documentos', icon: FileArchive, menu: 'documentos' },
  { to: '/rel-financeiro', label: 'Rel. Financeiro', icon: BarChart3, menu: 'financeiro' },
];

export default function ContratosGraosLayout() {
  const { can } = useAuth();
  const visibleTabs = CONTRATOS_GRAOS_TABS.filter((tab) => can(tab.menu, 'visualizar'));

  return (
    <div className="grid gap-5">
      <ContratosGraosHeaderNavigation tabs={visibleTabs} />

      <Outlet />
    </div>
  );
}
