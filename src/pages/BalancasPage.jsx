import {
  Check,
  Download,
  Edit,
  Eye,
  FileUp,
  FlaskConical,
  Info,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Sector,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  approveRecebimento,
  cancelRecebimento,
  createPortariaEntrada,
  createLookup,
  createNotaComplementar,
  createRecebimento,
  deleteLookup,
  deleteNotaComplementar,
  deletePortariaEntrada,
  deleteRecebimento,
  exportRecebimentosCsv,
  exportRecebimentosExcel,
  findDuplicateRecebimentoNotaFornecedor,
  findRecebimentoByPortariaId,
  listLookup,
  listPortariaEntradas,
  listRecebimentos,
  loadBalancasOptions,
  lookupTables,
  marcarNaoComplementarFornecedor,
  rejectRecebimento,
  toUserError,
  updateLookup,
  updateNotaComplementar,
  updatePortariaEntrada,
  updateRecebimento,
} from '../services/balancasService.js';
import { parseNfeRecebimento } from '../lib/nfeRecebimento.js';
import { unidadeScopedCan } from '../lib/permissions.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useSupabaseRealtimeRefresh } from '../hooks/useSupabaseRealtimeRefresh.js';
import { dateBr, kg } from '../lib/formatters.js';
import { fortalezaDateIso, fortalezaTime } from '../lib/fortalezaDateTime.js';
import {
  hasDispensaLaboratorio,
  hasRecebimentoFinalizationData,
  isAprovadaLaboratorio,
  isDiretoPendenteBalanca,
  isLaboratorioPendenteBalanca,
  isRecebimentoFinalizadoBalanca,
} from '../lib/balancasFlow.js';
import ArmazenagemTab from '../components/balancas/ArmazenagemTab.jsx';
import UnitHeaderNavigation from '../components/balancas/UnitHeaderNavigation.jsx';
import {
  UNIDADE_ABAS,
  UNIDADE_PADRAO,
  abasDaUnidade,
  encontrarBalancaDaUnidade,
  erroUnidadeNaoEncontrada,
  escopoDaUnidade,
  primeiraAbaDaUnidade,
  rotaDaAba,
} from '../config/unidades.js';

const UMIDADE_LIMITE = 14;
const SCORE_WEIGHTS = {
  aprovacao: 0.45,
  divergencia: 0.4,
  volume: 0.15,
};
const PRODUCT_DONUT_COLORS = ['#0f766e', '#2563eb', '#d97706', '#7c3aed'];
const PRODUCT_MILHO_COLOR = '#facc15';
const EMPTY_OPERATIONAL_SEARCH = Object.freeze({ nfe: '', fornecedor: '' });
const balancasRealtimeTables = [
  'balancas',
  'fornecedores',
  'portaria_entradas',
  'produtos',
  'recebimento_itens',
  'recebimento_laboratorios',
  'recebimento_motoristas',
  'recebimento_notas_complementares',
  'recebimento_transportadoras',
  'recebimento_veiculos',
  'recebimentos',
  'armazenagens_materia_prima',
  'armazenagem_itens',
  'armazenagem_distribuicoes',
  'fechamentos_armazenagem',
];

const BALANCAS_SUB_PERMISSION_MENUS = abasDaUnidade(UNIDADE_PADRAO)
  .filter((tab) => tab.menu !== 'balancas')
  .map((tab) => tab.menu);

const defaultFilters = {
  dataInicial: '',
  dataFinal: '',
  fornecedorId: '',
  produtoId: '',
  laboratorioId: '',
  status: '',
  origemPortaria: '',
};

const defaultRecebimento = {
  data: todayIso(),
  balanca_id: '',
  laboratorio_id: '',
  veiculo_id: '',
  motorista_id: '',
  transportadora_id: '',
  fornecedor_id: '',
  produto_id: '',
  fornecedor_nome_manual: '',
  produto_nome_manual: '',
  veiculo_placa_manual: '',
  tipo_veiculo: '',
  qtd_eixos: '',
  nf_numero: '',
  nf_serie: '',
  nf_chave_acesso: '',
  peso_bruto: '',
  tara: '',
  peso_nf: '',
  peso_nf_manual: false,
  quantidade_nota: '',
  unidade_nota: 'KG',
  peso_por_saca: '60',
  umidade: '',
  umidade_01: '',
  umidade_02: '',
  ticket_numero: '',
  liberado_por: '',
  observacao: '',
  valor_unitario: '',
  valor_total: '',
  subtotal: '',
  desconto_total: '',
  itens: [],
};

const defaultPortariaForm = {
  data_entrada: fortalezaDateIso(),
  hora_entrada: fortalezaTime(),
  balanca_id: '',
  placa: '',
  veiculo_id: '',
  motorista_id: '',
  fornecedor_id: '',
  cnpj_fornecedor: '',
  produto_id: '',
  numero_nf: '',
  serie_nf: '',
  peso_nf_kg: '',
  unidade_nota: 'KG',
  transportadora_id: '',
  tipo_veiculo: '',
  qtd_eixos: '',
  observacao: '',
  status: 'AGUARDANDO_LABORATORIO',
  dispensa_laboratorio: false,
};

