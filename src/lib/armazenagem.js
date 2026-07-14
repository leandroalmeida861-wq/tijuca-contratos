export function isRecebimentoFinalizadoParaArmazenagem(row) {
  return row?.status === 'aprovada'
    && Boolean(row?.balanca_id)
    && Boolean(String(row?.nf_numero || '').trim())
    && Number(row?.peso_bruto || 0) > 0
    && Number(row?.tara || 0) > 0
    && pesoNotaRecebimento(row) > 0;
}

export function pesoNotaRecebimento(row) {
  const itens = Array.isArray(row?.itens) ? row.itens : [];
  if (itens.length) {
    const itemWeights = itens.map((item) => notaItemPesoKg(item.quantidade, item.unidade, row?.peso_por_saca));
    if (itemWeights.some((weight) => weight <= 0)) return 0;
    return roundWeight(itemWeights.reduce((sum, weight) => sum + weight, 0));
  }

  if (Number(row?.quantidade_nota || 0) > 0) {
    const converted = notaItemPesoKg(row.quantidade_nota, row.unidade_nota, row.peso_por_saca);
    if (converted > 0) return converted;
  }
  return roundWeight(Math.max(Number(row?.peso_nf || 0), 0));
}

export function notaItemPesoKg(quantidade, unidade = 'KG', pesoPorSaca = 60) {
  const value = Math.max(Number(quantidade || 0), 0);
  const normalizedUnit = String(unidade || 'KG').toUpperCase().replace(/[^A-Z]/g, '');
  if (['TON', 'T', 'TONELADA', 'TONELADAS'].includes(normalizedUnit)) return roundWeight(value * 1000);
  if (['SC', 'SCS', 'SACA', 'SACAS'].includes(normalizedUnit)) {
    return roundWeight(value * (Number(pesoPorSaca || 60) || 60));
  }
  if (['KG', 'KGS', 'QUILO', 'QUILOS', 'QUILOGRAMA', 'QUILOGRAMAS'].includes(normalizedUnit)) {
    return roundWeight(value);
  }
  return 0;
}

export function mergeRecebimentosArmazenagens(recebimentos = [], armazenagens = []) {
  const byRecebimento = new Map(
    (armazenagens || [])
      .filter((item) => item.recebimento_id)
      .map((item) => [item.recebimento_id, item]),
  );
  return (recebimentos || []).map((recebimento) => {
    const armazenagem = byRecebimento.get(recebimento.id);
    if (armazenagem) return { ...armazenagem, recebimento };
    const pesoNota = pesoNotaRecebimento(recebimento);
    return {
      id: null,
      recebimento_id: recebimento.id,
      origem: 'recebimento',
      data_armazenagem: recebimento.data,
      peso_nota: pesoNota,
      peso_distribuido: 0,
      saldo_distribuir: pesoNota,
      origem_peso: recebimento.nf_chave_acesso ? 'XML' : 'NOTA',
      status: 'PENDENTE',
      recebimento,
      itens: [],
      created_at: null,
    };
  });
}

function roundWeight(value) {
  return Number(Number(value || 0).toFixed(3));
}
