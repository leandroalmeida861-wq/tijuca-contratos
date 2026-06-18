-- AgroFlow RBAC: Admin, Gestor e Operador.
-- Migração aditiva: preserva tabelas, usuários e dados existentes.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique not null,
  nome text,
  email text unique not null,
  perfil text not null default 'operador',
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.profiles drop constraint if exists profiles_perfil_check;
alter table public.profiles
  add constraint profiles_perfil_check check (perfil in ('admin', 'gestor', 'operador'));

create table if not exists public.permissoes_menu (
  id uuid primary key default gen_random_uuid(),
  perfil text not null,
  menu text not null,
  visualizar boolean not null default false,
  cadastrar boolean not null default false,
  editar boolean not null default false,
  excluir boolean not null default false,
  cancelar boolean not null default false,
  aprovar boolean not null default false,
  exportar boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (perfil, menu),
  constraint permissoes_menu_perfil_check check (perfil in ('admin', 'gestor', 'operador'))
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  perfil text,
  acao text not null,
  tabela text,
  registro_id text,
  dados_anteriores jsonb,
  dados_novos jsonb,
  criado_em timestamptz not null default now()
);

create index if not exists audit_logs_criado_em_idx on public.audit_logs (criado_em desc);
create index if not exists audit_logs_user_id_idx on public.audit_logs (user_id);

insert into public.profiles (user_id, nome, email, perfil, ativo)
select
  au.id,
  coalesce(ua.nome, au.raw_user_meta_data->>'nome', split_part(au.email, '@', 1)),
  lower(au.email),
  case
    when lower(au.email) = 'leandroalmeida861@gmail.com' then 'admin'
    when ua.perfil = 'admin' then 'admin'
    when ua.perfil = 'gestor' then 'gestor'
    else 'operador'
  end,
  coalesce(ua.status = 'ativo', true)
from auth.users au
left join public.usuarios_autorizados ua on lower(ua.email) = lower(au.email)
where au.email is not null
on conflict (user_id) do update
set
  nome = coalesce(excluded.nome, public.profiles.nome),
  email = excluded.email,
  perfil = case
    when excluded.email = 'leandroalmeida861@gmail.com' then 'admin'
    when public.profiles.perfil in ('admin', 'gestor', 'operador') then public.profiles.perfil
    else excluded.perfil
  end,
  ativo = case when excluded.email = 'leandroalmeida861@gmail.com' then true else public.profiles.ativo end,
  atualizado_em = now();

update public.profiles
set perfil = 'operador', atualizado_em = now()
where perfil not in ('admin', 'gestor', 'operador');

update public.profiles
set perfil = 'admin', ativo = true, nome = coalesce(nome, 'Leandro'), atualizado_em = now()
where lower(email) = 'leandroalmeida861@gmail.com';

do $$
declare
  menu_name text;
  operational_menus text[] := array[
    'dashboard', 'fornecedores', 'fabricas', 'produtos', 'contratos',
    'notas_fiscais', 'fretes', 'documentos', 'financeiro', 'backup'
  ];
begin
  foreach menu_name in array operational_menus loop
    insert into public.permissoes_menu (
      perfil, menu, visualizar, cadastrar, editar, excluir, cancelar, aprovar, exportar
    )
    values
      ('admin', menu_name, true, true, true, true, true, true, true),
      ('gestor', menu_name, true, true, true, true, true, true, true),
      ('operador', menu_name, true, true, true, false, false, false, true)
    on conflict (perfil, menu) do nothing;
  end loop;

  foreach menu_name in array array['usuarios', 'auditoria'] loop
    insert into public.permissoes_menu (
      perfil, menu, visualizar, cadastrar, editar, excluir, cancelar, aprovar, exportar
    )
    values
      ('admin', menu_name, true, true, true, true, true, true, true),
      ('gestor', menu_name, false, false, false, false, false, false, false),
      ('operador', menu_name, false, false, false, false, false, false, false)
    on conflict (perfil, menu) do nothing;
  end loop;
end $$;

create or replace function public.agroflow_ensure_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  result public.profiles;
  current_email text := lower(coalesce(auth.email(), ''));
