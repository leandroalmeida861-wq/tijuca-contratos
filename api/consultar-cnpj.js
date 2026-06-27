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

  const brasilApi = await consultaBrasilApi(cnpj);
  if (brasilApi.ok) {
    return response.status(200).json(brasilApi.data);
  }

  const receitaWs = await consultaReceitaWs(cnpj);
  if (receitaWs.ok) {
    return response.status(200).json(receitaWs.data);
  }

  const status = brasilApi.status === 404 && receitaWs.status === 404 ? 404 : 502;
  return response.status(status).json({
    ok: false,
    error:
      status === 404
        ? 'CNPJ nao encontrado nas consultas publicas.'
        : 'Nao foi possivel consultar este CNPJ agora. Como corrigir: confira o numero ou preencha manualmente.',
  });
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

async function consultaBrasilApi(cnpj) {
  try {
    const data = await fetchJson(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    if (!data.ok) return data;

    return {
      ok: true,
      data: {
        ok: true,
        cnpj: data.body.cnpj || cnpj,
        nome: data.body.razao_social || data.body.nome_fantasia || '',
        telefone: data.body.ddd_telefone_1 || data.body.ddd_telefone_2 || '',
        email: data.body.email || '',
        cidade: data.body.municipio || '',
        uf: data.body.uf || '',
        inscricao_estadual: data.body.inscricao_estadual || '',
      },
    };
  } catch {
    return { ok: false, status: 502 };
  }
}

async function consultaReceitaWs(cnpj) {
  try {
    const data = await fetchJson(`https://www.receitaws.com.br/v1/cnpj/${cnpj}`);
    if (!data.ok) return data;
    if (data.body?.status === 'ERROR') {
      return { ok: false, status: 404 };
    }

    return {
      ok: true,
      data: {
        ok: true,
        cnpj: onlyDigits(data.body.cnpj) || cnpj,
        nome: data.body.nome || data.body.fantasia || '',
        telefone: data.body.telefone || '',
        email: data.body.email || '',
        cidade: data.body.municipio || '',
        uf: data.body.uf || '',
        inscricao_estadual: '',
      },
    };
  } catch {
    return { ok: false, status: 502 };
  }
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const apiResponse = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    const body = await apiResponse.json().catch(() => ({}));

    if (!apiResponse.ok) {
      return { ok: false, status: apiResponse.status, body };
    }

    return { ok: true, status: apiResponse.status, body };
  } finally {
    clearTimeout(timeout);
  }
}
