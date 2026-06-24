import {
  BarChart3,
  Building2,
  ClipboardList,
  Database,
  FileArchive,
  Factory,
  Grid2X2,
  History,
  LogOut,
  Menu,
  Package,
  Receipt,
  Scale,
  ShieldCheck,
  Truck,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

const navItems = [
  { to: '/', label: 'Dashboard', icon: Grid2X2, menu: 'dashboard' },
  {
    label: 'Cadastros',
    icon: Building2,
    children: [
      { to: '/fornecedores', label: 'Fornecedores', icon: Building2, menu: 'fornecedores' },
      { to: '/fabricas', label: 'Fábricas', icon: Factory, menu: 'fabricas' },
      { to: '/produtos', label: 'Produtos', icon: Package, menu: 'produtos' },
    ],
  },
  { to: '/contratos', label: 'Contratos', icon: ClipboardList, menu: 'contratos' },
  { to: '/notas-fiscais', label: 'Notas Fiscais', icon: Receipt, menu: 'notas_fiscais' },
  { to: '/balancas', label: 'Balanças', icon: Scale, menu: 'balancas' },
  { to: '/frete', label: 'Frete', icon: Truck, menu: 'fretes' },
  { to: '/documentos', label: 'Documentos', icon: FileArchive, menu: 'documentos' },
  { to: '/rel-financeiro', label: 'Rel. Financeiro', icon: BarChart3, menu: 'financeiro' },
  { to: '/backup', label: 'Backup', icon: Database, menu: 'backup' },
  { to: '/admin/acessos', label: 'Usuários e permissões', icon: ShieldCheck, menu: 'usuarios' },
  { to: '/admin/auditoria', label: 'Auditoria', icon: History, menu: 'auditoria' },
];

export default function AppLayout() {
  const { signOut, can, profileData } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    function closeOnEscape(event) {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuOpen]);

  return (
    <div className="min-h-screen bg-[#f6f8fa] text-slate-900 lg:grid lg:grid-cols-[260px_1fr]">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm lg:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <img src="/agroflow-symbol.png" alt="" className="h-10 w-10 shrink-0 object-contain" />
          <div className="min-w-0">
            <p className="truncate text-lg font-black">
              <span className="text-[#5dcaa5]">Agro</span>
              <span className="text-[#ef9f27]">Flow</span>
            </p>
            <p className="truncate text-[9px] font-bold uppercase tracking-[0.04em] text-emerald-700">GESTÃO INTELIGENTE DO AGRONEGÓCIO</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
          aria-label="Abrir menu"
          aria-expanded={menuOpen}
        >
          <Menu size={23} />
        </button>
      </header>

      {menuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-950/55 lg:hidden"
          onClick={() => setMenuOpen(false)}
          aria-label="Fechar menu"
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-[min(84vw,300px)] flex-col overflow-y-auto border-r border-slate-800 bg-[#111820] px-3 py-5 text-white shadow-2xl transition-transform duration-200 lg:sticky lg:top-0 lg:z-20 lg:h-screen lg:w-auto lg:translate-x-0 lg:shadow-none ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="mb-7 flex items-center gap-3 px-2">
          <img src="/agroflow-symbol.png" alt="AgroFlow" className="h-12 w-12 object-contain" />
          <div className="min-w-0">
            <p className="text-2xl font-black leading-none tracking-wide">
              <span className="text-[#5dcaa5]">Agro</span>
              <span className="text-[#ef9f27]">Flow</span>
            </p>
            <p className="mt-1.5 max-w-[170px] text-[9px] font-semibold uppercase leading-[1.35] tracking-[0.07em] text-emerald-200">
              GESTÃO INTELIGENTE DO
              <span className="block">AGRONEGÓCIO</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="ml-auto grid h-10 w-10 shrink-0 place-items-center rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white lg:hidden"
            aria-label="Fechar menu"
          >
            <X size={21} />
          </button>
        </div>

        <nav className="grid gap-1">
          {navItems.map((item) => {
            if (item.children) {
              const visibleChildren = item.children.filter((child) => can(child.menu, 'visualizar'));
              if (!visibleChildren.length) return null;
              const GroupIcon = item.icon;
              const isGroupActive = visibleChildren.some((child) => location.pathname === child.to);

              return (
                <div key={item.label} className="grid gap-1">
                  <div
                    className={[
                      'flex min-h-11 items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-bold transition',
                      isGroupActive ? 'bg-slate-800 text-white' : 'text-slate-200',
                    ].join(' ')}
                  >
                    <GroupIcon size={18} />
                    <span>{item.label}</span>
                  </div>
                  <div className="ml-4 grid gap-1 border-l border-slate-700 pl-3">
                    {visibleChildren.map((child) => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        className={({ isActive }) =>
                          [
                            'flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition',
                            isActive ? 'bg-[#31bf69] text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                          ].join(' ')
                        }
                      >
                        <child.icon size={17} />
                        <span>{child.label}</span>
                      </NavLink>
                    ))}
                  </div>
                </div>
              );
            }

            if (!can(item.menu, 'visualizar')) return null;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  [
                    'flex min-h-11 items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-semibold transition',
                    isActive ? 'bg-[#31bf69] text-white' : 'text-slate-200 hover:bg-slate-800 hover:text-white',
                  ].join(' ')
                }
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="mt-5 border-t border-slate-800 px-4 pt-4 text-xs text-slate-400">
          <p className="truncate font-semibold text-slate-200">{profileData?.nome || profileData?.email}</p>
          <p className="mt-1 uppercase">{profileData?.perfil || 'usuário'}</p>
        </div>

        <button
          type="button"
          onClick={signOut}
          className="mt-8 flex h-11 items-center gap-3 border-t border-slate-800 px-4 pt-5 text-sm font-semibold text-slate-300 transition hover:text-white lg:mt-auto"
        >
          <LogOut size={18} />
          Sair
        </button>
      </aside>
      <main className="min-w-0 px-3 py-4 sm:px-5 sm:py-5 lg:px-7">
        <Outlet />
      </main>
    </div>
  );
}
