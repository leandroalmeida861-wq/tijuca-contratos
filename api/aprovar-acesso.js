import { APP_URL } from './_supabaseAdmin.js';

const SECURE_APPROVAL_URL = `${APP_URL}/admin/acessos?erro=aprovacao_por_token_desativada`;

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');

  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    response.status(405).json({
      error: 'Metodo nao permitido.',
    });
    return;
  }

  response.writeHead(302, { Location: SECURE_APPROVAL_URL });
  response.end();
}
