import { createClient } from '@supabase/supabase-js';

export const ADMIN_EMAIL = normalizeEmail(process.env.ADMIN_EMAIL || 'leandroalmeida861@gmail.com');

export function getSupabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

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

export async function ensureConfirmedAuthUser(supabaseAdmin, { email, password, name, phone }) {
  const normalized = normalizeEmail(email);
  const metadata = {
    name: name || 'Usuario autorizado',
    phone: phone || '',
    approved_flow: 'agroflow_access_request',
  };

  const existing = await findAuthUserByEmail(supabaseAdmin, normalized);
  if (existing) {
    const updatePayload = {
      email_confirm: true,
      user_metadata: {
        ...(existing.user_metadata || {}),
        ...metadata,
      },
    };

    if (password) updatePayload.password = password;

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(existing.id, updatePayload);
    if (error) throw error;
    return data.user;
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: normalized,
    password,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (error) throw error;
  return data.user;
}
