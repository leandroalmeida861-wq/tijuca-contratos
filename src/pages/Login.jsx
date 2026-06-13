import { BarChart3, FileCheck2, Lock, Mail, Phone, ShieldCheck, TrendingUp, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AUTHORIZED_EMAIL, useAuth } from '../contexts/AuthContext.jsx';
import { isSupabaseConfigured, supabase } from '../lib/supabase.js';

const initialAccessForm = {
  nome: '',
  email: '',
  telefone: '',
  password: '',
  confirmPassword: '',
  observacao: '',
};

export default function Login() {
  const { signIn, approveLocalAccess, changeApprovedPassword, user, authorized, configured } = useAuth();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState(AUTHORIZED_EMAIL);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accessForm, setAccessForm] = useState(initialAccessForm);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const approvalParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const [approvalMode, setApprovalMode] = useState(() => approvalParams.get('aprovar_acesso') === '1');

  useEffect(() => {
    if (!approvalMode) return;

    approveAccessFromLink();

    async function approveAccessFromLink() {
      try {
        const approved = await approveLocalAccess({
          email: approvalParams.get('email'),
          name: approvalParams.get('nome'),
          password: approvalParams.get('senha'),
        });
        const databaseMessage = approved.databaseApproval?.ok
          ? ' O e-mail também foi liberado no banco de dados.'
          : ' Atenção: para acessar dados do banco, entre como administrador antes de abrir o link de liberação ou aplique o SQL de liberação no Supabase.';
        setMode('login');
        setEmail(approved.email);
        setPassword('');
        setMessage(`Acesso liberado para ${approved.email}. Agora esse usuario pode entrar com a senha cadastrada no pedido.${databaseMessage}`);
        window.history.replaceState({}, document.title, window.location.pathname);
        setApprovalMode(false);
      } catch (error) {
        setMode('login');
        setMessage(error.message || 'Nao foi possivel liberar este acesso.');
        setApprovalMode(false);
      }
    }
  }, [approvalMode, approvalParams, approveLocalAccess]);

  if (user && authorized && !approvalMode) return <Navigate to="/" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    setLoading(true);
    try {
      if (!configured) throw new Error('Configure as variaveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');

      if (mode === 'login') {
        await signIn(email, password);
      } else if (mode === 'reset') {
        changeApprovedPassword(email, password, confirmPassword);
        setMode('login');
        setConfirmPassword('');
        setMessage('Senha alterada. Agora clique em Entrar no sistema com este e-mail e senha.');
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
    if (accessForm.password.length < 6) {
      throw new Error('A senha desejada deve ter pelo menos 6 caracteres. Como corrigir: escolha uma senha maior antes de enviar o pedido.');
    }
    if (accessForm.password !== accessForm.confirmPassword) {
      throw new Error('As senhas nao conferem. Como corrigir: digite a mesma senha nos dois campos.');
    }

    const approvalLink = new URL('/login', window.location.origin);
    approvalLink.searchParams.set('aprovar_acesso', '1');
    approvalLink.searchParams.set('email', accessForm.email.trim().toLowerCase());
    approvalLink.searchParams.set('nome', accessForm.nome.trim());
    approvalLink.searchParams.set('senha', accessForm.password);

    const databaseRequest = await registerAccessRequestInSupabase(accessForm);

    submitNetlifyAccessEmail({
      nome: accessForm.nome,
      email: accessForm.email,
      telefone: accessForm.telefone,
      senha: accessForm.password,
      confirmar_senha: accessForm.confirmPassword,
      observacao: accessForm.observacao,
      destinatario: AUTHORIZED_EMAIL,
      origem: 'agroflow-contratos-login',
      link_liberacao: approvalLink.toString(),
      status_senha: 'Senha enviada nos campos senha e confirmar_senha. O login consulta usuarios_autorizados no Supabase apos aprovacao.',
      status_banco: databaseRequest.requestSaved
        ? 'Solicitacao gravada no Supabase em solicitacoes_acesso.'
        : `Solicitacao enviada por e-mail. Aviso banco: ${databaseRequest.warning}`,
    });

    setAccessForm(initialAccessForm);
    setMessage(
      databaseRequest.requestSaved
        ? 'Pedido registrado no banco e enviado ao administrador. Depois da liberacao, o usuario podera entrar com essa senha.'
        : `Pedido enviado ao administrador. Atencao: nao foi possivel registrar no banco agora (${databaseRequest.warning}). Se o usuario nao acessar apos aprovacao, aplique o SQL mais recente no Supabase.`,
    );
  }

  function updateAccessForm(field, value) {
    setAccessForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <main className="min-h-screen bg-[#eef3f6] px-4 py-6 text-slate-900 sm:px-6 lg:grid lg:place-items-center">
      <section className="mx-auto grid w-full max-w-6xl overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.18)] lg:grid-cols-[1.25fr_1fr]">
        <LoginHero />

        <aside className="flex items-center justify-center bg-[#f8fafc] p-5 sm:p-8">
          <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.12)]">
            <div className="mb-6 text-center">
              <img src="/agroflow-icon.png" alt="AgroFlow" className="mx-auto h-16 w-16 rounded-2xl object-cover shadow-sm" />
              <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-950">{mode === 'request' ? 'Solicitar acesso' : 'Bem-vindo de volta'}</h2>
              <p className="mt-2 text-sm font-medium leading-5 text-slate-500">
                {mode === 'reset'
                  ? 'Altere a senha de um usuario que ja foi liberado neste navegador.'
                  : mode === 'request'
                  ? 'Preencha os dados para que Leandro receba o link de liberacao no e-mail dele.'
                  : 'Acesse sua area segura para controlar contratos e relatorios.'}
              </p>
            </div>

            <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
              <ModeButton active={mode === 'login'} onClick={() => setMode('login')}>Entrar</ModeButton>
              <ModeButton active={mode === 'request'} onClick={() => setMode('request')}>Solicitar</ModeButton>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-4">
              {mode === 'request' ? (
                <AccessRequestFields form={accessForm} update={updateAccessForm} />
              ) : mode === 'reset' ? (
                <ResetFields email={email} setEmail={setEmail} password={password} setPassword={setPassword} confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword} />
              ) : (
                <LoginFields mode={mode} email={email} setEmail={setEmail} password={password} setPassword={setPassword} />
              )}

              <button
                type="submit"
                disabled={loading}
                className="h-12 rounded-xl bg-gradient-to-r from-[#16895a] to-[#12a7a0] text-sm font-extrabold text-white shadow-lg shadow-emerald-900/15 transition hover:brightness-105 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none"
              >
                {loading ? 'Processando...' : submitLabel(mode)}
              </button>
            </form>

            {message && <p className="mt-4 rounded-xl bg-slate-100 p-3 text-sm font-medium leading-5 text-slate-700">{message}</p>}

            <p className="mt-6 text-center text-xs font-medium leading-5 text-slate-500">
              Novo usuario escolhe a senha em Solicitar e so consegue entrar depois da liberacao.
            </p>
            <button
              type="button"
              onClick={() => { setMode('reset'); setMessage(''); }}
              className="mt-3 w-full text-center text-xs font-black text-teal-700 transition hover:text-teal-900"
            >
              Alterar senha de usuario liberado
            </button>
          </section>
        </aside>
      </section>
    </main>
  );
}

