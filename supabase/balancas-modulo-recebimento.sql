-- AgroFlow - Modulo Balancas / Recebimento e Conferencia de NF
-- Migração aditiva: cria somente novas tabelas/funcoes/policies do modulo.
-- Antes de aplicar em producao: exporte backup do banco no Supabase.

create extension if not exists pgcrypto;

insert into public.permissoes_menu (
  perfil, menu, visualizar, cadastrar, editar, excluir, cancelar, aprovar, exportar
)
values
  ('admin', 'balancas', true, true, true, true, true, true, true),
  ('gestor', 'balancas', true, true, true, false, true, true, true),
  ('operador', 'balancas', true, true, true, false, false, false, true)
on conflict (perfil, menu) do nothing;

create table if not exists public.balancas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  nome text not null,
  identificacao text,
  localizacao text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recebimento_veiculos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  placa text not null,
  tipo_veiculo text,
  qtd_eixos integer,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recebimento_veiculos_placa_unica unique (placa)
);

create table if not exists public.recebimento_motoristas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  nome text not null,
  cpf text,
  telefone text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recebimento_transportadoras (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  nome text not null,
  cnpj text,
  telefone text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recebimento_laboratorios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  nome text not null,
  responsavel text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recebimentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  data date not null default current_date,
  balanca_id uuid references public.balancas(id) on delete set null,
  laboratorio_id uuid references public.recebimento_laboratorios(id) on delete set null,
  veiculo_id uuid references public.recebimento_veiculos(id) on delete set null,
  motorista_id uuid references public.recebimento_motoristas(id) on delete set null,
  transportadora_id uuid references public.recebimento_transportadoras(id) on delete set null,
  fornecedor_id uuid references public.fornecedores(id) on delete set null,
  produto_id uuid references public.produtos(id) on delete set null,
  fornecedor_nome_manual text,
  produto_nome_manual text,
  veiculo_placa_manual text,
  tipo_veiculo text,
  qtd_eixos integer,
  nf_numero text,
  nf_chave_acesso text,
  peso_bruto numeric(14, 3) not null default 0,
  tara numeric(14, 3) not null default 0,
  peso_nf numeric(14, 3),
  peso_liquido numeric(14, 3) generated always as (peso_bruto - tara) stored,
  diferenca_kg numeric(14, 3) generated always as ((peso_bruto - tara) - coalesce(peso_nf, 0)) stored,
  diferenca_pct numeric(14, 4) generated always as (
    case when coalesce(peso_nf, 0) > 0
      then (((peso_bruto - tara) - peso_nf) / peso_nf) * 100
      else null
    end
  ) stored,
  divergente boolean not null default false,
  status text not null default 'pendente',
  umidade numeric(8, 3),
  ticket_numero text,
  liberado_por text,
  motivo_reprovacao text,
  motivo_cancelamento text,
  observacao text,
  valor_unitario numeric(18, 10),
  valor_total numeric(14, 2),
  aprovado_em timestamptz,
  reprovado_em timestamptz,
  cancelado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recebimentos_status_check check (status in ('pendente', 'aprovada', 'reprovada', 'cancelada')),
  constraint recebimentos_pesos_validos check (peso_bruto >= 0 and tara >= 0 and tara <= peso_bruto),
  constraint recebimentos_nf_chave_unica unique (nf_chave_acesso)
);

create table if not exists public.recebimento_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid(),
  recebimento_id uuid references public.recebimentos(id) on delete cascade,
  acao text not null,
  dados_anteriores jsonb,
  dados_novos jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.recebimento_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.recebimento_marcar_divergencia()
returns trigger
language plpgsql
as $$
declare
  diferenca_pct_calc numeric;
begin
  if coalesce(new.peso_nf, 0) > 0 then
    diferenca_pct_calc := (((new.peso_bruto - new.tara) - new.peso_nf) / new.peso_nf) * 100;
    new.divergente := abs(diferenca_pct_calc) > 0.5;
  else
    new.divergente := false;
  end if;

  if new.status = 'aprovada' and new.aprovado_em is null then
    new.aprovado_em := now();
  end if;
  if new.status = 'reprovada' and new.reprovado_em is null then
    new.reprovado_em := now();
  end if;
  if new.status = 'cancelada' and new.cancelado_em is null then
    new.cancelado_em := now();
  end if;

  return new;
