-- ============================================================================
-- AgroFlow | Isolamento por unidade (Balancas e Armazens)
-- Arquivo: supabase/unidades-balancas-rls.sql
--
-- OBJETIVO
--   Levar o recorte por unidade (Beberibe, Haisa, Estrela e Iguatu) da camada
--   de aplicacao para o banco, de forma que trocar a URL, o payload ou chamar
--   a API diretamente nao exponha dados de outra unidade.
--
-- ESTRATEGIA (aditiva, nao destrutiva)
--   Nenhuma policy existente e alterada ou removida. O isolamento entra como
--   policies RESTRICTIVE, que o PostgreSQL combina com "AND" as policies atuais.
--   Assim as regras de menu/acao continuam valendo exatamente como hoje e a
--   unidade vira uma condicao adicional.
--
-- TABELAS AFETADAS
--   public.balancas                        (+ coluna codigo)
--   public.permissoes_unidade              (NOVA)
--   public.audit_logs                      (+ coluna balanca_id)
--   public.portaria_entradas               (+ policy restritiva, + trigger)
--   public.recebimentos                    (+ policy restritiva, + trigger)
--   public.recebimento_itens               (+ policy restritiva)
--   public.recebimento_notas_complementares(+ policy restritiva)
--   public.armazenagens_materia_prima      (+ policy restritiva)
--
-- POLICIES CRIADAS (todas novas, prefixo unidade_)
--   unidade_portaria_entradas, unidade_recebimentos, unidade_recebimento_itens,
--   unidade_recebimento_complementos, unidade_armazenagens,
--   permissoes_unidade_admin_*
--
-- FUNCOES CRIADAS/ALTERADAS
--   public.agroflow_acessa_unidade(uuid)          NOVA
--   public.agroflow_unidade_codigo(uuid)          NOVA
--   public.agroflow_forcar_fluxo_sem_laboratorio() NOVA (trigger)
--   public.agroflow_audit_trigger()               ALTERADA (passa a gravar a unidade)
--
-- RISCO
--   MEDIO-BAIXO. Nenhum dado e apagado, renomeado ou movido; nenhum ID muda.
--   O seed inicial libera TODAS as unidades para TODOS os perfis existentes,
--   ou seja, ao aplicar esta migration ninguem perde acesso: o comportamento
--   fica identico ao de hoje ate que o Admin restrinja alguma unidade na tela
--   de Usuarios e permissoes.
--   O ponto de atencao e a substituicao de agroflow_audit_trigger(), que e
--   compartilhada por todas as tabelas auditadas — por isso o corpo original
--   esta reproduzido integralmente no bloco de ROLLBACK no fim do arquivo.
--
-- ROLLBACK
--   Bloco comentado no fim deste arquivo. Remove policies, triggers, funcoes,
--   a tabela nova e as colunas adicionadas, e restaura a versao anterior de
--   agroflow_audit_trigger(). Nao ha perda de dados operacionais.
--
-- PRE-REQUISITOS
--   supabase/rbac-tres-perfis.sql, supabase/balancas-modulo-recebimento.sql,
--   supabase/portaria-balancas.sql e supabase/armazenagem-materia-prima.sql
--   ja aplicados.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) Codigo estavel da unidade
--    Identifica cada balanca sem depender do nome exibido. O vinculo usa a
--    identificacao (CNPJ) ja cadastrada; o nome e apenas o criterio reserva.
--    Os nomes dos registros NAO sao alterados.
-- ----------------------------------------------------------------------------
alter table public.balancas add column if not exists codigo text;

create unique index if not exists balancas_codigo_key
  on public.balancas (codigo)
  where codigo is not null;

with alvo(codigo, cnpj, nome_legado) as (
  values
    ('beberibe', '09524502000196', 'Balança Beberibe da Fabrica'),
    ('haisa',    '09524502001753', 'Balança Haisa Horizonte'),
    ('estrela',  '09524502001320', 'Balança Estrela Horizonte'),
    ('iguatu',   '09524502001400', 'Balança Iguatu')
)
update public.balancas b
set codigo = a.codigo
from alvo a
where b.codigo is null
  and (
    regexp_replace(coalesce(b.identificacao, ''), '\D', '', 'g') = a.cnpj
    or lower(btrim(b.nome)) = lower(a.nome_legado)
  );

