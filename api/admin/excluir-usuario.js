import {
  ADMIN_EMAIL,
  getBearerToken,
  getSupabaseAdmin,
  normalizeEmail,
  readJsonBody,
  sendJson,
} from '../_supabaseAdmin.js';

export default async function handler(request, response) {
  if (request.method !== 'DELETE') {
    response.setHeader('Allow', 'DELETE');
    return sendJson(response, 405, { error: 'Metodo nao permitido.' });
  }

  try {
    const accessToken = getBearerToken(request);
    if (!accessToken) {
      return sendJson(response, 401, { error: 'Sessao ausente. Entre novamente no AgroFlow.' });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: actorData, error: actorError } = await supabaseAdmin.auth.getUser(accessToken);
    if (actorError || !actorData?.user) {
      return sendJson(response, 401, { error: 'Sessao invalida ou expirada. Entre novamente no AgroFlow.' });
    }

    const { data: actorProfile, error: actorProfileError } = await supabaseAdmin
      .from('profiles')
      .select('user_id,email,perfil,ativo')
      .eq('user_id', actorData.user.id)
      .maybeSingle();
    if (actorProfileError) throw actorProfileError;
    if (!actorProfile?.ativo || actorProfile.perfil !== 'admin') {
      return sendJson(response, 403, { error: 'Somente um administrador ativo pode excluir usuarios.' });
    }

    const body = readJsonBody(request);
    const profileId = String(body.profileId || '').trim();
    if (!profileId) {
      return sendJson(response, 400, { error: 'Usuario nao informado.' });
    }

    const { data: target, error: targetError } = await supabaseAdmin
      .from('profiles')
      .select('id,user_id,nome,email,perfil,ativo')
      .eq('id', profileId)
      .maybeSingle();
    if (targetError) throw targetError;
    if (!target) return sendJson(response, 404, { error: 'Usuario nao encontrado.' });

    const targetEmail = normalizeEmail(target.email);
    if (targetEmail === ADMIN_EMAIL || target.user_id === actorData.user.id) {
      return sendJson(response, 403, { error: 'O Admin principal nao pode ser excluido.' });
    }

    const { error: auditError } = await supabaseAdmin.from('audit_logs').insert({
      user_id: actorData.user.id,
      perfil: actorProfile.perfil,
      acao: 'excluir_usuario',
      tabela: 'profiles',
      registro_id: target.id,
      dados_anteriores: target,
      dados_novos: null,
    });
    if (auditError) throw auditError;

    if (target.user_id) {
      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(target.user_id);
      if (authDeleteError && !String(authDeleteError.message || '').toLowerCase().includes('not found')) {
        throw authDeleteError;
      }
    }

    const { error: profileDeleteError } = await supabaseAdmin.from('profiles').delete().eq('id', target.id);
    if (profileDeleteError) throw profileDeleteError;

    await supabaseAdmin.from('usuarios_autorizados').delete().eq('email', targetEmail);

    return sendJson(response, 200, {
      ok: true,
      message: `Usuario ${targetEmail} excluido com sucesso.`,
    });
  } catch (error) {
    console.error('Erro ao excluir usuario AgroFlow:', error);
    return sendJson(response, 500, {
      error: 'Nao foi possivel excluir o usuario. Verifique os logs da Vercel e tente novamente.',
    });
  }
}