end;
$$;

create or replace function public.recebimento_audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.recebimento_logs (user_id, recebimento_id, acao, dados_anteriores, dados_novos)
  values (
    auth.uid(),
    case when tg_op = 'DELETE' then null else new.id end,
    case tg_op when 'INSERT' then 'cadastrar' when 'UPDATE' then 'editar' else 'excluir' end,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'balancas',
    'recebimento_veiculos',
    'recebimento_motoristas',
    'recebimento_transportadoras',
    'recebimento_laboratorios'
  ] loop
    execute format('drop trigger if exists %I on public.%I', table_name || '_updated_at', table_name);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.recebimento_set_updated_at()',
      table_name || '_updated_at',
      table_name
    );
  end loop;
end $$;

drop trigger if exists recebimentos_updated_at on public.recebimentos;
create trigger recebimentos_updated_at
before update on public.recebimentos
for each row execute function public.recebimento_set_updated_at();

drop trigger if exists recebimentos_marcar_divergencia on public.recebimentos;
create trigger recebimentos_marcar_divergencia
before insert or update on public.recebimentos
for each row execute function public.recebimento_marcar_divergencia();

drop trigger if exists recebimentos_audit on public.recebimentos;
create trigger recebimentos_audit
after insert or update or delete on public.recebimentos
for each row execute function public.recebimento_audit_trigger();

create index if not exists recebimentos_data_idx on public.recebimentos(data desc);
create index if not exists recebimentos_status_idx on public.recebimentos(status);
create index if not exists recebimentos_balanca_idx on public.recebimentos(balanca_id);
create index if not exists recebimentos_fornecedor_idx on public.recebimentos(fornecedor_id);
create index if not exists recebimentos_produto_idx on public.recebimentos(produto_id);
create index if not exists recebimentos_laboratorio_idx on public.recebimentos(laboratorio_id);
create index if not exists recebimento_logs_recebimento_idx on public.recebimento_logs(recebimento_id);

alter table public.balancas enable row level security;
alter table public.recebimento_veiculos enable row level security;
alter table public.recebimento_motoristas enable row level security;
alter table public.recebimento_transportadoras enable row level security;
alter table public.recebimento_laboratorios enable row level security;
alter table public.recebimentos enable row level security;
alter table public.recebimento_logs enable row level security;

do $$
declare
  table_name text;
  policy_item record;
begin
  foreach table_name in array array[
    'balancas',
    'recebimento_veiculos',
    'recebimento_motoristas',
    'recebimento_transportadoras',
    'recebimento_laboratorios',
    'recebimentos'
  ] loop
    for policy_item in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = table_name
    loop
      execute format('drop policy if exists %I on public.%I', policy_item.policyname, table_name);
    end loop;

    execute format(
      'create policy %I on public.%I for select to authenticated using (public.agroflow_tem_permissao(%L, %L))',
      'balancas_select_' || table_name, table_name, 'balancas', 'visualizar'
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.agroflow_tem_permissao(%L, %L))',
      'balancas_insert_' || table_name, table_name, 'balancas', 'cadastrar'
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.agroflow_tem_permissao(%L, %L) or public.agroflow_tem_permissao(%L, %L) or public.agroflow_tem_permissao(%L, %L)) with check (public.agroflow_tem_permissao(%L, %L) or public.agroflow_tem_permissao(%L, %L) or public.agroflow_tem_permissao(%L, %L))',
      'balancas_update_' || table_name, table_name,
      'balancas', 'editar', 'balancas', 'aprovar', 'balancas', 'cancelar',
      'balancas', 'editar', 'balancas', 'aprovar', 'balancas', 'cancelar'
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.agroflow_tem_permissao(%L, %L))',
      'balancas_delete_' || table_name, table_name, 'balancas', 'excluir'
    );
  end loop;
end $$;

drop policy if exists recebimento_logs_select on public.recebimento_logs;
create policy recebimento_logs_select
on public.recebimento_logs
for select to authenticated
using (public.agroflow_tem_permissao('balancas', 'visualizar'));

drop policy if exists recebimento_logs_insert on public.recebimento_logs;
create policy recebimento_logs_insert
on public.recebimento_logs
for insert to authenticated
with check (user_id = auth.uid() or public.agroflow_is_admin());
