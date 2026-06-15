-- Reparo AgroFlow: convites aprovados que voltam com access_denied.
-- Rode no SQL Editor do Supabase depois de publicar a API corrigida.
-- Ele ativa usuarios aprovados, vincula user_id do Supabase Auth por e-mail
-- e grava metadados simples para hooks/politicas que consultem o Auth.

insert into public.usuarios_autorizados (nome, email, perfil, status, created_at, updated_at)
select
  coalesce(sa.nome, 'Usuario autorizado') as nome,
  lower(trim(sa.email)) as email,
  case when lower(trim(sa.email)) = 'leandroalmeida861@gmail.com' then 'admin' else 'operador' end as perfil,
  'ativo' as status,
  now() as created_at,
  now() as updated_at
from public.solicitacoes_acesso sa
where sa.status = 'aprovado'
  and lower(trim(coalesce(sa.email, ''))) <> ''
on conflict (email) do update
set
  nome = coalesce(excluded.nome, public.usuarios_autorizados.nome),
  perfil = case
    when lower(excluded.email) = 'leandroalmeida861@gmail.com' then 'admin'
    else coalesce(public.usuarios_autorizados.perfil, excluded.perfil, 'operador')
  end,
  status = 'ativo',
  updated_at = now();

update public.usuarios_autorizados ua
set
  user_id = au.id,
  status = 'ativo',
  updated_at = now()
from auth.users au
where lower(trim(au.email)) = lower(trim(ua.email))
  and (ua.user_id is distinct from au.id or ua.status <> 'ativo');

update auth.users au
set raw_app_meta_data =
  coalesce(au.raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object(
    'agroflow_status', 'ativo',
    'agroflow_perfil', coalesce(ua.perfil, 'operador')
  )
from public.usuarios_autorizados ua
where lower(trim(au.email)) = lower(trim(ua.email))
  and ua.status = 'ativo';

insert into public.usuarios_autorizados (nome, email, perfil, status, user_id, created_at, updated_at)
select
  coalesce(au.raw_user_meta_data->>'nome', 'Leandro Almeida') as nome,
  lower(trim(au.email)) as email,
  'admin' as perfil,
  'ativo' as status,
  au.id as user_id,
  now() as created_at,
  now() as updated_at
from auth.users au
where lower(trim(au.email)) = 'leandroalmeida861@gmail.com'
on conflict (email) do update
set
  user_id = excluded.user_id,
  perfil = 'admin',
  status = 'ativo',
  updated_at = now();

select
  ua.email,
  ua.perfil,
  ua.status,
  ua.user_id is not null as vinculado_ao_auth
from public.usuarios_autorizados ua
order by ua.updated_at desc
limit 20;
