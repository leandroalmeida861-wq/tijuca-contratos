-- AgroFlow - corrige o Auth Hook para consultar as tabelas atuais de acesso.
-- Nao altera usuarios, perfis, permissoes ou dados operacionais.

create or replace function public.agroflow_hook_verificar_acesso(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text;
  v_user_id text;
  v_liberado boolean := false;
begin
  v_email := lower(trim(coalesce(
    event->>'email',
    event->'claims'->>'email',
    event->'user'->>'email'
  )));
  v_user_id := coalesce(
    event->>'user_id',
    event->'claims'->>'sub',
    event->'user'->>'id'
  );

  if v_email is null or v_email = '' then
    return event;
  end if;

  select
    v_email = 'leandroalmeida861@gmail.com'
    or exists (
      select 1
      from public.profiles p
      where p.ativo
        and (
          p.user_id::text = v_user_id
          or lower(trim(p.email)) = v_email
        )
    )
    or exists (
      select 1
      from public.usuarios_autorizados ua
      where ua.status = 'ativo'
        and (
          ua.user_id::text = v_user_id
          or lower(trim(ua.email)) = v_email
        )
    )
  into v_liberado;

  if not coalesce(v_liberado, false) then
    return jsonb_build_object(
      'error',
      jsonb_build_object(
        'http_code', 403,
        'message', 'Este e-mail ainda nao foi liberado pelo administrador. Aguarde a aprovacao do acesso e tente novamente.'
      )
    );
  end if;

  return event;
end;
$$;

revoke all on function public.agroflow_hook_verificar_acesso(jsonb) from public, anon, authenticated;
grant execute on function public.agroflow_hook_verificar_acesso(jsonb) to supabase_auth_admin, service_role;
