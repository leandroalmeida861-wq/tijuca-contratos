import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { getFirstAllowedRoute } from '../lib/permissions.js';

export default function AccessDenied() {
  const { can } = useAuth();
  const allowedRoute = getFirstAllowedRoute(can);

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 p-6">
      <section className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-7 text-center shadow-lg">
        <img src="/agroflow-icon.png" alt="AgroFlow" className="mx-auto h-16 w-16 rounded-lg" />
        <h1 className="mt-5 text-2xl font-extrabold text-slate-950">Acesso negado</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Você não tem permissão para acessar esta área. Caso precise de acesso, solicite ao administrador do sistema.
        </p>
        <Link to={allowedRoute || '/login'} className="mt-6 inline-flex h-11 items-center rounded-lg bg-emerald-600 px-5 text-sm font-extrabold text-white">
          {allowedRoute ? 'Ir para uma área permitida' : 'Voltar ao login'}
        </Link>
      </section>
    </main>
  );
}
