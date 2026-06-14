import crypto from 'node:crypto';
import {
  APP_URL,
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

    if (!nome || !email) {
      return sendJson(response, 400, {
        error: 'Nome e e-mail sao obrigatorios. Como corrigir: preencha o nome do solicitante e um e-mail valido.',
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

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

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
      })
      .select('id,token_autorizacao,email,status,expira_em')
      .single();
    if (error) throw error;

    return sendJson(response, 200, {
      ok: true,
      email,
      token: data.token_autorizacao,
      approvalUrl: `${APP_URL}/api/aprovar-acesso?token=${encodeURIComponent(data.token_autorizacao)}`,
    });
  } catch (error) {
    return sendJson(response, 500, {
      error: error.message || 'Nao foi possivel registrar o pedido de acesso.',
    });
  }
}
