-- AgroFlow - campos manuais para liberacao do laboratorio.
-- SQL aditivo e seguro: nao apaga dados existentes.

alter table public.recebimentos
  add column if not exists fornecedor_nome_manual text,
  add column if not exists produto_nome_manual text,
  add column if not exists veiculo_placa_manual text;

create index if not exists recebimentos_fornecedor_manual_idx
  on public.recebimentos using btree (fornecedor_nome_manual);

create index if not exists recebimentos_produto_manual_idx
  on public.recebimentos using btree (produto_nome_manual);

create index if not exists recebimentos_veiculo_placa_manual_idx
  on public.recebimentos using btree (veiculo_placa_manual);
