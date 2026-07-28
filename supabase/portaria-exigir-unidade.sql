-- AgroFlow | Portaria: unidade obrigatoria em novos lancamentos
--
-- Migration preservadora:
-- - nao altera nem exclui registros existentes;
-- - mantem compativeis os lancamentos historicos sem balanca_id;
-- - bloqueia novas gravacoes e atualizacoes sem unidade valida.

begin;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'portaria_entradas_balanca_obrigatoria'
      and conrelid = 'public.portaria_entradas'::regclass
  ) then
    alter table public.portaria_entradas
      add constraint portaria_entradas_balanca_obrigatoria
      check (balanca_id is not null) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'recebimentos_balanca_obrigatoria'
      and conrelid = 'public.recebimentos'::regclass
  ) then
    alter table public.recebimentos
      add constraint recebimentos_balanca_obrigatoria
      check (balanca_id is not null) not valid;
  end if;
end;
$$;

commit;
