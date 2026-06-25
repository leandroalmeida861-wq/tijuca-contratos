-- AgroFlow: isolamento por empresa para reduzir risco de IDOR/BOLA.
-- Execute primeiro em preview/staging. Faca backup antes de aplicar em producao.
-- Esta migracao e aditiva: cria empresa padrao, adiciona empresa_id e reforca RLS.

create extension if not exists pgcrypto;

create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cnpj text,
  status text not null default 'ativa',
  criada_em timestamptz not null default now(),
  atualizada_em timestamptz not null default now(),
  constraint empresas_status_check check (status in ('ativa', 'inativa'))
);

create unique index if not exists empresas_nome_lower_key
on public.empresas (lower(nome));

insert into public.empresas (nome, status)
select 'AgroFlow', 'ativa'
where not exists (
  select 1 from public.empresas where lower(nome) = 'agroflow'
);

create or replace function public.agroflow_empresa_padrao_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.empresas where lower(nome) = 'agroflow' limit 1;
$$;

alter table public.profiles
add column if not exists empresa_id uuid references public.empresas(id) on delete restrict;

alter table public.usuarios_autorizados
add column if not exists empresa_id uuid references public.empresas(id) on delete restrict;

update public.profiles
set empresa_id = public.agroflow_empresa_padrao_id()
where empresa_id is null;

update public.usuarios_autorizados
set empresa_id = public.agroflow_empresa_padrao_id()
where empresa_id is null;

alter table public.profiles
alter column empresa_id set default public.agroflow_empresa_padrao_id();

alter table public.usuarios_autorizados
alter column empresa_id set default public.agroflow_empresa_padrao_id();

alter table public.profiles
alter column empresa_id set not null;

alter table public.usuarios_autorizados
alter column empresa_id set not null;

create index if not exists profiles_empresa_id_idx on public.profiles (empresa_id);
create index if not exists usuarios_autorizados_empresa_id_idx on public.usuarios_autorizados (empresa_id);

create or replace function public.agroflow_empresa_atual_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.empresa_id
  from public.profiles p
  where p.user_id = auth.uid()
    and p.ativo
  limit 1;
$$;

create or replace function public.agroflow_mesma_empresa(row_empresa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select row_empresa_id is not null
     and row_empresa_id = public.agroflow_empresa_atual_id();
$$;

create or replace function public.agroflow_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.ativo
      and p.perfil = 'admin'
      and p.empresa_id = public.agroflow_empresa_atual_id()
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
  where p.user_id = auth.uid()
    and p.ativo
    and p.empresa_id = public.agroflow_empresa_atual_id();

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
  where pm.perfil = current_profile
    and pm.menu = menu_name;

  return coalesce(allowed, false);
end;
$$;

drop function if exists public.agroflow_profile_atual();

create function public.agroflow_profile_atual()
returns table (
  id uuid,
  user_id uuid,
  nome text,
  email text,
  perfil text,
  ativo boolean,
  empresa_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.user_id, p.nome, p.email, p.perfil, p.ativo, p.empresa_id
  from public.profiles p
  where p.user_id = auth.uid();
$$;

drop function if exists public.agroflow_usuario_atual();

create function public.agroflow_usuario_atual()
returns table (
  id uuid,
  user_id uuid,
  nome text,
  email text,
  perfil text,
  status text,
  empresa_id uuid
)
language sql
security definer
set search_path = public
as $$
  select ua.id, ua.user_id, ua.nome, ua.email, ua.perfil, ua.status, ua.empresa_id
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

create or replace function public.is_tijuca_authorized()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.ativo
      and p.empresa_id is not null
  );
$$;

create or replace function public.agroflow_set_empresa_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.empresa_id is null then
    new.empresa_id := coalesce(public.agroflow_empresa_atual_id(), public.agroflow_empresa_padrao_id());
  end if;
  return new;
end;
$$;

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
    'fretes',
    'balancas',
    'recebimento_veiculos',
    'recebimento_motoristas',
    'recebimento_transportadoras',
    'recebimento_laboratorios',
    'recebimentos'
  ]
  loop
    execute format(
      'alter table public.%I add column if not exists empresa_id uuid references public.empresas(id) on delete restrict',
      table_name
    );
    execute format(
      'update public.%I set empresa_id = public.agroflow_empresa_padrao_id() where empresa_id is null',
      table_name
    );
    execute format(
      'alter table public.%I alter column empresa_id set default public.agroflow_empresa_atual_id()',
      table_name
    );
    execute format(
      'alter table public.%I alter column empresa_id set not null',
      table_name
    );
    execute format(
      'create index if not exists %I on public.%I (empresa_id)',
      table_name || '_empresa_id_idx',
      table_name
    );
    execute format('drop trigger if exists %I on public.%I', table_name || '_set_empresa_id', table_name);
    execute format(
      'create trigger %I before insert on public.%I for each row execute function public.agroflow_set_empresa_id()',
      table_name || '_set_empresa_id',
      table_name
    );
  end loop;
