-- AgroFlow | Portaria: fluxo atomico e duplicidade por unidade/NF/serie
--
-- Migration incremental e preservadora:
-- - nao apaga, move ou copia recebimentos entre unidades;
-- - vincula cada recebimento novo exclusivamente por portaria_id;
-- - cria Portaria, recebimento e item na mesma transacao do Postgres;
-- - limita a duplicidade real a unidade + documento + NF + serie;
-- - corrige somente entradas diretas que ficaram incompletas por falha anterior.

begin;

alter table public.recebimentos
  add column if not exists nf_serie text;

create or replace function public.agroflow_nf_serie_normalizada(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(btrim(coalesce(value, '')));
$$;

comment on function public.agroflow_nf_serie_normalizada(text) is
  'Normaliza a serie da NF para validacao de duplicidade por unidade.';

-- A chave anterior bloqueava a mesma NF em unidades e series diferentes.
drop index if exists public.portaria_nf_fornecedor_serie_unica;
create unique index portaria_nf_fornecedor_serie_unica
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

create or replace function public.recebimentos_prevenir_nf_duplicada()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_nf text := public.agroflow_nf_numero_normalizado(new.nf_numero);
  new_serie text := public.agroflow_nf_serie_normalizada(new.nf_serie);
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
    and public.agroflow_nf_serie_normalizada(r.nf_serie) = new_serie
    and nullif(new_documento, '') is not null
    and regexp_replace(coalesce(f.cnpj, ''), '\D', '', 'g') = new_documento
  limit 1;

  if duplicate_id is not null then
    raise exception 'NF duplicada para este fornecedor, serie e unidade. Edite o recebimento existente ou confira os dados da NF.'
      using errcode = '23505';
  end if;

  return new;
end;
$$;

drop trigger if exists recebimentos_prevenir_nf_duplicada on public.recebimentos;
create trigger recebimentos_prevenir_nf_duplicada
before insert or update of nf_numero, nf_serie, fornecedor_id, balanca_id, portaria_id, status
on public.recebimentos
for each row execute function public.recebimentos_prevenir_nf_duplicada();

create schema if not exists private;

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
      and public.agroflow_nf_serie_normalizada(p.serie_nf)
        = public.agroflow_nf_serie_normalizada(new.serie_nf)
      and nullif(new_documento, '') is not null
      and regexp_replace(coalesce(p.cnpj_fornecedor, ''), '\D', '', 'g') = new_documento
    limit 1;
  end if;

  if duplicate_id is not null then
    raise exception 'NF duplicada para este fornecedor, serie e unidade. Edite a entrada existente ou confira os dados da NF.'
      using errcode = '23505';
  end if;

  return new;
end;
$$;

revoke all on function private.agroflow_preparar_fluxo_portaria()
  from public, anon, authenticated;

drop trigger if exists portaria_preparar_fluxo on public.portaria_entradas;
create trigger portaria_preparar_fluxo
before insert or update of
  balanca_id,
  fornecedor_id,
  cnpj_fornecedor,
  numero_nf,
  serie_nf,
  dispensa_laboratorio
on public.portaria_entradas
for each row
execute function private.agroflow_preparar_fluxo_portaria();

create or replace function private.agroflow_criar_recebimento_da_portaria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recebimento_id uuid;
  peso_nf_convertido numeric;
begin
  if new.status = 'CANCELADA' then
    return new;
  end if;

  if new.balanca_id is null then
    raise exception 'UNIDADE_OBRIGATORIA'
      using errcode = '23514';
  end if;

  select r.id
  into v_recebimento_id
  from public.recebimentos r
  where r.portaria_id = new.id
    and r.status <> 'cancelada'
  order by r.created_at desc
  limit 1
  for update;

  if v_recebimento_id is not null then
    if exists (
      select 1
      from public.recebimentos r
      where r.id = v_recebimento_id
        and r.balanca_id is distinct from new.balanca_id
    ) then
      raise exception 'UNIDADE_DIVERGENTE'
        using errcode = '23514';
    end if;

    return new;
  end if;

  peso_nf_convertido := case upper(btrim(coalesce(new.unidade_nota, 'KG')))
    when 'SC' then new.peso_nf_kg * 60
    when 'SACA' then new.peso_nf_kg * 60
    when 'SACAS' then new.peso_nf_kg * 60
    when 'SCS' then new.peso_nf_kg * 60
    when 'TON' then new.peso_nf_kg * 1000
    when 'TONELADA' then new.peso_nf_kg * 1000
    when 'TONELADAS' then new.peso_nf_kg * 1000
    else new.peso_nf_kg
  end;

  insert into public.recebimentos (
    user_id,
    data,
    balanca_id,
    veiculo_id,
    motorista_id,
    transportadora_id,
    fornecedor_id,
    produto_id,
    tipo_veiculo,
    qtd_eixos,
    nf_numero,
    nf_serie,
    peso_bruto,
    tara,
    peso_nf,
    status,
    observacao,
    quantidade_nota,
    unidade_nota,
    portaria_id,
    dispensa_laboratorio
  )
  values (
    new.created_by,
    new.data_entrada,
    new.balanca_id,
    new.veiculo_id,
    new.motorista_id,
    new.transportadora_id,
    new.fornecedor_id,
    new.produto_id,
    new.tipo_veiculo,
    new.qtd_eixos,
    new.numero_nf,
    new.serie_nf,
    0,
    0,
    peso_nf_convertido,
    'pendente',
    new.observacao,
    new.peso_nf_kg,
    coalesce(new.unidade_nota, 'KG'),
    new.id,
    new.dispensa_laboratorio
  )
  returning id into v_recebimento_id;

  insert into public.recebimento_itens (
    recebimento_id,
    produto_id,
    quantidade,
    unidade,
    valor_unitario,
    desconto,
    valor_total,
    ordem
  )
  values (
    v_recebimento_id,
    new.produto_id,
    new.peso_nf_kg,
    coalesce(new.unidade_nota, 'KG'),
    0,
    0,
    0,
    1
  )
  on conflict (recebimento_id, ordem) do nothing;

  return new;
end;
$$;

revoke all on function private.agroflow_criar_recebimento_da_portaria()
  from public, anon, authenticated;

drop trigger if exists portaria_criar_recebimento on public.portaria_entradas;
create trigger portaria_criar_recebimento
after insert or update of
  data_entrada,
  balanca_id,
  veiculo_id,
  motorista_id,
  transportadora_id,
  fornecedor_id,
  produto_id,
  tipo_veiculo,
  qtd_eixos,
  numero_nf,
  serie_nf,
  peso_nf_kg,
  unidade_nota,
  observacao,
  dispensa_laboratorio
on public.portaria_entradas
for each row
execute function private.agroflow_criar_recebimento_da_portaria();

-- Preserva a serie em recebimentos que ja possuem origem na Portaria.
update public.recebimentos r
set nf_serie = p.serie_nf
from public.portaria_entradas p
where r.portaria_id = p.id
  and nullif(btrim(coalesce(r.nf_serie, '')), '') is null;

-- Reprocessa apenas entradas diretas incompletas. O UPDATE dispara a mesma
-- regra atomica e idempotente, sem IDs fixos e sem alterar outras entradas.
update public.portaria_entradas p
set dispensa_laboratorio = p.dispensa_laboratorio
where p.dispensa_laboratorio = true
  and p.status <> 'CANCELADA'
  and not exists (
    select 1
    from public.recebimentos r
    where r.portaria_id = p.id
      and r.status <> 'cancelada'
  );

commit;
