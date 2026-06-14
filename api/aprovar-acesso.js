import {
  ADMIN_APPROVED_REDIRECT,
  INVITE_REDIRECT_URL,
  findAuthUserByEmail,
  getSupabaseAdmin,
  normalizeEmail,
} from './_supabaseAdmin.js';

const ERROR_REDIRECT = 'https://agroflow-contratos.vercel.app/admin/solicitacoes?erro=';

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    response.status(405).send('Metodo nao permitido.');
    return;
  }

  try {
    const token = String(request.query?.token || '').trim();
    if (!token) return redirectError(response, 'token_ausente');

    const supabaseAdmin = getSupabaseAdmin();
    const { data: requestRow, error: requestError } = await supabaseAdmin
      .from('solicitacoes_acesso')
      .select('id,nome,email,telefone,observacao,status,expira_em,usado_em')
      .eq('token_autorizacao', token)
      .maybeSingle();
    if (requestError) throw requestError;
    if (!requestRow) return redirectError(response, 'pedido_nao_encontrado');

    if (requestRow.status !== 'pendente' || requestRow.usado_em) {
      return redirectError(response, 'pedido_ja_processado');
    }

    if (requestRow.expira_em && new Date(requestRow.expira_em).getTime() < Date.now()) {
      await supabaseAdmin
        .from('solicitacoes_acesso')
        .update({ status: 'expirado' })
        .eq('id', requestRow.id);
      return redirectError(response, 'token_expirado');
    }

    const email = normalizeEmail(requestRow.email);
    if (!email) return redirectError(response, 'email_invalido');

    let authUser = await findAuthUserByEmail(supabaseAdmin, email);
    if (!authUser) {
      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: INVITE_REDIRECT_URL,
        data: {
          nome: requestRow.nome || 'Usuario autorizado',
          telefone: requestRow.telefone || '',
          perfil: 'operador',
          origem: 'agroflow_convite_admin',
        },
      });
      if (inviteError) throw inviteError;
      authUser = inviteData?.user || null;
    }

    const now = new Date().toISOString();
    const { error: upsertError } = await supabaseAdmin
      .from('usuarios_autorizados')
      .upsert(
        {
          user_id: authUser?.id || null,
          nome: requestRow.nome || 'Usuario autorizado',
          email,
          perfil: 'operador',
          status: 'ativo',
          updated_at: now,
        },
        { onConflict: 'email' },
      );
    if (upsertError) throw upsertError;

    const { error: updateError } = await supabaseAdmin
      .from('solicitacoes_acesso')
      .update({
        status: 'aprovado',
        usado_em: now,
        aprovado_em: now,
      })
      .eq('id', requestRow.id);
    if (updateError) throw updateError;

    response.writeHead(302, { Location: ADMIN_APPROVED_REDIRECT });
    response.end();
  } catch (error) {
    console.error('Erro ao aprovar acesso AgroFlow:', error);
    redirectError(response, 'falha_aprovacao');
  }
}

function redirectError(response, code) {
  response.writeHead(302, { Location: `${ERROR_REDIRECT}${encodeURIComponent(code)}` });
  response.end();
}
