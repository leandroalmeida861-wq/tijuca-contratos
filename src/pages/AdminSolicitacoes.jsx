import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

const messages = {
  usuario_aprovado: {
    title: 'Usuario aprovado',
    text: 'O convite oficial do Supabase foi enviado para o usuario criar a senha e acessar o AgroFlow.',
  },
};

const errors = {
  token_ausente: 'Link de aprovacao sem token. Use o link mais recente recebido por e-mail.',
  pedido_nao_encontrado: 'Pedido de acesso nao encontrado. Confira se o link esta completo.',
  pedido_ja_processado: 'Este pedido ja foi aprovado, expirado ou cancelado.',
  token_expirado: 'O token expirou. Peca para o usuario solicitar acesso novamente.',
  email_invalido: 'O pedido esta sem e-mail valido. Crie uma nova solicitacao.',
  email_invalido_supabase: 'O Supabase recusou este e-mail como invalido. Use um e-mail real e ativo, como Gmail, Outlook ou e-mail corporativo.',
  limite_email_supabase: 'O Supabase bloqueou temporariamente o envio de convites por limite de e-mail. Aguarde alguns minutos e tente novamente, ou configure SMTP proprio no Supabase Auth.',
  falha_aprovacao: 'Nao foi possivel aprovar agora. Confira a SERVICE_ROLE_KEY na Vercel e tente novamente.',
};

export default function AdminSolicitacoes() {
  const { profile, authorized } = useAuth();
  const [searchParams] = useSearchParams();
  const success = searchParams.get('sucesso');
  const error = searchParams.get('erro');

  if (!authorized) return <Navigate to="/login" replace />;
  if (profile !== 'admin') {
    return (
      <section className="grid min-h-[60vh] place-items-center">
        <div className="max-w-lg rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-black text-slate-950">Acesso restrito</h1>
          <p className="mt-2 text-sm font-medium text-slate-600">Somente administrador pode consultar solicitacoes de acesso.</p>
          <Link className="mt-5 inline-flex rounded-lg bg-tijuca-600 px-4 py-2 text-sm font-bold text-white" to="/">
            Voltar ao dashboard
          </Link>
        </div>
      </section>
    );
  }

  const successMessage = messages[success];
  const errorMessage = errors[error];

  return (
    <section className="grid gap-5">
      <div>
        <h1 className="text-2xl font-black text-slate-950">Solicitacoes de acesso</h1>
        <p className="mt-1 text-sm font-medium text-slate-500">Aprovacoes sao feitas pelo link seguro enviado ao e-mail do administrador.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {successMessage ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
            <p className="font-black">{successMessage.title}</p>
            <p className="mt-1 text-sm font-medium">{successMessage.text}</p>
          </div>
        ) : errorMessage ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">
            <p className="font-black">Aprovacao nao concluida</p>
            <p className="mt-1 text-sm font-medium">{errorMessage}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
            <p className="font-black">Nenhuma aprovacao recente</p>
            <p className="mt-1 text-sm font-medium">Quando um link for aprovado, o resultado aparecera nesta tela.</p>
          </div>
        )}
      </div>
    </section>
  );
}