begin
  if auth.uid() is null or current_email = '' then
    raise exception 'Usuário não autenticado.';
  end if;

  if current_email = 'leandroalmeida861@gmail.com' then
    insert into public.profiles (user_id, nome, email, perfil, ativo)
    values (auth.uid(), 'Leandro', current_email, 'admin', true)
    on conflict (user_id) do update
    set email = excluded.email, perfil = 'admin', ativo = true, atualizado_em = now();
  end if;

  select * into result
  from public.profiles
  where user_id = auth.uid();

  return result;
end;
$$;

create or replace function public.agroflow_profile_atual()
returns table (
  id uuid,
  user_id uuid,
  nome text,
  email text,
  perfil text,
  ativo boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.user_id, p.nome, p.email, p.perfil, p.ativo
  from public.profiles p
  where p.user_id = auth.uid();
$$;

create or replace function public.agroflow_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.ativo and p.perfil = 'admin'
  ) or lower(coalesce(auth.email(), '')) = 'leandroalmeida861@gmail.com';
$$;

create or replace function public.agroflow_tem_permissao(menu_name text, action_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  current_profile text;
  allowed boolean := false;
begin
  select p.perfil into current_profile
  from public.profiles p
  where p.user_id = auth.uid() and p.ativo;

  if current_profile = 'admin' or lower(coalesce(auth.email(), '')) = 'leandroalmeida861@gmail.com' then
    return true;
  end if;

  select case action_name
    when 'visualizar' then pm.visualizar
    when 'cadastrar' then pm.cadastrar
    when 'editar' then pm.editar
    when 'excluir' then pm.excluir
    when 'cancelar' then pm.cancelar
    when 'aprovar' then pm.aprovar
    when 'exportar' then pm.exportar
    else false
  end into allowed
  from public.permissoes_menu pm
  where pm.perfil = current_profile and pm.menu = menu_name;

  return coalesce(allowed, false);
end;
$$;

create or replace function public.agroflow_permissoes_atuais()
returns setof public.permissoes_menu
language sql
stable
security definer
set search_path = public
as $$
  select pm.*
  from public.permissoes_menu pm
  join public.profiles p on p.user_id = auth.uid() and p.ativo
  where pm.perfil = p.perfil
     or p.perfil = 'admin';
$$;

create or replace function public.agroflow_auditar(
  action_name text,
  table_name text default null,
  record_id text default null,
  old_data jsonb default null,
  new_data jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile text;
begin
  select p.perfil into current_profile from public.profiles p where p.user_id = auth.uid();
  insert into public.audit_logs (user_id, perfil, acao, tabela, registro_id, dados_anteriores, dados_novos)
  values (auth.uid(), current_profile, action_name, table_name, record_id, old_data, new_data);
end;
$$;

create or replace function public.agroflow_audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (
    user_id, perfil, acao, tabela, registro_id, dados_anteriores, dados_novos
  )
  values (
    auth.uid(),
    (select p.perfil from public.profiles p where p.user_id = auth.uid()),
    case tg_op when 'INSERT' then 'cadastrar' when 'UPDATE' then 'editar' else 'excluir' end,
    tg_table_name,
    coalesce((to_jsonb(new)->>'id'), (to_jsonb(old)->>'id')),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

alter table public.profiles enable row level security;
alter table public.permissoes_menu enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_admin_insert" on public.profiles;
drop policy if exists "profiles_admin_update" on public.profiles;
drop policy if exists "profiles_admin_delete" on public.profiles;
create policy "profiles_select" on public.profiles for select to authenticated
using (user_id = auth.uid() or public.agroflow_is_admin());
create policy "profiles_admin_insert" on public.profiles for insert to authenticated
with check (public.agroflow_is_admin());
create policy "profiles_admin_update" on public.profiles for update to authenticated
using (public.agroflow_is_admin()) with check (public.agroflow_is_admin());
create policy "profiles_admin_delete" on public.profiles for delete to authenticated
using (public.agroflow_is_admin() and lower(email) <> 'leandroalmeida861@gmail.com');

drop policy if exists "permissoes_select" on public.permissoes_menu;
drop policy if exists "permissoes_admin_insert" on public.permissoes_menu;
drop policy if exists "permissoes_admin_update" on public.permissoes_menu;
drop policy if exists "permissoes_admin_delete" on public.permissoes_menu;
create policy "permissoes_select" on public.permissoes_menu for select to authenticated
using (public.agroflow_is_admin() or perfil = (select p.perfil from public.profiles p where p.user_id = auth.uid()));
create policy "permissoes_admin_insert" on public.permissoes_menu for insert to authenticated
with check (public.agroflow_is_admin());
create policy "permissoes_admin_update" on public.permissoes_menu for update to authenticated
using (public.agroflow_is_admin()) with check (public.agroflow_is_admin());
create policy "permissoes_admin_delete" on public.permissoes_menu for delete to authenticated
using (public.agroflow_is_admin() and perfil <> 'admin');

drop policy if exists "audit_admin_select" on public.audit_logs;
drop policy if exists "audit_authenticated_insert" on public.audit_logs;
create policy "audit_admin_select" on public.audit_logs for select to authenticated
using (public.agroflow_is_admin());
create policy "audit_authenticated_insert" on public.audit_logs for insert to authenticated
with check (user_id = auth.uid());

do $$
declare
  item record;
  policy_item record;
  menu_name text;
begin
  for item in
    select * from (values
      ('fornecedores', 'fornecedores'),
      ('fabricas', 'fabricas'),
      ('produtos', 'produtos'),
      ('contratos', 'contratos'),
      ('notas_fiscais', 'notas_fiscais'),
      ('fretes', 'fretes'),
      ('documentos', 'documentos')
    ) as mapped(table_name, menu_name)
  loop
    execute format('alter table public.%I enable row level security', item.table_name);

    for policy_item in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = item.table_name
    loop
      execute format('drop policy if exists %I on public.%I', policy_item.policyname, item.table_name);
    end loop;

    execute format(
      'create policy %I on public.%I for select to authenticated using (public.agroflow_tem_permissao(%L, %L))',
      'rbac_select_' || item.table_name, item.table_name, item.menu_name, 'visualizar'
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.agroflow_tem_permissao(%L, %L))',
      'rbac_insert_' || item.table_name, item.table_name, item.menu_name, 'cadastrar'
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.agroflow_tem_permissao(%L, %L)) with check (public.agroflow_tem_permissao(%L, %L))',
      'rbac_update_' || item.table_name, item.table_name, item.menu_name, 'editar', item.menu_name, 'editar'
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.agroflow_tem_permissao(%L, %L))',
      'rbac_delete_' || item.table_name, item.table_name, item.menu_name, 'excluir'
    );

    execute format('drop trigger if exists %I on public.%I', 'agroflow_audit_' || item.table_name, item.table_name);
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.agroflow_audit_trigger()',
      'agroflow_audit_' || item.table_name, item.table_name
    );
  end loop;