-- Interrompe a migration se alguma das quatro unidades nao existir no banco.
do $$
declare
  faltando text;
begin
  select string_agg(c, ', ')
    into faltando
  from unnest(array['beberibe', 'haisa', 'estrela', 'iguatu']) as c
  where not exists (select 1 from public.balancas b where b.codigo = c);

  if faltando is not null then
    raise exception 'Unidades nao encontradas na tabela public.balancas: %. Cadastre-as antes de aplicar esta migration.', faltando;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 2) Quem acessa cada unidade
--    Regra por perfil e, opcionalmente, excecao por usuario (que tem
--    precedencia). A tabela de menus/acoes (permissoes_menu) continua
--    respondendo por "o que pode fazer"; esta responde por "onde pode fazer".
-- ----------------------------------------------------------------------------
create table if not exists public.permissoes_unidade (
  id uuid primary key default gen_random_uuid(),
  perfil text,
  user_id uuid references auth.users(id) on delete cascade,
  balanca_id uuid not null references public.balancas(id) on delete cascade,
  permitido boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint permissoes_unidade_alvo_check check (num_nonnulls(perfil, user_id) = 1),
  constraint permissoes_unidade_perfil_check
    check (perfil is null or perfil in ('admin', 'gestor', 'operador', 'visualizador',
                                        'operador_laboratorio', 'operador_balanca', 'operador_portaria'))
);

create unique index if not exists permissoes_unidade_perfil_key
  on public.permissoes_unidade (perfil, balanca_id) where perfil is not null;

create unique index if not exists permissoes_unidade_user_key
  on public.permissoes_unidade (user_id, balanca_id) where user_id is not null;

create index if not exists permissoes_unidade_balanca_idx
  on public.permissoes_unidade (balanca_id);

-- Seed conservador: mantem o acesso atual de todos os perfis a todas as
-- unidades. Nenhum usuario perde acesso ao aplicar esta migration.
insert into public.permissoes_unidade (perfil, balanca_id, permitido)
select p.perfil, b.id, true
from (values ('admin'), ('gestor'), ('operador'), ('visualizador'),
             ('operador_laboratorio'), ('operador_balanca'), ('operador_portaria')) as p(perfil)
cross join public.balancas b
where b.codigo is not null
on conflict do nothing;

alter table public.permissoes_unidade enable row level security;

drop policy if exists permissoes_unidade_admin_select on public.permissoes_unidade;
drop policy if exists permissoes_unidade_admin_insert on public.permissoes_unidade;
drop policy if exists permissoes_unidade_admin_update on public.permissoes_unidade;
drop policy if exists permissoes_unidade_admin_delete on public.permissoes_unidade;

-- Apenas Admin gerencia unidades por perfil/usuario.
create policy permissoes_unidade_admin_select on public.permissoes_unidade
  for select to authenticated using (public.agroflow_is_admin());
create policy permissoes_unidade_admin_insert on public.permissoes_unidade
  for insert to authenticated with check (public.agroflow_is_admin());
create policy permissoes_unidade_admin_update on public.permissoes_unidade
  for update to authenticated using (public.agroflow_is_admin()) with check (public.agroflow_is_admin());
create policy permissoes_unidade_admin_delete on public.permissoes_unidade
  for delete to authenticated using (public.agroflow_is_admin());

grant select, insert, update, delete on public.permissoes_unidade to authenticated;

