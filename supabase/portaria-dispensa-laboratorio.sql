-- AgroFlow - Portaria: dispensa de laboratorio
-- SQL incremental. Nao apaga dados existentes.

alter table public.portaria_entradas
add column if not exists dispensa_laboratorio boolean not null default false;

alter table public.recebimentos
add column if not exists dispensa_laboratorio boolean not null default false;

alter table public.portaria_entradas
drop constraint if exists portaria_entradas_status_check;

alter table public.portaria_entradas
add constraint portaria_entradas_status_check
check (status in (
  'AGUARDANDO_LABORATORIO',
  'ENVIADO_LABORATORIO',
  'ENVIADO_RECEBIMENTO',
  'RECEBIMENTO_FINALIZADO',
  'CANCELADA'
));

create unique index if not exists recebimentos_portaria_unica
on public.recebimentos (portaria_id)
where portaria_id is not null
  and status <> 'cancelada';

create schema if not exists private;

create or replace function private.agroflow_sincronizar_portaria_recebimento_finalizado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.portaria_id is null then
    return new;
  end if;

  if new.status = 'aprovada'
    and new.balanca_id is not null
    and nullif(btrim(coalesce(new.nf_numero, '')), '') is not null
    and new.fornecedor_id is not null
    and (new.veiculo_id is not null or nullif(btrim(coalesce(new.veiculo_placa_manual, '')), '') is not null)
    and (new.produto_id is not null or nullif(btrim(coalesce(new.produto_nome_manual, '')), '') is not null)
    and coalesce(new.peso_bruto, 0) > 0
    and coalesce(new.tara, 0) > 0
    and new.peso_bruto >= new.tara
  then
    update public.portaria_entradas
    set status = 'RECEBIMENTO_FINALIZADO'
    where id = new.portaria_id
      and status <> 'CANCELADA';
  end if;

  return new;
end;
$$;

revoke all on function private.agroflow_sincronizar_portaria_recebimento_finalizado() from public, anon, authenticated;

drop trigger if exists recebimentos_sincronizar_portaria_finalizada on public.recebimentos;
create trigger recebimentos_sincronizar_portaria_finalizada
after insert or update of status, balanca_id, nf_numero, fornecedor_id, veiculo_id, veiculo_placa_manual, produto_id, produto_nome_manual, peso_bruto, tara
on public.recebimentos
for each row
execute function private.agroflow_sincronizar_portaria_recebimento_finalizado();

update public.portaria_entradas p
set status = 'RECEBIMENTO_FINALIZADO'
from public.recebimentos r
where r.portaria_id = p.id
  and r.status = 'aprovada'
  and r.balanca_id is not null
  and nullif(btrim(coalesce(r.nf_numero, '')), '') is not null
  and r.fornecedor_id is not null
  and (r.veiculo_id is not null or nullif(btrim(coalesce(r.veiculo_placa_manual, '')), '') is not null)
  and (r.produto_id is not null or nullif(btrim(coalesce(r.produto_nome_manual, '')), '') is not null)
  and coalesce(r.peso_bruto, 0) > 0
  and coalesce(r.tara, 0) > 0
  and r.peso_bruto >= r.tara
  and p.status <> 'CANCELADA';
