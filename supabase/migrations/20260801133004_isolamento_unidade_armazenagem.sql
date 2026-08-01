-- Isolamento preventivo da Armazenagem M.P. por unidade.
--
-- A Armazenagem herda a unidade do recebimento. Esta migration reforca essa
-- heranca tanto nas leituras das tabelas filhas quanto nas escritas feitas
-- pelos RPCs SECURITY DEFINER. Nenhum dado existente e alterado.

create or replace function private.agroflow_validar_unidade_armazenagem()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recebimento_id uuid;
  v_balanca_id uuid;
begin
  v_recebimento_id := case
    when tg_op = 'DELETE' then old.recebimento_id
    else new.recebimento_id
  end;

  select r.balanca_id
    into v_balanca_id
  from public.recebimentos r
  where r.id = v_recebimento_id;

  if v_balanca_id is null then
    raise exception 'RECEBIMENTO_SEM_UNIDADE' using errcode = '23514';
  end if;

  -- Chamadas administrativas diretas do banco permanecem possiveis. Para
  -- usuarios autenticados, inclusive dentro de RPCs SECURITY DEFINER, a
  -- unidade do recebimento precisa estar liberada para edicao.
  if auth.uid() is not null
     and not public.agroflow_pode_editar_unidade(v_balanca_id) then
    raise exception 'SEM_PERMISSAO_UNIDADE' using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.agroflow_validar_unidade_armazenagem()
from public, anon, authenticated;

drop trigger if exists armazenagens_validar_unidade_escrita
on public.armazenagens_materia_prima;

create trigger armazenagens_validar_unidade_escrita
before insert or update or delete on public.armazenagens_materia_prima
for each row execute function private.agroflow_validar_unidade_armazenagem();

-- As tabelas filhas nao possuem balanca_id proprio. A policy restritiva faz
-- a leitura herdar a unidade do recebimento por meio da armazenagem pai.
drop policy if exists unidade_armazenagem_itens_select
on public.armazenagem_itens;

create policy unidade_armazenagem_itens_select
on public.armazenagem_itens
as restrictive
for select
to authenticated
using (
  exists (
    select 1
    from public.armazenagens_materia_prima a
    join public.recebimentos r on r.id = a.recebimento_id
    where a.id = armazenagem_id
      and public.agroflow_acessa_unidade(r.balanca_id)
  )
);

drop policy if exists unidade_armazenagem_distribuicoes_select
on public.armazenagem_distribuicoes;

create policy unidade_armazenagem_distribuicoes_select
on public.armazenagem_distribuicoes
as restrictive
for select
to authenticated
using (
  exists (
    select 1
    from public.armazenagens_materia_prima a
    join public.recebimentos r on r.id = a.recebimento_id
    where a.id = armazenagem_id
      and public.agroflow_acessa_unidade(r.balanca_id)
  )
);
