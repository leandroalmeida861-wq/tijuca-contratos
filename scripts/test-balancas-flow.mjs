import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  hasRecebimentoFinalizationData,
  isDiretoPendenteBalanca,
  isLaboratorioPendenteBalanca,
  isRecebimentoFinalizadoBalanca,
  isRecebimentoPendenteBalanca,
} from '../src/lib/balancasFlow.js';

const complete = {
  status: 'aprovada',
  balanca_id: 'balanca-1',
  nf_numero: '006',
  fornecedor_id: 'fornecedor-1',
  veiculo_id: 'veiculo-1',
  produto_id: 'produto-1',
  peso_bruto: 52000,
  tara: 20000,
};

const directPending = {
  ...complete,
  status: 'pendente',
  dispensa_laboratorio: true,
  portaria: { data_entrada: '2026-07-15', hora_entrada: '08:00:00', dispensa_laboratorio: true },
};

assert.equal(hasRecebimentoFinalizationData(complete), true, 'Dados completos devem permitir finalizar');
assert.equal(isDiretoPendenteBalanca(directPending), true, 'Carga direta pendente deve entrar na fila superior');
assert.equal(isRecebimentoPendenteBalanca(directPending), true, 'Fila geral deve incluir carga direta');
assert.equal(isRecebimentoFinalizadoBalanca({ ...directPending, status: 'aprovada' }), true, 'Carga direta aprovada e completa deve finalizar');
assert.equal(isDiretoPendenteBalanca({ ...directPending, status: 'aprovada' }), false, 'Carga finalizada deve sair da fila direta');

const labPending = {
  ...complete,
  peso_bruto: 0,
  tara: 0,
  dispensa_laboratorio: false,
};
assert.equal(isLaboratorioPendenteBalanca(labPending), true, 'Aprovação laboratorial incompleta deve aguardar balança');
assert.equal(isRecebimentoFinalizadoBalanca(labPending), false, 'Aprovação do laboratório não é finalização da balança');
assert.equal(isLaboratorioPendenteBalanca({ ...complete, dispensa_laboratorio: false }), false, 'Carga completa deve sair da fila laboratorial');

const page = await readFile(new URL('../src/pages/BalancasPage.jsx', import.meta.url), 'utf8');
const service = await readFile(new URL('../src/services/balancasService.js', import.meta.url), 'utf8');
const migration = await readFile(new URL('../supabase/portaria-dispensa-laboratorio.sql', import.meta.url), 'utf8');
const unitMigration = await readFile(new URL('../supabase/portaria-exigir-unidade.sql', import.meta.url), 'utf8');
const iguatuTriggerMigration = await readFile(new URL('../supabase/portaria-corrigir-trigger-iguatu.sql', import.meta.url), 'utf8');
const rlsUnitMigration = await readFile(new URL('../supabase/portaria-corrigir-rls-unidade.sql', import.meta.url), 'utf8');
const atomicFlowMigration = await readFile(new URL('../supabase/portaria-corrigir-fluxo-atomico.sql', import.meta.url), 'utf8');
const strictDuplicateMigration = await readFile(new URL('../supabase/recebimentos-bloquear-nf-fornecedor-unidade.sql', import.meta.url), 'utf8');
const automaticLabMigration = await readFile(new URL('../supabase/portaria-envio-automatico-laboratorio.sql', import.meta.url), 'utf8');
const synchronizedPortariaMigration = await readFile(new URL('../supabase/portaria-sincronizar-edicao-exclusao.sql', import.meta.url), 'utf8');
const portariaLookupPermissionsMigration = await readFile(new URL('../supabase/portaria-permitir-cadastro-veiculos-motoristas.sql', import.meta.url), 'utf8');
const dashboardDecisionMigration = await readFile(new URL('../supabase/dashboard-nao-complementar-fornecedor.sql', import.meta.url), 'utf8');
const linkedInvoicesMigration = await readFile(new URL('../supabase/recebimentos-validar-notas-vinculadas.sql', import.meta.url), 'utf8');

