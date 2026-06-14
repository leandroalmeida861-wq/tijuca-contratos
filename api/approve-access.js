import {
  ADMIN_EMAIL,
  ensureConfirmedAuthUser,
  getBearerToken,
  getSupabaseAdmin,
  getSupabasePublic,
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
    const token = String(body?.token || '').trim();
    if (!token) {
      return sendJson(response, 400, { error: 'Token de aprovacao ausente.' });
    }

    const accessToken = getBearerToken(request);
    if (!accessToken) {
      return sendJson(response, 401, { error: 'Entre como administrador para aprovar este acesso.' });
    }

    const supabasePublic = getSupabasePublic();
    const { data: authData, error: authError } = await supabasePublic.auth.getUser(accessToken);
    if (authError || normalizeEmail(authData?.user?.email) !== ADMIN_EMAIL) {
      return sendJson(response, 403, { error: 'Apenas o administrador autorizado pode aprovar usuarios.' });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: requestRows, error: requestError } = await supabaseAdmin
      .from('solicitacoes_acesso')
      .select('id,nome,email,telefone,status')
      .eq('token', token)
      .limit(1);
    if (requestError) throw requestError;

    const accessRequest = requestRows?.[0];
    if (!accessRequest) {
      return sendJson(response, 404, { error: 'Pedido de acesso nao encontrado.' });
    }

    const email = normalizeEmail(accessRequest.email);
    if (!email) {
      return sendJson(response, 400, { error: 'Pedido de acesso sem e-mail valido.' });
    }

    await ensureConfirmedAuthUser(supabaseAdmin, {
      email,
      name: accessRequest.nome,
      phone: accessRequest.telefone,
    });

    const { error: upsertError } = await supabaseAdmin
      .from('usuarios_autorizados')
      .upsert(
        {
          email,
          nome: accessRequest.nome || 'Usuario autorizado',
          liberado_por: authData.user.id,
          liberado_em: new Date().toISOString(),
          ativo: true,
        },
        { onConflict: 'email' },
      );
    if (upsertError) throw upsertError;

    const { error: updateError } = await supabaseAdmin
      .from('solicitacoes_acesso')
      .update({
        status: 'liberado',
        liberado_em: new Date().toISOString(),
      })
      .eq('id', accessRequest.id);
    if (updateError) throw updateError;

    return sendJson(response, 200, {
      ok: true,
      email,
      name: accessRequest.nome || 'Usuario autorizado',
      status: 'liberado',
    });
  } catch (error) {
    return sendJson(response, 500, {
      error: error.message || 'Nao foi possivel aprovar este acesso.',
    });
  }
}
