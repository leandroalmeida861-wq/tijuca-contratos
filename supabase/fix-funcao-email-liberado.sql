-- Correção imediata: cria a função que está faltando.
-- Execute este SQL no Supabase SQL Editor.

create extension if not exists "pgcrypto";

create table if not exists public.usuarios_autorizados (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  nome text,
  liberado_por uuid,
  liberado_em timestamptz not null default now(),
  ativo boolean not null default true
);

insert into public.usuarios_autorizados (email, nome, ativo)
values ('leandroalmeida861@gmail.com', 'Leandro Almeida', true)
on conflict (email) do update set ativo = true;

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

grant execute on function public.agroflow_email_liberado(text) to anon, authenticated;

notify pgrst, 'reload schema';
