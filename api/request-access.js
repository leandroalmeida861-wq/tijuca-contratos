import {
  ensureConfirmedAuthUser,
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
    const name = String(body.nome || '').trim();
    const email = normalizeEmail(body.email);
    const phone = String(body.telefone || '').trim();
    const note = String(body.observacao || '').trim();
    const password = String(body.password || '');

    if (!name || !email) {
      return sendJson(response, 400, { error: 'Nome e e-mail sao obrigatorios.' });
    }
    if (password.length < 6) {
      return sendJson(response, 400, { error: 'A senha deve ter pelo menos 6 caracteres.' });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: alreadyAllowed, error: allowedError } = await supabaseAdmin.rpc('agroflow_email_liberado', {
      check_email: email,
    });
    if (allowedError) throw allowedError;
    if (alreadyAllowed) {
      return sendJson(response, 409, { error: 'Este e-mail ja esta liberado. Use a opcao Entrar.' });
    }

    await ensureConfirmedAuthUser(supabaseAdmin, {
      email,
      password,
      name,
      phone,
    });

    const { data, error } = await supabaseAdmin.rpc('agroflow_solicitar_acesso', {
      p_email: email,
      p_nome: name,
      p_observacao: note,
      p_telefone: phone,
    });
    if (error) throw error;

    const requestRow = Array.isArray(data) ? data[0] : data;
    return sendJson(response, 200, {
      ok: true,
      token: requestRow?.token,
      email,
    });
  } catch (error) {
    return sendJson(response, 500, {
      error: error.message || 'Nao foi possivel registrar o pedido de acesso.',
    });
  }
}
