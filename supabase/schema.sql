-- Tijuca Alimentos - Supabase schema
-- Execute este arquivo no SQL Editor do Supabase.

create extension if not exists "pgcrypto";

create or replace function public.is_tijuca_authorized()
returns boolean
language sql
stable
as $$
  select auth.email() = 'leandroalmeida861@gmail.com';
$$;

create table if not exists public.fornecedores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  nome text not null,
  cnpj text,
  telefone text,
  email text,
  cidade text,
  uf text,
  created_at timestamptz not null default now()
);

create table if not exists public.fabricas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  nome text not null,
  cnpj text,
  cidade text,
  uf text,
  responsavel text,
  created_at timestamptz not null default now()
);

create table if not exists public.produtos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  nome text not null,
  unidade text not null default 'KG',
  descricao text,
  created_at timestamptz not null default now()
);

create table if not exists public.contratos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  numero_contrato text not null,
  fornecedor_id uuid not null references public.fornecedores(id) on delete restrict,
  fabrica_id uuid references public.fabricas(id) on delete set null,
  produto_id uuid not null references public.produtos(id) on delete restrict,
  quantidade_contratada numeric(14, 3) not null default 0,
  quantidade_recebida numeric(14, 3) not null default 0,
  custo_kg numeric(14, 4) not null default 0,
  data_vencimento date,
  observacoes text,
  created_at timestamptz not null default now(),
  unique (user_id, numero_contrato)
);

create table if not exists public.notas_fiscais (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  contrato_id uuid not null references public.contratos(id) on delete cascade,
  fornecedor_id uuid references public.fornecedores(id) on delete set null,
  numero_nf text not null,
  quantidade_recebida numeric(14, 3) not null default 0,
  valor_total numeric(14, 2) not null default 0,
  data_recebimento date,
  created_at timestamptz not null default now()
);

create table if not exists public.documentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  nome text not null,
  tipo text,
  url text,
  observacoes text,
  created_at timestamptz not null default now()
);

create table if not exists public.fretes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  contrato_id uuid references public.contratos(id) on delete set null,
  numero_cte text,
  transportadora text not null,
  placa text,
  motorista text,
  valor numeric(14, 2) not null default 0,
  data_frete date,
  created_at timestamptz not null default now()
);

create or replace function public.recalcular_recebido_contrato()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  alvo uuid;
begin
  alvo := coalesce(new.contrato_id, old.contrato_id);

  update public.contratos
  set quantidade_recebida = coalesce((
    select sum(nf.quantidade_recebida)
    from public.notas_fiscais nf
    where nf.contrato_id = alvo
  ), 0)
  where id = alvo;

  return coalesce(new, old);
end;
$$;

drop trigger if exists notas_recalcular_contrato on public.notas_fiscais;
create trigger notas_recalcular_contrato
after insert or update or delete on public.notas_fiscais
for each row execute function public.recalcular_recebido_contrato();

alter table public.fornecedores enable row level security;
alter table public.fabricas enable row level security;
alter table public.produtos enable row level security;
alter table public.contratos enable row level security;
alter table public.notas_fiscais enable row level security;
alter table public.documentos enable row level security;
alter table public.fretes enable row level security;

create policy "tijuca_select_fornecedores" on public.fornecedores for select using (public.is_tijuca_authorized() and user_id = auth.uid());
create policy "tijuca_insert_fornecedores" on public.fornecedores for insert with check (public.is_tijuca_authorized() and user_id = auth.uid());
create policy "tijuca_update_fornecedores" on public.fornecedores for update using (public.is_tijuca_authorized() and user_id = auth.uid()) with check (public.is_tijuca_authorized() and user_id = auth.uid());
create policy "tijuca_delete_fornecedores" on public.fornecedores for delete using (public.is_tijuca_authorized() and user_id = auth.uid());

create policy "tijuca_select_fabricas" on public.fabricas for select using (public.is_tijuca_authorized() and user_id = auth.uid());
create policy "tijuca_insert_fabricas" on public.fabricas for insert with check (public.is_tijuca_authorized() and user_id = auth.uid());
create policy "tijuca_update_fabricas" on public.fabricas for update using (public.is_tijuca_authorized() and user_id = auth.uid()) with check (public.is_tijuca_authorized() and user_id = auth.uid());
create policy "tijuca_delete_fabricas" on public.fabricas for delete using (public.is_tijuca_authorized() and user_id = auth.uid());

create policy "tijuca_select_produtos" on public.produtos for select using (public.is_tijuca_authorized() and user_id = auth.uid());
create policy "tijuca_insert_produtos" on public.produtos for insert with check (public.is_tijuca_authorized() and user_id = auth.uid());
create policy "tijuca_update_produtos" on public.produtos for update using (public.is_tijuca_authorized() and user_id = auth.uid()) with check (public.is_tijuca_authorized() and user_id = auth.uid());
create policy "tijuca_delete_produtos" on public.produtos for delete using (public.is_tijuca_authorized() and user_id = auth.uid());

create policy "tijuca_select_contratos" on public.contratos for select using (public.is_tijuca_authorized() and user_id = auth.uid());
create policy "tijuca_insert_contratos" on public.contratos for insert with check (public.is_tijuca_authorized() and user_id = auth.uid());
create policy "tijuca_update_contratos" on public.contratos for update using (public.is_tijuca_authorized() and user_id = auth.uid()) with check (public.is_tijuca_authorized() and user_id = auth.uid());
create policy "tijuca_delete_contratos" on public.contratos for delete using (public.is_tijuca_authorized() and user_id = auth.uid());

create policy "tijuca_select_notas" on public.notas_fiscais for select using (public.is_tijuca_authorized() and user_id = auth.uid());
create policy "tijuca_insert_notas" on public.notas_fiscais for insert with check (public.is_tijuca_authorized() and user_id = auth.uid());
create policy "tijuca_update_notas" on public.notas_fiscais for update using (public.is_tijuca_authorized() and user_id = auth.uid()) with check (public.is_tijuca_authorized() and user_id = auth.uid());
create policy "tijuca_delete_notas" on public.notas_fiscais for delete using (public.is_tijuca_authorized() and user_id = auth.uid());

create policy "tijuca_select_documentos" on public.documentos for select using (public.is_tijuca_authorized() and user_id = auth.uid());
create policy "tijuca_insert_documentos" on public.documentos for insert with check (public.is_tijuca_authorized() and user_id = auth.uid());
create policy "tijuca_update_documentos" on public.documentos for update using (public.is_tijuca_authorized() and user_id = auth.uid()) with check (public.is_tijuca_authorized() and user_id = auth.uid());
create policy "tijuca_delete_documentos" on public.documentos for delete using (public.is_tijuca_authorized() and user_id = auth.uid());

create policy "tijuca_select_fretes" on public.fretes for select using (public.is_tijuca_authorized() and user_id = auth.uid());
create policy "tijuca_insert_fretes" on public.fretes for insert with check (public.is_tijuca_authorized() and user_id = auth.uid());
create policy "tijuca_update_fretes" on public.fretes for update using (public.is_tijuca_authorized() and user_id = auth.uid()) with check (public.is_tijuca_authorized() and user_id = auth.uid());
create policy "tijuca_delete_fretes" on public.fretes for delete using (public.is_tijuca_authorized() and user_id = auth.uid());
