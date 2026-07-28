-- ============================================================================
-- AgroFlow | Retirar lancamento do fechamento mensal (Armazenagem M.P.)
-- Arquivo: supabase/armazenagem-fechamento-exclusoes.sql
--
-- OBJETIVO
--   Permitir marcar um recebimento como "fora do fechamento mensal" sem apagar
--   nada: o lancamento continua no sistema, na tela e nos relatorios
--   operacionais, apenas deixa de compor os totais do fechamento.
--
-- ESTRATEGIA (aditiva)
--   Tabela nova e independente. Nada e alterado em recebimentos,
--   armazenagens_materia_prima, portaria_entradas ou fechamentos_armazenagem.
--   A exclusao e por recebimento, porque a linha da Armazenagem pode ainda nao
--   ter registro proprio (cargas pendentes de distribuicao).
--
-- TABELAS AFETADAS
--   public.armazenagem_fechamento_exclusoes  (NOVA)
--
-- RISCO
--   BAIXO. Nenhum dado existente e lido de forma destrutiva, alterado ou
--   apagado. Sem DROP de tabela, coluna ou policy.
--
-- ROLLBACK
--   drop table if exists public.armazenagem_fechamento_exclusoes;
-- ============================================================================

begin;

create table if not exists public.armazenagem_fechamento_exclusoes (
  id uuid primary key default gen_random_uuid(),
  recebimento_id uuid not null unique references public.recebimentos(id) on delete cascade,
  balanca_id uuid references public.balancas(id) on delete set null,
  ativo boolean not null default true,
  motivo text not null,
  excluido_por uuid,
  excluido_por_nome text,
  excluido_em timestamptz not null default now(),
  restaurado_por uuid,
  restaurado_por_nome text,
  restaurado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint armazenagem_exclusao_motivo_check check (btrim(motivo) <> '')
);

create index if not exists armazenagem_exclusoes_balanca_idx
  on public.armazenagem_fechamento_exclusoes (balanca_id);

create index if not exists armazenagem_exclusoes_ativo_idx
  on public.armazenagem_fechamento_exclusoes (ativo) where ativo;

comment on table public.armazenagem_fechamento_exclusoes is
  'Recebimentos retirados do fechamento mensal da Armazenagem M.P. O dado operacional nunca e apagado.';

alter table public.armazenagem_fechamento_exclusoes enable row level security;

-- ----------------------------------------------------------------------------
-- Permissoes: mesma regra do modulo. Ver exige acesso a unidade; alterar exige
-- o nivel Editar na unidade. Validado no banco, nao no navegador.
-- ----------------------------------------------------------------------------
drop policy if exists armazenagem_exclusoes_select on public.armazenagem_fechamento_exclusoes;
create policy armazenagem_exclusoes_select
on public.armazenagem_fechamento_exclusoes
for select to authenticated
using (
  (
    public.agroflow_tem_permissao('balancas', 'visualizar')
    or public.agroflow_tem_permissao('balancas_armazenagem', 'visualizar')
  )
  and public.agroflow_acessa_unidade(balanca_id)
);

drop policy if exists armazenagem_exclusoes_insert on public.armazenagem_fechamento_exclusoes;
create policy armazenagem_exclusoes_insert
on public.armazenagem_fechamento_exclusoes
for insert to authenticated
with check (
  (
    public.agroflow_tem_permissao('balancas', 'editar')
    or public.agroflow_tem_permissao('balancas', 'cancelar')
    or public.agroflow_tem_permissao('balancas_armazenagem', 'editar')
    or public.agroflow_tem_permissao('balancas_armazenagem', 'cancelar')
  )
  and public.agroflow_pode_editar_unidade(balanca_id)
);

drop policy if exists armazenagem_exclusoes_update on public.armazenagem_fechamento_exclusoes;
create policy armazenagem_exclusoes_update
on public.armazenagem_fechamento_exclusoes
for update to authenticated
using (
  (
    public.agroflow_tem_permissao('balancas', 'editar')
    or public.agroflow_tem_permissao('balancas', 'cancelar')
    or public.agroflow_tem_permissao('balancas_armazenagem', 'editar')
    or public.agroflow_tem_permissao('balancas_armazenagem', 'cancelar')
  )
  and public.agroflow_pode_editar_unidade(balanca_id)
)
with check (public.agroflow_pode_editar_unidade(balanca_id));

grant select, insert, update on public.armazenagem_fechamento_exclusoes to authenticated;

-- Auditoria: mesma trigger usada nas demais tabelas do modulo.
drop trigger if exists agroflow_audit_armazenagem_fechamento_exclusoes
  on public.armazenagem_fechamento_exclusoes;
create trigger agroflow_audit_armazenagem_fechamento_exclusoes
  after insert or update or delete on public.armazenagem_fechamento_exclusoes
  for each row execute function public.agroflow_audit_trigger();

commit;

-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- begin;
-- drop trigger if exists agroflow_audit_armazenagem_fechamento_exclusoes on public.armazenagem_fechamento_exclusoes;
-- drop table if exists public.armazenagem_fechamento_exclusoes;
-- commit;
