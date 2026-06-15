import {
  ADMIN_APPROVED_REDIRECT,
  INVITE_REDIRECT_URL,
  findAuthUserByEmail,
  getSupabasePublic,
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

    const now = new Date().toISOString();

    let authUser = await findAuthUserByEmail(supabaseAdmin, email);
    await upsertAuthorizedUser(supabaseAdmin, {
      userId: authUser?.id || null,
      nome: requestRow.nome || 'Usuario autorizado',
      email,
      now,
    });

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

      if (authUser?.id) {
        await upsertAuthorizedUser(supabaseAdmin, {
          userId: authUser.id,
          nome: requestRow.nome || 'Usuario autorizado',
          email,
          now,
        });
      }
    } else {
      const supabasePublic = getSupabasePublic();
      const { error: resetError } = await supabasePublic.auth.resetPasswordForEmail(email, {
        redirectTo: INVITE_REDIRECT_URL,
      });
      if (resetError) throw resetError;
    }

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
    redirectError(response, approvalErrorCode(error));
  }
}

function redirectError(response, code) {
  response.writeHead(302, { Location: `${ERROR_REDIRECT}${encodeURIComponent(code)}` });
  response.end();
}

function approvalErrorCode(error) {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();

  if (code.includes('over_email_send_rate_limit') || message.includes('rate limit')) {
    return 'limite_email_supabase';
  }
  if (code.includes('email_address_invalid') || message.includes('email address') || message.includes('invalid')) {
    return 'email_invalido_supabase';
  }
  return 'falha_aprovacao';
}

async function upsertAuthorizedUser(supabaseAdmin, { userId, nome, email, now }) {
  const { error } = await supabaseAdmin
    .from('usuarios_autorizados')
    .upsert(
      {
        user_id: userId,
        nome,
        email,
        perfil: 'operador',
        status: 'ativo',
        updated_at: now,
      },
      { onConflict: 'email' },
    );
  if (error) throw error;
}
