-- AgroFlow - controle de solicitacao e liberacao de acesso
-- Execute este arquivo no SQL Editor do Supabase.

create extension if not exists "pgcrypto";

create table if not exists public.usuarios_autorizados (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  nome text,
  liberado_por uuid,
  liberado_em timestamptz not null default now(),
  ativo boolean not null default true
);

create table if not exists public.solicitacoes_acesso (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null,
  telefone text,
  observacao text,
  token uuid not null default gen_random_uuid(),
  status text not null default 'pendente',
  liberado_em timestamptz,
  created_at timestamptz not null default now(),
  unique (token)
);

alter table public.usuarios_autorizados enable row level security;
alter table public.solicitacoes_acesso enable row level security;

insert into public.usuarios_autorizados (email, nome, ativo)
values ('leandroalmeida861@gmail.com', 'Leandro Almeida', true)
on conflict (email) do update set ativo = true;

create or replace function public.agroflow_admin_email()
returns text
language sql
stable
as $$
  select 'leandroalmeida861@gmail.com';
$$;

create or replace function public.agroflow_is_admin()
returns boolean
language sql
stable
as $$
  select lower(coalesce(auth.email(), '')) = public.agroflow_admin_email();
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
    where lower(ua.email) = lower(trim(check_email))
      and ua.ativo = true
  );
$$;

create or replace function public.is_tijuca_authorized()
returns boolean
language sql
stable
as $$
  select public.agroflow_email_liberado(auth.email());
$$;

drop function if exists public.agroflow_solicitar_acesso(text, text, text, text);

create or replace function public.agroflow_solicitar_acesso(
  p_email text,
  p_nome text,
  p_observacao text,
  p_telefone text
)
returns table (token uuid, email text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token uuid;
  v_email text;
begin
  v_email := lower(trim(p_email));

  if v_email = '' or p_nome is null or trim(p_nome) = '' then
    raise exception 'Nome e e-mail sao obrigatorios.';
  end if;

  if public.agroflow_email_liberado(v_email) then
    raise exception 'Este e-mail ja esta liberado. Use a opcao Entrar ou Criar senha.';
  end if;

  insert into public.solicitacoes_acesso (nome, email, telefone, observacao)
  values (trim(p_nome), v_email, nullif(trim(coalesce(p_telefone, '')), ''), nullif(trim(coalesce(p_observacao, '')), ''))
  returning solicitacoes_acesso.token into v_token;

  return query select v_token, v_email;
end;
$$;

create or replace function public.agroflow_liberar_acesso(p_token uuid)
returns table (email text, nome text, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.solicitacoes_acesso%rowtype;
begin
  if not public.agroflow_is_admin() then
    raise exception 'Apenas o administrador pode liberar acesso.';
  end if;

  select *
  into req
  from public.solicitacoes_acesso
  where token = p_token
  limit 1;

  if req.id is null then
    raise exception 'Pedido de acesso nao encontrado.';
  end if;

  insert into public.usuarios_autorizados (email, nome, liberado_por, ativo)
  values (req.email, req.nome, auth.uid(), true)
  on conflict (email) do update
    set nome = excluded.nome,
        liberado_por = excluded.liberado_por,
        liberado_em = now(),
        ativo = true;

  update public.solicitacoes_acesso
  set status = 'liberado',
      liberado_em = now()
  where id = req.id;

  return query select req.email, req.nome, 'liberado'::text;
end;
$$;

drop policy if exists "agroflow_admin_select_usuarios" on public.usuarios_autorizados;
create policy "agroflow_admin_select_usuarios"
on public.usuarios_autorizados
for select
using (public.agroflow_is_admin());

drop policy if exists "agroflow_admin_select_solicitacoes" on public.solicitacoes_acesso;
create policy "agroflow_admin_select_solicitacoes"
on public.solicitacoes_acesso
for select
using (public.agroflow_is_admin());

grant execute on function public.agroflow_email_liberado(text) to anon, authenticated;
grant execute on function public.agroflow_solicitar_acesso(text, text, text, text) to anon, authenticated;
grant execute on function public.agroflow_liberar_acesso(uuid) to authenticated;

notify pgrst, 'reload schema';
