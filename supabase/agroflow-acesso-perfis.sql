-- AgroFlow - acesso seguro por convite, perfis e RLS
-- Rode este arquivo no Supabase SQL Editor do projeto atual.

create extension if not exists pgcrypto;

create table if not exists public.solicitacoes_acesso (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null,
  telefone text,
  observacao text,
  token_autorizacao uuid not null default gen_random_uuid(),
  status text not null default 'pendente',
  expira_em timestamptz not null default (now() + interval '7 days'),
  usado_em timestamptz,
  criado_em timestamptz not null default now(),
  aprovado_em timestamptz
);

alter table public.solicitacoes_acesso add column if not exists token_autorizacao uuid;
alter table public.solicitacoes_acesso add column if not exists expira_em timestamptz;
alter table public.solicitacoes_acesso add column if not exists usado_em timestamptz;
alter table public.solicitacoes_acesso add column if not exists criado_em timestamptz;
alter table public.solicitacoes_acesso add column if not exists aprovado_em timestamptz;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'solicitacoes_acesso' and column_name = 'token'
  ) then
    execute 'update public.solicitacoes_acesso set token_autorizacao = coalesce(token_autorizacao, token::uuid) where token_autorizacao is null and token is not null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'solicitacoes_acesso' and column_name = 'created_at'
  ) then
    execute 'update public.solicitacoes_acesso set criado_em = coalesce(criado_em, created_at) where criado_em is null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'solicitacoes_acesso' and column_name = 'liberado_em'
  ) then
    execute 'update public.solicitacoes_acesso set aprovado_em = coalesce(aprovado_em, liberado_em) where aprovado_em is null';
  end if;
end $$;

update public.solicitacoes_acesso
set token_autorizacao = gen_random_uuid()
where token_autorizacao is null;

update public.solicitacoes_acesso
set expira_em = now() + interval '7 days'
where expira_em is null;

update public.solicitacoes_acesso
set criado_em = now()
where criado_em is null;

update public.solicitacoes_acesso
set status = 'aprovado'
where status = 'liberado';

alter table public.solicitacoes_acesso alter column token_autorizacao set not null;
alter table public.solicitacoes_acesso alter column token_autorizacao set default gen_random_uuid();
alter table public.solicitacoes_acesso alter column expira_em set not null;
alter table public.solicitacoes_acesso alter column expira_em set default (now() + interval '7 days');
alter table public.solicitacoes_acesso alter column criado_em set not null;
alter table public.solicitacoes_acesso alter column criado_em set default now();

create unique index if not exists solicitacoes_acesso_token_autorizacao_key
on public.solicitacoes_acesso (token_autorizacao);

create index if not exists solicitacoes_acesso_email_status_idx
on public.solicitacoes_acesso (lower(email), status);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'solicitacoes_acesso_status_check'
      and conrelid = 'public.solicitacoes_acesso'::regclass
  ) then
    alter table public.solicitacoes_acesso
      add constraint solicitacoes_acesso_status_check
      check (status in ('pendente', 'aprovado', 'expirado', 'cancelado'));
  end if;
end $$;

create table if not exists public.usuarios_autorizados (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  nome text not null,
  email text not null unique,
  perfil text not null default 'operador',
  status text not null default 'ativo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.usuarios_autorizados add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.usuarios_autorizados add column if not exists perfil text;
alter table public.usuarios_autorizados add column if not exists status text;
alter table public.usuarios_autorizados add column if not exists created_at timestamptz;
alter table public.usuarios_autorizados add column if not exists updated_at timestamptz;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'usuarios_autorizados' and column_name = 'ativo'
  ) then
    execute 'update public.usuarios_autorizados set status = case when ativo is true then ''ativo'' else ''inativo'' end where status is null';
  end if;
end $$;

update public.usuarios_autorizados
set perfil = case when lower(email) = 'leandroalmeida861@gmail.com' then 'admin' else 'operador' end
where perfil is null;

update public.usuarios_autorizados
set status = 'ativo'
where status is null;

update public.usuarios_autorizados
set created_at = now()
where created_at is null;

update public.usuarios_autorizados
set updated_at = now()
where updated_at is null;

alter table public.usuarios_autorizados alter column perfil set not null;
alter table public.usuarios_autorizados alter column perfil set default 'operador';
alter table public.usuarios_autorizados alter column status set not null;
alter table public.usuarios_autorizados alter column status set default 'ativo';
alter table public.usuarios_autorizados alter column created_at set not null;
alter table public.usuarios_autorizados alter column created_at set default now();
alter table public.usuarios_autorizados alter column updated_at set not null;
alter table public.usuarios_autorizados alter column updated_at set default now();

