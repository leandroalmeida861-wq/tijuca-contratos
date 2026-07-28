-- ============================================================================
-- AgroFlow | Acessos por unidade administrados pela tela
-- Arquivo: supabase/acessos-unidade-por-usuario.sql
--
-- OBJETIVO
--   Permitir que a tela "Usuarios e permissoes" grave os acessos por unidade
--   de cada usuario na tabela ja existente public.permissoes_unidade.
--
-- POR QUE UMA FUNCAO
--   Os indices unicos de permissoes_unidade sao PARCIAIS
--   (permissoes_unidade_user_key ... where user_id is not null), e o upsert do
--   supabase-js nao consegue mirar um indice parcial. A funcao resolve isso e,
--   de quebra, garante duas coisas no servidor:
--     1) so o Admin altera acessos (nao depende do frontend);
--     2) a gravacao das varias unidades acontece em uma unica instrucao,
--        portanto atomica.
--
-- TABELAS AFETADAS
--   public.permissoes_unidade  (somente linhas do usuario informado)
--   Nenhuma tabela e criada, alterada ou removida.
--
-- FUNCOES CRIADAS
--   public.agroflow_salvar_acessos_unidade(uuid, jsonb)  NOVA
--
-- RISCO
--   BAIXO. Nao ha DDL destrutivo, nao ha DROP de tabela, coluna ou policy.
--   As regras por perfil criadas pelo seed anterior permanecem intactas: a
--   funcao escreve apenas linhas com user_id preenchido, que tem precedencia
--   sobre a regra do perfil em public.agroflow_acessa_unidade().
--   Nenhum registro de outro usuario e tocado.
--
-- ROLLBACK
--   drop function if exists public.agroflow_salvar_acessos_unidade(uuid, jsonb);
-- ============================================================================

begin;

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
  -- Autorizacao validada no banco, nao no navegador.
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

  -- Uma unica instrucao: ou grava tudo, ou nada.
  -- O ON CONFLICT mira explicitamente o indice parcial por usuario.
  with entrada as (
    select
      (item->>'balanca_id')::uuid as balanca_id,
      coalesce((item->>'permitido')::boolean, false) as permitido
    from jsonb_array_elements(p_unidades) as item
  ),
  gravadas as (
    insert into public.permissoes_unidade (user_id, balanca_id, permitido, atualizado_em)
    select p_user_id, e.balanca_id, e.permitido, now()
    from entrada e
    where exists (select 1 from public.balancas b where b.id = e.balanca_id)
    on conflict (user_id, balanca_id) where user_id is not null
    do update set permitido = excluded.permitido, atualizado_em = now()
    returning 1
  )
  select count(*) into v_total from gravadas;

  return v_total;
end;
$$;

revoke all on function public.agroflow_salvar_acessos_unidade(uuid, jsonb) from public;
grant execute on function public.agroflow_salvar_acessos_unidade(uuid, jsonb) to authenticated;

commit;
