-- AgroFlow | Corrigir falso positivo de NF duplicada na Portaria
-- Escopo: Portaria/Recebimentos das unidades de balanca.
-- Nao altera, exclui ou movimenta dados existentes.

begin;

drop index if exists public.portaria_nf_fornecedor_unidade_unica;
create unique index portaria_nf_fornecedor_unidade_unica
  on public.portaria_entradas (
    balanca_id,
    fornecedor_id,
    public.agroflow_nf_numero_normalizado(numero_nf),
    public.agroflow_nf_serie_normalizada(serie_nf)
  )
  where status <> 'CANCELADA';

drop index if exists public.recebimentos_fornecedor_nf_unica_idx;
create unique index recebimentos_fornecedor_nf_unica_idx
  on public.recebimentos (
    balanca_id,
    fornecedor_id,
    public.agroflow_nf_numero_normalizado(nf_numero),
    public.agroflow_nf_serie_normalizada(nf_serie)
  )
  where fornecedor_id is not null
    and balanca_id is not null
    and public.agroflow_nf_numero_normalizado(nf_numero) is not null
    and status <> 'cancelada';

create or replace function private.agroflow_preparar_fluxo_portaria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_documento text := regexp_replace(coalesce(new.cnpj_fornecedor, ''), '\D', '', 'g');
  new_nf text := public.agroflow_nf_numero_normalizado(new.numero_nf);
  new_serie text := public.agroflow_nf_serie_normalizada(new.serie_nf);
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
      and public.agroflow_nf_numero_normalizado(p.numero_nf) = new_nf
      and public.agroflow_nf_serie_normalizada(p.serie_nf) = new_serie
      and nullif(new_documento, '') is not null
      and regexp_replace(coalesce(p.cnpj_fornecedor, ''), '\D', '', 'g') = new_documento
    limit 1;
  end if;

  if duplicate_id is not null then
    raise exception 'NOTA_FISCAL_JA_VINCULADA'
      using errcode = '23505';
  end if;

  return new;
end;
$$;

create or replace function public.recebimentos_prevenir_nf_duplicada()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_nf text := public.agroflow_nf_numero_normalizado(new.nf_numero);
  new_serie text := public.agroflow_nf_serie_normalizada(new.nf_serie);
  new_chave text := nullif(regexp_replace(coalesce(new.nf_chave_acesso, ''), '\D', '', 'g'), '');
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
  left join public.fornecedores f on f.id = r.fornecedor_id
  where r.id is distinct from new.id
    and (new.portaria_id is null or r.portaria_id is distinct from new.portaria_id)
    and r.balanca_id = new.balanca_id
    and coalesce(r.status, '') <> 'cancelada'
    and public.agroflow_nf_numero_normalizado(r.nf_numero) = new_nf
    and public.agroflow_nf_serie_normalizada(r.nf_serie) = new_serie
    and (
      (nullif(new_documento, '') is not null
        and regexp_replace(coalesce(f.cnpj, ''), '\D', '', 'g') = new_documento)
      or (nullif(new_documento, '') is null and r.fornecedor_id = new.fornecedor_id)
    )
  limit 1;

  if duplicate_id is null then
    select c.id
    into duplicate_id
    from public.recebimento_notas_complementares c
    join public.recebimentos r on r.id = c.recebimento_id
    left join public.fornecedores f on f.id = coalesce(c.fornecedor_id, r.fornecedor_id)
    where r.balanca_id = new.balanca_id
      and coalesce(r.status, '') <> 'cancelada'
      and public.agroflow_nf_numero_normalizado(c.numero_nf) = new_nf
      and public.agroflow_nf_serie_normalizada(c.serie) = new_serie
      and (
        (nullif(new_documento, '') is not null
          and regexp_replace(coalesce(f.cnpj, ''), '\D', '', 'g') = new_documento)
        or (nullif(new_documento, '') is null
          and coalesce(c.fornecedor_id, r.fornecedor_id) = new.fornecedor_id)
      )
    limit 1;
  end if;

  if duplicate_id is null and new_chave is not null then
    select c.id
    into duplicate_id
    from public.recebimento_notas_complementares c
    join public.recebimentos r on r.id = c.recebimento_id
    where r.balanca_id = new.balanca_id
      and coalesce(r.status, '') <> 'cancelada'
      and nullif(regexp_replace(coalesce(c.chave_nfe, ''), '\D', '', 'g'), '') = new_chave
    limit 1;
  end if;

  if duplicate_id is not null then
    raise exception 'NOTA_FISCAL_JA_VINCULADA'
      using errcode = '23505';
  end if;

  return new;
end;
$$;

comment on function private.agroflow_preparar_fluxo_portaria() is
  'Valida unidade e duplicidade exata por fornecedor, numero e serie antes de definir o fluxo da Portaria.';

comment on function public.recebimentos_prevenir_nf_duplicada() is
  'Impede NF principal duplicada na mesma unidade por fornecedor, numero e serie, sem bloquear series diferentes.';

commit;
