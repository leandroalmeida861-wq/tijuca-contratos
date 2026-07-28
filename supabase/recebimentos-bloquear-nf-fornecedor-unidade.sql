-- AgroFlow | Impedir NF duplicada por unidade e fornecedor
--
-- Migration incremental e preservadora:
-- - nao altera nem exclui recebimentos existentes;
-- - considera duplicada a mesma unidade + fornecedor + numero da NF;
-- - mantem a serie da NF apenas como informacao do documento;
-- - preserva a edicao do proprio registro e o isolamento por unidade.

begin;

drop index if exists public.portaria_nf_fornecedor_serie_unica;
create unique index portaria_nf_fornecedor_unidade_unica
on public.portaria_entradas (
  balanca_id,
  fornecedor_id,
  public.agroflow_nf_numero_normalizado(numero_nf)
)
where status <> 'CANCELADA';

drop index if exists public.recebimentos_fornecedor_nf_unica_idx;
create unique index recebimentos_fornecedor_nf_unica_idx
on public.recebimentos (
  balanca_id,
  fornecedor_id,
  public.agroflow_nf_numero_normalizado(nf_numero)
)
where fornecedor_id is not null
  and balanca_id is not null
  and public.agroflow_nf_numero_normalizado(nf_numero) is not null
  and status <> 'cancelada';

create or replace function public.recebimentos_prevenir_nf_duplicada()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_nf text := public.agroflow_nf_numero_normalizado(new.nf_numero);
  new_documento text := '';
  duplicate_id uuid;
begin
  if new.balanca_id is null then
    raise exception 'UNIDADE_OBRIGATORIA'
      using errcode = '23514';
  end if;

  if new.fornecedor_id is null
    or nullif(new_nf, '') is null
    or coalesce(new.status, '') = 'cancelada' then
    return new;
  end if;

  select regexp_replace(coalesce(f.cnpj, ''), '\D', '', 'g')
  into new_documento
  from public.fornecedores f
  where f.id = new.fornecedor_id;

  select r.id
  into duplicate_id
  from public.recebimentos r
  join public.fornecedores f on f.id = r.fornecedor_id
  where r.id is distinct from new.id
    and (new.portaria_id is null or r.portaria_id is distinct from new.portaria_id)
    and r.balanca_id = new.balanca_id
    and coalesce(r.status, '') <> 'cancelada'
    and public.agroflow_nf_numero_normalizado(r.nf_numero) = new_nf
    and nullif(new_documento, '') is not null
    and regexp_replace(coalesce(f.cnpj, ''), '\D', '', 'g') = new_documento
  limit 1;

  if duplicate_id is not null then
    raise exception 'NF duplicada para este fornecedor e unidade. Edite o recebimento existente ou confira o numero da NF.'
      using errcode = '23505';
  end if;

  return new;
end;
$$;

drop trigger if exists recebimentos_prevenir_nf_duplicada on public.recebimentos;
create trigger recebimentos_prevenir_nf_duplicada
before insert or update of nf_numero, fornecedor_id, balanca_id, portaria_id, status
on public.recebimentos
for each row execute function public.recebimentos_prevenir_nf_duplicada();

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
      new.status := 'AGUARDANDO_LABORATORIO';
    elsif old.dispensa_laboratorio is distinct from false then
      new.status := 'AGUARDANDO_LABORATORIO';
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
