import { notaComplementoPesoKg, pesoNotaPrincipalRecebimento } from './armazenagem.js';

/**
 * Regras do fechamento mensal da Armazenagem M.P.
 *
 * Modulo puro (sem React e sem Supabase) para que a tela, o Excel e o PDF
 * usem exatamente os mesmos numeros, sem logica duplicada.
 */

/**
 * Primeiro mes valido para o fechamento mensal.
 * Lancamentos anteriores continuam no sistema, aparecem normalmente na tela e
 * nos relatorios operacionais, mas nao compoem nenhum fechamento.
 */
export const FECHAMENTO_PRIMEIRO_MES = '2026-07';

export function dataDaLinha(row) {
  return String(row?.data_armazenagem || row?.recebimento?.data || '');
}

export function competenciaDaLinha(row) {
  return dataDaLinha(row).slice(0, 7);
}

/** Lancamento anterior ao inicio do fechamento (nao entra em nenhum mes). */
export function anteriorAoInicioDoFechamento(row) {
  const competencia = competenciaDaLinha(row);
  if (!competencia) return false;
  return competencia < FECHAMENTO_PRIMEIRO_MES;
}

export function competenciaAnteriorAoInicio(ano, mes) {
  return `${ano}-${String(mes).padStart(2, '0')}` < FECHAMENTO_PRIMEIRO_MES;
}

/**
 * Marca em cada linha se ela esta fora do fechamento e por que.
 * `exclusoes` sao as linhas ativas de armazenagem_fechamento_exclusoes.
 */
export function aplicarExclusoesDeFechamento(rows = [], exclusoes = []) {
  const porRecebimento = new Map(
    (exclusoes || [])
      .filter((item) => item?.ativo !== false && item?.recebimento_id)
      .map((item) => [item.recebimento_id, item]),
  );

  return (rows || []).map((row) => {
    const exclusao = porRecebimento.get(row.recebimento_id) || null;
    const antesDoCorte = anteriorAoInicioDoFechamento(row);
    return {
      ...row,
      exclusao_fechamento: exclusao,
      excluido_do_fechamento: Boolean(exclusao),
      anterior_ao_fechamento: antesDoCorte,
      fora_do_fechamento: Boolean(exclusao) || antesDoCorte,
    };
  });
}

/** A linha compoe os totais do fechamento mensal? */
export function entraNoFechamento(row) {
  if (!row) return false;
  if (row.status === 'CANCELADO') return false;
  if (row.excluido_do_fechamento) return false;
  return !anteriorAoInicioDoFechamento(row);
}

export function motivoForaDoFechamento(row) {
  if (!row?.fora_do_fechamento) return '';
  if (row.excluido_do_fechamento) {
    return row.exclusao_fechamento?.motivo || 'Retirado do fechamento mensal';
  }
  return `Anterior a ${FECHAMENTO_PRIMEIRO_MES.split('-').reverse().join('/')}`;
}

/** Linhas de um mes que efetivamente compoem o fechamento. */
export function linhasDoFechamento(rows = [], ano, mes) {
  if (competenciaAnteriorAoInicio(ano, mes)) return [];
  const competencia = `${ano}-${String(mes).padStart(2, '0')}`;
  return (rows || []).filter((row) => competenciaDaLinha(row) === competencia && entraNoFechamento(row));
}

// ---------------------------------------------------------------------------
// Notas fiscais: principal e complementares
// ---------------------------------------------------------------------------

/**
 * Uma carga = um recebimento. As notas complementares nao criam nova carga:
 * elas apenas somam peso a nota principal quando `afeta_peso` nao e false.
 */
export function notasDaLinha(row) {
  const recebimento = row?.recebimento || {};
  const complementos = (recebimento.complementos || []).filter((item) => item?.numero_nf);
  return {
    principal: recebimento.nf_numero || '',
    complementares: complementos.map((item) => ({
      numero: item.numero_nf,
      peso: notaComplementoPesoKg(item),
      afetaPeso: item?.afeta_peso !== false,
    })),
  };
}

export function textoNotasComplementares(row) {
  const { complementares } = notasDaLinha(row);
  if (!complementares.length) return '';
  return complementares.map((item) => item.numero).join(', ');
}

export function pesoNotaPrincipal(row) {
  return pesoNotaPrincipalRecebimento(row?.recebimento || {});
}

export function pesoNotasComplementares(row) {
  return arredondar(notasDaLinha(row).complementares.reduce((total, item) => total + item.peso, 0));
}

// ---------------------------------------------------------------------------
// Totais
// ---------------------------------------------------------------------------

