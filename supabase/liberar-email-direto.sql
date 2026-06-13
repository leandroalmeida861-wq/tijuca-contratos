-- AgroFlow - libera um e-mail autorizado diretamente pelo administrador logado.
-- Execute este arquivo no SQL Editor do Supabase.

create or replace function public.agroflow_liberar_email_direto(
  p_email text,
  p_nome text default null
)
returns table (email text, nome text, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_nome text;
begin
  if not public.agroflow_is_admin() then
    raise exception 'Apenas o administrador pode liberar acesso.';
  end if;

  v_email := lower(trim(coalesce(p_email, '')));
  v_nome := nullif(trim(coalesce(p_nome, '')), '');

  if v_email = '' then
    raise exception 'E-mail obrigatorio para liberacao.';
  end if;

  insert into public.usuarios_autorizados (email, nome, liberado_por, ativo)
  values (v_email, v_nome, auth.uid(), true)
  on conflict (email) do update
    set nome = coalesce(excluded.nome, public.usuarios_autorizados.nome),
        liberado_por = excluded.liberado_por,
        liberado_em = now(),
        ativo = true;

  update public.solicitacoes_acesso
     set status = 'liberado',
         liberado_em = now()
   where lower(email) = v_email
     and status <> 'liberado';

  return query select v_email, v_nome, 'liberado'::text;
end;
$$;

grant execute on function public.agroflow_liberar_email_direto(text, text) to authenticated;

notify pgrst, 'reload schema';
