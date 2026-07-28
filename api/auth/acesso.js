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

    const unidades = await carregarUnidadesPermitidas(supabaseAdmin, profile, userData.user.id);

    return sendJson(response, 200, {
      authorized: true,
      profile: profile.perfil,
      profileData: profile,
      permissions: permissions || [],
      unidades,
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

/**
 * Unidades que o usuario pode acessar, com o nivel de acesso de cada uma,
 * calculadas no servidor. Reproduz a mesma regra das funcoes
 * public.agroflow_acessa_unidade() e public.agroflow_pode_editar_unidade():
 * Admin ve tudo; a excecao por usuario tem precedencia sobre a regra do
 * perfil; sem regra, nao ha acesso.
 *
 * Retorna somente as unidades com visualizar = true, cada uma marcando se o
 * usuario tambem pode editar nela.
 */
async function carregarUnidadesPermitidas(supabaseAdmin, profile, authUserId) {
  const { data: balancas, error: balancasError } = await supabaseAdmin
    .from('balancas')
    .select('id,codigo,nome')
    .not('codigo', 'is', null)
    .order('nome');
  if (balancasError) throw balancasError;

  const unidades = balancas || [];
  if (profile.perfil === 'admin') {
    return unidades.map((unidade) => ({
      id: unidade.id,
      codigo: unidade.codigo,
      nome: unidade.nome,
      visualizar: true,
      editar: true,
    }));
  }

  const colunas = 'balanca_id,permitido,editar';
  const [porUsuario, porPerfil] = await Promise.all([
    supabaseAdmin.from('permissoes_unidade').select(colunas).eq('user_id', authUserId),
    supabaseAdmin.from('permissoes_unidade').select(colunas).eq('perfil', profile.perfil),
  ]);
  if (porUsuario.error) throw porUsuario.error;
  if (porPerfil.error) throw porPerfil.error;

  const doUsuario = new Map((porUsuario.data || []).map((row) => [row.balanca_id, row]));
  const doPerfil = new Map((porPerfil.data || []).map((row) => [row.balanca_id, row]));

  return unidades
    .map((unidade) => {
      const regra = doUsuario.has(unidade.id) ? doUsuario.get(unidade.id) : doPerfil.get(unidade.id);
      const editar = Boolean(regra?.editar);
      return {
        id: unidade.id,
        codigo: unidade.codigo,
        nome: unidade.nome,
        // Quem edita necessariamente visualiza.
        visualizar: Boolean(regra?.permitido) || editar,
        editar,
      };
    })
    .filter((unidade) => unidade.visualizar);
}
