import {
  BarChart3,
  Building2,
  ClipboardList,
  FileArchive,
  FileText,
  Factory,
  Grid2X2,
  LogOut,
  Package,
  Receipt,
  Sprout,
  Truck,
} from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

const navItems = [
  { to: '/', label: 'Dashboard', icon: Grid2X2 },
  { to: '/fornecedores', label: 'Fornecedores', icon: Building2 },
  { to: '/fabricas', label: 'Fábricas', icon: Factory },
  { to: '/produtos', label: 'Produtos', icon: Package },
  { to: '/contratos', label: 'Contratos', icon: ClipboardList },
  { to: '/notas-fiscais', label: 'Notas Fiscais', icon: Receipt },
  { to: '/frete', label: 'Frete', icon: Truck },
  { to: '/documentos', label: 'Documentos', icon: FileArchive },
  { to: '/rel-financeiro', label: 'Rel. Financeiro', icon: BarChart3 },
];

export default function AppLayout() {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-[#f6f8fa] text-slate-900 lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 z-20 flex h-auto flex-col border-r border-slate-800 bg-[#111820] px-3 py-5 text-white lg:h-screen">
        <div className="mb-7 flex items-center gap-3 px-2">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#31bf69]">
            <Sprout size={22} />
          </div>
          <div>
            <p className="text-sm font-extrabold tracking-wide">TIJUCA ALIMENTOS</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Gestão de contratos</p>
          </div>
        </div>

        <nav className="grid gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                [
                  'flex h-11 items-center gap-3 rounded-lg px-4 text-sm font-semibold transition',
                  isActive ? 'bg-[#31bf69] text-white' : 'text-slate-200 hover:bg-slate-800 hover:text-white',
                ].join(' ')
              }
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          onClick={signOut}
          className="mt-8 flex h-11 items-center gap-3 border-t border-slate-800 px-4 pt-5 text-sm font-semibold text-slate-300 transition hover:text-white lg:mt-auto"
        >
          <LogOut size={18} />
          Sair
        </button>
      </aside>
      <main className="min-w-0 px-4 py-5 sm:px-6 lg:px-7">
        <Outlet />
      </main>
    </div>
  );
}
