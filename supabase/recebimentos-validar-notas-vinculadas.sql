-- AgroFlow | Validar NF principal e complementar vinculadas ao recebimento
--
-- Migration incremental e nao destrutiva:
-- - nao altera nem exclui recebimentos ou notas existentes;
-- - preserva o bloqueio mais restritivo ja existente para NF principal;
-- - impede reutilizar numero/serie ou chave de uma NF complementar na mesma unidade;
-- - permite editar o proprio registro e preserva o vinculo legitimo com a NF principal.

begin;

create unique index if not exists recebimento_complementos_recebimento_nf_serie_unica
on public.recebimento_notas_complementares (
  recebimento_id,
  public.agroflow_nf_numero_normalizado(numero_nf),
  public.agroflow_nf_serie_normalizada(serie)
)
where public.agroflow_nf_numero_normalizado(numero_nf) is not null;

create or replace function private.agroflow_validar_nota_complementar_vinculada()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  recebimento_pai public.recebimentos%rowtype;
  fornecedor_nota uuid;
  documento_nota text := '';
  numero_nota text := public.agroflow_nf_numero_normalizado(new.numero_nf);
  serie_nota text := public.agroflow_nf_serie_normalizada(new.serie);
  chave_nota text := nullif(regexp_replace(coalesce(new.chave_nfe, ''), '\D', '', 'g'), '');
  duplicada uuid;
begin
  select r.*
  into recebimento_pai
  from public.recebimentos r
  where r.id = new.recebimento_id;

  if not found then
    raise exception 'RECEBIMENTO_NAO_ENCONTRADO'
      using errcode = '23503';
  end if;

  if coalesce(recebimento_pai.status, '') = 'cancelada' then
    return new;
  end if;

  fornecedor_nota := coalesce(new.fornecedor_id, recebimento_pai.fornecedor_id);
  select regexp_replace(coalesce(f.cnpj, ''), '\D', '', 'g')
  into documento_nota
  from public.fornecedores f
  where f.id = fornecedor_nota;

  select c.id
  into duplicada
  from public.recebimento_notas_complementares c
  join public.recebimentos r on r.id = c.recebimento_id
  left join public.fornecedores f on f.id = coalesce(c.fornecedor_id, r.fornecedor_id)
  where c.id is distinct from new.id
    and r.balanca_id = recebimento_pai.balanca_id
    and coalesce(r.status, '') <> 'cancelada'
    and public.agroflow_nf_numero_normalizado(c.numero_nf) = numero_nota
    and public.agroflow_nf_serie_normalizada(c.serie) = serie_nota
    and (
      (nullif(documento_nota, '') is not null
        and regexp_replace(coalesce(f.cnpj, ''), '\D', '', 'g') = documento_nota)
      or (nullif(documento_nota, '') is null
        and coalesce(c.fornecedor_id, r.fornecedor_id) = fornecedor_nota)
    )
  limit 1;

  if duplicada is null then
    select r.id
    into duplicada
    from public.recebimentos r
    left join public.fornecedores f on f.id = r.fornecedor_id
    where r.balanca_id = recebimento_pai.balanca_id
      and coalesce(r.status, '') <> 'cancelada'
      and public.agroflow_nf_numero_normalizado(r.nf_numero) = numero_nota
      and public.agroflow_nf_serie_normalizada(r.nf_serie) = serie_nota
      and (
        (nullif(documento_nota, '') is not null
          and regexp_replace(coalesce(f.cnpj, ''), '\D', '', 'g') = documento_nota)
        or (nullif(documento_nota, '') is null and r.fornecedor_id = fornecedor_nota)
      )
    limit 1;
  end if;

  if duplicada is null and chave_nota is not null then
    select nota.id
    into duplicada
    from (
      select r.id
      from public.recebimentos r
      where r.balanca_id = recebimento_pai.balanca_id
        and coalesce(r.status, '') <> 'cancelada'
        and nullif(regexp_replace(coalesce(r.nf_chave_acesso, ''), '\D', '', 'g'), '') = chave_nota
      union all
      select c.id
      from public.recebimento_notas_complementares c
      join public.recebimentos r on r.id = c.recebimento_id
      where c.id is distinct from new.id
        and r.balanca_id = recebimento_pai.balanca_id
        and coalesce(r.status, '') <> 'cancelada'
        and nullif(regexp_replace(coalesce(c.chave_nfe, ''), '\D', '', 'g'), '') = chave_nota
    ) nota
    limit 1;
  end if;

  if duplicada is not null then
    raise exception 'NOTA_FISCAL_JA_VINCULADA'
      using errcode = '23505';
  end if;

  return new;
end;
$$;

revoke all on function private.agroflow_validar_nota_complementar_vinculada()
  from public, anon, authenticated;

drop trigger if exists recebimento_complementos_prevenir_duplicada
  on public.recebimento_notas_complementares;
create trigger recebimento_complementos_prevenir_duplicada
before insert or update of recebimento_id, numero_nf, serie, chave_nfe, fornecedor_id
on public.recebimento_notas_complementares
for each row execute function private.agroflow_validar_nota_complementar_vinculada();

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

drop trigger if exists recebimentos_prevenir_nf_duplicada on public.recebimentos;
create trigger recebimentos_prevenir_nf_duplicada
before insert or update of nf_numero, nf_serie, nf_chave_acesso, fornecedor_id, balanca_id, portaria_id, status
on public.recebimentos
for each row execute function public.recebimentos_prevenir_nf_duplicada();

comment on function private.agroflow_validar_nota_complementar_vinculada() is
  'Impede reutilizar NF complementar por unidade, fornecedor, numero, serie ou chave, preservando edicao do proprio registro.';

commit;
