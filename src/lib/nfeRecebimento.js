export class NfeParseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NfeParseError';
  }
}

export function parseNfeRecebimento(xml) {
  if (typeof xml !== 'string' || !/<infNFe\b/i.test(xml)) {
    throw new NfeParseError('Arquivo inválido. Como corrigir: selecione o XML original da NF-e, não o PDF/DANFE.');
  }

  const infId = xml.match(/<infNFe\b[^>]*\bId\s*=\s*"([^"]+)"/i);
  const chaveAcesso = infId ? onlyDigits(infId[1]).slice(-44) || null : null;
  const ide = section(xml, 'ide') || '';
  const emit = section(xml, 'emit') || '';
  const transp = section(xml, 'transp') || '';
  const transporta = section(transp, 'transporta') || '';
  const veicTransp = section(transp, 'veicTransp') || '';
  const vol = section(transp, 'vol') || '';
  const total = section(xml, 'total') || '';
  const icmsTot = section(total, 'ICMSTot') || total;

  const itens = sectionsAll(xml, 'det').map((det) => {
    const prod = section(det, 'prod') || det;
    const valorUnitarioRaw = tagText(prod, 'vUnCom');
    const valorTotalRaw = tagText(prod, 'vProd');
    const descontoRaw = tagText(prod, 'vDesc');
    return {
      codigo: tagText(prod, 'cProd'),
      nome: tagText(prod, 'xProd') || '(sem descrição)',
      unidade: tagText(prod, 'uCom'),
      quantidade: numberValue(tagText(prod, 'qCom')),
      valorUnitario: numberValue(valorUnitarioRaw),
      valorUnitarioDecimais: decimalPlaces(valorUnitarioRaw),
      valorTotal: numberValue(valorTotalRaw),
      valorTotalDecimais: decimalPlaces(valorTotalRaw),
      desconto: numberValue(descontoRaw) || 0,
    };
  });

  const pesoLiquidoXml = numberValue(tagText(vol, 'pesoL'));
  const pesoLiquidoItens = itens
    .filter((item) => String(item.unidade || '').toUpperCase().startsWith('KG'))
    .reduce((sum, item) => sum + Number(item.quantidade || 0), 0);

  return {
    chaveAcesso,
    numero: tagText(ide, 'nNF'),
    serie: tagText(ide, 'serie'),
    dataEmissao: (tagText(ide, 'dhEmi') || tagText(ide, 'dEmi') || '').slice(0, 10) || null,
    emitente: {
      nome: tagText(emit, 'xNome'),
      documento: tagText(emit, 'CNPJ') || tagText(emit, 'CPF'),
    },
    transportadora: {
      nome: tagText(transporta, 'xNome'),
      cnpj: tagText(transporta, 'CNPJ') || tagText(transporta, 'CPF'),
    },
    placaVeiculo: tagText(veicTransp, 'placa'),
    itens,
    pesoLiquidoNf: pesoLiquidoXml ?? (pesoLiquidoItens > 0 ? pesoLiquidoItens : null),
    pesoBrutoNf: numberValue(tagText(vol, 'pesoB')),
    valorTotalNota: numberValue(tagText(icmsTot, 'vNF')),
  };
}

function section(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return match ? match[1] : null;
}

function sectionsAll(xml, tag) {
  const regex = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
  const result = [];
  let match = regex.exec(xml);
  while (match) {
    result.push(match[1]);
    match = regex.exec(xml);
  }
  return result;
}

function tagText(xml, tag) {
  const inner = section(xml, tag);
  if (inner === null) return null;
  const value = decodeXml(inner);
  return value || null;
}

function decodeXml(value) {
  return String(value || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

function numberValue(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function decimalPlaces(value) {
  const decimal = String(value || '').trim().replace(',', '.').split('.')[1] || '';
  return decimal.length;
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}
