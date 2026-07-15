export function hasDispensaLaboratorio(row) {
  return Boolean(
    row?.dispensa_laboratorio
    || row?.portaria?.dispensa_laboratorio
    || row?.portaria?.status === 'ENVIADO_RECEBIMENTO',
  );
}

export function hasRecebimentoFinalizationData(row) {
  const hasProduct = Boolean(
    row?.produto_id
    || row?.produto_nome_manual
    || row?.itens?.some((item) => item?.produto_id || item?.produto_nome_manual),
  );

  return Boolean(
    row?.balanca_id
    && row?.nf_numero
    && row?.fornecedor_id
    && (row?.veiculo_id || row?.veiculo_placa_manual)
    && hasProduct
    && Number(row?.peso_bruto || 0) > 0
    && Number(row?.tara || 0) > 0
    && Number(row?.peso_bruto || 0) >= Number(row?.tara || 0),
  );
}

export function isRecebimentoFinalizadoBalanca(row) {
  return row?.status === 'aprovada' && hasRecebimentoFinalizationData(row);
}

export function isLaboratorioPendenteBalanca(row) {
  return row?.status === 'aprovada'
    && !hasDispensaLaboratorio(row)
    && !isRecebimentoFinalizadoBalanca(row);
}

export function isDiretoPendenteBalanca(row) {
  return hasDispensaLaboratorio(row)
    && !isRecebimentoFinalizadoBalanca(row)
    && row?.status !== 'cancelada'
    && row?.status !== 'reprovada';
}

export function isRecebimentoPendenteBalanca(row) {
  return isLaboratorioPendenteBalanca(row) || isDiretoPendenteBalanca(row);
}

export function isAprovadaLaboratorio(row) {
  return row?.status === 'aprovada' && !hasDispensaLaboratorio(row);
}
