import { createClient } from '@supabase/supabase-js';

export const ADMIN_EMAIL = normalizeEmail(process.env.ADMIN_EMAIL || 'leandroalmeida861@gmail.com');
export const APP_URL = 'https://agroflow-contratos.vercel.app';
export const INVITE_REDIRECT_URL = `${APP_URL}/login`;
export const ADMIN_APPROVED_REDIRECT = `${APP_URL}/admin/solicitacoes?sucesso=usuario_aprovado`;

export function getSupabaseAdmin() {
  const supabaseUrl = readEnv('SUPABASE_URL') || readEnv('VITE_SUPABASE_URL');
  const serviceRoleKey = readEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Variaveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nao configuradas na Vercel.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function getSupabasePublic() {
  const supabaseUrl = readEnv('SUPABASE_URL') || readEnv('VITE_SUPABASE_URL');
  const anonKey = readEnv('SUPABASE_ANON_KEY') || readEnv('VITE_SUPABASE_ANON_KEY');

  if (!supabaseUrl || !anonKey) {
    throw new Error('Variaveis SUPABASE_URL e SUPABASE_ANON_KEY nao configuradas na Vercel.');
  }

  return createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function readEnv(name) {
  return String(process.env[name] || '').trim().replace(/^['"]|['"]$/g, '');
}

export function sendJson(response, status, body) {
  response.status(status).json(body);
}

export function getBearerToken(request) {
  const header = request.headers.authorization || '';
  const [type, token] = header.split(' ');
  return type?.toLowerCase() === 'bearer' ? token : '';
}

export function readJsonBody(request) {
  if (!request.body) return {};
  if (typeof request.body === 'string') {
    try {
      return JSON.parse(request.body);
    } catch {
      return {};
    }
  }
  return request.body;
}

export async function findAuthUserByEmail(supabaseAdmin, email) {
  const normalized = normalizeEmail(email);
  let page = 1;

  while (page <= 20) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;

    const user = data?.users?.find((item) => normalizeEmail(item.email) === normalized);
    if (user) return user;
    if (!data?.users || data.users.length < 100) return null;
    page += 1;
  }

  return null;
}
