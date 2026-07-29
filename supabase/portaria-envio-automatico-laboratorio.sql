-- AgroFlow | Portaria: envio automatico para o laboratorio
--
-- Migration incremental e preservadora:
-- - nao altera registros existentes;
-- - mantem o fluxo direto para Recebimentos quando houver dispensa;
-- - envia novas entradas sem dispensa ao Laboratorio na mesma transacao;
-- - preserva unidade, duplicidade, RLS e permissoes existentes.

begin;

create or replace function private.agroflow_preparar_fluxo_portaria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_documento text := regexp_replace(coalesce(new.cnpj_fornecedor, ''), '\D', '', 'g');
  duplicate_id uuid;
begin
  if new.balanca_id is null then
    raise exception 'UNIDADE_OBRIGATORIA'
      using errcode = '23514';
  end if;

  if public.agroflow_unidade_codigo(new.balanca_id) = 'iguatu' then
    new.dispensa_laboratorio := true;
  end if;

  new.dispensa_laboratorio := coalesce(new.dispensa_laboratorio, false);

  if coalesce(new.status, '') <> 'CANCELADA' then
    if new.dispensa_laboratorio then
      if coalesce(new.status, '') <> 'RECEBIMENTO_FINALIZADO' then
        new.status := 'ENVIADO_RECEBIMENTO';
      end if;
    elsif tg_op = 'INSERT' then
      new.status := 'ENVIADO_LABORATORIO';
    elsif old.dispensa_laboratorio is distinct from false then
      new.status := 'ENVIADO_LABORATORIO';
    end if;
  end if;

  if coalesce(new.status, '') <> 'CANCELADA' then
    select p.id
    into duplicate_id
    from public.portaria_entradas p
    where p.id is distinct from new.id
      and p.balanca_id = new.balanca_id
      and p.status <> 'CANCELADA'
      and public.agroflow_nf_numero_normalizado(p.numero_nf)
        = public.agroflow_nf_numero_normalizado(new.numero_nf)
      and nullif(new_documento, '') is not null
      and regexp_replace(coalesce(p.cnpj_fornecedor, ''), '\D', '', 'g') = new_documento
    limit 1;
  end if;

  if duplicate_id is not null then
    raise exception 'NF duplicada para este fornecedor e unidade. Edite a entrada existente ou confira o numero da NF.'
      using errcode = '23505';
  end if;

  return new;
end;
$$;

revoke all on function private.agroflow_preparar_fluxo_portaria()
  from public, anon, authenticated;

commit;