-- ----------------------------------------------------------------------------
-- 3) Funcoes de apoio
-- ----------------------------------------------------------------------------
create or replace function public.agroflow_unidade_codigo(p_balanca_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select b.codigo from public.balancas b where b.id = p_balanca_id;
$$;

create or replace function public.agroflow_acessa_unidade(p_balanca_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_balanca_id uuid;
  v_perfil text;
  v_permitido boolean;
begin
  if public.agroflow_is_admin() then
    return true;
  end if;

  -- Lancamentos historicos sem unidade seguem a regra de Beberibe, que e o
  -- modulo legado onde eles sempre apareceram.
  v_balanca_id := coalesce(
    p_balanca_id,
    (select b.id from public.balancas b where b.codigo = 'beberibe' limit 1)
  );

  if v_balanca_id is null then
    return false;
  end if;

  -- Excecao por usuario tem precedencia sobre a regra do perfil.
  select u.permitido into v_permitido
  from public.permissoes_unidade u
  where u.user_id = auth.uid() and u.balanca_id = v_balanca_id;

  if found then
    return coalesce(v_permitido, false);
  end if;

  select p.perfil into v_perfil
  from public.profiles p
  where p.user_id = auth.uid() and p.ativo;

  if v_perfil is null then
    return false;
  end if;

  select u.permitido into v_permitido
  from public.permissoes_unidade u
  where u.perfil = v_perfil and u.balanca_id = v_balanca_id;

  return coalesce(v_permitido, false);
end;
$$;

-- ----------------------------------------------------------------------------
-- 4) Isolamento por unidade (policies RESTRICTIVE)
--    Combinadas com "AND" as policies ja existentes de menu/acao.
-- ----------------------------------------------------------------------------
drop policy if exists unidade_portaria_entradas on public.portaria_entradas;
create policy unidade_portaria_entradas on public.portaria_entradas
  as restrictive for all to authenticated
  using (public.agroflow_acessa_unidade(balanca_id))
  with check (public.agroflow_acessa_unidade(balanca_id));

drop policy if exists unidade_recebimentos on public.recebimentos;
create policy unidade_recebimentos on public.recebimentos
  as restrictive for all to authenticated
  using (public.agroflow_acessa_unidade(balanca_id))
  with check (public.agroflow_acessa_unidade(balanca_id));

drop policy if exists unidade_recebimento_itens on public.recebimento_itens;
create policy unidade_recebimento_itens on public.recebimento_itens
  as restrictive for all to authenticated
  using (exists (
    select 1 from public.recebimentos r
    where r.id = recebimento_id and public.agroflow_acessa_unidade(r.balanca_id)
  ))
  with check (exists (
    select 1 from public.recebimentos r
    where r.id = recebimento_id and public.agroflow_acessa_unidade(r.balanca_id)
  ));

drop policy if exists unidade_recebimento_complementos on public.recebimento_notas_complementares;
create policy unidade_recebimento_complementos on public.recebimento_notas_complementares
  as restrictive for all to authenticated
  using (exists (
    select 1 from public.recebimentos r
    where r.id = recebimento_id and public.agroflow_acessa_unidade(r.balanca_id)
  ))
  with check (exists (
    select 1 from public.recebimentos r
    where r.id = recebimento_id and public.agroflow_acessa_unidade(r.balanca_id)
  ));

-- Armazenagem nao tem coluna propria de unidade: herda do recebimento.
drop policy if exists unidade_armazenagens on public.armazenagens_materia_prima;
create policy unidade_armazenagens on public.armazenagens_materia_prima
  as restrictive for all to authenticated
  using (exists (
    select 1 from public.recebimentos r
    where r.id = recebimento_id and public.agroflow_acessa_unidade(r.balanca_id)
  ))
  with check (exists (
    select 1 from public.recebimentos r
    where r.id = recebimento_id and public.agroflow_acessa_unidade(r.balanca_id)
  ));

-- ----------------------------------------------------------------------------
-- 5) Iguatu nao possui laboratorio
--    Garante no banco que o recebimento de Iguatu nunca dependa de aprovacao
--    laboratorial. O fluxo das demais unidades continua inalterado.
-- ----------------------------------------------------------------------------
create or replace function public.agroflow_forcar_fluxo_sem_laboratorio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.balanca_id is null then
    return new;
  end if;

  if public.agroflow_unidade_codigo(new.balanca_id) <> 'iguatu' then
    return new;
  end if;

  new.dispensa_laboratorio := true;

  if tg_table_name = 'recebimentos' and new.laboratorio_id is not null then
    raise exception 'O Armazém Iguatu não possui laboratório. Remova o vínculo de laboratório deste recebimento.';
  end if;

  return new;
end;
$$;

