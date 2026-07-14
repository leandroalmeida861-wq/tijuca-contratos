-- AgroFlow - protege o vinculo entre Armazenagem M.P. e Recebimento.
-- Migration incremental: nao remove dados, nao muda RLS e nao altera registros existentes.

begin;

create or replace function private.agroflow_armazenagem_recebimento_id_imutavel()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.recebimento_id is distinct from old.recebimento_id then
    raise exception 'RECEBIMENTO_ID_ARMAZENAGEM_IMUTAVEL';
  end if;
  return new;
end;
$$;

revoke all on function private.agroflow_armazenagem_recebimento_id_imutavel()
  from public, anon, authenticated;

drop trigger if exists armazenagem_recebimento_id_imutavel
  on public.armazenagens_materia_prima;

create trigger armazenagem_recebimento_id_imutavel
before update of recebimento_id on public.armazenagens_materia_prima
for each row execute function private.agroflow_armazenagem_recebimento_id_imutavel();

comment on trigger armazenagem_recebimento_id_imutavel on public.armazenagens_materia_prima is
  'Impede trocar o recebimento de uma armazenagem por NF, placa ou qualquer outro dado mutavel.';

commit;

-- Diagnostico seguro apos aplicar:
-- select recebimento_id, count(*) quantidade
-- from public.armazenagens_materia_prima
-- group by recebimento_id
-- having count(*) > 1;