const defaultLaboratorioForm = {
  data: todayIso(),
  laboratorio_id: '',
  fornecedor_nome_manual: '',
  produto_nome_manual: '',
  veiculo_placa_manual: '',
  nf_numero: '',
  ticket_numero: '',
  umidade: '',
  umidade_01: '',
  umidade_02: '',
  liberado_por: '',
  status: 'aprovada',
  motivo_reprovacao: '',
  observacao: '',
};

export default function BalancasPage({ unidade = UNIDADE_PADRAO, aba }) {
  const { can, permissions, podeEditarUnidade, profile } = useAuth();
  const podeEditarNaUnidade = podeEditarUnidade(unidade.codigo);
  // Ponto unico onde a permissao do menu e cruzada com a permissao da unidade.
  const canDaAba = (tabKey) => unidadeScopedCan(scopedBalancasCan(can, permissions, tabKey), podeEditarNaUnidade);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const modoQuery = unidade.modoRota === 'query';
  const tabs = useMemo(() => abasDaUnidade(unidade), [unidade]);
  const tabKeys = useMemo(
    () => new Set([...tabs.map((tab) => tab.key), ...(unidade.temCadastros ? ['cadastros'] : [])]),
    [tabs, unidade],
  );
  const abaInicial = primeiraAbaDaUnidade(unidade).key;
  const tabParam = modoQuery ? searchParams.get('tab') : null;
  const cadastroParam = searchParams.get('cadastro');
  const [queryTab, setQueryTab] = useState(tabKeys.has(tabParam) ? tabParam : abaInicial);
  const activeTab = modoQuery ? queryTab : (tabKeys.has(aba) ? aba : abaInicial);
  const [rows, setRows] = useState([]);
  const [portariaRows, setPortariaRows] = useState([]);
  const [options, setOptions] = useState(emptyOptions());
  const [balancaUnidade, setBalancaUnidade] = useState(null);
  const [filters, setFilters] = useState(defaultFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const generalDataLoaded = useRef(false);
  const canTab = (tabKey, action = 'visualizar') => canBalancasTab(can, permissions, tabKey, action);
  const visibleTabs = tabs.filter((tab) => canTab(tab.key, 'visualizar'));
  const escopo = escopoDaUnidade(unidade, balancaUnidade);

  async function load(customFilters = filters, { silent = false } = {}) {
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      // A unidade e resolvida antes de qualquer consulta: nenhum dado e
      // carregado sem o recorte da balanca correspondente.
      const nextOptions = await loadBalancasOptions();
      setOptions(nextOptions);

      const balanca = encontrarBalancaDaUnidade(unidade, nextOptions.balancas);
      setBalancaUnidade(balanca);
      if (!balanca) {
        setRows([]);
        setPortariaRows([]);
        if (!silent) setError(erroUnidadeNaoEncontrada(unidade));
        return;
      }

      const escopoUnidade = escopoDaUnidade(unidade, balanca);
      const nextRowsPromise = listRecebimentos({ ...customFilters, ...escopoUnidade });
      const portariaRecebimentosPromise = hasActiveBalancasFilters(customFilters)
        ? listRecebimentos({ origemPortaria: 'com_portaria', ...escopoUnidade })
        : nextRowsPromise;
      const [nextRows, nextPortariaRows, portariaRecebimentos] = await Promise.all([
        nextRowsPromise,
        listPortariaEntradas(escopoUnidade),
        portariaRecebimentosPromise,
      ]);
      setRows(attachPortariaRows(nextRows, nextPortariaRows));
      setPortariaRows(attachRecebimentosToPortarias(nextPortariaRows, portariaRecebimentos));
      generalDataLoaded.current = true;
    } catch (err) {
      if (!silent) setError(toUserError(err));
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab !== 'armazenagem' && !generalDataLoaded.current) load();
  }, [activeTab]);

  // A aba Armazenagem carrega os proprios dados e nao dispara o load() geral.
  // Mesmo assim a unidade precisa estar resolvida: sem ela o escopo fica vazio
  // e a consulta traria lancamentos de todas as unidades.
  useEffect(() => {
    if (balancaUnidade) return undefined;
    let cancelado = false;
    listLookup('balancas')
      .then((balancas) => {
        if (cancelado) return;
        const balanca = encontrarBalancaDaUnidade(unidade, balancas);
        if (balanca) setBalancaUnidade(balanca);
        else setError(erroUnidadeNaoEncontrada(unidade));
      })
      .catch(() => { /* o load() principal ja reporta falhas de carga */ });
    return () => { cancelado = true; };
  }, [unidade, balancaUnidade]);

  useSupabaseRealtimeRefresh(balancasRealtimeTables, () => {
    if (activeTab !== 'armazenagem') load(filters, { silent: true });
  }, {
    channelName: 'balancas',
  });

  useEffect(() => {
    if (!modoQuery) return;
    if (tabKeys.has(tabParam) && (tabParam === 'cadastros' || canTab(tabParam, 'visualizar'))) {
      setQueryTab(tabParam);
    }
  }, [modoQuery, tabParam, permissions]);

  useEffect(() => {
    if (activeTab === 'cadastros') return;
    if (canTab(activeTab, 'visualizar')) return;
    const fallback = visibleTabs[0]?.key;
    if (!fallback) return;
    if (modoQuery) {
      setQueryTab(fallback);
      setSearchParams(fallback === abaInicial ? {} : { tab: fallback });
      return;
    }
    navigate(rotaDaAba(unidade, fallback), { replace: true });
  }, [activeTab, permissions]);

  function selectTab(tabKey) {
    if (tabKey !== 'cadastros' && !canTab(tabKey, 'visualizar')) return;
    if (tabKey !== 'relatorios' && filters.origemPortaria) {
      const nextFilters = { ...filters, origemPortaria: '' };
      setFilters(nextFilters);
      load(nextFilters);
    }
    if (!modoQuery) {
      navigate(rotaDaAba(unidade, tabKey));
      return;
    }
    setQueryTab(tabKey);
    setSearchParams(tabKey === abaInicial ? {} : { tab: tabKey });
  }

  function selectCadastro(cadastroKey) {
    setSearchParams({ tab: 'cadastros', cadastro: cadastroKey });
  }

  function applyFilters(event) {
    event?.preventDefault();
    if (filters.dataInicial && filters.dataFinal && filters.dataInicial > filters.dataFinal) {
      setError('A data inicial nÃ£o pode ser maior que a data final. Como corrigir: ajuste o perÃ­odo e tente novamente.');
      return;
    }
    load(filters);
  }

  function clearFilters() {
    setFilters(defaultFilters);
    load(defaultFilters);
  }

  return (
    <div className="grid gap-5">
      <UnitHeaderNavigation
        unidade={unidade}
        tabs={visibleTabs}
        activeTab={activeTab}
        onSelectTab={selectTab}
      />

      {message && <Alert tone="success" text={message} />}
      {error && activeTab !== 'armazenagem' && <Alert tone="error" text={error} />}

      {activeTab === 'dashboard' && (
        <DashboardTab
          rows={rows}
          options={options}
          filters={filters}
          setFilters={setFilters}
          applyFilters={applyFilters}
          clearFilters={clearFilters}
          loading={loading}
          balancaId={balancaUnidade?.id}
          canDecideComplement={['admin', 'gestor'].includes(profile) && podeEditarNaUnidade}
          reload={load}
          setError={setError}
          setMessage={setMessage}
        />
      )}
      {activeTab === 'portaria' && <PortariaTab rows={portariaRows} options={options} unidade={unidade} balanca={balancaUnidade} can={canDaAba('portaria')} loading={loading} reload={load} setError={setError} setMessage={setMessage} />}
      {activeTab === 'recebimentos' && <RecebimentosTab rows={rows} options={options} unidade={unidade} balanca={balancaUnidade} can={canDaAba('recebimentos')} loading={loading} reload={load} setError={setError} setMessage={setMessage} />}
      {activeTab === 'laboratorio' && <LaboratorioTab rows={rows} options={options} can={canDaAba('laboratorio')} reload={load} setError={setError} setMessage={setMessage} />}
      {activeTab === 'armazenagem' && <ArmazenagemTab can={canDaAba('armazenagem')} escopo={escopo} unidade={unidade} />}
      {activeTab === 'cadastros' && <CadastrosTab activeCadastro={cadastroParam} onCadastroChange={selectCadastro} can={unidadeScopedCan(can, podeEditarNaUnidade)} setError={setError} setMessage={setMessage} reloadMain={load} />}
      {activeTab === 'relatorios' && <RelatoriosTab rows={rows} options={options} filters={filters} setFilters={setFilters} applyFilters={applyFilters} clearFilters={clearFilters} can={canDaAba('relatorios')} />}
    </div>
  );
}