function LoginHero() {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-[#073f3a] via-[#0b7782] to-[#27a9d2] p-7 text-white sm:p-9 lg:min-h-[700px]">
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
  );
}

function ModeButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 rounded-lg text-xs font-bold transition sm:text-sm ${active ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
    >
      {children}
    </button>
  );
}

function LoginFields({ mode, email, setEmail, password, setPassword }) {
  return (
    <>
      <Field label="E-mail autorizado" icon={Mail}>
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full border-0 bg-transparent outline-none"
          type="email"
          autoComplete="email"
          required
        />
      </Field>

      <Field label="Senha" icon={Lock}>
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full border-0 bg-transparent outline-none"
          type="password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          minLength={6}
          required
        />
      </Field>
    </>
  );
}

function ResetFields({ email, setEmail, password, setPassword, confirmPassword, setConfirmPassword }) {
  return (
    <>
      <Field label="E-mail liberado" icon={Mail}>
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full border-0 bg-transparent outline-none"
          type="email"
          autoComplete="email"
          required
        />
      </Field>
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

function AccessRequestFields({ form, update }) {
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
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Senha desejada" icon={Lock}>
          <input value={form.password} onChange={(event) => update('password', event.target.value)} className="w-full border-0 bg-transparent outline-none" type="password" minLength={6} required />
        </Field>
        <Field label="Confirmar senha" icon={Lock}>
          <input value={form.confirmPassword} onChange={(event) => update('confirmPassword', event.target.value)} className="w-full border-0 bg-transparent outline-none" type="password" minLength={6} required />
        </Field>
      </div>
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

function Field({ label, icon: Icon, children }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-700">
      {label}
      <div className="flex h-12 items-center gap-3 rounded-xl border border-slate-300 bg-white px-3 focus-within:border-tijuca-500 focus-within:ring-4 focus-within:ring-tijuca-100">
        <Icon size={18} className="shrink-0 text-slate-400" />
        {children}
      </div>
    </label>
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

function submitLabel(mode) {
  if (mode === 'login') return 'Entrar no sistema';
  if (mode === 'reset') return 'Alterar senha';
  return 'Enviar pedido de acesso';
}

async function registerAccessRequestInSupabase(form) {
  if (!isSupabaseConfigured) return { requestSaved: false, warning: 'Supabase nao configurado' };

  const email = form.email.trim().toLowerCase();
  let warning = '';

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password: form.password,
    options: {
      emailRedirectTo: `${window.location.origin}/login`,
    },
  });

  if (signUpData?.session) {
    await supabase.auth.signOut();
  }

  if (signUpError && !isExistingAuthUserError(signUpError)) {
    warning = signUpError.message || 'falha ao preparar usuario no Supabase Auth';
  }

  const { error } = await supabase.rpc('agroflow_solicitar_acesso', {
    p_email: email,
    p_nome: form.nome.trim(),
    p_observacao: form.observacao.trim(),
    p_telefone: form.telefone.trim(),
  });

  if (error) {
    const message = error.message || 'falha ao gravar solicitacao';
    if (isAlreadyApprovedError(error)) {
      return { requestSaved: true, warning: 'e-mail ja estava liberado no banco' };
    }
    return { requestSaved: false, warning: warning ? `${warning}; ${message}` : message };
  }

  return { requestSaved: true, warning };
}

function isExistingAuthUserError(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('already registered') || message.includes('already exists') || message.includes('user already');
}

function isAlreadyApprovedError(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('ja esta liberado') || message.includes('ja liberado') || message.includes('already approved');
}

function toPortugueseError(error) {
  const message = error?.message || '';
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('invalid login credentials')) {
    return 'E-mail ou senha incorretos. Como corrigir: confira o e-mail digitado e use a senha cadastrada para esse usuario.';
  }
  if (lowerMessage.includes('email not confirmed')) {
    return 'E-mail ainda nao confirmado pelo Supabase. Como corrigir: abra o e-mail automático do Supabase recebido por este usuário e confirme; para não pedir isso nos próximos usuários, desative "Confirm email" em Authentication > Providers > Email no Supabase.';
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