create unique index if not exists usuarios_autorizados_email_lower_key
on public.usuarios_autorizados (lower(email));

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'usuarios_autorizados_perfil_check'
      and conrelid = 'public.usuarios_autorizados'::regclass
  ) then
    alter table public.usuarios_autorizados
      add constraint usuarios_autorizados_perfil_check
      check (perfil in ('admin', 'operador', 'consulta'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'usuarios_autorizados_status_check'
      and conrelid = 'public.usuarios_autorizados'::regclass
  ) then
    alter table public.usuarios_autorizados
      add constraint usuarios_autorizados_status_check
      check (status in ('ativo', 'inativo', 'bloqueado'));
  end if;
end $$;

insert into public.usuarios_autorizados (nome, email, perfil, status)
values ('Leandro Almeida', 'leandroalmeida861@gmail.com', 'admin', 'ativo')
on conflict (email) do update
set nome = excluded.nome,
    perfil = 'admin',
    status = 'ativo',
    updated_at = now();

create or replace function public.agroflow_email_normalizado(raw_email text)
returns text
language sql
immutable
as $$
  select lower(trim(coalesce(raw_email, '')));
$$;

create or replace function public.agroflow_usuario_atual()
returns table (
  id uuid,
  user_id uuid,
  nome text,
  email text,
  perfil text,
  status text
)
language sql
security definer
set search_path = public
as $$
  select ua.id, ua.user_id, ua.nome, ua.email, ua.perfil, ua.status
  from public.usuarios_autorizados ua
  where public.agroflow_email_normalizado(ua.email) = public.agroflow_email_normalizado(auth.email())
    and ua.status = 'ativo'
  limit 1;
$$;

create or replace function public.agroflow_email_liberado(check_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.usuarios_autorizados ua
    where public.agroflow_email_normalizado(ua.email) = public.agroflow_email_normalizado(check_email)
      and ua.status = 'ativo'
  );
$$;

create or replace function public.agroflow_perfil_atual()
returns text
language sql
security definer
set search_path = public
as $$
  select coalesce((
    select ua.perfil
    from public.usuarios_autorizados ua
    where public.agroflow_email_normalizado(ua.email) = public.agroflow_email_normalizado(auth.email())
      and ua.status = 'ativo'
    limit 1
  ), 'bloqueado');
$$;

create or replace function public.is_tijuca_authorized()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.agroflow_email_liberado(auth.email());
$$;

create or replace function public.agroflow_is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.agroflow_perfil_atual() = 'admin'
     or public.agroflow_email_normalizado(auth.email()) = 'leandroalmeida861@gmail.com';
$$;

create or replace function public.agroflow_can_write()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.agroflow_perfil_atual() in ('admin', 'operador');
$$;

alter table public.usuarios_autorizados enable row level security;
alter table public.solicitacoes_acesso enable row level security;

drop policy if exists "agroflow_select_usuarios" on public.usuarios_autorizados;
drop policy if exists "agroflow_admin_insert_usuarios" on public.usuarios_autorizados;
drop policy if exists "agroflow_admin_update_usuarios" on public.usuarios_autorizados;
drop policy if exists "agroflow_admin_delete_usuarios" on public.usuarios_autorizados;
drop policy if exists "agroflow_admin_select_usuarios" on public.usuarios_autorizados;

create policy "agroflow_select_usuarios"
on public.usuarios_autorizados
for select
to authenticated
using (
  public.agroflow_is_admin()
  or public.agroflow_email_normalizado(email) = public.agroflow_email_normalizado(auth.email())
);

create policy "agroflow_admin_insert_usuarios"
on public.usuarios_autorizados
for insert
to authenticated
with check (public.agroflow_is_admin());

create policy "agroflow_admin_update_usuarios"
on public.usuarios_autorizados
for update
to authenticated
using (public.agroflow_is_admin())
with check (public.agroflow_is_admin());

create policy "agroflow_admin_delete_usuarios"
on public.usuarios_autorizados
for delete
to authenticated
using (public.agroflow_is_admin());

drop policy if exists "agroflow_admin_select_solicitacoes" on public.solicitacoes_acesso;
drop policy if exists "agroflow_admin_update_solicitacoes" on public.solicitacoes_acesso;

create policy "agroflow_admin_select_solicitacoes"
on public.solicitacoes_acesso
for select
to authenticated
using (public.agroflow_is_admin());

create policy "agroflow_admin_update_solicitacoes"
on public.solicitacoes_acesso
for update
to authenticated
using (public.agroflow_is_admin())
with check (public.agroflow_is_admin());

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'fornecedores',
    'fabricas',
    'produtos',
    'contratos',
    'notas_fiscais',
    'documentos',
    'fretes'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);

    execute format('drop policy if exists "agroflow_select_%s" on public.%I', table_name, table_name);
    execute format('drop policy if exists "agroflow_insert_%s" on public.%I', table_name, table_name);
    execute format('drop policy if exists "agroflow_update_%s" on public.%I', table_name, table_name);
    execute format('drop policy if exists "agroflow_delete_%s" on public.%I', table_name, table_name);
    execute format('drop policy if exists "Acesso autenticado" on public.%I', table_name);
    execute format('drop policy if exists "Usuarios autorizados podem ler" on public.%I', table_name);
    execute format('drop policy if exists "Usuarios autorizados podem inserir" on public.%I', table_name);
    execute format('drop policy if exists "Usuarios autorizados podem atualizar" on public.%I', table_name);
    execute format('drop policy if exists "Usuarios autorizados podem excluir" on public.%I', table_name);

    execute format(
      'create policy "agroflow_select_%s" on public.%I for select to authenticated using (public.is_tijuca_authorized())',
      table_name,
      table_name
    );

    execute format(
      'create policy "agroflow_insert_%s" on public.%I for insert to authenticated with check (public.agroflow_can_write())',
      table_name,
      table_name
    );

    execute format(
      'create policy "agroflow_update_%s" on public.%I for update to authenticated using (public.agroflow_can_write()) with check (public.agroflow_can_write())',
      table_name,
      table_name
    );

    execute format(
      'create policy "agroflow_delete_%s" on public.%I for delete to authenticated using (public.agroflow_is_admin())',
      table_name,
      table_name
    );
  end loop;
end $$;

grant execute on function public.agroflow_email_normalizado(text) to anon, authenticated;
grant execute on function public.agroflow_usuario_atual() to authenticated;
grant execute on function public.agroflow_email_liberado(text) to anon, authenticated;
grant execute on function public.agroflow_perfil_atual() to authenticated;
grant execute on function public.is_tijuca_authorized() to authenticated;
grant execute on function public.agroflow_is_admin() to authenticated;
grant execute on function public.agroflow_can_write() to authenticated;