function hasBalancasSubPermissions(permissions = {}) {
  return BALANCAS_SUB_PERMISSION_MENUS.some((menu) => permissions?.[menu]);
}

function attachPortariaRows(recebimentos = [], portarias = []) {
  if (!Array.isArray(recebimentos) || !recebimentos.length || !Array.isArray(portarias) || !portarias.length) {
    return recebimentos || [];
  }
  const portariaById = new Map(portarias.map((row) => [row.id, row]));
  return recebimentos.map((row) => (
    row.portaria_id && portariaById.has(row.portaria_id)
      ? { ...row, portaria: portariaById.get(row.portaria_id) }
      : row
  ));
}

function hasActiveBalancasFilters(filters = {}) {
  return Object.values(filters || {}).some(Boolean);
}

function attachRecebimentosToPortarias(portarias = [], recebimentos = []) {
  if (!Array.isArray(portarias) || !portarias.length) return portarias || [];

  const recebimentoByPortariaId = new Map();
  (recebimentos || []).forEach((row) => {
    if (!row.portaria_id) return;
    const current = recebimentoByPortariaId.get(row.portaria_id);
    if (!current || (current.status === 'cancelada' && row.status !== 'cancelada')) {
      recebimentoByPortariaId.set(row.portaria_id, row);
    }
  });

  return portarias
    .map((row) => ({ ...row, recebimento: recebimentoByPortariaId.get(row.id) || null }))
    .sort((a, b) => comparePortariaOperationalDateTimeDesc(portariaDisplayRow(a), portariaDisplayRow(b)));
}

