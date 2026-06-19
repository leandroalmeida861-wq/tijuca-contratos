import {
  ADMIN_EMAIL,
  decryptAccessRequestPassword,
  findAuthUserByEmail,
  getBearerToken,
  getSupabaseAdmin,
  normalizeEmail,
  readJsonBody,
  sendJson,
} from '../_supabaseAdmin.js';

const ALLOWED_ROLES = new Set(['admin', 'gestor', 'operador']);

export default async function handler(request, response) {
  if (!['GET', 'PATCH'].includes(request.method)) {
    response.setHeader('Allow', 'GET, PATCH');
    return sendJson(response, 405, { error: 'Metodo nao permitido.' });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const actor = await requireActiveAdmin(request, supabaseAdmin);
    if (actor.error) return sendJson(response, actor.status, { error: actor.error });

    if (request.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('solicitacoes_acesso')
        .select('id,nome,email,telefone,observacao,status,criado_em,expira_em')
        .eq('status', 'pendente')
        .order('criado_em', { ascending: true });
      if (error) throw error;
      return sendJson(response, 200, { requests: data || [] });
    }

    const body = readJsonBody(request);
    const requestId = String(body.requestId || '').trim();
    const action = String(body.action || '').trim().toLowerCase();
    const perfil = String(body.perfil || 'operador').trim().toLowerCase();

    if (!requestId || !['aprovar', 'rejeitar'].includes(action)) {
      return sendJson(response, 400, { error: 'Pedido ou acao invalida.' });
    }
    if (action === 'aprovar' && !ALLOWED_ROLES.has(perfil)) {
      return sendJson(response, 400, { error: 'Perfil invalido. Escolha Admin, Gestor ou Operador.' });
    }

    const { data: accessRequest, error: requestError } = await supabaseAdmin
      .from('solicitacoes_acesso')
      .select('id,nome,email,telefone,observacao,status,expira_em,senha_criptografada')
      .eq('id', requestId)
      .maybeSingle();
    if (requestError) throw requestError;
    if (!accessRequest) return sendJson(response, 404, { error: 'Pedido nao encontrado.' });
    if (accessRequest.status !== 'pendente') {
      return sendJson(response, 409, { error: 'Este pedido ja foi processado.' });
    }

    if (action === 'rejeitar') {
      await rejectRequest(supabaseAdmin, accessRequest, actor);
      return sendJson(response, 200, { ok: true, message: 'Pedido rejeitado com seguranca.' });
    }

    if (accessRequest.expira_em && new Date(accessRequest.expira_em).getTime() < Date.now()) {
      await supabaseAdmin
        .from('solicitacoes_acesso')
        .update({ status: 'expirado', usado_em: new Date().toISOString(), senha_criptografada: null })
        .eq('id', accessRequest.id);
      return sendJson(response, 410, { error: 'Este pedido expirou. Solicite um novo cadastro.' });
    }
    if (!accessRequest.senha_criptografada) {
      return sendJson(response, 409, { error: 'Este pedido nao possui senha protegida. Rejeite-o e solicite um novo cadastro.' });
    }

    await approveRequest(supabaseAdmin, accessRequest, perfil, actor);
    return sendJson(response, 200, {
      ok: true,
      message: `Usuario aprovado como ${roleLabel(perfil)} e liberado para entrar.`,
    });
  } catch (error) {
    console.error('Erro ao processar solicitacao de acesso AgroFlow:', safeLogError(error));
    return sendJson(response, 500, {
      error: safeAdminError(error),
    });
  }
}

async function requireActiveAdmin(request, supabaseAdmin) {
  const accessToken = getBearerToken(request);
  if (!accessToken) return { status: 401, error: 'Sessao ausente. Entre novamente no AgroFlow.' };

  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data?.user) return { status: 401, error: 'Sessao invalida ou expirada. Entre novamente.' };

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('user_id,email,perfil,ativo')
    .eq('user_id', data.user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile?.ativo || profile.perfil !== 'admin') {
    return { status: 403, error: 'Somente um administrador ativo pode processar pedidos de acesso.' };
  }

  return { user: data.user, profile };
}

