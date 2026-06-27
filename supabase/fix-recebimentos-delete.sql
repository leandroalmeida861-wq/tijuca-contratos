-- AgroFlow - corrigir exclusao de recebimentos no modulo Balancas.
-- Motivo: no DELETE, o log nao pode referenciar o recebimento apagado.
-- Execute no Supabase SQL Editor. Nao apaga dados existentes.

create or replace function public.recebimento_audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.recebimento_logs (
    user_id,
    recebimento_id,
    acao,
    dados_anteriores,
    dados_novos
  )
  values (
    auth.uid(),
    case when tg_op = 'DELETE' then null else new.id end,
    case tg_op
      when 'INSERT' then 'cadastrar'
      when 'UPDATE' then 'editar'
      else 'excluir'
    end,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );

  return coalesce(new, old);
end;
$$;

comment on function public.recebimento_audit_trigger() is
  'Registra auditoria de recebimentos. Em DELETE, recebimento_id fica nulo para evitar FK contra registro apagado.';
