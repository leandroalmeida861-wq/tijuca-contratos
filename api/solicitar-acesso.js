import crypto from 'node:crypto';
import {
  APP_URL,
  encryptAccessRequestPassword,
  getSupabaseAdmin,
  normalizeEmail,
  readJsonBody,
  sendJson,
} from './_supabaseAdmin.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return sendJson(response, 405, { error: 'Metodo nao permitido.' });
  }

  try {
    const body = readJsonBody(request);
    const nome = String(body.nome || '').trim();
    const email = normalizeEmail(body.email);
    const telefone = String(body.telefone || '').trim();
    const observacao = String(body.observacao || '').trim();
    const senha = String(body.senha || '');
    const confirmarSenha = String(body.confirmarSenha || '');
    if (!nome || !email) {
      return sendJson(response, 400, {
        error: 'Nome e e-mail sao obrigatorios. Como corrigir: preencha o nome do solicitante e um e-mail valido.',
      });
    }
    if (senha.length < 6) {
      return sendJson(response, 400, {
        error: 'A senha deve ter pelo menos 6 caracteres. Como corrigir: informe uma senha maior.',
      });
    }
    if (senha !== confirmarSenha) {
      return sendJson(response, 400, {
        error: 'As senhas nao conferem. Como corrigir: digite a mesma senha nos dois campos.',
      });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: allowed, error: allowedError } = await supabaseAdmin.rpc('agroflow_email_liberado', {
      check_email: email,
    });
    if (allowedError) throw allowedError;
    if (allowed) {
      return sendJson(response, 409, {
        error: 'Este e-mail ja esta liberado. Como corrigir: use Entrar no sistema ou recupere a senha pelo Supabase.',
      });
    }

    const { data: pendingRequest, error: pendingError } = await supabaseAdmin
      .from('solicitacoes_acesso')
      .select('id')
      .eq('email', email)
      .eq('status', 'pendente')
      .limit(1)
      .maybeSingle();
    if (pendingError) throw pendingError;
    if (pendingRequest) {
      return sendJson(response, 409, {
        error: 'Ja existe um pedido pendente para este e-mail. Como corrigir: aguarde a analise do administrador.',
      });
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const encryptedPassword = encryptAccessRequestPassword(senha);

    const { data, error } = await supabaseAdmin
      .from('solicitacoes_acesso')
      .insert({
        nome,
        email,
        telefone,
        observacao,
        token_autorizacao: token,
        status: 'pendente',
        expira_em: expiresAt,
        senha_criptografada: encryptedPassword,
      })
      .select('id,email,status,expira_em')
      .single();
    if (error) throw error;

    return sendJson(response, 200, {
      ok: true,
      email,
      requestId: data.id,
      approvalUrl: `${APP_URL}/admin/acessos`,
    });
  } catch (error) {
    return sendJson(response, 500, {
      error: safeRequestError(error),
    });
  }
}

function safeRequestError(error) {
  const message = String(error?.message || '');
  if (message.includes('ACCESS_REQUEST_ENCRYPTION_KEY')) {
    return 'O cadastro seguro ainda nao esta configurado. Como corrigir: o administrador deve configurar a chave de criptografia na Vercel.';
  }
  return 'Nao foi possivel registrar o pedido de acesso. Como corrigir: tente novamente e, se continuar, avise o administrador.';
}