function portariaDisplayRow(row) {
  const recebimento = row?.recebimento;
  if (!recebimento) return row;
  const hasManualSupplier = Boolean(recebimento.fornecedor_nome_manual);
  const hasManualProduct = Boolean(recebimento.produto_nome_manual);
  const hasManualVehicle = Boolean(recebimento.veiculo_placa_manual);

  return {
    ...row,
    balanca_id: recebimento.balanca_id || row.balanca_id,
    balanca: recebimento.balanca || row.balanca,
    placa: placaVeiculo(recebimento, row.placa),
    veiculo_id: hasManualVehicle ? null : recebimento.veiculo_id || row.veiculo_id,
    veiculo: hasManualVehicle ? null : recebimento.veiculo || row.veiculo,
    motorista_id: recebimento.motorista_id || row.motorista_id,
    motorista: recebimento.motorista || row.motorista,
    transportadora_id: recebimento.transportadora_id || row.transportadora_id,
    transportadora: recebimento.transportadora || row.transportadora,
    fornecedor_id: hasManualSupplier ? null : recebimento.fornecedor_id || row.fornecedor_id,
    fornecedor: hasManualSupplier ? null : recebimento.fornecedor || row.fornecedor,
    fornecedor_nome_sincronizado: fornecedorNome(recebimento, ''),
    produto_id: hasManualProduct ? null : recebimento.produto_id || row.produto_id,
    produto: hasManualProduct ? null : recebimento.produto || row.produto,
    produto_nome_sincronizado: produtoNome(recebimento, ''),
    numero_nf: recebimento.nf_numero || row.numero_nf,
    peso_nf_kg: recebimento.quantidade_nota ?? recebimento.peso_nf ?? row.peso_nf_kg,
    unidade_nota: recebimento.unidade_nota || row.unidade_nota,
    tipo_veiculo: recebimento.tipo_veiculo || recebimento.veiculo?.tipo_veiculo || row.tipo_veiculo,
    qtd_eixos: recebimento.qtd_eixos ?? recebimento.veiculo?.qtd_eixos ?? row.qtd_eixos,
    observacao: recebimento.observacao ?? row.observacao,
  };
}

function comparePortariaOperationalDateTimeDesc(a, b) {
  const dateDiff = String(b?.data_entrada || '').localeCompare(String(a?.data_entrada || ''));
  if (dateDiff) return dateDiff;
  const timeDiff = String(b?.hora_entrada || '').localeCompare(String(a?.hora_entrada || ''));
  if (timeDiff) return timeDiff;
  return String(b?.created_at || '').localeCompare(String(a?.created_at || ''));
}

function balancasTabMenu(tabKey) {
  return UNIDADE_ABAS[tabKey]?.menu || 'balancas';
}

function canBalancasTab(can, permissions, tabKey, action = 'visualizar') {
  const menu = balancasTabMenu(tabKey);
  if (menu === 'balancas') return can('balancas', action);
  if (hasBalancasSubPermissions(permissions)) return can(menu, action);
  return can('balancas', action);
}

function scopedBalancasCan(can, permissions, tabKey) {
  return (menu, action = 'visualizar') => {
    if (menu !== 'balancas') return can(menu, action);
    return canBalancasTab(can, permissions, tabKey, action);
  };
}


