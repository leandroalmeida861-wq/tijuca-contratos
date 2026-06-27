export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ ok: false, error: 'Metodo nao permitido.' });
  }

  const cnpj = onlyDigits(request.query?.cnpj).slice(0, 14);
  if (cnpj.length !== 14) {
    return response.status(400).json({
      ok: false,
      error: 'CNPJ invalido.',
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const apiResponse = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await apiResponse.json().catch(() => ({}));

    if (!apiResponse.ok) {
      return response.status(apiResponse.status === 404 ? 404 : 502).json({
        ok: false,
        error: data?.message || 'CNPJ nao encontrado na consulta publica.',
      });
    }

    return response.status(200).json({
      ok: true,
      cnpj: data.cnpj || cnpj,
      nome: data.razao_social || data.nome_fantasia || '',
      telefone: data.ddd_telefone_1 || data.ddd_telefone_2 || '',
      email: data.email || '',
      cidade: data.municipio || '',
      uf: data.uf || '',
      inscricao_estadual: data.inscricao_estadual || '',
    });
  } catch (error) {
    const aborted = error?.name === 'AbortError';
    return response.status(504).json({
      ok: false,
      error: aborted
        ? 'Tempo esgotado ao consultar CNPJ.'
        : 'Nao foi possivel consultar este CNPJ agora.',
    });
  }
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}
