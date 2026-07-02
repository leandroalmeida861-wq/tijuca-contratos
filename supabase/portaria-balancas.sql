-- AgroFlow - Modulo Balancas / Portaria
-- SQL incremental: cria tabela e politicas sem apagar dados existentes.

create table if not exists public.portaria_entradas (
  id uuid primary key default gen_random_uuid(),
  data_entrada date not null default current_date,
  hora_entrada time not null default localtime,
  balanca_id uuid references public.balancas(id) on delete set null,
  placa text not null,
  veiculo_id uuid not null references public.recebimento_veiculos(id) on delete restrict,
  motorista_id uuid references public.recebimento_motoristas(id) on delete set null,
  fornecedor_id uuid not null references public.fornecedores(id) on delete restrict,
  cnpj_fornecedor text not null,
  produto_id uuid not null references public.produtos(id) on delete restrict,
  numero_nf text not null,
  serie_nf text not null,
  peso_nf_kg numeric(14, 3) not null,
  transportadora_id uuid references public.recebimento_transportadoras(id) on delete set null,
  tipo_veiculo text,
  qtd_eixos integer,
  observacao text,
  status text not null default 'AGUARDANDO_LABORATORIO',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint portaria_entradas_status_check check (status in ('AGUARDANDO_LABORATORIO', 'ENVIADO_LABORATORIO', 'CANCELADA')),
  constraint portaria_entradas_placa_check check (placa ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$'),
  constraint portaria_entradas_peso_check check (peso_nf_kg > 0)
);

alter table public.portaria_entradas
add column if not exists balanca_id uuid references public.balancas(id) on delete set null;

create unique index if not exists portaria_nf_fornecedor_serie_unica
on public.portaria_entradas (fornecedor_id, numero_nf, serie_nf)
where status <> 'CANCELADA';

create index if not exists portaria_entradas_data_idx on public.portaria_entradas (data_entrada desc);
create index if not exists portaria_entradas_placa_idx on public.portaria_entradas (placa);
create index if not exists portaria_entradas_status_idx on public.portaria_entradas (status);
create index if not exists portaria_entradas_balanca_idx on public.portaria_entradas (balanca_id);
create index if not exists portaria_entradas_fornecedor_idx on public.portaria_entradas (fornecedor_id);
create index if not exists portaria_entradas_produto_idx on public.portaria_entradas (produto_id);

drop trigger if exists portaria_entradas_updated_at on public.portaria_entradas;
create trigger portaria_entradas_updated_at
before update on public.portaria_entradas
for each row execute function public.recebimento_set_updated_at();

alter table public.portaria_entradas enable row level security;

drop policy if exists portaria_entradas_select on public.portaria_entradas;
create policy portaria_entradas_select
on public.portaria_entradas
for select to authenticated
using (public.agroflow_tem_permissao('balancas', 'visualizar'));

drop policy if exists portaria_entradas_insert on public.portaria_entradas;
create policy portaria_entradas_insert
on public.portaria_entradas
for insert to authenticated
with check (public.agroflow_tem_permissao('balancas', 'cadastrar'));

drop policy if exists portaria_entradas_update on public.portaria_entradas;
create policy portaria_entradas_update
on public.portaria_entradas
for update to authenticated
using (
  public.agroflow_tem_permissao('balancas', 'editar')
  or public.agroflow_tem_permissao('balancas', 'cancelar')
  or public.agroflow_tem_permissao('balancas', 'aprovar')
)
with check (
  public.agroflow_tem_permissao('balancas', 'editar')
  or public.agroflow_tem_permissao('balancas', 'cancelar')
  or public.agroflow_tem_permissao('balancas', 'aprovar')
);

drop policy if exists portaria_entradas_delete on public.portaria_entradas;
create policy portaria_entradas_delete
on public.portaria_entradas
for delete to authenticated
using (public.agroflow_tem_permissao('balancas', 'excluir'));
