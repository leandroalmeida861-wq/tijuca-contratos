-- Correção da função de solicitação de acesso do AgroFlow.
-- Execute este arquivo no SQL Editor do Supabase.

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
    raise exception 'Este e-mail ja esta liberado. Use a opcao Entrar.';
  end if;

  insert into public.solicitacoes_acesso (nome, email, telefone, observacao)
  values (
    trim(p_nome),
    v_email,
    nullif(trim(coalesce(p_telefone, '')), ''),
    nullif(trim(coalesce(p_observacao, '')), '')
  )
  returning solicitacoes_acesso.token into v_token;

  return query select v_token, v_email;
end;
$$;

grant execute on function public.agroflow_solicitar_acesso(text, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
