-- AgroFlow - correcao do fluxo pedido -> aprovacao -> login.
-- Execute no SQL Editor do Supabase do projeto AgroFlow.
--
-- O que este SQL garante:
-- 1. O e-mail aprovado fica ativo em public.usuarios_autorizados.
-- 2. A solicitacao correspondente em public.solicitacoes_acesso deixa de ficar pendente.
-- 3. O PostgREST recarrega o cache de funcoes.

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
