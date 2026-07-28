import { BarChart3, ClipboardList, FileArchive, Grid2X2, Receipt, Truck } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

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
      <header>
        <h1 className="text-2xl font-extrabold text-slate-950">Contratos de Grãos</h1>
        <p className="mt-1 text-sm font-medium text-slate-500">
          Gestão integrada de contratos, notas fiscais, fretes, documentos e informações financeiras.
        </p>
      </header>

      {visibleTabs.length > 0 && (
        <div className="flex gap-2 overflow-x-auto rounded-lg border border-slate-200 bg-white p-2 shadow-panel">
          {visibleTabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) =>
                [
                  'inline-flex h-10 shrink-0 items-center rounded-md px-3 text-sm font-bold transition',
                  isActive ? 'bg-tijuca-600 text-white' : 'text-slate-600 hover:bg-slate-100',
                ].join(' ')
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      )}

      <Outlet />
    </div>
  );
}