end $$;

grant execute on function public.agroflow_ensure_profile() to authenticated;
grant execute on function public.agroflow_profile_atual() to authenticated;
grant execute on function public.agroflow_is_admin() to authenticated;
grant execute on function public.agroflow_tem_permissao(text, text) to authenticated;
grant execute on function public.agroflow_permissoes_atuais() to authenticated;
grant execute on function public.agroflow_auditar(text, text, text, jsonb, jsonb) to authenticated;

drop policy if exists "agroflow_documentos_storage_select" on storage.objects;
drop policy if exists "agroflow_documentos_storage_insert" on storage.objects;
drop policy if exists "agroflow_documentos_storage_update" on storage.objects;
drop policy if exists "agroflow_documentos_storage_delete" on storage.objects;
create policy "agroflow_documentos_storage_select" on storage.objects for select to authenticated
using (bucket_id = 'documentos' and public.agroflow_tem_permissao('documentos', 'visualizar'));
create policy "agroflow_documentos_storage_insert" on storage.objects for insert to authenticated
with check (bucket_id = 'documentos' and public.agroflow_tem_permissao('documentos', 'cadastrar'));
create policy "agroflow_documentos_storage_update" on storage.objects for update to authenticated
using (bucket_id = 'documentos' and public.agroflow_tem_permissao('documentos', 'editar'))
with check (bucket_id = 'documentos' and public.agroflow_tem_permissao('documentos', 'editar'));
create policy "agroflow_documentos_storage_delete" on storage.objects for delete to authenticated
using (bucket_id = 'documentos' and public.agroflow_tem_permissao('documentos', 'excluir'));