export function resumoFechamento(rows = []) {
  const silos = new Set();
  const baias = new Set();
  const produtos = new Set();

  rows.forEach((row) => {
    nomesDeProduto(row).forEach((nome) => produtos.add(nome));
    (row.itens || []).forEach((item) => (item.distribuicoes || []).forEach((distribuicao) => {
      if (distribuicao.silo) silos.add(chave(distribuicao.silo));
      if (distribuicao.baia) baias.add(chave(distribuicao.baia));
    }));
  });

  return {
    cargas: rows.length,
    produtos: produtos.size,
    pesoNota: somar(rows, 'peso_nota'),
    armazenado: somar(rows, 'peso_distribuido'),
    saldo: somar(rows, 'saldo_distribuir'),
    silos: silos.size,
    baias: baias.size,
  };
}

export function totaisPorProduto(rows = []) {
  const mapa = new Map();
  rows.forEach((row) => {
    const nomes = nomesDeProduto(row);
    // Uma carga com varios produtos conta 1 carga em cada produto, mas o peso
    // e rateado para nao inflar o total do mes.
    const fatia = nomes.length ? 1 / nomes.length : 1;
    (nomes.length ? nomes : ['Sem produto']).forEach((nome) => {
      const atual = mapa.get(nome) || { chave: nome, cargas: 0, pesoNota: 0, armazenado: 0, saldo: 0 };
      atual.cargas += 1;
      atual.pesoNota += Number(row.peso_nota || 0) * fatia;
      atual.armazenado += Number(row.peso_distribuido || 0) * fatia;
      atual.saldo += Number(row.saldo_distribuir || 0) * fatia;
      mapa.set(nome, atual);
    });
  });
  return ordenarTotais(mapa);
}

export function totaisPorFornecedor(rows = []) {
  const mapa = new Map();
  rows.forEach((row) => {
    const nome = nomeFornecedor(row);
    const atual = mapa.get(nome) || { chave: nome, cargas: 0, pesoNota: 0, armazenado: 0, saldo: 0 };
    atual.cargas += 1;
    atual.pesoNota += Number(row.peso_nota || 0);
    atual.armazenado += Number(row.peso_distribuido || 0);
    atual.saldo += Number(row.saldo_distribuir || 0);
    mapa.set(nome, atual);
  });
  return ordenarTotais(mapa);
}

/**
 * Totais por silo/baia vem das distribuicoes, que sao o peso realmente
 * armazenado. Cada distribuicao entra uma unica vez.
 */
export function totaisPorSiloBaia(rows = []) {
  const mapa = new Map();
  rows.forEach((row) => {
    (row.itens || []).forEach((item) => (item.distribuicoes || []).forEach((distribuicao) => {
      const silo = distribuicao.silo || '-';
      const baia = distribuicao.baia || '-';
      const nome = `${silo} / ${baia}`;
      const atual = mapa.get(nome) || { chave: nome, silo, baia, movimentacoes: 0, armazenado: 0 };
      atual.movimentacoes += 1;
      atual.armazenado += Number(distribuicao.peso_armazenado || 0);
      mapa.set(nome, atual);
    }));
  });
  return Array.from(mapa.values())
    .map((item) => ({ ...item, armazenado: arredondar(item.armazenado) }))
    .sort((a, b) => b.armazenado - a.armazenado);
}

export function nomesDeProduto(row) {
  const doArmazenagem = (row?.itens || []).map((item) => item.produto?.nome).filter(Boolean);
  if (doArmazenagem.length) return [...new Set(doArmazenagem)];
  const doRecebimento = (row?.recebimento?.itens || []).map((item) => item.produto?.nome).filter(Boolean);
  if (doRecebimento.length) return [...new Set(doRecebimento)];
  const unico = row?.recebimento?.produto?.nome || row?.recebimento?.produto_nome_manual;
  return unico ? [unico] : [];
}

export function nomeFornecedor(row) {
  return row?.recebimento?.fornecedor?.nome || row?.recebimento?.fornecedor_nome_manual || 'Sem fornecedor';
}

export function nomeTransportadora(row) {
  return row?.recebimento?.transportadora?.nome || row?.recebimento?.tipo_veiculo || '';
}

export function placaDaLinha(row) {
  return row?.recebimento?.veiculo?.placa || row?.recebimento?.veiculo_placa_manual || '';
}

function ordenarTotais(mapa) {
  return Array.from(mapa.values())
    .map((item) => ({
      ...item,
      pesoNota: arredondar(item.pesoNota),
      armazenado: arredondar(item.armazenado),
      saldo: arredondar(item.saldo),
    }))
    .sort((a, b) => b.pesoNota - a.pesoNota);
}

function somar(rows, campo) {
  return arredondar((rows || []).reduce((total, row) => total + Number(row[campo] || 0), 0));
}

function chave(valor) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function arredondar(valor) {
  return Number(Number(valor || 0).toFixed(3));
}