assert.ok(
  page.includes("const canSendToLab = can('balancas', 'aprovar') || canCreate"),
  'Envio ao laboratorio deve respeitar a permissao de aprovacao da Portaria',
);
assert.ok(
  page.includes("row.status !== 'AGUARDANDO_LABORATORIO'"),
  'Entrada ja encaminhada nao pode ser enviada novamente ao laboratorio',
);
assert.ok(
  (page.match(/balanca_id: unidadeId/g) || []).length >= 4,
  'Todas as transicoes da Portaria devem enviar a unidade resolvida pela rota',
);
assert.ok(
  page.includes("if (existing.balanca_id !== unidadeId) throw new Error('UNIDADE_DIVERGENTE')"),
  'Reenvio nao pode reutilizar recebimento de outra unidade',
);
assert.ok(
  /await updatePortariaEntrada\(row\.id,\s*\{\s*balanca_id: unidadeId,/.test(page),
  'Mudanca de status da Portaria deve manter o balanca_id',
);
assert.ok(
  /\.eq\('id', id\)\s*\.eq\('balanca_id', balancaId\)/.test(service),
  'Updates devem ser limitados simultaneamente pelo registro e pela unidade',
);
assert.ok(
  service.includes('Nao foi possivel identificar a unidade desta Portaria.'),
  'Erro tecnico de unidade deve ser traduzido para uma mensagem clara',
);
assert.ok(
  unitMigration.includes('check (balanca_id is not null) not valid'),
  'Banco deve bloquear novos lancamentos sem unidade sem alterar o legado',
);
assert.ok(
  !unitMigration.includes('delete from')
    && !unitMigration.includes('truncate')
    && !unitMigration.includes('update public.'),
  'Migration de unidade obrigatoria nao pode alterar ou excluir dados',
);
assert.ok(
  iguatuTriggerMigration.includes("to_jsonb(new)->>'laboratorio_id'"),
  'Trigger compartilhado deve consultar laboratorio_id sem quebrar a Portaria de Iguatu',
);
assert.ok(
  iguatuTriggerMigration.includes("public.agroflow_unidade_codigo(new.balanca_id) <> 'iguatu'"),
  'Correcao deve preservar a regra existente de Iguatu sem laboratorio',
);
assert.ok(
  (rlsUnitMigration.match(/as restrictive/g) || []).length === 2,
  'RLS deve exigir permissao de menu e permissao da unidade em Portaria e Recebimentos',
);
assert.ok(
  rlsUnitMigration.includes('unidade_portaria_entradas')
    && rlsUnitMigration.includes('unidade_recebimentos'),
  'RLS restritiva deve proteger as duas tabelas do fluxo da Portaria',
);
assert.ok(
  page.includes('Enviar para Laborat'),
  'Visualizacao da entrada deve oferecer a acao de envio ao laboratorio',
);
assert.ok(page.includes('sendingToLabId'), 'Envio deve bloquear cliques simultaneos na mesma entrada');
assert.ok(
  page.includes('nf_serie: row.serie_nf'),
  'Recebimento originado na Portaria deve preservar a serie da NF',
);
assert.ok(
  page.includes('balanca_id: payload.balanca_id'),
  'Validacao remota de duplicidade deve receber a unidade da rota',
);
assert.ok(
  service.includes(".eq('balanca_id', balancaId)"),
  'Consulta de duplicidade deve ser filtrada no banco pela unidade',
);
assert.ok(
  !service.includes('normalize(row.nf_serie) !== nfSerie'),
  'Consulta de duplicidade nao pode permitir outra serie para a mesma NF e fornecedor',
);
assert.ok(
  service.includes('portaria_id.is.null,portaria_id.neq.'),
  'Consulta de duplicidade deve ignorar o registro da propria Portaria',
);
assert.ok(
  !service.includes("delete fallbackPayload.portaria_id"),
  'Falha de schema nao pode remover silenciosamente o vinculo idempotente da Portaria',
);
assert.ok(
  atomicFlowMigration.includes('private.agroflow_criar_recebimento_da_portaria'),
  'Banco deve criar o recebimento na mesma transacao da Portaria',
);
assert.ok(
  atomicFlowMigration.includes("new.status := 'ENVIADO_RECEBIMENTO'"),
  'Backend deve direcionar a entrada marcada diretamente ao recebimento',
);
assert.ok(
  atomicFlowMigration.includes("new.status := 'AGUARDANDO_LABORATORIO'"),
  'Backend deve manter o fluxo laboratorial quando a opcao estiver desmarcada',
);
assert.ok(
  atomicFlowMigration.includes('r.portaria_id = new.id')
    && atomicFlowMigration.includes('r.balanca_id is distinct from new.balanca_id'),
  'Idempotencia deve usar portaria_id e rejeitar vinculo de outra unidade',
);
assert.ok(
  atomicFlowMigration.includes('r.id is distinct from new.id')
    && atomicFlowMigration.includes('r.portaria_id is distinct from new.portaria_id'),
  'Validacao deve ignorar o proprio recebimento e a propria origem',
);
assert.ok(
  atomicFlowMigration.includes('r.balanca_id = new.balanca_id')
    && atomicFlowMigration.includes('agroflow_nf_serie_normalizada(r.nf_serie) = new_serie'),
  'Migration anterior deve permanecer preservada no historico',
);
assert.ok(
  atomicFlowMigration.includes('on conflict (recebimento_id, ordem) do nothing'),
  'Item inicial do recebimento deve ser criado de forma idempotente',
);
assert.ok(
  !/\bdelete\s+from\b/i.test(atomicFlowMigration)
    && !/\btruncate\b/i.test(atomicFlowMigration),
  'Migration atomica nao pode excluir dados existentes',
);
assert.ok(
  strictDuplicateMigration.includes('portaria_nf_fornecedor_unidade_unica')
    && /balanca_id,\s*fornecedor_id,\s*public\.agroflow_nf_numero_normalizado\(numero_nf\)/.test(strictDuplicateMigration),
  'Portaria deve possuir chave unica por unidade, fornecedor e numero da NF',
);
assert.ok(
  strictDuplicateMigration.includes('recebimentos_fornecedor_nf_unica_idx')
    && strictDuplicateMigration.includes('public.agroflow_nf_numero_normalizado(nf_numero)'),
  'Recebimentos deve possuir chave unica por unidade, fornecedor e numero da NF',
);
assert.ok(
  !strictDuplicateMigration.includes('new_serie')
    && !strictDuplicateMigration.includes('agroflow_nf_serie_normalizada(r.nf_serie)'),
  'Protecao atual nao pode considerar a serie como permissao para duplicar a NF',
);
assert.ok(
  !/\bdelete\s+from\b/i.test(strictDuplicateMigration)
    && !/\btruncate\b/i.test(strictDuplicateMigration)
    && !/\bupdate\s+public\./i.test(strictDuplicateMigration),
  'Migration de bloqueio nao pode alterar nem excluir dados existentes',
);
assert.ok(
  !page.includes('normalizeName(row.serie_nf) === normalizeName(form.serie_nf)'),
  'Validacao local da Portaria deve bloquear a mesma NF mesmo com serie diferente',
);
assert.ok(
  /elsif tg_op = 'INSERT' then\s*new\.status := 'ENVIADO_LABORATORIO'/.test(automaticLabMigration),
  'Nova entrada sem dispensa deve ser enviada ao laboratorio na mesma transacao',
);
assert.ok(
  automaticLabMigration.includes("new.status := 'ENVIADO_RECEBIMENTO'"),
  'Fluxo automatico deve preservar o envio direto quando houver dispensa de laboratorio',
);
assert.ok(
  !/\bdelete\s+from\b/i.test(automaticLabMigration)
    && !/\btruncate\b/i.test(automaticLabMigration)
    && !/\bupdate\s+public\./i.test(automaticLabMigration),
  'Migration de envio automatico nao pode alterar nem excluir registros existentes',
);
assert.ok(
  page.includes('Entrada salva e enviada automaticamente para Aprovação Laboratório.'),
  'Operador deve receber confirmacao clara do envio automatico ao salvar',
);
assert.ok(
  service.indexOf("String(error?.code || '') === '23505'") < service.indexOf('const requestError = classifyRequestError(error)'),
  'Erro de NF duplicada deve ser traduzido antes da classificacao generica de servidor',
);
assert.ok(
  /deletePortariaEntrada\(id, balancaId\)/.test(service)
    && /\.eq\('id', id\)\s*\.eq\('balanca_id', unidadeId\)/.test(service),
  'Exclusao da Portaria deve exigir simultaneamente o registro e a unidade',
);
assert.ok(
  synchronizedPortariaMigration.includes('new.dispensa_laboratorio = false then')
    && synchronizedPortariaMigration.includes("status = case")
    && synchronizedPortariaMigration.includes("then 'pendente'"),
  'Retorno de entrada direta deve recolocar o mesmo recebimento no laboratorio',
);
assert.ok(
  synchronizedPortariaMigration.includes('where r.portaria_id = old.id')
    && synchronizedPortariaMigration.includes('and r.balanca_id = old.balanca_id'),
  'Exclusao sincronizada deve atingir somente o recebimento vinculado da mesma unidade',
);
assert.ok(
  synchronizedPortariaMigration.includes('RECEBIMENTO_JA_ARMAZENADO'),
  'Edicao e exclusao devem preservar recebimentos ja utilizados na Armazenagem',
);
assert.ok(
  page.includes('Entrada atualizada e enviada novamente para Aprovação Laboratório.'),
  'Portaria deve confirmar claramente o retorno ao laboratorio',
);
assert.ok(
  /veiculos:\s*\{[\s\S]*?permissionMenu:\s*'balancas_portaria'/.test(service)
    && /motoristas:\s*\{[\s\S]*?permissionMenu:\s*'balancas_portaria'/.test(service),
  'Veiculos e motoristas devem usar as permissoes especificas da Portaria',
);
assert.ok(
  page.includes("const permissionMenu = config.permissionMenu || 'balancas'")
    && page.includes("can(permissionMenu, editing ? 'editar' : 'cadastrar')")
    && page.includes("can(permissionMenu, 'editar')")
    && page.includes("can(permissionMenu, 'excluir')"),
  'Cadastro compartilhado deve respeitar o menu configurado em todas as acoes',
);
assert.ok(
  portariaLookupPermissionsMigration.includes("agroflow_tem_permissao('balancas_portaria', 'cadastrar')")
    && portariaLookupPermissionsMigration.includes('on public.recebimento_veiculos')
    && portariaLookupPermissionsMigration.includes('on public.recebimento_motoristas'),
  'RLS deve permitir os dois cadastros somente conforme a permissao da Portaria',
);
assert.ok(
  !/\b(insert|update|delete)\s+(into|public\.|from)\s+public\.recebimento_(veiculos|motoristas)/i.test(portariaLookupPermissionsMigration),
  'Migration de permissoes nao pode alterar cadastros existentes',
);

assert.ok(page.includes('const shouldFinalizePending = Boolean('), 'Salvamento deve concluir qualquer pendencia de balanca valida');
assert.ok(
  page.includes('(isLaboratorioPendenteBalanca(row) || isDiretoPendenteBalanca(row))'),
  'Finalizacao deve contemplar cargas vindas do laboratorio e cargas diretas',
);
assert.ok(
  page.includes("status: 'aprovada', dispensa_laboratorio: hasDispensaLaboratorio(row)"),
  'Finalizacao deve preservar a origem laboratorial ou direta do recebimento',
);
assert.ok(page.includes("'Peso bruto KG maior que zero'"), 'Peso bruto zerado nao pode produzir falso sucesso');
assert.ok(page.includes("'Tara KG maior que zero'"), 'Tara zerada nao pode produzir falso sucesso');
assert.ok(page.includes("item?.afeta_peso !== false"), 'Complemento financeiro nao deve alterar a diferenca de peso');
assert.ok(service.includes('afeta_peso,'), 'Consulta deve carregar o marcador de peso do complemento');
assert.ok(
  page.includes('|| isDiretoPendenteBalanca(row);'),
  'Carga direta pendente deve reutilizar a importação XML do formulário de recebimento',
);
assert.ok(page.includes('sortPendingScaleRows'), 'Pendências devem usar ordenação operacional crescente');
assert.ok(page.toUpperCase().includes('DIRETO PARA RECEBIMENTOS - PENDENTE FINALIZAR RECEBIMENTO'), 'Fila direta deve ter identificação própria');
assert.ok(page.includes("return 'Recebimento finalizado'"), 'Status final deve ter texto próprio e prioritário');
assert.ok(migration.includes("'RECEBIMENTO_FINALIZADO'"), 'Portaria deve persistir o status final');
assert.ok(migration.includes('recebimentos_sincronizar_portaria_finalizada'), 'Trigger deve sincronizar o vínculo na mesma transação');
assert.ok(migration.includes('where id = new.portaria_id'), 'Sincronização deve usar exclusivamente portaria_id');
assert.ok(!migration.includes('where numero_nf ='), 'NF não pode identificar a Portaria a atualizar');

assert.ok(
  page.includes('current.diferencaKg = current.kgRecebido - current.kgNota;'),
  'Dashboard deve calcular diferenca como peso da balanca menos peso da nota',
);
assert.ok(
  page.includes('.filter((item) => Math.abs(Number(item.diferencaKg || 0)) > Number.EPSILON)'),
  'Dashboard nao deve exibir diferencas zeradas',
);
assert.ok(
  page.includes('.sort((a, b) => Math.abs(b.diferencaKg) - Math.abs(a.diferencaKg))'),
  'Dashboard deve ordenar diferencas pelo maior valor absoluto',
);
assert.ok(
  page.includes('percent: totalKg ? (item.kgTotal / totalKg) * 100 : 0'),
  'Distribuicao por produtos deve calcular percentual pelo peso real em kg',
);
assert.ok(
  page.includes('{formatDashboardKg(kgTotal)} ({formatPercentPt(productPercent)})')
    && !page.includes('formatPercentPt(percent * 100)'),
  'Rotulo externo nao pode multiplicar novamente percentual ja calculado',
);
assert.ok(
  page.includes('Balança maior — complementar fornecedor')
    && page.includes('Nota maior que balança')
    && page.includes('Diferenças de 0 kg não são exibidas.'),
  'Grafico de diferencas deve apresentar a legenda operacional completa',
);
assert.ok(
  page.includes('Complementar nota')
    && page.includes('Não complementar')
    && page.includes('Revisar nota'),
  'Grafico de diferencas deve exibir as opcoes solicitadas',
);
assert.ok(
  page.includes("['admin', 'gestor'].includes(profile) && podeEditarNaUnidade"),
  'Somente Admin e Gestor com edicao na unidade devem receber a acao Nao complementar',
);
assert.ok(
  page.includes('await marcarNaoComplementarFornecedor({')
    && page.includes('recebimentoIds: item.recebimentoIds'),
  'Nao complementar deve persistir a decisao dos recebimentos do fornecedor',
);
assert.ok(
  page.includes('if (hasNoComplementDecision(row)) return;'),
  'Recebimentos marcados como Nao complementar devem sair do grafico',
);
assert.ok(
  page.includes('function DailyReceivedVolumeChart({ data })')
    && page.includes('function buildDailyReceivedVolume(rows)'),
  'Dashboard deve preencher o espaco com o grafico de volume recebido por dia',
);
assert.ok(
  service.includes("supabase.rpc('agroflow_marcar_nao_complementar'")
    && service.includes('p_balanca_id: unidadeId')
    && service.includes('p_recebimento_ids: ids'),
  'Servico deve delegar a decisao ao backend com unidade e recebimentos validados',
);
assert.ok(
  dashboardDecisionMigration.includes("not in ('admin', 'gestor')")
    && dashboardDecisionMigration.includes('public.agroflow_pode_editar_unidade(p_balanca_id)')
    && dashboardDecisionMigration.includes('r.balanca_id = p_balanca_id')
    && dashboardDecisionMigration.includes("r.status = 'aprovada'"),
  'Backend deve restringir a decisao a Admin/Gestor, unidade autorizada e recebimentos finalizados',
);
assert.ok(
  dashboardDecisionMigration.includes("raise exception 'DIFERENCA_NAO_POSITIVA'")
    && dashboardDecisionMigration.includes("'nao_complementar_fornecedor'")
    && dashboardDecisionMigration.includes('insert into public.audit_logs'),
  'Backend deve validar diferenca positiva e auditar a decisao',
);
assert.ok(
  page.includes("'Qtd. produto', 'Unid.'")
    && page.includes("['Qtd.', 42]")
    && page.includes("reportQuantity(row),")
    && page.includes("reportUnit(row),"),
  'Tabela e PDF devem exibir a quantidade e a unidade do produto de cada nota',
);
assert.ok(
  page.includes('function buildRecebimentoReportRows(rows, mode)')
    && page.includes('return rows.map((row) => ({')
    && !page.includes('return [...principais, ...complementos]')
    && !page.includes("tipo_nota_relatorio: `Complemento da NF"),
  'Relatorio deve produzir uma unica linha por recebimento fisico, inclusive no modo detalhado',
);
assert.ok(
  page.includes("nf_complementar_relatorio: (row.complementos || []).map((item) => item.numero_nf)")
    && page.includes('valor_complemento_relatorio: complementosTotal(row.complementos)')
    && page.includes('valor_agregado_relatorio: valorTotalAgregado(row)'),
  'Complementos devem permanecer vinculados na linha principal e somar somente seu valor',
);
assert.ok(
  page.includes("'Placa', 'Peso chegada', 'Peso nota'")
    && page.includes("['Placa', 38]")
    && page.includes("['Chegada', 45]")
    && page.includes("['Peso NF', 45]")
    && page.includes('peso_chegada_relatorio: Number(row.peso_liquido || 0)')
    && page.includes('peso_nota_relatorio: pesoNotaAgregado(row)'),
  'Tela e PDF devem exibir placa, peso de chegada e peso da nota sem repetir a carga',
);
assert.ok(
  page.includes('`Placa: ${placaVeiculo(row)')
    && page.includes('`Peso da nota: ${kg(pesoNotaAgregado(row))}`')
    && page.includes('`Peso de chegada: ${kg(row.peso_liquido)}`')
    && service.includes("Observacao: row.observacao_complementar_relatorio || ''"),
  'Observacao da tela, CSV, Excel e PDF deve repetir placa, peso da nota e peso de chegada',
);
assert.ok(
  service.includes("totalRow[11] = totals.chegada")
    && service.includes("totalRow[12] = totals.nota")
    && service.includes("totalRow[18] = totals.agregado"),
  'CSV deve totalizar os mesmos pesos e valor agregado da tela e do PDF',
);
assert.ok(
  page.includes('exportRecebimentosExcel(displayRows)')
    && service.includes('export function exportRecebimentosExcel(rows')
    && service.includes("XLSX.utils.book_append_sheet(workbook, worksheet, 'Recebimentos')")
    && service.includes("'Total agregado': totals.agregado"),
  'Excel deve usar as linhas consolidadas e os mesmos totais da tela, CSV e PDF',
);
assert.ok(
  page.includes('if (difference > 0) doc.setTextColor(29, 78, 216);')
    && page.includes('else if (difference < 0) doc.setTextColor(190, 18, 60);')
    && page.includes("if (numeric > 0) return 'font-extrabold text-blue-700';")
    && page.includes("if (numeric < 0) return 'font-extrabold text-rose-700';"),
  'Diferenca deve ficar azul quando positiva e vermelha quando negativa na tela e no PDF',
);
assert.ok(
  linkedInvoicesMigration.includes('recebimento_complementos_recebimento_nf_serie_unica')
    && linkedInvoicesMigration.includes('public.agroflow_nf_numero_normalizado(numero_nf)')
    && linkedInvoicesMigration.includes('public.agroflow_nf_serie_normalizada(serie)'),
  'Banco deve impedir repeticao da mesma NF complementar no recebimento por numero e serie',
);
assert.ok(
  linkedInvoicesMigration.includes('private.agroflow_validar_nota_complementar_vinculada')
    && linkedInvoicesMigration.includes('r.balanca_id = recebimento_pai.balanca_id')
    && linkedInvoicesMigration.includes('c.id is distinct from new.id')
    && linkedInvoicesMigration.includes('coalesce(c.fornecedor_id, r.fornecedor_id) = fornecedor_nota'),
  'Trigger deve validar unidade e fornecedor sem acusar o proprio complemento durante edicao',
);
assert.ok(
  linkedInvoicesMigration.includes('r.balanca_id = new.balanca_id')
    && linkedInvoicesMigration.includes('public.agroflow_nf_serie_normalizada(c.serie) = new_serie')
    && linkedInvoicesMigration.includes('new.nf_chave_acesso')
    && linkedInvoicesMigration.includes('new.chave_nfe'),
  'NF principal e complementar devem validar unidade, numero, serie e chave no backend',
);
assert.ok(
  linkedInvoicesMigration.includes("raise exception 'NOTA_FISCAL_JA_VINCULADA'")
    && service.includes('recebimentos_fornecedor_nf_unica_idx')
    && service.includes('Esta nota fiscal já está vinculada a um recebimento nesta unidade. Revise o lançamento existente.'),
  'Duplicidade deve produzir a mensagem clara solicitada',
);
assert.ok(
  !/\bdelete\s+from\b/i.test(linkedInvoicesMigration)
    && !/\btruncate\b/i.test(linkedInvoicesMigration)
    && !/\bupdate\s+public\./i.test(linkedInvoicesMigration),
  'Migration de duplicidade nao pode alterar nem excluir dados existentes',
);

console.log('Testes do fluxo Portaria/Laboratório/Recebimentos aprovados.');
