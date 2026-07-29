// Login e solicitacao de acesso com senha protegida no backend.
import {
  ArrowRight,
  ChartNoAxesCombined,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Network,
  Phone,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AUTHORIZED_EMAIL, useAuth } from '../contexts/AuthContext.jsx';
import { appUrl } from '../lib/appUrl.js';
import { supabase } from '../lib/supabase.js';

const initialAccessForm = {
  nome: '',
  email: '',
  telefone: '',
  observacao: '',
  senha: '',
  confirmarSenha: '',
};

export default function Login() {
  const { signIn, user, authorized, configured } = useAuth();
  const [mode, setMode] = useState(() => (hasPasswordSetupToken() ? 'setPassword' : 'login'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accessForm, setAccessForm] = useState(initialAccessForm);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapAuthCallback() {
      if (!supabase) return;

      const queryParams = new URLSearchParams(window.location.search);
      const code = queryParams.get('code');

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!cancelled && !error) {
          setMode('setPassword');
          window.history.replaceState({}, document.title, '/login');
        }
        return;
      }

      if (hasPasswordSetupToken()) {
        const { data } = await supabase.auth.getSession();
        if (!cancelled && data?.session) {
          setMode('setPassword');
        }
      }
    }

    bootstrapAuthCallback();

    if (!supabase) return undefined;

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('setPassword');
        return;
      }
      if (event === 'SIGNED_IN' && isPasswordSetupFlow()) {
        setMode('setPassword');
      }
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (user && authorized && mode !== 'setPassword') return <Navigate to="/inicio" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    setLoading(true);
    try {
      if (!configured) throw new Error('Configure as variaveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');

      if (mode === 'login') {
        await signIn(email, password);
      } else if (mode === 'setPassword') {
        await submitPasswordSetup();
      } else if (mode === 'forgotPassword') {
        await submitForgotPassword();
      } else {
        await submitAccessRequest();
      }
    } catch (error) {
      setMessage(toPortugueseError(error));
    } finally {
      setLoading(false);
    }
  }

  async function submitAccessRequest() {
    if (accessForm.senha.length < 6) {
      throw new Error('A senha deve ter pelo menos 6 caracteres. Como corrigir: informe uma senha maior.');
    }
    if (accessForm.senha !== accessForm.confirmarSenha) {
      throw new Error('As senhas nao conferem. Como corrigir: digite a mesma senha nos dois campos.');
    }

    const databaseRequest = await registerAccessRequestInSupabase(accessForm);

    submitNetlifyAccessEmail({
      nome: accessForm.nome,
      email: accessForm.email,
      telefone: accessForm.telefone,
      observacao: accessForm.observacao,
      destinatario: AUTHORIZED_EMAIL,
      origem: 'agroflow-contratos-login',
      link_liberacao: databaseRequest.approvalUrl,
      status_senha: 'Senha protegida pelo backend e nunca enviada neste e-mail.',
      status_banco: 'Solicitacao pendente. A aprovacao deve ser feita em Usuarios e permissoes.',
    });

    setAccessForm(initialAccessForm);
    setMessage('Pedido registrado. Depois da aprovacao, entre usando o e-mail e a senha informados.');
  }

  async function submitPasswordSetup() {
    if (password.length < 6) {
      throw new Error('Crie uma senha com pelo menos 6 caracteres. Como corrigir: digite uma senha maior antes de continuar.');
    }
    if (password !== confirmPassword) {
      throw new Error('As senhas nao conferem. Como corrigir: digite a mesma senha nos dois campos.');
    }

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) {
      throw new Error('Convite ainda nao carregou a sessao. Como corrigir: aguarde alguns segundos nesta tela ou abra novamente o link do convite recebido no e-mail.');
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;

    window.history.replaceState({}, document.title, '/login');
    setPassword('');
    setConfirmPassword('');
    setMode('login');
    setMessage('Senha criada com sucesso. Agora entre no AgroFlow usando seu e-mail e a senha criada.');
  }

  async function submitForgotPassword() {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      throw new Error('Informe o e-mail aprovado. Como corrigir: digite o mesmo e-mail usado para acessar o AgroFlow.');
    }

    const { error } = await supabase.auth.resetPasswordForEmail(normalized, {
      redirectTo: appUrl('/login'),
    });
    if (error) throw error;

    setMode('login');
    setPassword('');
    setMessage('Enviamos um link para alterar a senha. Abra o e-mail recebido e crie uma nova senha pelo AgroFlow.');
  }

  function updateAccessForm(field, value) {
    setAccessForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <main className="min-h-screen bg-[#031f2c] px-3 py-3 text-slate-900 sm:px-6 sm:py-6 lg:grid lg:place-items-center lg:px-8">
      <section className="mx-auto grid w-full max-w-[1480px] overflow-hidden rounded-[26px] border border-white/20 bg-white shadow-[0_30px_90px_rgba(0,12,20,0.45)] lg:min-h-[800px] lg:grid-cols-[minmax(0,1.4fr)_minmax(420px,1fr)]">
        <LoginHero />

        <aside className="flex items-center justify-center bg-white px-5 py-8 sm:px-10 sm:py-12 lg:px-12">
          <section className="w-full max-w-[470px]">
            <div className="mb-7 text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-700 shadow-sm">
                <ShieldCheck size={34} strokeWidth={1.8} aria-hidden="true" />
              </div>
              <h2 className="mt-5 text-3xl font-black tracking-tight text-[#071528]">{titleForMode(mode)}</h2>
              <p className="mt-2 text-sm font-medium leading-5 text-slate-500">
                {descriptionForMode(mode)}
              </p>
            </div>

            {mode !== 'setPassword' && (
              <div className="mb-7 grid grid-cols-2 rounded-xl border border-slate-200 bg-slate-100/80 p-1 shadow-inner">
                <ModeButton active={mode === 'login'} onClick={() => setMode('login')}>Entrar</ModeButton>
                <ModeButton active={mode === 'request'} onClick={() => setMode('request')}>Solicitar</ModeButton>
              </div>
            )}

            <form onSubmit={handleSubmit} autoComplete="off" className="grid gap-4">
              {mode === 'request' ? (
                <AccessRequestFields form={accessForm} update={updateAccessForm} />
              ) : mode === 'setPassword' ? (
                <PasswordSetupFields password={password} setPassword={setPassword} confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword} />
              ) : mode === 'forgotPassword' ? (
                <ForgotPasswordFields email={email} setEmail={setEmail} />
              ) : (
                <LoginFields mode={mode} email={email} setEmail={setEmail} password={password} setPassword={setPassword} />
              )}

              <button
                type="submit"
                disabled={loading}
                className="group flex h-14 items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-[#118c58] to-[#15a266] text-sm font-extrabold text-white shadow-[0_12px_24px_rgba(17,140,88,0.22)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:translate-y-0 disabled:bg-slate-400 disabled:shadow-none"
              >
                <span>{loading ? 'Processando...' : submitLabel(mode)}</span>
                {!loading && <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />}
              </button>
            </form>

            {message && <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium leading-5 text-slate-700">{message}</p>}

            <div className="mt-7 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 before:h-px before:flex-1 before:bg-slate-200 after:h-px after:flex-1 after:bg-slate-200">
              Acesso seguro
            </div>
            <p className="mt-4 text-center text-xs font-medium leading-5 text-slate-500">
              {mode === 'request'
                ? 'Sua senha e protegida e nunca fica visivel para o administrador.'
                : 'Novo usuario solicita acesso e aguarda a aprovacao do administrador.'}
            </p>
            {mode === 'login' && (
              <button
                type="button"
                onClick={() => {
                  setMode('forgotPassword');
                  setMessage('');
                  setPassword('');
                }}
                className="mt-3 w-full text-center text-xs font-black text-teal-700 transition hover:text-teal-900"
              >
                Alterar ou recuperar senha
              </button>
            )}
            {mode === 'forgotPassword' && (
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setMessage('');
                }}
                className="mt-3 w-full text-center text-xs font-black text-teal-700 transition hover:text-teal-900"
              >
                Voltar para entrar
              </button>
            )}
          </section>
        </aside>
      </section>
    </main>
  );
}

