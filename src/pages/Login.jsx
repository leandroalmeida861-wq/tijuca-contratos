import { Lock, Mail, Sprout } from 'lucide-react';
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AUTHORIZED_EMAIL, useAuth } from '../contexts/AuthContext.jsx';

export default function Login() {
  const { signIn, signUp, user, configured } = useAuth();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState(AUTHORIZED_EMAIL);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  if (user?.email === AUTHORIZED_EMAIL) return <Navigate to="/" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    setLoading(true);
    try {
      if (!configured) throw new Error('Configure as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
      if (mode === 'login') {
        await signIn(email, password);
      } else {
        await signUp(email, password);
        setMessage('Cadastro enviado. Se a confirmação por e-mail estiver ativa no Supabase, confirme antes de entrar.');
      }
    } catch (error) {
      setMessage(error.message || 'Não foi possível autenticar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4">
      <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-panel">
        <div className="mb-7 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-tijuca-500 text-white">
            <Sprout size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-wide text-slate-950">AgroFlow</h1>
            <p className="text-sm font-medium text-slate-500">Gestão de contratos</p>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`h-10 rounded-md text-sm font-bold ${mode === 'login' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`h-10 rounded-md text-sm font-bold ${mode === 'signup' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}
          >
            Criar senha
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            E-mail autorizado
            <div className="flex h-12 items-center gap-3 rounded-lg border border-slate-300 bg-white px-3 focus-within:border-tijuca-500 focus-within:ring-4 focus-within:ring-tijuca-100">
              <Mail size={18} className="text-slate-400" />
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full border-0 outline-none"
                type="email"
                autoComplete="email"
                required
              />
            </div>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Senha
            <div className="flex h-12 items-center gap-3 rounded-lg border border-slate-300 bg-white px-3 focus-within:border-tijuca-500 focus-within:ring-4 focus-within:ring-tijuca-100">
              <Lock size={18} className="text-slate-400" />
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full border-0 outline-none"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={6}
                required
              />
            </div>
          </label>
          <button
            type="submit"
            disabled={loading}
            className="h-12 rounded-lg bg-tijuca-600 text-sm font-extrabold text-white transition hover:bg-tijuca-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {loading ? 'Processando...' : mode === 'login' ? 'Acessar dashboard' : 'Confirmar cadastro'}
          </button>
        </form>

        {message && <p className="mt-4 rounded-lg bg-slate-100 p-3 text-sm font-medium text-slate-700">{message}</p>}
      </section>
    </main>
  );
}
