-- AgroFlow - Corrigir vinculo oficial de fornecedores nos recebimentos.
-- SQL incremental: nao apaga dados, nao altera permissoes e nao troca nome oficial de fornecedor.

create extension if not exists unaccent;

create or replace function public.agroflow_apenas_digitos(valor text)
returns text
language sql
immutable
as $$
  select regexp_replace(coalesce(valor, ''), '\D', '', 'g');
$$;

create or replace function public.agroflow_normalizar_fornecedor(valor text)
returns text
language sql
stable
as $$
  with palavras as (
    select unnest(regexp_split_to_array(
      regexp_replace(
        lower(unaccent(coalesce(valor, ''))),
        '[^a-z0-9]+',
        ' ',
        'g'
      ),
      '\s+'
    )) as palavra
  )
  select coalesce(string_agg(palavra, '' order by palavra), '')
  from palavras
  where palavra <> ''
    and palavra not in ('ltda', 'limitada', 'sa', 's', 'a', 'eireli', 'me', 'epp', 'do', 'da', 'de', 'dos', 'das');
$$;

create or replace function public.agroflow_bloquear_fornecedor_cnpj_duplicado()
returns trigger
language plpgsql
as $$
declare
  novo_cnpj text;
  existente text;
begin
  novo_cnpj := public.agroflow_apenas_digitos(new.cnpj);
  if novo_cnpj = '' then
    return new;
  end if;

  select nome into existente
  from public.fornecedores
  where id <> new.id
    and public.agroflow_apenas_digitos(cnpj) = novo_cnpj
  limit 1;

  if existente is not null then
    raise exception 'Fornecedor duplicado. Este CNPJ/CPF ja esta cadastrado em "%". Como corrigir: use o cadastro existente ou edite o fornecedor ja salvo.', existente
      using errcode = '23505';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_agroflow_bloquear_fornecedor_cnpj_duplicado on public.fornecedores;
create trigger trg_agroflow_bloquear_fornecedor_cnpj_duplicado
before insert or update of cnpj on public.fornecedores
for each row execute function public.agroflow_bloquear_fornecedor_cnpj_duplicado();

-- Vincula recebimentos antigos que tinham apenas fornecedor_nome_manual.
-- So atualiza quando houver exatamente 1 fornecedor compativel pelo nome normalizado.
with candidatos as (
  select
    r.id as recebimento_id,
    f.id as fornecedor_id,
    count(*) over (partition by r.id) as total_candidatos
  from public.recebimentos r
  join public.fornecedores f
    on public.agroflow_normalizar_fornecedor(r.fornecedor_nome_manual) <> ''
   and (
      public.agroflow_normalizar_fornecedor(f.nome) = public.agroflow_normalizar_fornecedor(r.fornecedor_nome_manual)
      or public.agroflow_normalizar_fornecedor(f.nome) like public.agroflow_normalizar_fornecedor(r.fornecedor_nome_manual) || '%'
      or public.agroflow_normalizar_fornecedor(r.fornecedor_nome_manual) like public.agroflow_normalizar_fornecedor(f.nome) || '%'
   )
  where r.fornecedor_id is null
    and r.fornecedor_nome_manual is not null
)
update public.recebimentos r
set fornecedor_id = c.fornecedor_id,
    fornecedor_nome_manual = null,
    updated_at = now()
from candidatos c
where r.id = c.recebimento_id
  and c.total_candidatos = 1;

comment on function public.agroflow_normalizar_fornecedor(text) is
  'Normaliza nomes de fornecedores apenas para comparacao/migracao. A exibicao deve usar fornecedores.nome.';
