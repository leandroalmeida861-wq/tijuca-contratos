-- ============================================================================
-- AgroFlow | Acesso por unidade em dois niveis: Visualizar e Editar
-- Arquivo: supabase/acessos-unidade-visualizar-editar.sql
--
-- OBJETIVO
--   Hoje o acesso a uma unidade e um sim/nao (permissoes_unidade.permitido).
--   Esta migration acrescenta o nivel "Editar", para que um usuario possa
--   consultar dados e relatorios de uma unidade sem poder cadastrar, editar,
--   excluir, cancelar ou aprovar nela.
--
-- ESTRATEGIA (aditiva e incremental)
--   - permissoes_unidade.permitido passa a significar "Visualizar".
--   - Nova coluna permissoes_unidade.editar significa "Editar".
--   - As policies RESTRICTIVE ja existentes (leitura por unidade) NAO sao
--     alteradas. Entram policies novas, so para INSERT/UPDATE/DELETE.
--   - Nenhum registro e apagado.
--
-- COMPATIBILIDADE
--   No primeiro apply, editar recebe o valor de permitido. Ou seja: quem hoje
--   consegue editar continua conseguindo, e nada muda de comportamento ate o
--   Admin restringir alguem pela tela. O backfill roda UMA UNICA VEZ (so quando
--   a coluna ainda nao existe), entao reexecutar o arquivo nao desfaz nenhuma
--   restricao configurada depois.
--
-- TABELAS AFETADAS
--   public.permissoes_unidade                (+ coluna editar)
--   public.portaria_entradas                 (+ 3 policies de escrita)
--   public.recebimentos                      (+ 3 policies de escrita)
--   public.recebimento_itens                 (+ 3 policies de escrita)
--   public.recebimento_notas_complementares  (+ 3 policies de escrita)
--   public.armazenagens_materia_prima        (+ 3 policies de escrita)
--
-- FUNCOES
--   public.agroflow_pode_editar_unidade(uuid)          NOVA
--   public.agroflow_salvar_acessos_unidade(uuid,jsonb) ATUALIZADA (aceita editar)
--   public.agroflow_acessa_unidade(uuid)               INALTERADA
--
-- RISCO
--   BAIXO. Sem DROP de tabela, coluna ou dado. As policies criadas tem nome
--   proprio (prefixo unidade_escrita_) e nao colidem com as existentes.
--
-- ROLLBACK
--   Bloco comentado no fim do arquivo.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) Coluna "editar" + backfill unico preservando o comportamento atual
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'permissoes_unidade'
      and column_name = 'editar'
  ) then
    alter table public.permissoes_unidade add column editar boolean not null default false;

    -- Primeiro apply: quem ja tinha acesso mantem o poder de editar.
    update public.permissoes_unidade set editar = permitido;
  end if;
end $$;

comment on column public.permissoes_unidade.permitido is 'Visualizar a unidade (ver menu, abrir rota e consultar dados).';
comment on column public.permissoes_unidade.editar is 'Editar na unidade (cadastrar, editar, excluir, cancelar e aprovar).';

-- ----------------------------------------------------------------------------
-- 2) Quem pode editar em cada unidade
--    Mesma precedencia de agroflow_acessa_unidade(): Admin ve tudo; a excecao
--    por usuario vence a regra do perfil; sem regra, nao ha permissao.
-- ----------------------------------------------------------------------------
create or replace function public.agroflow_pode_editar_unidade(p_balanca_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_balanca_id uuid;
  v_perfil text;
  v_editar boolean;
begin
  if public.agroflow_is_admin() then
    return true;
  end if;

  -- Lancamentos historicos sem unidade seguem a regra de Beberibe.
  v_balanca_id := coalesce(
    p_balanca_id,
    (select b.id from public.balancas b where b.codigo = 'beberibe' limit 1)
  );

  if v_balanca_id is null then
    return false;
  end if;

  select u.editar into v_editar
  from public.permissoes_unidade u
  where u.user_id = auth.uid() and u.balanca_id = v_balanca_id;

  if found then
    return coalesce(v_editar, false);
  end if;

  select p.perfil into v_perfil
  from public.profiles p
  where p.user_id = auth.uid() and p.ativo;

  if v_perfil is null then
    return false;
  end if;

  select u.editar into v_editar
  from public.permissoes_unidade u
  where u.perfil = v_perfil and u.balanca_id = v_balanca_id;

  return coalesce(v_editar, false);
end;
$$;

-- ----------------------------------------------------------------------------
-- 3) Policies de escrita por unidade
--    Precisam ser separadas por comando: uma policy RESTRICTIVE "for all"
--    usaria o USING tambem no SELECT e bloquearia a leitura de quem so
--    visualiza. INSERT usa WITH CHECK, DELETE usa USING, UPDATE usa os dois.
-- ----------------------------------------------------------------------------
do $$
declare
  alvo record;
  nome text;
