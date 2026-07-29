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

console.log('Testes do fluxo Portaria/Laboratório/Recebimentos aprovados.');
