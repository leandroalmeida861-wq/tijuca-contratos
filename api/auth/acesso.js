import {
  ADMIN_EMAIL,
  getBearerToken,
  getSupabaseAdmin,
  normalizeEmail,
  sendJson,
} from '../_supabaseAdmin.js';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return sendJson(response, 405, { error: 'Metodo nao permitido.' });
  }

  try {
    const accessToken = getBearerToken(request);
    if (!accessToken) return sendJson(response, 401, { authorized: false });

    const supabaseAdmin = getSupabaseAdmin();
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
    if (userError || !userData?.user) return sendJson(response, 401, { authorized: false });

    const email = normalizeEmail(userData.user.email);
    let { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id,user_id,nome,email,perfil,ativo')
      .eq('user_id', userData.user.id)
      .maybeSingle();
    if (profileError) throw profileError;

    if (!profile && email === ADMIN_EMAIL) {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .upsert({
          user_id: userData.user.id,
          nome: 'Leandro',
          email,
          perfil: 'admin',
          ativo: true,
          atualizado_em: new Date().toISOString(),
        }, { onConflict: 'user_id' })
        .select('id,user_id,nome,email,perfil,ativo')
        .single();
      if (error) throw error;
      profile = data;
    }

    if (!profile?.ativo) return sendJson(response, 403, { authorized: false });

    const { data: permissions, error: permissionsError } = await supabaseAdmin
      .from('permissoes_menu')
      .select('*')
      .eq('perfil', profile.perfil);
    if (permissionsError) throw permissionsError;

    return sendJson(response, 200, {
      authorized: true,
      profile: profile.perfil,
      profileData: profile,
      permissions: permissions || [],
      access: profile,
    });
  } catch (error) {
    console.error('Erro ao validar acesso AgroFlow:', {
      code: String(error?.code || ''),
      message: String(error?.message || 'Falha interna'),
    });
    return sendJson(response, 500, {
      authorized: false,
      error: 'Nao foi possivel validar o acesso. Tente novamente.',
    });
  }
}