begin
  for alvo in
    select *
    from (values
      -- tabelas com balanca_id proprio
      ('portaria_entradas', 'public.agroflow_pode_editar_unidade(balanca_id)'),
      ('recebimentos',      'public.agroflow_pode_editar_unidade(balanca_id)'),
      -- tabelas que herdam a unidade do recebimento vinculado
      ('recebimento_itens',
       'exists (select 1 from public.recebimentos r where r.id = recebimento_id and public.agroflow_pode_editar_unidade(r.balanca_id))'),
      ('recebimento_notas_complementares',
       'exists (select 1 from public.recebimentos r where r.id = recebimento_id and public.agroflow_pode_editar_unidade(r.balanca_id))'),
      ('armazenagens_materia_prima',
       'exists (select 1 from public.recebimentos r where r.id = recebimento_id and public.agroflow_pode_editar_unidade(r.balanca_id))')
    ) as t(tabela, expressao)
  loop
    nome := 'unidade_escrita_insert_' || alvo.tabela;
    execute format('drop policy if exists %I on public.%I', nome, alvo.tabela);
    execute format(
      'create policy %I on public.%I as restrictive for insert to authenticated with check (%s)',
      nome, alvo.tabela, alvo.expressao
    );

    nome := 'unidade_escrita_update_' || alvo.tabela;
    execute format('drop policy if exists %I on public.%I', nome, alvo.tabela);
    execute format(
      'create policy %I on public.%I as restrictive for update to authenticated using (%s) with check (%s)',
      nome, alvo.tabela, alvo.expressao, alvo.expressao
    );

    nome := 'unidade_escrita_delete_' || alvo.tabela;
    execute format('drop policy if exists %I on public.%I', nome, alvo.tabela);
    execute format(
      'create policy %I on public.%I as restrictive for delete to authenticated using (%s)',
      nome, alvo.tabela, alvo.expressao
    );
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 4) Gravacao pela tela, agora com os dois niveis
--    Continua atomica, continua exigindo Admin no banco e continua sem tocar
--    em nenhum outro usuario.
-- ----------------------------------------------------------------------------
create or replace function public.agroflow_salvar_acessos_unidade(
  p_user_id uuid,
  p_unidades jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer := 0;
begin
  if not public.agroflow_is_admin() then
    raise exception 'Apenas o Admin pode alterar os acessos por unidade.';
  end if;

  if p_user_id is null then
    raise exception 'Informe o usuario que tera os acessos alterados.';
  end if;

  if not exists (select 1 from public.profiles p where p.user_id = p_user_id) then
    raise exception 'Usuario nao encontrado no cadastro de perfis.';
  end if;

  if p_unidades is null or jsonb_typeof(p_unidades) <> 'array' then
    raise exception 'Lista de unidades invalida.';
  end if;

  with entrada as (
    select
      (item->>'balanca_id')::uuid as balanca_id,
      coalesce((item->>'editar')::boolean, false) as editar,
      -- Quem pode editar necessariamente visualiza. A regra vale tambem aqui,
      -- e nao so na tela, para que a API nao dependa do navegador.
      (
        coalesce((item->>'visualizar')::boolean, (item->>'permitido')::boolean, false)
        or coalesce((item->>'editar')::boolean, false)
      ) as visualizar
    from jsonb_array_elements(p_unidades) as item
  ),
  gravadas as (
    insert into public.permissoes_unidade (user_id, balanca_id, permitido, editar, atualizado_em)
    select p_user_id, e.balanca_id, e.visualizar, e.editar, now()
    from entrada e
    where exists (select 1 from public.balancas b where b.id = e.balanca_id)
    on conflict (user_id, balanca_id) where user_id is not null
    do update set
      permitido = excluded.permitido,
      editar = excluded.editar,
      atualizado_em = now()
    returning 1
  )
  select count(*) into v_total from gravadas;

  return v_total;
end;
$$;

revoke all on function public.agroflow_salvar_acessos_unidade(uuid, jsonb) from public;
grant execute on function public.agroflow_salvar_acessos_unidade(uuid, jsonb) to authenticated;

commit;

-- ============================================================================
-- ROLLBACK (executar somente se for necessario desfazer)
-- ============================================================================
-- begin;
--
-- do $rollback$
-- declare
--   alvo text;
-- begin
--   foreach alvo in array array['portaria_entradas', 'recebimentos', 'recebimento_itens',
--                               'recebimento_notas_complementares', 'armazenagens_materia_prima']
--   loop
--     execute format('drop policy if exists %I on public.%I', 'unidade_escrita_insert_' || alvo, alvo);
--     execute format('drop policy if exists %I on public.%I', 'unidade_escrita_update_' || alvo, alvo);
--     execute format('drop policy if exists %I on public.%I', 'unidade_escrita_delete_' || alvo, alvo);
--   end loop;
-- end $rollback$;
--
-- drop function if exists public.agroflow_pode_editar_unidade(uuid);
--
-- -- A coluna e aditiva e pode ser mantida sem efeito colateral.
-- -- alter table public.permissoes_unidade drop column if exists editar;
--
-- commit;
