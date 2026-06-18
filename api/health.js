export default async function handler(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD');
    return response.status(405).json({ ok: false, error: 'Metodo nao permitido.' });
  }

  response.setHeader('Cache-Control', 'no-store, max-age=0');

  const supabaseUrl = cleanEnv(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
  const anonKey = cleanEnv(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY);
  if (!supabaseUrl || !anonKey) {
    return response.status(503).json({
      ok: false,
      service: 'agroflow',
      vercel: true,
      supabase: false,
      error: 'Variaveis do Supabase ausentes.',
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const supabaseResponse = await fetch(`${supabaseUrl}/auth/v1/health`, {
      headers: { apikey: anonKey },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const healthy = supabaseResponse.ok;
    return response.status(healthy ? 200 : 503).json({
      ok: healthy,
      service: 'agroflow',
      vercel: true,
      supabase: healthy,
      checkedAt: new Date().toISOString(),
    });
  } catch {
    return response.status(503).json({
      ok: false,
      service: 'agroflow',
      vercel: true,
      supabase: false,
      checkedAt: new Date().toISOString(),
    });
  }
}

function cleanEnv(value) {
  return String(value || '').trim().replace(/^['"]|['"]$/g, '');
}
