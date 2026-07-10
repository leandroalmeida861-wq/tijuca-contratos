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
  'CANCELADA'
));

create unique index if not exists recebimentos_portaria_unica
on public.recebimentos (portaria_id)
where portaria_id is not null
  and status <> 'cancelada';
