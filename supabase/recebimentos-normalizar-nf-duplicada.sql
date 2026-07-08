-- AgroFlow - normalizar numero da NF para bloquear duplicidade com zeros a esquerda.
-- Exemplos tratados como a mesma NF: 6, 06, 006 e 0006.
-- Nao altera dados existentes, layout, permississoes, filtros ou calculos.

create or replace function public.agroflow_nf_numero_normalizado(value text)
returns text
language sql
immutable
as $$
  select coalesce(nullif(ltrim(regexp_replace(coalesce(value, ''), '\D', '', 'g'), '0'), ''), '0')
  where nullif(regexp_replace(coalesce(value, ''), '\D', '', 'g'), '') is not null;
$$;

create or replace function public.recebimentos_prevenir_nf_duplicada()
returns trigger
language plpgsql
as $$
declare
  new_nf text := public.agroflow_nf_numero_normalizado(new.nf_numero);
  new_cnpj text := '';
  new_nome text := '';
  duplicate_id uuid;
begin
  if new.fornecedor_id is null
    or nullif(new_nf, '') is null
    or coalesce(new.status, '') = 'cancelada' then
    return new;
  end if;

  select
    regexp_replace(coalesce(cnpj, ''), '\D', '', 'g'),
    lower(regexp_replace(trim(coalesce(nome, '')), '\s+', ' ', 'g'))
  into new_cnpj, new_nome
  from public.fornecedores
  where id = new.fornecedor_id;

  select r.id
  into duplicate_id
  from public.recebimentos r
  left join public.fornecedores f on f.id = r.fornecedor_id
  where r.id <> new.id
    and coalesce(r.status, '') <> 'cancelada'
    and public.agroflow_nf_numero_normalizado(r.nf_numero) = new_nf
    and (
      r.fornecedor_id = new.fornecedor_id
      or (
        nullif(new_cnpj, '') is not null
        and regexp_replace(coalesce(f.cnpj, ''), '\D', '', 'g') = new_cnpj
      )
      or (
        nullif(new_nome, '') is not null
        and lower(regexp_replace(trim(coalesce(f.nome, '')), '\s+', ' ', 'g')) = new_nome
      )
    )
  limit 1;

  if duplicate_id is not null then
    raise exception 'NF duplicada para este fornecedor. Edite o recebimento existente ou confira o numero da NF.'
      using errcode = '23505';
  end if;

  return new;
end;
$$;

comment on function public.agroflow_nf_numero_normalizado(text) is
  'Normaliza numero de NF removendo caracteres nao numericos e zeros a esquerda para validacao de duplicidade.';
