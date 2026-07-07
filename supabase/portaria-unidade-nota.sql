-- AgroFlow - Portaria com unidade da quantidade
-- SQL incremental: adiciona unidade KG/SC/TON na Portaria sem apagar dados.

alter table public.portaria_entradas
add column if not exists unidade_nota text not null default 'KG';

update public.portaria_entradas
set unidade_nota = 'KG'
where unidade_nota is null or trim(unidade_nota) = '';

alter table public.portaria_entradas
drop constraint if exists portaria_entradas_unidade_nota_check;

alter table public.portaria_entradas
add constraint portaria_entradas_unidade_nota_check
check (unidade_nota in ('KG', 'SC', 'TON'));