async function approveRequest(supabaseAdmin, accessRequest, perfil, actor) {
  const email = normalizeEmail(accessRequest.email);
  let requestedPassword = decryptAccessRequestPassword(accessRequest.senha_criptografada);
  const now = new Date().toISOString();
  let authUser = await findAuthUserByEmail(supabaseAdmin, email);

  try {
    if (authUser) {
      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
        password: requestedPassword,
        email_confirm: true,
        user_metadata: { nome: accessRequest.nome, telefone: accessRequest.telefone || '' },
      });
      if (error) throw error;
      authUser = data.user;
    } else {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: requestedPassword,
        email_confirm: true,
        user_metadata: { nome: accessRequest.nome, telefone: accessRequest.telefone || '' },
      });
      if (error) throw error;
      authUser = data.user;
    }
  } finally {
    requestedPassword = null;
  }

  const effectiveRole = email === ADMIN_EMAIL ? 'admin' : perfil;
  const { error: authorizedError } = await supabaseAdmin.from('usuarios_autorizados').upsert({
    user_id: authUser.id,
    nome: accessRequest.nome,
    email,
    perfil: effectiveRole,
    status: 'ativo',
    updated_at: now,
  }, { onConflict: 'email' });
  if (authorizedError) throw authorizedError;

  const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
    user_id: authUser.id,
    nome: accessRequest.nome,
    email,
    perfil: effectiveRole,
    ativo: true,
    atualizado_em: now,
  }, { onConflict: 'user_id' });
  if (profileError) throw profileError;

  const { error: updateError } = await supabaseAdmin
    .from('solicitacoes_acesso')
    .update({
      status: 'aprovado',
      aprovado_em: now,
      usado_em: now,
      senha_criptografada: null,
    })
    .eq('id', accessRequest.id)
    .eq('status', 'pendente');
  if (updateError) throw updateError;

  await writeSafeAudit(supabaseAdmin, actor, 'aprovar_solicitacao_acesso', accessRequest, {
    email,
    perfil: effectiveRole,
    status: 'aprovado',
  });
}

async function rejectRequest(supabaseAdmin, accessRequest, actor) {
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('solicitacoes_acesso')
    .update({ status: 'rejeitado', usado_em: now, senha_criptografada: null })
    .eq('id', accessRequest.id)
    .eq('status', 'pendente');
  if (error) throw error;

  await writeSafeAudit(supabaseAdmin, actor, 'rejeitar_solicitacao_acesso', accessRequest, {
    email: normalizeEmail(accessRequest.email),
    status: 'rejeitado',
  });
}

async function writeSafeAudit(supabaseAdmin, actor, action, accessRequest, newData) {
  const { error } = await supabaseAdmin.from('audit_logs').insert({
    user_id: actor.user.id,
    perfil: actor.profile.perfil,
    acao: action,
    tabela: 'solicitacoes_acesso',
    registro_id: accessRequest.id,
    dados_anteriores: {
      email: normalizeEmail(accessRequest.email),
      status: 'pendente',
    },
    dados_novos: newData,
  });
  if (error) throw error;
}

function safeLogError(error) {
  return {
    name: String(error?.name || 'Error'),
    code: String(error?.code || ''),
    message: String(error?.message || 'Falha interna').replace(/password|senha/gi, '[dado protegido]'),
  };
}

function safeAdminError(error) {
  const message = String(error?.message || '');
  if (message.includes('ACCESS_REQUEST_ENCRYPTION_KEY')) {
    return 'A chave segura de aprovacao nao esta configurada na Vercel.';
  }
  if (message.includes('senha protegida')) return message;
  return 'Nao foi possivel processar o pedido. Verifique a configuracao do servidor e tente novamente.';
}

function roleLabel(role) {
  return { admin: 'Admin', gestor: 'Gestor', operador: 'Operador' }[role] || role;
}