end $$;

alter table public.empresas enable row level security;

drop policy if exists "empresas_select" on public.empresas;
drop policy if exists "empresas_admin_insert" on public.empresas;
drop policy if exists "empresas_admin_update" on public.empresas;
drop policy if exists "empresas_admin_delete" on public.empresas;

create policy "empresas_select"
on public.empresas
for select
to authenticated
using (id = public.agroflow_empresa_atual_id() or public.agroflow_is_admin());

create policy "empresas_admin_insert"
on public.empresas
for insert
to authenticated
with check (public.agroflow_is_admin());

create policy "empresas_admin_update"
on public.empresas
for update
to authenticated
using (public.agroflow_is_admin())
with check (public.agroflow_is_admin());

create policy "empresas_admin_delete"
on public.empresas
for delete
to authenticated
using (false);

drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_admin_insert" on public.profiles;
drop policy if exists "profiles_admin_update" on public.profiles;
drop policy if exists "profiles_admin_delete" on public.profiles;

create policy "profiles_select"
on public.profiles
for select
to authenticated
using (
  user_id = auth.uid()
  or (public.agroflow_is_admin() and empresa_id = public.agroflow_empresa_atual_id())
);

create policy "profiles_admin_insert"
on public.profiles
for insert
to authenticated
with check (public.agroflow_is_admin() and empresa_id = public.agroflow_empresa_atual_id());

create policy "profiles_admin_update"
on public.profiles
for update
to authenticated
using (public.agroflow_is_admin() and empresa_id = public.agroflow_empresa_atual_id())
with check (public.agroflow_is_admin() and empresa_id = public.agroflow_empresa_atual_id());

create policy "profiles_admin_delete"
on public.profiles
for delete
to authenticated
using (
  public.agroflow_is_admin()
  and empresa_id = public.agroflow_empresa_atual_id()
  and lower(email) <> 'leandroalmeida861@gmail.com'
);

drop policy if exists "agroflow_select_usuarios" on public.usuarios_autorizados;
drop policy if exists "agroflow_admin_insert_usuarios" on public.usuarios_autorizados;
drop policy if exists "agroflow_admin_update_usuarios" on public.usuarios_autorizados;
drop policy if exists "agroflow_admin_delete_usuarios" on public.usuarios_autorizados;

create policy "agroflow_select_usuarios"
on public.usuarios_autorizados
for select
to authenticated
using (
  public.agroflow_email_normalizado(email) = public.agroflow_email_normalizado(auth.email())
  or (public.agroflow_is_admin() and empresa_id = public.agroflow_empresa_atual_id())
);

create policy "agroflow_admin_insert_usuarios"
on public.usuarios_autorizados
for insert
to authenticated
with check (public.agroflow_is_admin() and empresa_id = public.agroflow_empresa_atual_id());

create policy "agroflow_admin_update_usuarios"
on public.usuarios_autorizados
for update
to authenticated
using (public.agroflow_is_admin() and empresa_id = public.agroflow_empresa_atual_id())
with check (public.agroflow_is_admin() and empresa_id = public.agroflow_empresa_atual_id());

create policy "agroflow_admin_delete_usuarios"
on public.usuarios_autorizados
for delete
to authenticated
using (public.agroflow_is_admin() and empresa_id = public.agroflow_empresa_atual_id());

do $$
declare
  item record;
  policy_item record;