function LoginHero() {
  const benefits = [
    {
      title: 'Segurança',
      description: 'Controle de acesso e proteção das informações da operação.',
      icon: ShieldCheck,
    },
    {
      title: 'Integração',
      description: 'Contratos, notas fiscais e logística em um único ambiente.',
      icon: Network,
    },
    {
      title: 'Controle operacional',
      description: 'Visão completa de custos, saldos e resultados do negócio.',
      icon: ChartNoAxesCombined,
    },
  ];

  return (
    <div className="relative isolate min-h-[500px] overflow-hidden bg-[#052b39] text-white sm:min-h-[580px] lg:min-h-full">
      <img
        src="/images/agroflow-login-silos.webp"
        alt="Silos metálicos de armazenagem de grãos ao entardecer"
        className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
        width="1920"
        height="1280"
        fetchPriority="high"
      />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(2,28,40,0.97)_0%,rgba(3,34,46,0.82)_48%,rgba(3,31,42,0.28)_100%)]" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(0deg,rgba(1,24,34,0.72)_0%,transparent_55%,rgba(1,24,34,0.28)_100%)]" />

      <div className="flex min-h-full flex-col px-6 py-7 sm:px-10 sm:py-9 lg:px-14 lg:py-12">
        <div className="flex items-center gap-4">
          <img
            src="/agroflow-symbol.png"
            alt="Símbolo AgroFlow"
            className="h-[72px] w-[72px] shrink-0 rounded-2xl border border-emerald-300/30 bg-[#042c3a]/70 object-contain p-1 drop-shadow-[0_10px_20px_rgba(0,0,0,0.3)] sm:h-[82px] sm:w-[82px]"
          />
          <div className="min-w-0">
            <p className="text-[36px] font-black leading-none tracking-wide drop-shadow-[0_3px_8px_rgba(0,0,0,0.35)] sm:text-5xl">
              <span className="text-[#5dcaa5]">Agro</span>
              <span className="text-[#ef9f27]">Flow</span>
            </p>
            <p className="mt-2 text-[10px] font-black uppercase leading-[1.35] tracking-[0.16em] text-emerald-100 sm:text-xs">
              Gestão Inteligente do Agronegócio
            </p>
          </div>
        </div>

        <div className="mt-10 max-w-2xl sm:mt-14 lg:mt-16">
          <h1 className="text-4xl font-black leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[54px]">
            Gestão integrada.
            <span className="mt-1 block">Resultados que <span className="text-emerald-400">crescem.</span></span>
          </h1>
          <p className="mt-5 max-w-xl text-sm font-medium leading-6 text-slate-100 sm:text-base sm:leading-7">
            O AgroFlow centraliza contratos, notas fiscais, fretes e informações financeiras para uma operação mais segura, previsível e eficiente.
          </p>
        </div>

        <div className="mt-8 hidden max-w-xl sm:block lg:mt-12">
          <div className="mb-5 flex items-center gap-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">Inteligência e controle para o seu negócio</p>
            <span className="h-px w-12 bg-emerald-400/70" />
          </div>
          <div className="grid gap-5">
            {benefits.map(({ title, description, icon: Icon }) => (
              <article key={title} className="flex items-center gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-emerald-400/60 bg-[#07394a]/75 text-white backdrop-blur-sm">
                  <Icon size={22} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-sm font-extrabold text-white">{title}</h2>
                  <p className="mt-1 text-xs font-medium leading-5 text-slate-200">{description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ModeButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-11 rounded-lg border-b-2 text-xs font-extrabold transition sm:text-sm ${active ? 'border-emerald-600 bg-white text-emerald-700 shadow-sm' : 'border-transparent text-slate-500 hover:bg-white/60 hover:text-slate-800'}`}
    >
      {children}
    </button>
  );
}

function LoginFields({ mode, email, setEmail, password, setPassword }) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <>
      <Field label="E-mail autorizado" icon={Mail}>
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full border-0 bg-transparent outline-none"
          type="email"
          autoComplete="off"
          placeholder="seu@email.com"
          required
        />
      </Field>

      <Field label="Senha" icon={Lock}>
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="min-w-0 flex-1 border-0 bg-transparent outline-none"
          type={showPassword ? 'text' : 'password'}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          placeholder="Digite sua senha"
          minLength={6}
          required
        />
        <PasswordVisibilityButton visible={showPassword} onClick={() => setShowPassword((current) => !current)} label="senha" />
      </Field>
    </>
  );
}

function PasswordSetupFields({ password, setPassword, confirmPassword, setConfirmPassword }) {
  return (
    <>
      <Field label="Nova senha" icon={Lock}>
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full border-0 bg-transparent outline-none"
          type="password"
          autoComplete="new-password"
          minLength={6}
          required
        />
      </Field>
      <Field label="Confirmar nova senha" icon={Lock}>
        <input
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="w-full border-0 bg-transparent outline-none"
          type="password"
          autoComplete="new-password"
          minLength={6}
          required
        />
      </Field>
    </>
  );
}

function ForgotPasswordFields({ email, setEmail }) {
  return (
    <Field label="E-mail aprovado" icon={Mail}>
      <input
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="w-full border-0 bg-transparent outline-none"
        type="email"
        autoComplete="off"
        required
      />
    </Field>
  );
}

function AccessRequestFields({ form, update }) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  return (
    <>
      <Field label="Nome do solicitante" icon={UserRound}>
        <input value={form.nome} onChange={(event) => update('nome', event.target.value)} className="w-full border-0 bg-transparent outline-none" required />
      </Field>
      <Field label="E-mail do solicitante" icon={Mail}>
        <input value={form.email} onChange={(event) => update('email', event.target.value)} className="w-full border-0 bg-transparent outline-none" type="email" required />
      </Field>
      <Field label="Telefone ou WhatsApp" icon={Phone}>
        <input value={form.telefone} onChange={(event) => update('telefone', event.target.value)} className="w-full border-0 bg-transparent outline-none" />
      </Field>
      <Field label="Senha" icon={Lock}>
        <input
          value={form.senha}
          onChange={(event) => update('senha', event.target.value)}
          className="min-w-0 flex-1 border-0 bg-transparent outline-none"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          minLength={6}
          required
        />
        <PasswordVisibilityButton visible={showPassword} onClick={() => setShowPassword((current) => !current)} label="senha" />
      </Field>
      <Field label="Confirmar senha" icon={Lock}>
        <input
          value={form.confirmarSenha}
          onChange={(event) => update('confirmarSenha', event.target.value)}
          className="min-w-0 flex-1 border-0 bg-transparent outline-none"
          type={showConfirmation ? 'text' : 'password'}
          autoComplete="new-password"
          minLength={6}
          required
        />
        <PasswordVisibilityButton visible={showConfirmation} onClick={() => setShowConfirmation((current) => !current)} label="confirmacao da senha" />
      </Field>
      <label className="grid gap-2 text-sm font-semibold text-slate-700">
        Observacao para liberacao
        <textarea
          value={form.observacao}
          onChange={(event) => update('observacao', event.target.value)}
          className="min-h-24 rounded-xl border border-slate-300 bg-white px-3 py-3 outline-none focus:border-tijuca-500 focus:ring-4 focus:ring-tijuca-100"
        />
      </label>
    </>
  );
}

function PasswordVisibilityButton({ visible, onClick, label }) {
  const Icon = visible ? EyeOff : Eye;
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
      aria-label={`${visible ? 'Ocultar' : 'Mostrar'} ${label}`}
      title={`${visible ? 'Ocultar' : 'Mostrar'} ${label}`}
    >
      <Icon size={17} />
    </button>
  );
}

function Field({ label, icon: Icon, children }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-700">
      {label}
      <div className="flex h-14 items-center gap-3 rounded-xl border border-slate-300 bg-white px-4 shadow-sm transition focus-within:border-emerald-600 focus-within:ring-4 focus-within:ring-emerald-100">
        <Icon size={18} className="shrink-0 text-slate-400" />
        {children}
      </div>
    </label>
  );
}

function submitLabel(mode) {
  if (mode === 'login') return 'Entrar no sistema';
  if (mode === 'setPassword') return 'Criar senha';
  if (mode === 'forgotPassword') return 'Enviar link para alterar senha';
  return 'Enviar pedido de acesso';
}

function titleForMode(mode) {
  if (mode === 'request') return 'Solicitar acesso';
  if (mode === 'setPassword') return 'Criar senha de acesso';
  if (mode === 'forgotPassword') return 'Alterar senha';
  return 'Bem-vindo de volta';
}

function descriptionForMode(mode) {
  if (mode === 'request') return 'Preencha os dados para que Leandro receba o link de liberacao no e-mail dele.';
  if (mode === 'setPassword') return 'Seu convite foi aprovado. Crie uma senha para entrar no AgroFlow.';
  if (mode === 'forgotPassword') return 'Informe seu e-mail aprovado para receber um link seguro de alteracao de senha.';
  return 'Acesse sua area segura para controlar contratos e relatorios.';
}

function hasPasswordSetupToken() {
  return isPasswordSetupFlow();
}

function isPasswordSetupFlow() {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const queryParams = new URLSearchParams(window.location.search);
  const type = hashParams.get('type') || queryParams.get('type');

  if (type === 'invite' || type === 'recovery' || type === 'signup') return true;

  return Boolean(
    hashParams.get('access_token')
      || hashParams.get('refresh_token')
      || hashParams.get('token_hash')
      || queryParams.get('code')
      || queryParams.get('token_hash')
      || queryParams.get('confirmation_url'),
  );
}

async function registerAccessRequestInSupabase(form) {
  const response = await fetch('/api/solicitar-acesso', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nome: form.nome.trim(),
      email: form.email.trim().toLowerCase(),
      telefone: form.telefone.trim(),
      observacao: form.observacao.trim(),
      senha: form.senha,
      confirmarSenha: form.confirmarSenha,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.approvalUrl) {
    throw new Error(payload?.error || 'Nao foi possivel registrar o pedido de acesso. Como corrigir: confira os dados e tente novamente.');
  }
  return payload;
}

function toPortugueseError(error) {
  const message = error?.message || '';
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('invalid login credentials')) {
    return 'E-mail ou senha incorretos. Como corrigir: confira o e-mail digitado e use a senha cadastrada para esse usuario.';
  }
  if (lowerMessage.includes('email not confirmed')) {
    return 'Cadastro ainda nao finalizado. Como corrigir: abra o convite oficial do Supabase enviado depois da aprovacao e crie sua senha por ele.';
  }
  if (lowerMessage.includes('function public') || lowerMessage.includes('schema cache') || lowerMessage.includes('does not exist')) {
    return 'Configuracao antiga do banco encontrada. Como corrigir: atualize a pagina; se continuar, aplique novamente o SQL mais recente no Supabase.';
  }
  if (message) return message;
  return 'Nao foi possivel concluir a operacao. Como corrigir: confira os dados preenchidos e tente novamente.';
}

function submitNetlifyAccessEmail(fields) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = 'https://chipper-ganache-d099b1.netlify.app/obrigado.html';
  form.style.display = 'none';

  const allFields = {
    'form-name': 'pedido-acesso',
    ...fields,
  };

  Object.entries(allFields).forEach(([name, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value || '';
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
}
