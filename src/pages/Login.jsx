import { BarChart3, FileCheck2, Lock, Mail, ShieldCheck, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
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
      if (!configured) throw new Error('Configure as variaveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
      if (mode === 'login') {
        await signIn(email, password);
      } else {
        await signUp(email, password);
        setMessage('Cadastro enviado. Se a confirmacao por e-mail estiver ativa no Supabase, confirme antes de entrar.');
      }
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel autenticar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#eef3f6] px-4 py-6 text-slate-900 sm:px-6 lg:grid lg:place-items-center">
      <section className="mx-auto grid w-full max-w-6xl overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.18)] lg:grid-cols-[1.45fr_0.9fr]">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#073f3a] via-[#0b7782] to-[#27a9d2] p-7 text-white sm:p-9 lg:min-h-[640px]">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-tl-[120px] bg-[#31bf69]/20" />

          <div className="relative z-10 flex items-center gap-3">
            <img src="/agroflow-icon.png" alt="AgroFlow" className="h-14 w-14 rounded-2xl object-cover shadow-lg" />
            <div>
              <p className="text-2xl font-black tracking-wide">AgroFlow</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-100">gestao inteligente de contratos</p>
            </div>
          </div>

          <div className="relative z-10 mt-12 max-w-2xl">
            <p className="mb-3 inline-flex rounded-full bg-white/12 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-100 ring-1 ring-white/15">
              Plataforma de controle operacional
            </p>
            <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-5xl">
              Contratos, notas, fretes e financeiro em um unico lugar.
            </h1>
            <p className="mt-5 max-w-xl text-base font-medium leading-7 text-cyan-50">
              Organize compras, acompanhe saldo por contrato, importe XML, vincule fretes e tenha um fechamento financeiro mais seguro, claro e rastreavel.
            </p>
          </div>

          <div className="relative z-10 mt-9 grid gap-3 sm:grid-cols-3">
            <LoginBenefit icon={FileCheck2} title="Contratos" text="Volume, prazo, produto e fornecedor sempre visiveis." />
            <LoginBenefit icon={BarChart3} title="Indicadores" text="Dashboard com saldo, execucao e alertas de vencimento." />
            <LoginBenefit icon={ShieldCheck} title="Seguranca" text="Acesso protegido, banco online e backup dos dados." />
          </div>

          <div className="relative z-10 mt-10 grid gap-4 sm:grid-cols-3">
            <LoginMetric value="100%" label="mais controle sobre contratos" />
            <LoginMetric value="XML" label="importacao de notas e CT-e" />
            <LoginMetric value="PDF" label="relatorios para conferencia" />
          </div>

          <div className="relative z-10 mt-10 rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-300/20 text-emerald-100">
                <TrendingUp size={21} />
              </div>
              <div>
                <p className="text-sm font-extrabold">Fechamento financeiro com mais confianca</p>
                <p className="mt-1 text-sm leading-6 text-cyan-50">
                  O custo medio considera contrato e frete vinculado, reduzindo divergencias na conferencia de saldos e valores.
                </p>
              </div>
            </div>
          </div>
        </div>

        <aside className="flex items-center justify-center bg-[#f8fafc] p-6 sm:p-8">
          <section className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.12)]">
            <div className="mb-7 text-center">
              <img src="/agroflow-icon.png" alt="AgroFlow" className="mx-auto h-16 w-16 rounded-2xl object-cover shadow-sm" />
              <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-950">Bem-vindo de volta</h2>
              <p className="mt-2 text-sm font-medium leading-5 text-slate-500">
                Acesse sua area segura para controlar contratos e relatorios.
              </p>
            </div>

            <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`h-10 rounded-lg text-sm font-bold transition ${mode === 'login' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => setMode('signup')}
                className={`h-10 rounded-lg text-sm font-bold transition ${mode === 'signup' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Criar senha
              </button>
            </div>

            <Link
              to="/acesso.html"
              className="mb-5 grid h-11 place-items-center rounded-xl border border-teal-100 bg-teal-50 text-sm font-extrabold text-teal-800 transition hover:border-teal-200 hover:bg-teal-100"
            >
              Solicitar acesso ao sistema
            </Link>

            <form onSubmit={handleSubmit} className="grid gap-4">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                E-mail autorizado
                <div className="flex h-12 items-center gap-3 rounded-xl border border-slate-300 bg-white px-3 focus-within:border-tijuca-500 focus-within:ring-4 focus-within:ring-tijuca-100">
                  <Mail size={18} className="text-slate-400" />
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full border-0 bg-transparent outline-none"
                    type="email"
                    autoComplete="email"
                    required
                  />
                </div>
              </label>

              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Senha
                <div className="flex h-12 items-center gap-3 rounded-xl border border-slate-300 bg-white px-3 focus-within:border-tijuca-500 focus-within:ring-4 focus-within:ring-tijuca-100">
                  <Lock size={18} className="text-slate-400" />
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full border-0 bg-transparent outline-none"
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
                className="h-12 rounded-xl bg-gradient-to-r from-[#16895a] to-[#12a7a0] text-sm font-extrabold text-white shadow-lg shadow-emerald-900/15 transition hover:brightness-105 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none"
              >
                {loading ? 'Processando...' : mode === 'login' ? 'Entrar no sistema' : 'Confirmar cadastro'}
              </button>
            </form>

            {message && <p className="mt-4 rounded-xl bg-slate-100 p-3 text-sm font-medium leading-5 text-slate-700">{message}</p>}

            <p className="mt-6 text-center text-xs font-medium leading-5 text-slate-500">
              Sistema exclusivo para usuario autorizado. Use sempre Sair ao finalizar em computador compartilhado.
            </p>
          </section>
        </aside>
      </section>
    </main>
  );
}

function LoginBenefit({ icon: Icon, title, text }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur">
      <div className="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-white/15 text-emerald-100">
        <Icon size={19} />
      </div>
      <p className="text-sm font-extrabold">{title}</p>
      <p className="mt-1 text-xs leading-5 text-cyan-50">{text}</p>
    </div>
  );
}

function LoginMetric({ value, label }) {
  return (
    <div>
      <p className="text-2xl font-black leading-none">{value}</p>
      <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-cyan-100">{label}</p>
    </div>
  );
}
