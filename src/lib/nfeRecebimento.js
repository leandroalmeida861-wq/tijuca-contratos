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

  const domResult = parseNfeRecebimentoDom(xml);
  if (domResult) return domResult;

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
    const icmsDesoneradoRaw = tagText(det, 'vICMSDeson');
    const descontoTotal = somaValoresNfe(descontoRaw, icmsDesoneradoRaw);
    return {
      codigo: tagText(prod, 'cProd'),
      nome: tagText(prod, 'xProd') || '(sem descrição)',
      unidade: tagText(prod, 'uCom'),
      quantidade: numberValue(tagText(prod, 'qCom')),
      valorUnitario: numberValue(valorUnitarioRaw),
      valorUnitarioDecimais: decimalPlaces(valorUnitarioRaw),
      valorTotal: numberValue(valorTotalRaw),
      valorTotalDecimais: decimalPlaces(valorTotalRaw),
      desconto: descontoTotal,
      descontoProduto: numberValue(descontoRaw) || 0,
      icmsDesonerado: numberValue(icmsDesoneradoRaw) || 0,
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

function parseNfeRecebimentoDom(xmlText) {
  if (typeof DOMParser === 'undefined') return null;

  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (findFirst(doc, 'parsererror')) {
    throw new NfeParseError('XML inválido. Como corrigir: selecione o arquivo XML original da NF-e.');
  }

  const infNfe = findFirst(doc, 'infNFe');
  if (!infNfe) return null;

  const ide = findFirst(infNfe, 'ide');
  const emit = findFirst(infNfe, 'emit');
  const transp = findFirst(infNfe, 'transp');
  const transporta = findFirst(transp, 'transporta');
  const veicTransp = findFirst(transp, 'veicTransp');
  const vol = findFirst(transp, 'vol');
  const icmsTot = findFirst(infNfe, 'ICMSTot');
  const chaveAcesso = onlyDigits(infNfe.getAttribute('Id')).slice(-44) || null;

  const itens = findAll(infNfe, 'det').map((det) => {
    const prod = findFirst(det, 'prod') || det;
    const valorUnitarioRaw = textFrom(prod, 'vUnCom');
    const valorTotalRaw = textFrom(prod, 'vProd');
    const descontoRaw = textFrom(prod, 'vDesc');
    const icmsDesoneradoRaw = textFrom(det, 'vICMSDeson');
    const descontoTotal = somaValoresNfe(descontoRaw, icmsDesoneradoRaw);
    return {
      codigo: textFrom(prod, 'cProd'),
      nome: textFrom(prod, 'xProd') || '(sem descrição)',
      unidade: textFrom(prod, 'uCom'),
      quantidade: numberValue(textFrom(prod, 'qCom')),
      valorUnitario: numberValue(valorUnitarioRaw),
      valorUnitarioDecimais: decimalPlaces(valorUnitarioRaw),
      valorTotal: numberValue(valorTotalRaw),
      valorTotalDecimais: decimalPlaces(valorTotalRaw),
      desconto: descontoTotal,
      descontoProduto: numberValue(descontoRaw) || 0,
      icmsDesonerado: numberValue(icmsDesoneradoRaw) || 0,
    };
  });

  const pesoLiquidoXml = numberValue(textFrom(vol, 'pesoL'));
  const pesoLiquidoItens = itens
    .filter((item) => String(item.unidade || '').toUpperCase().startsWith('KG'))
    .reduce((sum, item) => sum + Number(item.quantidade || 0), 0);

  return {
    chaveAcesso,
    numero: textFrom(ide, 'nNF'),
    serie: textFrom(ide, 'serie'),
    dataEmissao: (textFrom(ide, 'dhEmi') || textFrom(ide, 'dEmi') || '').slice(0, 10) || null,
    emitente: {
      nome: textFrom(emit, 'xNome'),
      documento: textFrom(emit, 'CNPJ') || textFrom(emit, 'CPF'),
    },
    transportadora: {
      nome: textFrom(transporta, 'xNome'),
      cnpj: textFrom(transporta, 'CNPJ') || textFrom(transporta, 'CPF'),
    },
    placaVeiculo: textFrom(veicTransp, 'placa'),
    itens,
    pesoLiquidoNf: pesoLiquidoXml ?? (pesoLiquidoItens > 0 ? pesoLiquidoItens : null),
    pesoBrutoNf: numberValue(textFrom(vol, 'pesoB')),
    valorTotalNota: numberValue(textFrom(icmsTot, 'vNF')),
  };
}

function findFirst(root, localName) {
  if (!root) return null;
  return findAll(root, localName)[0] || null;
}

function findAll(root, localName) {
  if (!root) return [];
  return Array.from(root.getElementsByTagName('*')).filter((node) => node.localName === localName);
}

function textFrom(root, localName) {
  const node = findFirst(root, localName);
  const value = decodeXml(node?.textContent || '');
  return value || null;
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

function somaValoresNfe(...values) {
  return Number(values.reduce((sum, value) => sum + Number(numberValue(value) || 0), 0).toFixed(2));
}

function decimalPlaces(value) {
  const decimal = String(value || '').trim().replace(',', '.').split('.')[1] || '';
  return decimal.length;
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}