begin
  for item in
    select * from (values
      ('fornecedores', 'fornecedores'),
      ('fabricas', 'fabricas'),
      ('produtos', 'produtos'),
      ('contratos', 'contratos'),
      ('notas_fiscais', 'notas_fiscais'),
      ('fretes', 'fretes'),
      ('documentos', 'documentos'),
      ('balancas', 'balancas'),
      ('recebimento_veiculos', 'balancas'),
      ('recebimento_motoristas', 'balancas'),
      ('recebimento_transportadoras', 'balancas'),
      ('recebimento_laboratorios', 'balancas'),
      ('recebimentos', 'balancas')
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
      'create policy %I on public.%I for select to authenticated using (public.agroflow_tem_permissao(%L, %L) and public.agroflow_mesma_empresa(empresa_id))',
      'empresa_select_' || item.table_name,
      item.table_name,
      item.menu_name,
      'visualizar'
    );

    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.agroflow_tem_permissao(%L, %L) and public.agroflow_mesma_empresa(empresa_id))',
      'empresa_insert_' || item.table_name,
      item.table_name,
      item.menu_name,
      'cadastrar'
    );

    execute format(
      'create policy %I on public.%I for update to authenticated using (public.agroflow_mesma_empresa(empresa_id) and (public.agroflow_tem_permissao(%L, %L) or public.agroflow_tem_permissao(%L, %L) or public.agroflow_tem_permissao(%L, %L))) with check (public.agroflow_mesma_empresa(empresa_id) and (public.agroflow_tem_permissao(%L, %L) or public.agroflow_tem_permissao(%L, %L) or public.agroflow_tem_permissao(%L, %L)))',
      'empresa_update_' || item.table_name,
      item.table_name,
      item.menu_name, 'editar',
      item.menu_name, 'aprovar',
      item.menu_name, 'cancelar',
      item.menu_name, 'editar',
      item.menu_name, 'aprovar',
      item.menu_name, 'cancelar'
    );

    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.agroflow_tem_permissao(%L, %L) and public.agroflow_mesma_empresa(empresa_id))',
      'empresa_delete_' || item.table_name,
      item.table_name,
      item.menu_name,
      'excluir'
    );
  end loop;
end $$;

drop policy if exists recebimento_logs_select on public.recebimento_logs;
drop policy if exists recebimento_logs_insert on public.recebimento_logs;

create policy recebimento_logs_select
on public.recebimento_logs
for select
to authenticated
using (
  public.agroflow_tem_permissao('balancas', 'visualizar')
  and exists (
    select 1
    from public.recebimentos r
    where r.id = recebimento_logs.recebimento_id
      and public.agroflow_mesma_empresa(r.empresa_id)
  )
);

create policy recebimento_logs_insert
on public.recebimento_logs
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.recebimentos r
    where r.id = recebimento_logs.recebimento_id
      and public.agroflow_mesma_empresa(r.empresa_id)
  )
);

drop policy if exists "agroflow_documentos_storage_select" on storage.objects;
drop policy if exists "agroflow_documentos_storage_insert" on storage.objects;
drop policy if exists "agroflow_documentos_storage_update" on storage.objects;
drop policy if exists "agroflow_documentos_storage_delete" on storage.objects;

create policy "agroflow_documentos_storage_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'documentos'
  and public.agroflow_tem_permissao('documentos', 'visualizar')
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1
      from public.documentos d
      where d.url = 'storage://documentos/' || storage.objects.name
        and public.agroflow_mesma_empresa(d.empresa_id)
    )
  )
);

create policy "agroflow_documentos_storage_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'documentos'
  and public.agroflow_tem_permissao('documentos', 'cadastrar')
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "agroflow_documentos_storage_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'documentos'
  and public.agroflow_tem_permissao('documentos', 'editar')
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1
      from public.documentos d
      where d.url = 'storage://documentos/' || storage.objects.name
        and public.agroflow_mesma_empresa(d.empresa_id)
    )
  )
)
with check (
  bucket_id = 'documentos'
  and public.agroflow_tem_permissao('documentos', 'editar')
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1
      from public.documentos d
      where d.url = 'storage://documentos/' || storage.objects.name
        and public.agroflow_mesma_empresa(d.empresa_id)
    )
  )
);

create policy "agroflow_documentos_storage_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'documentos'
  and public.agroflow_tem_permissao('documentos', 'excluir')
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1
      from public.documentos d
      where d.url = 'storage://documentos/' || storage.objects.name
        and public.agroflow_mesma_empresa(d.empresa_id)
    )
  )
);

grant execute on function public.agroflow_empresa_padrao_id() to authenticated, service_role;
grant execute on function public.agroflow_empresa_atual_id() to authenticated, service_role;
grant execute on function public.agroflow_mesma_empresa(uuid) to authenticated, service_role;
grant execute on function public.agroflow_set_empresa_id() to authenticated, service_role;
grant execute on function public.agroflow_profile_atual() to authenticated;
grant execute on function public.agroflow_usuario_atual() to authenticated;
grant execute on function public.agroflow_is_admin() to authenticated;
grant execute on function public.agroflow_tem_permissao(text, text) to authenticated;
grant execute on function public.agroflow_email_liberado(text) to anon, authenticated;
grant execute on function public.is_tijuca_authorized() to authenticated;

grant select, insert, update, delete on public.empresas to authenticated;