drop trigger if exists agroflow_iguatu_sem_laboratorio on public.portaria_entradas;
create trigger agroflow_iguatu_sem_laboratorio
  before insert or update on public.portaria_entradas
  for each row execute function public.agroflow_forcar_fluxo_sem_laboratorio();

drop trigger if exists agroflow_iguatu_sem_laboratorio on public.recebimentos;
create trigger agroflow_iguatu_sem_laboratorio
  before insert or update on public.recebimentos
  for each row execute function public.agroflow_forcar_fluxo_sem_laboratorio();

-- ----------------------------------------------------------------------------
-- 6) Auditoria com a unidade
--    Mesma logica de antes, apenas gravando tambem a balanca do registro.
-- ----------------------------------------------------------------------------
alter table public.audit_logs add column if not exists balanca_id uuid;

create index if not exists audit_logs_balanca_idx on public.audit_logs (balanca_id);

create or replace function public.agroflow_audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balanca text;
begin
  v_balanca := coalesce(to_jsonb(new)->>'balanca_id', to_jsonb(old)->>'balanca_id');

  insert into public.audit_logs (
    user_id, perfil, acao, tabela, registro_id, dados_anteriores, dados_novos, balanca_id
  )
  values (
    auth.uid(),
    (select p.perfil from public.profiles p where p.user_id = auth.uid()),
    case tg_op when 'INSERT' then 'cadastrar' when 'UPDATE' then 'editar' else 'excluir' end,
    tg_table_name,
    coalesce((to_jsonb(new)->>'id'), (to_jsonb(old)->>'id')),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
    nullif(v_balanca, '')::uuid
  );
  return coalesce(new, old);
end;
$$;

commit;

-- ============================================================================
-- ROLLBACK (executar somente se for necessario desfazer)
-- ============================================================================
-- begin;
--
-- drop policy if exists unidade_portaria_entradas on public.portaria_entradas;
-- drop policy if exists unidade_recebimentos on public.recebimentos;
-- drop policy if exists unidade_recebimento_itens on public.recebimento_itens;
-- drop policy if exists unidade_recebimento_complementos on public.recebimento_notas_complementares;
-- drop policy if exists unidade_armazenagens on public.armazenagens_materia_prima;
--
-- drop trigger if exists agroflow_iguatu_sem_laboratorio on public.portaria_entradas;
-- drop trigger if exists agroflow_iguatu_sem_laboratorio on public.recebimentos;
-- drop function if exists public.agroflow_forcar_fluxo_sem_laboratorio();
--
-- drop policy if exists permissoes_unidade_admin_select on public.permissoes_unidade;
-- drop policy if exists permissoes_unidade_admin_insert on public.permissoes_unidade;
-- drop policy if exists permissoes_unidade_admin_update on public.permissoes_unidade;
-- drop policy if exists permissoes_unidade_admin_delete on public.permissoes_unidade;
-- drop table if exists public.permissoes_unidade;
--
-- drop function if exists public.agroflow_acessa_unidade(uuid);
-- drop function if exists public.agroflow_unidade_codigo(uuid);
--
-- -- Restaura a versao anterior do gatilho de auditoria.
-- create or replace function public.agroflow_audit_trigger()
-- returns trigger
-- language plpgsql
-- security definer
-- set search_path = public
-- as $rollback$
-- begin
--   insert into public.audit_logs (
--     user_id, perfil, acao, tabela, registro_id, dados_anteriores, dados_novos
--   )
--   values (
--     auth.uid(),
--     (select p.perfil from public.profiles p where p.user_id = auth.uid()),
--     case tg_op when 'INSERT' then 'cadastrar' when 'UPDATE' then 'editar' else 'excluir' end,
--     tg_table_name,
--     coalesce((to_jsonb(new)->>'id'), (to_jsonb(old)->>'id')),
--     case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
--     case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
--   );
--   return coalesce(new, old);
-- end;
-- $rollback$;
--
-- -- As colunas abaixo sao aditivas e podem ser mantidas sem efeito colateral.
-- -- alter table public.audit_logs drop column if exists balanca_id;
-- -- drop index if exists public.balancas_codigo_key;
-- -- alter table public.balancas drop column if exists codigo;
--
-- commit;