function DashboardTab({
  rows,
  options,
  filters,
  setFilters,
  applyFilters,
  clearFilters,
  loading,
  balancaId,
  canDecideComplement,
  reload,
  setError,
  setMessage,
}) {
  const recebimentosBalanca = useMemo(() => rows.filter(isRecebimentoFinalizadoBalanca), [rows]);
  const aprovadasLaboratorio = useMemo(() => rows.filter(isAprovadaLaboratorio), [rows]);
  const pendentesFinalizar = useMemo(() => rows.filter(isLaboratorioPendenteBalanca), [rows]);
  const metrics = useMemo(() => {
    return {
      cargas: rows.length,
      aprovadasLaboratorio: aprovadasLaboratorio.length,
      kgRecebidos: recebimentosBalanca.reduce((sum, row) => sum + Number(row.peso_liquido || 0), 0),
      recebimentosBalanca: recebimentosBalanca.length,
      pendentesFinalizar: pendentesFinalizar.length,
      reprovadas: rows.filter((row) => row.status === 'reprovada').length,
    };
  }, [aprovadasLaboratorio, pendentesFinalizar, recebimentosBalanca, rows]);

  const bySupplier = groupSupplierSum(recebimentosBalanca, 'peso_liquido').filter((item) => item.value > 0).slice(0, 6);
  const byStatus = useMemo(() => buildDashboardStatus(aprovadasLaboratorio, recebimentosBalanca, pendentesFinalizar), [aprovadasLaboratorio, pendentesFinalizar, recebimentosBalanca]);
  const productsDistribution = useMemo(() => buildProductsDistribution(recebimentosBalanca), [recebimentosBalanca]);
  const supplierDifferences = useMemo(() => buildSupplierDifferences(recebimentosBalanca), [recebimentosBalanca]);
  const dailyReceivedVolume = useMemo(() => buildDailyReceivedVolume(recebimentosBalanca), [recebimentosBalanca]);
  const supplierMoisture = useMemo(() => buildSupplierMoisture(aprovadasLaboratorio), [aprovadasLaboratorio]);
  const bestSuppliers = useMemo(() => buildBestSuppliersRanking(recebimentosBalanca), [recebimentosBalanca]);

  return (
    <div className="grid gap-5">
      <Filters options={options} filters={filters} setFilters={setFilters} onApply={applyFilters} onClear={clearFilters} />

      {loading ? (
        <div className="grid min-h-40 place-items-center rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-500 shadow-panel">
          Carregando dados de balanÃ§as...
        </div>
      ) : (
        <>
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Metric title="Aprovadas no laboratÃ³rio" value={metrics.aprovadasLaboratorio} icon={FlaskConical} color={chartColor(1)} />
            <Metric title="…53526 tokens truncated…ed, fornecedores = []) {
  const documentoXml = onlyDigits(parsed?.emitente?.documento);
  if (!documentoXml) return null;
  return (fornecedores || []).find((fornecedor) => onlyDigits(fornecedor.cnpj) === documentoXml) || null;
}

function findTransportadoraFromNfe(parsed, transportadoras = []) {
  const documentoXml = onlyDigits(parsed?.transportadora?.cnpj);
  if (documentoXml) {
    const byDocument = (transportadoras || []).find((item) => onlyDigits(item.cnpj) === documentoXml);
    if (byDocument) return byDocument;
  }
  const normalizedName = normalizeSupplierName(parsed?.transportadora?.nome);
  if (!normalizedName) return null;
  return (transportadoras || []).find((item) => normalizeSupplierName(item.nome) === normalizedName) || null;
}

function findVeiculoFromNfe(parsed, veiculos = []) {
  const plate = normalizePlate(parsed?.placaVeiculo);
  if (!plate) return null;
  return (veiculos || []).find((item) => normalizePlate(item.placa) === plate) || null;
}

function findProdutoFromNfe(item, produtos = []) {
  const normalizedXmlName = normalizeProductName(item?.nome);
  if (!normalizedXmlName) return null;
  const candidates = (produtos || [])
    .map((produto) => {
      const normalizedProduct = normalizeProductName(produto.nome);
      return { produto, score: productMatchScore(normalizedXmlName, normalizedProduct) };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!candidates.length) return null;
  const [best, second] = candidates;
  if (second && second.score === best.score) return null;
  return best.produto;
}

function findProductByManualName(name, produtos = []) {
  const normalizedManualName = normalizeProductName(name);
  if (!normalizedManualName) return null;
  const candidates = (produtos || [])
    .map((produto) => {
      const normalizedProduct = normalizeProductName(produto.nome);
      return { produto, score: productMatchScore(normalizedManualName, normalizedProduct) };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!candidates.length) return null;
  const [best, second] = candidates;
  if (second && second.score === best.score) return null;
  return best.produto;
}

function resolveManualProductFields(name, produtos = []) {
  const product = findProductByManualName(name, produtos);
  if (!product) return {};
  return { produto_id: product.id, produto_nome_manual: '' };
}

function productMatchScore(normalizedXmlName, normalizedProduct) {
  if (!normalizedXmlName || !normalizedProduct) return 0;
  if (normalizedProduct === normalizedXmlName) return 100;

  const xmlTokens = productTokens(normalizedXmlName);
  const productTokenList = productTokens(normalizedProduct);
  if (!xmlTokens.length || !productTokenList.length) return 0;

  const xmlSet = new Set(xmlTokens);
  const productSet = new Set(productTokenList);
  const sameTokenSet = xmlSet.size === productSet.size && [...xmlSet].every((token) => productSet.has(token));
  if (sameTokenSet) return 95;

  const xmlHasAllProductTokens = [...productSet].every((token) => xmlSet.has(token));
  const productHasAllXmlTokens = [...xmlSet].every((token) => productSet.has(token));

  if (xmlHasAllProductTokens && xmlTokens.length === productTokenList.length) return 90;
  if (productHasAllXmlTokens && xmlTokens.length === productTokenList.length) return 90;

  return 0;
}

function resolveNfeProduct(parsed, produtos = []) {
  const itens = parsed?.itens || [];
  const matchedItems = itens
    .map((item) => ({ item, product: findProdutoFromNfe(item, produtos) }))
    .filter((entry) => entry.product);

  if (!matchedItems.length) {
    const totalQuantity = sumNfeItems(itens, 'quantidade');
    const totalValue = sumNfeItems(itens, 'valorTotal') ?? parsed?.valorTotalNota;
    return {
      item: itens[0] || null,
      product: null,
      quantity: totalQuantity ?? parsed?.pesoLiquidoNf,
      unit: itens[0]?.unidade || 'KG',
      totalValue,
      unitValue: calculateUnitValue(totalValue, totalQuantity ?? parsed?.pesoLiquidoNf),
      unitDecimalPlaces: 2,
    };
  }

  const grouped = new Map();
  for (const { item, product } of matchedItems) {
    const current = grouped.get(product.id) || {
      item,
      product,
      quantity: 0,
      totalValue: 0,
      unitDecimalPlaces: item.valorUnitarioDecimais || 2,
      unit: item.unidade || 'KG',
    };
    current.quantity += Number(item.quantidade || 0);
    current.totalValue += Number(item.valorTotal || 0);
    current.unitDecimalPlaces = Math.max(current.unitDecimalPlaces, item.valorUnitarioDecimais || 0);
    grouped.set(product.id, current);
  }

  const sorted = [...grouped.values()].sort((a, b) => Number(b.totalValue || b.quantity || 0) - Number(a.totalValue || a.quantity || 0));
  const selected = sorted[0];
  const quantity = selected.quantity || parsed?.pesoLiquidoNf;
  const totalValue = selected.totalValue || parsed?.valorTotalNota;
  const unitValueFromXml = grouped.size === 1 && selected.item?.valorUnitario ? selected.item.valorUnitario : null;

  return {
    ...selected,
    quantity,
    totalValue,
    unitValue: unitValueFromXml ?? calculateUnitValue(totalValue, quantity),
    unit: selected.unit || selected.item?.unidade || 'KG',
  };
}

function sumNfeItems(items, key) {
  const values = (items || []).map((item) => Number(item?.[key] || 0)).filter((value) => Number.isFinite(value) && value > 0);
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0);
}

function calculateUnitValue(totalValue, quantity) {
  const total = Number(totalValue || 0);
  const qty = Number(quantity || 0);
  if (!Number.isFinite(total) || !Number.isFinite(qty) || qty <= 0) return null;
  return total / qty;
}

function produtoNome(row, fallback = '-') {
  if (Array.isArray(row.itens) && row.itens.length) {
    const names = row.itens
      .slice()
      .sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0))
      .map((item) => item.produto?.nome)
      .filter(Boolean);
    if (names.length) return names.join(', ');
  }
  return row.produto?.nome || row.produto_nome_manual || fallback;
}

function placaVeiculo(row, fallback = '-') {
  return row.veiculo_placa_manual || row.veiculo?.placa || fallback;
}

function formatPlateDisplay(value) {
  const cleaned = String(value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (!cleaned) return '-';
  if (cleaned.length === 7) return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
  return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ') || '-';
}

function formatPercent(value) {
  const number = nullableNumber(value);
  if (number === null) return '';
  return `${number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function sortRecebimentoRows(rows) {
  return [...rows].sort((a, b) => {
    const priorityDiff = recebimentoSortPriority(a) - recebimentoSortPriority(b);
    if (priorityDiff) return priorityDiff;
    return compareOperationalDateTimeDesc(a, b);
  });
}

function sortPendingScaleRows(rows) {
  return [...rows].sort((a, b) => {
    const dateA = String(a.portaria?.data_entrada || a.data || '');
    const dateB = String(b.portaria?.data_entrada || b.data || '');
    const dateDiff = dateA.localeCompare(dateB);
    if (dateDiff) return dateDiff;

    const timeA = String(a.portaria?.hora_entrada || '00:00:00');
    const timeB = String(b.portaria?.hora_entrada || '00:00:00');
    const timeDiff = timeA.localeCompare(timeB);
    if (timeDiff) return timeDiff;

    const createdAtA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const createdAtB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return createdAtA - createdAtB;
  });
}

function sortReportRows(rows) {
  return [...rows].sort((a, b) => {
    const supplierDiff = normalizeName(fornecedorNome(a)).localeCompare(normalizeName(fornecedorNome(b)), 'pt-BR');
    if (supplierDiff) return supplierDiff;
    const productDiff = normalizeName(produtoNome(a)).localeCompare(normalizeName(produtoNome(b)), 'pt-BR');
    if (productDiff) return productDiff;
    const dateDiff = String(a.data || '').localeCompare(String(b.data || ''));
    if (dateDiff) return dateDiff;
    return String(a.nf_numero || '').localeCompare(String(b.nf_numero || ''), 'pt-BR', { numeric: true });
  });
}

function recebimentoSortPriority(row) {
  if (isLaboratorioPendenteBalanca(row) || isDiretoPendenteBalanca(row)) return 0;
  if (row.status === 'aprovada') return 1;
  return 2;
}

function compareOperationalDateTimeDesc(a, b) {
  const dateDiff = String(b.data || '').localeCompare(String(a.data || ''));
  if (dateDiff) return dateDiff;

  const createdAtA = a.created_at ? new Date(a.created_at).getTime() : 0;
  const createdAtB = b.created_at ? new Date(b.created_at).getTime() : 0;
  if (createdAtA !== createdAtB) return createdAtB - createdAtA;

  return String(b.id || '').localeCompare(String(a.id || ''));
}

function recebimentoRowClass(row) {
  const base = 'border-b last:border-0';
  if (isDiretoPendenteBalanca(row)) return `${base} bg-sky-50/80 hover:bg-sky-100/80`;
  if (isLaboratorioPendenteBalanca(row)) return `${base} bg-amber-50/80 hover:bg-amber-100/80`;
  return base;
}

function recebimentoStatusLabel(row) {
  if (isRecebimentoFinalizadoBalanca(row)) return 'Recebimento finalizado';
  if (isLaboratorioPendenteBalanca(row)) return 'Aprovado pelo LaboratÃ³rio - Pendente finalizar recebimento';
  if (isDiretoPendenteBalanca(row)) return 'Direto para Recebimentos - Pendente finalizar recebimento';
  return statusLabel(row.status);
}

function groupSum(rows, getName, field) {
  const map = new Map();
  rows.forEach((row) => {
    const name = getName(row);
    map.set(name, (map.get(name) || 0) + Number(row[field] || 0));
  });
  return Array.from(map, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

function groupSupplierSum(rows, field) {
  const map = new Map();
  rows.forEach((row) => {
    const key = fornecedorGroupKey(row);
    const current = map.get(key) || { name: fornecedorNome(row, 'Sem fornecedor'), value: 0 };
    current.value += Number(row[field] || 0);
    map.set(key, current);
  });
  return Array.from(map.values()).sort((a, b) => b.value - a.value);
}

function groupCount(rows, getName) {
  const map = new Map();
  rows.forEach((row) => {
    const name = getName(row);
    map.set(name, (map.get(name) || 0) + 1);
  });
  return Array.from(map, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

function buildDashboardStatus(aprovadasLaboratorio, recebimentosBalanca, pendentesFinalizar) {
  return [
    { name: 'Aprovadas no LaboratÃ³rio', value: aprovadasLaboratorio.length, color: chartColor(1) },
    { name: 'Finalizadas na BalanÃ§a', value: recebimentosBalanca.length, color: chartColor(3) },
    { name: 'Pendentes de Recebimento', value: pendentesFinalizar.length, color: chartColor(2) },
  ];
}

function buildProductsDistribution(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const originalName = produtoNome(row, 'Sem produto');
    const name = dashboardProductGroupName(originalName);
    const current = map.get(name) || { name, kgTotal: 0, cargas: 0, items: new Map() };
    current.kgTotal += Number(row.peso_liquido || 0);
    current.cargas += 1;
    const detail = current.items.get(originalName) || { name: originalName, kgTotal: 0, cargas: 0 };
    detail.kgTotal += Number(row.peso_liquido || 0);
    detail.cargas += 1;
    current.items.set(originalName, detail);
    map.set(name, current);
  });

  const ranked = Array.from(map.values())
    .map((item) => ({ ...item, items: Array.from(item.items.values()).sort((a, b) => b.kgTotal - a.kgTotal) }))
    .filter((item) => item.kgTotal > 0)
    .sort((a, b) => {
      const priorityDiff = dashboardProductPriority(a.name) - dashboardProductPriority(b.name);
      if (priorityDiff !== 0) return priorityDiff;
      return b.kgTotal - a.kgTotal;
    });

  const main = ranked.slice(0, 4);
  const others = ranked.slice(4);
  const othersTotal = others.reduce((sum, item) => sum + item.kgTotal, 0);
  const othersCargas = others.reduce((sum, item) => sum + item.cargas, 0);
  const data = othersTotal > 0
    ? [...main, { name: `Outros (${others.length} produtos)`, kgTotal: othersTotal, cargas: othersCargas, isOthers: true, items: others }]
    : main;
  const totalKg = data.reduce((sum, item) => sum + Number(item.kgTotal || 0), 0);

  return data.map((item) => ({
    ...item,
    percent: totalKg ? (item.kgTotal / totalKg) * 100 : 0,
  }));
}

function buildSupplierDifferences(rows) {
  const map = new Map();

  rows.forEach((row) => {
    if (hasNoComplementDecision(row)) return;
    const key = fornecedorGroupKey(row);
    const current = map.get(key) || {
      key,
      name: fornecedorNome(row, 'Sem fornecedor'),
      kgNota: 0,
      kgRecebido: 0,
      diferencaKg: 0,
      recebimentoIds: [],
    };
    current.kgNota += pesoNotaAgregado(row);
    current.kgRecebido += Number(row.peso_liquido || 0);
    current.diferencaKg = current.kgRecebido - current.kgNota;
    current.recebimentoIds.push(row.id);
    map.set(key, current);
  });

  return Array.from(map.values())
    .filter((item) => Math.abs(Number(item.diferencaKg || 0)) > Number.EPSILON)
    .sort((a, b) => Math.abs(b.diferencaKg) - Math.abs(a.diferencaKg));
}

function hasNoComplementDecision(row) {
  const decisions = Array.isArray(row?.decisoes_complemento)
    ? row.decisoes_complemento
    : [row?.decisoes_complemento].filter(Boolean);
  return decisions.some((item) => item?.decisao === 'NAO_COMPLEMENTAR');
}

function buildDailyReceivedVolume(rows) {
  const map = new Map();

  rows.forEach((row) => {
    const date = String(row.data || '').slice(0, 10);
    if (!date) return;
    const current = map.get(date) || { date, kgTotal: 0, cargas: 0 };
    current.kgTotal += Number(row.peso_liquido || 0);
    current.cargas += 1;
    map.set(date, current);
  });

  return Array.from(map.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((item) => ({
      ...item,
      label: dateBr(item.date).slice(0, 5),
      dateLabel: dateBr(item.date),
    }));
}

function buildSupplierMoisture(rows) {
  const map = new Map();

  rows.forEach((row) => {
    const umidade = Number(row.umidade);
    if (!Number.isFinite(umidade) || umidade <= 0) return;

    const key = fornecedorGroupKey(row);
    const kgRecebido = Number(row.peso_liquido || 0);
    const weight = kgRecebido > 0 ? kgRecebido : 1;
    const current = map.get(key) || { name: fornecedorNome(row, 'Sem fornecedor'), weightedMoisture: 0, weight: 0, registros: 0, kgRecebido: 0 };
    current.weightedMoisture += umidade * weight;
    current.weight += weight;
    current.registros += 1;
    current.kgRecebido += kgRecebido;
    map.set(key, current);
  });

  return Array.from(map.values())
    .map((item) => ({
      name: item.name,
      umidadeMedia: item.weight ? item.weightedMoisture / item.weight : 0,
      registros: item.registros,
      kgRecebido: item.kgRecebido,
    }))
    .sort((a, b) => b.umidadeMedia - a.umidadeMedia)
    .slice(0, 10);
}

function buildBestSuppliersRanking(rows) {
  const map = new Map();

  rows.forEach((row) => {
    const key = fornecedorGroupKey(row);
    const kgRecebido = Number(row.peso_liquido || 0);
    const kgNota = pesoNotaAgregado(row);
    const current = map.get(key) || {
      name: fornecedorNome(row, 'Sem fornecedor'),
      cargas: 0,
      aprovadas: 0,
      kgRecebido: 0,
      kgNota: 0,
      diferencaAbsKg: 0,
    };

    current.cargas += 1;
    current.aprovadas += row.status === 'aprovada' ? 1 : 0;
    current.kgRecebido += kgRecebido;
    current.kgNota += kgNota;
    current.diferencaAbsKg += Math.abs(kgRecebido - kgNota);
    map.set(key, current);
  });

  const suppliers = Array.from(map.values()).filter((item) => item.cargas > 0);
  const maxKg = Math.max(...suppliers.map((item) => item.kgRecebido), 1);

  return suppliers
    .map((item) => {
      const taxaAprovacao = item.cargas ? (item.aprovadas / item.cargas) * 100 : 0;
      const divergenciaPercentualAbs = item.kgNota ? (item.diferencaAbsKg / item.kgNota) * 100 : 0;
      const qualidadeDivergencia = Math.max(0, 100 - Math.min(divergenciaPercentualAbs * 4, 100));
      const volumeScore = Math.min((item.kgRecebido / maxKg) * 100, 100);
      const score = (taxaAprovacao * SCORE_WEIGHTS.aprovacao) + (qualidadeDivergencia * SCORE_WEIGHTS.divergencia) + (volumeScore * SCORE_WEIGHTS.volume);

      return {
        ...item,
        taxaAprovacao,
        divergenciaPercentualAbs,
        score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

function statusLabel(status) {
  return {
    pendente: 'Pendente',
    aprovada: 'Aprovada',
    reprovada: 'Reprovada',
    cancelada: 'Cancelada',
  }[status] || status || '-';
}

function differenceClass(value) {
  const numeric = Number(value || 0);
  if (numeric > 0) return 'font-extrabold text-blue-700';
  if (numeric < 0) return 'font-extrabold text-rose-700';
  return 'font-semibold text-slate-700';
}

function chartColor(index) {
  const chartColors = [
    '#0F172A',
    '#0F766E',
    '#D97706',
    '#2563EB',
    '#16A34A',
    '#DC2626',
    '#7C3AED',
    '#DB2777',
    '#0891B2',
    '#65A30D',
    '#EA580C',
    '#4F46E5',
  ];
  return chartColors[index % chartColors.length];
}

function compactKg(value) {
  const numeric = Number(value || 0);
  if (Math.abs(numeric) >= 1000) return `${Math.round(numeric / 1000)}t`;
  return `${Math.round(numeric)}kg`;
}

function formatWeightShort(value) {
  const numeric = Number(value || 0);
  if (Math.abs(numeric) >= 1000) {
    return `${(numeric / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}t`;
  }
  return `${Math.round(numeric).toLocaleString('pt-BR')} kg`;
}

function formatDashboardKg(value) {
  const numeric = Number(value || 0);
  const rounded = Math.round(numeric);
  const safeValue = Object.is(rounded, -0) ? 0 : rounded;
  return `${safeValue.toLocaleString('pt-BR')} kg`;
}

function formatPercentPt(value) {
  return `${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function formatPontosPercentuais(value) {
  const numeric = Number(value || 0);
  const sign = numeric > 0 ? '+' : numeric < 0 ? '-' : '';
  return `${sign}${Math.abs(numeric).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} p.p.`;
}

function humidityColor(value) {
  const numeric = Number(value || 0);
  if (numeric <= UMIDADE_LIMITE) return '#16a34a';
  if (numeric <= UMIDADE_LIMITE + 0.5) return '#d97706';
  return '#dc2626';
}

function bestSupplierSortValue(item, key) {
  const values = {
    rank: item.score,
    name: item.name,
    score: item.score,
    volume: item.kgRecebido,
    divergencia: item.divergenciaPercentualAbs,
    aprovacao: item.taxaAprovacao,
  };
  return values[key] ?? item.score;
}

function scoreBadgeClass(score) {
  const numeric = Number(score || 0);
  if (numeric >= 90) return 'bg-green-600';
  if (numeric >= 80) return 'bg-blue-600';
  return 'bg-amber-600';
}

function label(value) {
  return String(value).replace(/_/g, ' ');
}

function formatGeneric(value) {
  if (value === true) return 'Ativo';
  if (value === false) return 'Inativo';
  return value ?? '-';
}

