-- AgroFlow - Armazenagem de materia-prima
-- Migration incremental e aditiva. Nao altera registros de Portaria, Laboratorio ou Recebimentos.
-- O peso de armazenagem vem exclusivamente da NF, por item/produto.

begin;

create extension if not exists pgcrypto;
create schema if not exists private;

-- 1. Permissao da nova subaba do modulo Balancas.
insert into public.permissoes_menu (
  perfil, menu, visualizar, cadastrar, editar, excluir, cancelar, aprovar, exportar
)
select perfil, 'balancas_armazenagem', false, false, false, false, false, false, false
from unnest(array[
  'admin', 'gestor', 'operador', 'visualizador',
  'operador_laboratorio', 'operador_balanca', 'operador_portaria'
]) as p(perfil)
on conflict (perfil, menu) do nothing;

update public.permissoes_menu
set visualizar = true,
    cadastrar = true,
    editar = true,
    excluir = true,
    cancelar = true,
    aprovar = true,
    exportar = true,
    atualizado_em = now()
where perfil = 'admin'
  and menu = 'balancas_armazenagem';

-- Gestor, Operador e Visualizador preservam o nivel que ja possuem no menu Balancas.
update public.permissoes_menu destino
set visualizar = origem.visualizar,
    cadastrar = origem.cadastrar,
    editar = origem.editar,
    excluir = origem.excluir,
    cancelar = origem.cancelar,
    aprovar = origem.aprovar,
    exportar = origem.exportar,
    atualizado_em = now()
from public.permissoes_menu origem
where destino.perfil = origem.perfil
  and destino.menu = 'balancas_armazenagem'
  and origem.menu = 'balancas'
  and destino.perfil in ('gestor', 'operador', 'visualizador');

-- 2. Cabecalho unico por recebimento.
create table if not exists public.armazenagens_materia_prima (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default public.agroflow_empresa_atual_id()
    references public.empresas(id) on delete restrict,
  recebimento_id uuid not null references public.recebimentos(id) on delete restrict,
  data_armazenagem date not null,
  peso_nota numeric(18, 3) not null default 0,
  origem_peso text not null default 'RECEBIMENTO',
  peso_distribuido numeric(18, 3) not null default 0,
  saldo_distribuir numeric(18, 3) not null default 0,
  status text not null default 'PENDENTE',
  observacao text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_by_nome text,
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  updated_by_nome text,
  updated_at timestamptz not null default now(),
  cancelled_by uuid references auth.users(id) on delete set null,
  cancelled_at timestamptz,
  motivo_cancelamento text,
  constraint armazenagens_recebimento_unico unique (recebimento_id),
  constraint armazenagens_pesos_validos check (
    peso_nota > 0
    and peso_distribuido >= 0
    and saldo_distribuir >= 0
    and peso_distribuido <= peso_nota
  ),
  constraint armazenagens_origem_peso_check check (origem_peso in ('XML', 'NOTA', 'RECEBIMENTO')),
  constraint armazenagens_status_check check (
    status in ('PENDENTE', 'PARCIALMENTE_ARMAZENADO', 'ARMAZENADO', 'CANCELADO')
  )
);

-- 3. Controle do peso da NF por item/produto.
create table if not exists public.armazenagem_itens (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default public.agroflow_empresa_atual_id()
    references public.empresas(id) on delete restrict,
  armazenagem_id uuid not null references public.armazenagens_materia_prima(id) on delete cascade,
  recebimento_item_id uuid references public.recebimento_itens(id) on delete restrict,
  produto_id uuid references public.produtos(id) on delete restrict,
  ordem integer not null default 1,
  peso_nota numeric(18, 3) not null,
  origem_peso text not null,
  peso_distribuido numeric(18, 3) not null default 0,
  saldo_distribuir numeric(18, 3) not null,
  status text not null default 'PENDENTE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint armazenagem_itens_peso_check check (
    peso_nota > 0
    and peso_distribuido >= 0
    and saldo_distribuir >= 0
    and peso_distribuido <= peso_nota
  ),
  constraint armazenagem_itens_origem_check check (origem_peso in ('XML', 'NOTA', 'RECEBIMENTO')),
  constraint armazenagem_itens_status_check check (
    status in ('PENDENTE', 'PARCIALMENTE_ARMAZENADO', 'ARMAZENADO', 'CANCELADO')
  ),
  constraint armazenagem_itens_ordem_unica unique (armazenagem_id, ordem)
);

create unique index if not exists armazenagem_itens_recebimento_item_unico
  on public.armazenagem_itens(recebimento_item_id)
  where recebimento_item_id is not null;

-- 4. Divisoes entre Silos e Baias.
create table if not exists public.armazenagem_distribuicoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default public.agroflow_empresa_atual_id()
    references public.empresas(id) on delete restrict,
  armazenagem_id uuid not null references public.armazenagens_materia_prima(id) on delete cascade,
  armazenagem_item_id uuid not null references public.armazenagem_itens(id) on delete cascade,
  silo text,
  baia text,
  peso_armazenado numeric(18, 3) not null,
  observacao text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_by_nome text,
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  updated_by_nome text,
  updated_at timestamptz not null default now(),
  constraint armazenagem_distribuicoes_local_check check (
    nullif(btrim(coalesce(silo, '')), '') is not null
    or nullif(btrim(coalesce(baia, '')), '') is not null
  ),
  constraint armazenagem_distribuicoes_peso_check check (peso_armazenado > 0)
);

-- 5. Fechamento mensal por empresa.
create table if not exists public.fechamentos_armazenagem (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default public.agroflow_empresa_atual_id()
    references public.empresas(id) on delete restrict,
  ano integer not null,
  mes integer not null,
  status text not null default 'ABERTO',
  fechado_por uuid references auth.users(id) on delete set null,
  fechado_por_nome text,
  fechado_em timestamptz,
  justificativa_pendencias text,
  reaberto_por uuid references auth.users(id) on delete set null,
  reaberto_por_nome text,
  reaberto_em timestamptz,
  justificativa_reabertura text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fechamentos_armazenagem_ano_check check (ano between 2000 and 2200),
  constraint fechamentos_armazenagem_mes_check check (mes between 1 and 12),
  constraint fechamentos_armazenagem_status_check check (status in ('ABERTO', 'FECHADO')),
  constraint fechamentos_armazenagem_periodo_unico unique (empresa_id, ano, mes)
);

create index if not exists armazenagens_empresa_data_idx
  on public.armazenagens_materia_prima(empresa_id, data_armazenagem desc);
create index if not exists armazenagens_status_idx
  on public.armazenagens_materia_prima(status);
create index if not exists armazenagens_cancelled_by_idx
  on public.armazenagens_materia_prima(cancelled_by);
create index if not exists armazenagens_created_by_idx
  on public.armazenagens_materia_prima(created_by);
create index if not exists armazenagens_updated_by_idx
  on public.armazenagens_materia_prima(updated_by);
create index if not exists armazenagem_itens_armazenagem_idx
  on public.armazenagem_itens(armazenagem_id, ordem);
create index if not exists armazenagem_itens_produto_idx
  on public.armazenagem_itens(produto_id);
create index if not exists armazenagem_itens_empresa_idx
  on public.armazenagem_itens(empresa_id);
create index if not exists armazenagem_distribuicoes_item_idx
  on public.armazenagem_distribuicoes(armazenagem_item_id);
create index if not exists armazenagem_distribuicoes_locais_idx
  on public.armazenagem_distribuicoes(empresa_id, silo, baia);
create index if not exists armazenagem_distribuicoes_armazenagem_idx
  on public.armazenagem_distribuicoes(armazenagem_id);
create index if not exists armazenagem_distribuicoes_created_by_idx
  on public.armazenagem_distribuicoes(created_by);
create index if not exists armazenagem_distribuicoes_updated_by_idx
  on public.armazenagem_distribuicoes(updated_by);
create index if not exists fechamentos_armazenagem_fechado_por_idx
  on public.fechamentos_armazenagem(fechado_por);
create index if not exists fechamentos_armazenagem_reaberto_por_idx
  on public.fechamentos_armazenagem(reaberto_por);

-- 6. Funcoes internas de integridade.
create or replace function private.armazenagem_usuario_nome()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select nullif(btrim(p.nome), '') from public.profiles p where p.user_id = auth.uid() limit 1),
    auth.email(),
    'Usuario'
  );
$$;

create or replace function private.armazenagem_peso_nota_kg(
  quantidade numeric,
  unidade text,
  peso_por_saca numeric default 60
)
returns numeric
language sql
immutable
set search_path = pg_catalog
as $$
  select round((
    case upper(regexp_replace(coalesce(unidade, 'KG'), '[^A-Z]', '', 'g'))
      when 'TON' then coalesce(quantidade, 0) * 1000
      when 'T' then coalesce(quantidade, 0) * 1000
      when 'TONELADA' then coalesce(quantidade, 0) * 1000
      when 'TONELADAS' then coalesce(quantidade, 0) * 1000
      when 'SC' then coalesce(quantidade, 0) * coalesce(nullif(peso_por_saca, 0), 60)
      when 'SCS' then coalesce(quantidade, 0) * coalesce(nullif(peso_por_saca, 0), 60)
      when 'SACA' then coalesce(quantidade, 0) * coalesce(nullif(peso_por_saca, 0), 60)
      when 'SACAS' then coalesce(quantidade, 0) * coalesce(nullif(peso_por_saca, 0), 60)
      when 'KG' then coalesce(quantidade, 0)
      when 'KGS' then coalesce(quantidade, 0)
      when 'QUILO' then coalesce(quantidade, 0)
      when 'QUILOS' then coalesce(quantidade, 0)
      when 'QUILOGRAMA' then coalesce(quantidade, 0)
      when 'QUILOGRAMAS' then coalesce(quantidade, 0)
      else 0
    end
  )::numeric, 3);
$$;

create or replace function private.armazenagem_mes_fechado(p_empresa_id uuid, p_data date)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.fechamentos_armazenagem f
    where f.empresa_id = p_empresa_id
      and f.ano = extract(year from p_data)::integer
      and f.mes = extract(month from p_data)::integer
      and f.status = 'FECHADO'
  );
$$;

create or replace function private.armazenagem_metadata_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    new.empresa_id := coalesce(new.empresa_id, public.agroflow_empresa_atual_id());
    if to_jsonb(new) ? 'created_by' then
      new.created_by := coalesce(new.created_by, auth.uid());
    end if;
    if to_jsonb(new) ? 'created_by_nome' then
      new.created_by_nome := coalesce(new.created_by_nome, private.armazenagem_usuario_nome());
    end if;
  else
    if to_jsonb(new) ? 'updated_by' then
      new.updated_by := auth.uid();
    end if;
    if to_jsonb(new) ? 'updated_by_nome' then
      new.updated_by_nome := private.armazenagem_usuario_nome();
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create or replace function private.armazenagem_validar_cabecalho_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and private.armazenagem_mes_fechado(old.empresa_id, old.data_armazenagem) then
    raise exception 'MES_ARMAZENAGEM_FECHADO';
  end if;
  if tg_op = 'UPDATE' and new.data_armazenagem is distinct from old.data_armazenagem
     and private.armazenagem_mes_fechado(new.empresa_id, new.data_armazenagem) then
    raise exception 'MES_ARMAZENAGEM_DESTINO_FECHADO';
  end if;
  return new;
end;
$$;

create or replace function private.armazenagem_validar_distribuicao_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item public.armazenagem_itens%rowtype;
  v_armazenagem public.armazenagens_materia_prima%rowtype;
  v_total numeric;
  v_item_id uuid;
begin
  v_item_id := case when tg_op = 'DELETE' then old.armazenagem_item_id else new.armazenagem_item_id end;

  select * into v_item
  from public.armazenagem_itens
  where id = v_item_id
  for update;

  if v_item.id is null then
    raise exception 'ITEM_ARMAZENAGEM_INVALIDO';
  end if;

  select * into v_armazenagem
  from public.armazenagens_materia_prima
  where id = v_item.armazenagem_id
  for update;

  if private.armazenagem_mes_fechado(v_armazenagem.empresa_id, v_armazenagem.data_armazenagem) then
    raise exception 'MES_ARMAZENAGEM_FECHADO';
  end if;

  if tg_op <> 'DELETE' then
    new.armazenagem_id := v_armazenagem.id;
    new.empresa_id := v_armazenagem.empresa_id;
    new.silo := nullif(btrim(coalesce(new.silo, '')), '');
    new.baia := nullif(btrim(coalesce(new.baia, '')), '');

    if new.silo is null and new.baia is null then
      raise exception 'SILO_OU_BAIA_OBRIGATORIO';
    end if;

    select coalesce(sum(d.peso_armazenado), 0)
    into v_total
    from public.armazenagem_distribuicoes d
    where d.armazenagem_item_id = v_item.id
      and (tg_op = 'INSERT' or d.id <> new.id);

    if round(v_total + new.peso_armazenado, 3) > round(v_item.peso_nota, 3) then
      raise exception 'PESO_DISTRIBUIDO_SUPERA_NOTA';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function private.armazenagem_recalcular(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_armazenagem_id uuid;
begin
  update public.armazenagem_itens item
  set peso_distribuido = totals.distribuido,
      saldo_distribuir = greatest(item.peso_nota - totals.distribuido, 0),
      status = case
        when item.status = 'CANCELADO' then 'CANCELADO'
        when totals.distribuido = 0 then 'PENDENTE'
        when totals.distribuido < item.peso_nota then 'PARCIALMENTE_ARMAZENADO'
        else 'ARMAZENADO'
      end,
      updated_at = now()
  from (
    select i.id, coalesce(sum(d.peso_armazenado), 0)::numeric(18, 3) as distribuido
    from public.armazenagem_itens i
    left join public.armazenagem_distribuicoes d on d.armazenagem_item_id = i.id
    where i.id = p_item_id
    group by i.id
  ) totals
  where item.id = totals.id
  returning item.armazenagem_id into v_armazenagem_id;

  if v_armazenagem_id is null then
    return;
  end if;

  update public.armazenagens_materia_prima armazenagem
  set peso_distribuido = totals.distribuido,
      saldo_distribuir = greatest(armazenagem.peso_nota - totals.distribuido, 0),
      status = case
        when armazenagem.status = 'CANCELADO' then 'CANCELADO'
        when totals.distribuido = 0 then 'PENDENTE'
        when totals.distribuido < armazenagem.peso_nota then 'PARCIALMENTE_ARMAZENADO'
        else 'ARMAZENADO'
      end,
      updated_at = now()
  from (
    select i.armazenagem_id, coalesce(sum(i.peso_distribuido), 0)::numeric(18, 3) as distribuido
    from public.armazenagem_itens i
    where i.armazenagem_id = v_armazenagem_id
    group by i.armazenagem_id
  ) totals
  where armazenagem.id = totals.armazenagem_id;
end;
$$;

create or replace function private.armazenagem_recalcular_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    perform private.armazenagem_recalcular(old.armazenagem_item_id);
    return old;
  end if;

  perform private.armazenagem_recalcular(new.armazenagem_item_id);
  if tg_op = 'UPDATE' and old.armazenagem_item_id <> new.armazenagem_item_id then
    perform private.armazenagem_recalcular(old.armazenagem_item_id);
  end if;
  return new;
end;
$$;

revoke all on function private.armazenagem_usuario_nome() from public, anon, authenticated;
revoke all on function private.armazenagem_peso_nota_kg(numeric, text, numeric) from public, anon, authenticated;
revoke all on function private.armazenagem_mes_fechado(uuid, date) from public, anon, authenticated;
revoke all on function private.armazenagem_metadata_trigger() from public, anon, authenticated;
revoke all on function private.armazenagem_validar_cabecalho_trigger() from public, anon, authenticated;
revoke all on function private.armazenagem_validar_distribuicao_trigger() from public, anon, authenticated;
revoke all on function private.armazenagem_recalcular(uuid) from public, anon, authenticated;
revoke all on function private.armazenagem_recalcular_trigger() from public, anon, authenticated;

drop trigger if exists armazenagens_metadata on public.armazenagens_materia_prima;
create trigger armazenagens_metadata
before insert or update on public.armazenagens_materia_prima
for each row execute function private.armazenagem_metadata_trigger();

drop trigger if exists armazenagens_validar_mes on public.armazenagens_materia_prima;
create trigger armazenagens_validar_mes
before update on public.armazenagens_materia_prima
for each row execute function private.armazenagem_validar_cabecalho_trigger();

drop trigger if exists armazenagem_itens_metadata on public.armazenagem_itens;
create trigger armazenagem_itens_metadata
before insert or update on public.armazenagem_itens
for each row execute function private.armazenagem_metadata_trigger();

drop trigger if exists armazenagem_distribuicoes_metadata on public.armazenagem_distribuicoes;
create trigger armazenagem_distribuicoes_metadata
before insert or update on public.armazenagem_distribuicoes
for each row execute function private.armazenagem_metadata_trigger();

drop trigger if exists armazenagem_distribuicoes_validar on public.armazenagem_distribuicoes;
create trigger armazenagem_distribuicoes_validar
before insert or update or delete on public.armazenagem_distribuicoes
for each row execute function private.armazenagem_validar_distribuicao_trigger();

drop trigger if exists armazenagem_distribuicoes_recalcular on public.armazenagem_distribuicoes;
create trigger armazenagem_distribuicoes_recalcular
after insert or update or delete on public.armazenagem_distribuicoes
for each row execute function private.armazenagem_recalcular_trigger();

drop trigger if exists fechamentos_armazenagem_metadata on public.fechamentos_armazenagem;
create trigger fechamentos_armazenagem_metadata
before insert or update on public.fechamentos_armazenagem
for each row execute function private.armazenagem_metadata_trigger();

-- 7. Operacoes atomicas. As funcoes validam usuario, empresa e permissao.
create or replace function public.agroflow_armazenagem_iniciar(p_recebimento_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_recebimento public.recebimentos%rowtype;
  v_armazenagem_id uuid;
  v_total numeric(18, 3) := 0;
  v_origem text := 'RECEBIMENTO';
  v_inseridos integer := 0;
  v_total_itens integer := 0;
  v_item record;
  v_peso numeric(18, 3);
begin
  if auth.uid() is null then
    raise exception 'USUARIO_NAO_AUTENTICADO';
  end if;
  if not (
    public.agroflow_tem_permissao('balancas_armazenagem', 'cadastrar')
    or public.agroflow_tem_permissao('balancas_armazenagem', 'editar')
  ) then
    raise exception 'SEM_PERMISSAO_ARMAZENAGEM';
  end if;

  select * into v_recebimento
  from public.recebimentos r
  where r.id = p_recebimento_id
    and public.agroflow_mesma_empresa(r.empresa_id)
  for update;

  if v_recebimento.id is null then
    raise exception 'RECEBIMENTO_NAO_ENCONTRADO';
  end if;
  if v_recebimento.status <> 'aprovada'
     or v_recebimento.balanca_id is null
     or nullif(btrim(coalesce(v_recebimento.nf_numero, '')), '') is null
     or coalesce(v_recebimento.peso_bruto, 0) <= 0
     or coalesce(v_recebimento.tara, 0) <= 0 then
    raise exception 'RECEBIMENTO_NAO_FINALIZADO';
  end if;

  select a.id into v_armazenagem_id
  from public.armazenagens_materia_prima a
  where a.recebimento_id = p_recebimento_id;

  if v_armazenagem_id is not null then
    return v_armazenagem_id;
  end if;

  insert into public.armazenagens_materia_prima (
    empresa_id, recebimento_id, data_armazenagem, peso_nota,
    origem_peso, peso_distribuido, saldo_distribuir, status,
    created_by, created_by_nome
  ) values (
    v_recebimento.empresa_id, v_recebimento.id, v_recebimento.data, 1,
    'RECEBIMENTO', 0, 1, 'PENDENTE', auth.uid(), private.armazenagem_usuario_nome()
  ) returning id into v_armazenagem_id;

  select count(*) into v_total_itens
  from public.recebimento_itens ri
  where ri.recebimento_id = v_recebimento.id;

  for v_item in
    select ri.*
    from public.recebimento_itens ri
    where ri.recebimento_id = v_recebimento.id
    order by ri.ordem, ri.created_at, ri.id
  loop
    v_peso := private.armazenagem_peso_nota_kg(
      v_item.quantidade,
      v_item.unidade,
      v_recebimento.peso_por_saca
    );
    if v_peso <= 0 then
      continue;
    end if;

    v_origem := case
      when nullif(btrim(coalesce(v_recebimento.nf_chave_acesso, '')), '') is not null then 'XML'
      else 'NOTA'
    end;

    insert into public.armazenagem_itens (
      empresa_id, armazenagem_id, recebimento_item_id, produto_id, ordem,
      peso_nota, origem_peso, peso_distribuido, saldo_distribuir, status
    ) values (
      v_recebimento.empresa_id, v_armazenagem_id, v_item.id, v_item.produto_id,
      v_item.ordem, v_peso, v_origem, 0, v_peso, 'PENDENTE'
    );
    v_total := v_total + v_peso;
    v_inseridos := v_inseridos + 1;
  end loop;

  if v_total_itens > 0 and v_inseridos <> v_total_itens then
    raise exception 'PESO_ITEM_NF_NAO_INFORMADO';
  end if;

  if v_inseridos = 0 then
    v_peso := case
      when coalesce(v_recebimento.quantidade_nota, 0) > 0 then
        private.armazenagem_peso_nota_kg(
          v_recebimento.quantidade_nota,
          v_recebimento.unidade_nota,
          v_recebimento.peso_por_saca
        )
      else coalesce(v_recebimento.peso_nf, 0)
    end;

    if v_peso <= 0 then
      raise exception 'PESO_NOTA_NAO_INFORMADO';
    end if;

    v_origem := case
      when nullif(btrim(coalesce(v_recebimento.nf_chave_acesso, '')), '') is not null then 'XML'
      when coalesce(v_recebimento.quantidade_nota, 0) > 0 then 'NOTA'
      else 'RECEBIMENTO'
    end;

    insert into public.armazenagem_itens (
      empresa_id, armazenagem_id, recebimento_item_id, produto_id, ordem,
      peso_nota, origem_peso, peso_distribuido, saldo_distribuir, status
    ) values (
      v_recebimento.empresa_id, v_armazenagem_id, null, v_recebimento.produto_id, 1,
      v_peso, v_origem, 0, v_peso, 'PENDENTE'
    );
    v_total := v_peso;
  end if;

  select case
    when bool_or(i.origem_peso = 'XML') then 'XML'
    when bool_or(i.origem_peso = 'NOTA') then 'NOTA'
    else 'RECEBIMENTO'
  end
  into v_origem
  from public.armazenagem_itens i
  where i.armazenagem_id = v_armazenagem_id;

  update public.armazenagens_materia_prima
  set peso_nota = v_total,
      peso_distribuido = 0,
      saldo_distribuir = v_total,
      origem_peso = v_origem,
      updated_at = now()
  where id = v_armazenagem_id;

  return v_armazenagem_id;
exception
  when others then
    if v_armazenagem_id is not null then
      delete from public.armazenagens_materia_prima
      where id = v_armazenagem_id
        and peso_nota = 1
        and not exists (
          select 1 from public.armazenagem_distribuicoes d where d.armazenagem_id = v_armazenagem_id
        );
    end if;
    raise;
end;
$$;

create or replace function public.agroflow_armazenagem_salvar(
  p_armazenagem_id uuid,
  p_data_armazenagem date,
  p_observacao text,
  p_distribuicoes jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_armazenagem public.armazenagens_materia_prima%rowtype;
  v_distribuicao jsonb;
  v_item_id uuid;
begin
  if auth.uid() is null then raise exception 'USUARIO_NAO_AUTENTICADO'; end if;
  if not (
    public.agroflow_tem_permissao('balancas_armazenagem', 'cadastrar')
    or public.agroflow_tem_permissao('balancas_armazenagem', 'editar')
  ) then raise exception 'SEM_PERMISSAO_ARMAZENAGEM'; end if;

  select * into v_armazenagem
  from public.armazenagens_materia_prima a
  where a.id = p_armazenagem_id
    and public.agroflow_mesma_empresa(a.empresa_id)
  for update;

  if v_armazenagem.id is null then raise exception 'ARMAZENAGEM_NAO_ENCONTRADA'; end if;
  if v_armazenagem.status = 'CANCELADO' then raise exception 'ARMAZENAGEM_CANCELADA'; end if;
  if private.armazenagem_mes_fechado(v_armazenagem.empresa_id, v_armazenagem.data_armazenagem)
     or private.armazenagem_mes_fechado(v_armazenagem.empresa_id, p_data_armazenagem) then
    raise exception 'MES_ARMAZENAGEM_FECHADO';
  end if;
  if jsonb_typeof(coalesce(p_distribuicoes, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_distribuicoes, '[]'::jsonb)) = 0 then
    raise exception 'DISTRIBUICAO_OBRIGATORIA';
  end if;

  update public.armazenagens_materia_prima
  set data_armazenagem = p_data_armazenagem,
      observacao = nullif(btrim(coalesce(p_observacao, '')), ''),
      updated_by = auth.uid(),
      updated_by_nome = private.armazenagem_usuario_nome()
  where id = p_armazenagem_id;

  delete from public.armazenagem_distribuicoes
  where armazenagem_id = p_armazenagem_id;

  for v_distribuicao in select value from jsonb_array_elements(p_distribuicoes)
  loop
    v_item_id := nullif(v_distribuicao->>'armazenagem_item_id', '')::uuid;
    if not exists (
      select 1 from public.armazenagem_itens i
      where i.id = v_item_id and i.armazenagem_id = p_armazenagem_id
    ) then
      raise exception 'ITEM_ARMAZENAGEM_INVALIDO';
    end if;

    insert into public.armazenagem_distribuicoes (
      empresa_id, armazenagem_id, armazenagem_item_id, silo, baia,
      peso_armazenado, observacao, created_by, created_by_nome
    ) values (
      v_armazenagem.empresa_id,
      p_armazenagem_id,
      v_item_id,
      nullif(btrim(coalesce(v_distribuicao->>'silo', '')), ''),
      nullif(btrim(coalesce(v_distribuicao->>'baia', '')), ''),
      coalesce(nullif(v_distribuicao->>'peso_armazenado', '')::numeric, 0),
      nullif(btrim(coalesce(v_distribuicao->>'observacao', '')), ''),
      auth.uid(),
      private.armazenagem_usuario_nome()
    );
  end loop;

  return p_armazenagem_id;
end;
$$;

create or replace function public.agroflow_armazenagem_cancelar(
  p_armazenagem_id uuid,
  p_motivo text
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_armazenagem public.armazenagens_materia_prima%rowtype;
begin
  if auth.uid() is null then raise exception 'USUARIO_NAO_AUTENTICADO'; end if;
  if not (
    public.agroflow_tem_permissao('balancas_armazenagem', 'cancelar')
    or public.agroflow_tem_permissao('balancas_armazenagem', 'excluir')
  ) then raise exception 'SEM_PERMISSAO_CANCELAR_ARMAZENAGEM'; end if;
  if nullif(btrim(coalesce(p_motivo, '')), '') is null then
    raise exception 'MOTIVO_CANCELAMENTO_OBRIGATORIO';
  end if;

  select * into v_armazenagem
  from public.armazenagens_materia_prima a
  where a.id = p_armazenagem_id
    and public.agroflow_mesma_empresa(a.empresa_id)
  for update;

  if v_armazenagem.id is null then raise exception 'ARMAZENAGEM_NAO_ENCONTRADA'; end if;
  if private.armazenagem_mes_fechado(v_armazenagem.empresa_id, v_armazenagem.data_armazenagem) then
    raise exception 'MES_ARMAZENAGEM_FECHADO';
  end if;

  update public.armazenagens_materia_prima
  set status = 'CANCELADO',
      motivo_cancelamento = btrim(p_motivo),
      cancelled_by = auth.uid(),
      cancelled_at = now(),
      updated_by = auth.uid(),
      updated_by_nome = private.armazenagem_usuario_nome()
  where id = p_armazenagem_id;

  update public.armazenagem_itens
  set status = 'CANCELADO', updated_at = now()
  where armazenagem_id = p_armazenagem_id;
end;
$$;

create or replace function public.agroflow_armazenagem_fechar_mes(
  p_ano integer,
  p_mes integer,
  p_autorizar_pendencias boolean default false,
  p_justificativa text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_empresa_id uuid := public.agroflow_empresa_atual_id();
  v_inicio date;
  v_fim date;
  v_pendencias integer;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'USUARIO_NAO_AUTENTICADO'; end if;
  if not public.agroflow_tem_permissao('balancas_armazenagem', 'aprovar') then
    raise exception 'SEM_PERMISSAO_FECHAR_MES';
  end if;
  if p_mes not between 1 and 12 or p_ano not between 2000 and 2200 then
    raise exception 'PERIODO_INVALIDO';
  end if;

  v_inicio := make_date(p_ano, p_mes, 1);
  v_fim := (v_inicio + interval '1 month')::date;

  select count(*) into v_pendencias
  from public.recebimentos r
  where r.empresa_id = v_empresa_id
    and r.data >= v_inicio and r.data < v_fim
    and r.status = 'aprovada'
    and r.balanca_id is not null
    and nullif(btrim(coalesce(r.nf_numero, '')), '') is not null
    and coalesce(r.peso_bruto, 0) > 0
    and coalesce(r.tara, 0) > 0
    and (
      not exists (
        select 1 from public.armazenagens_materia_prima a
        where a.recebimento_id = r.id and a.status = 'ARMAZENADO'
      )
    );

  if v_pendencias > 0 and not p_autorizar_pendencias then
    raise exception 'EXISTEM_PENDENCIAS_ARMAZENAGEM:%', v_pendencias;
  end if;
  if v_pendencias > 0 and (
    not public.agroflow_is_admin()
    or nullif(btrim(coalesce(p_justificativa, '')), '') is null
  ) then
    raise exception 'JUSTIFICATIVA_ADMIN_OBRIGATORIA';
  end if;

  insert into public.fechamentos_armazenagem (
    empresa_id, ano, mes, status, fechado_por, fechado_por_nome,
    fechado_em, justificativa_pendencias
  ) values (
    v_empresa_id, p_ano, p_mes, 'FECHADO', auth.uid(),
    private.armazenagem_usuario_nome(), now(),
    case when v_pendencias > 0 then btrim(p_justificativa) else null end
  )
  on conflict (empresa_id, ano, mes) do update set
    status = 'FECHADO',
    fechado_por = excluded.fechado_por,
    fechado_por_nome = excluded.fechado_por_nome,
    fechado_em = excluded.fechado_em,
    justificativa_pendencias = excluded.justificativa_pendencias,
    reaberto_por = null,
    reaberto_por_nome = null,
    reaberto_em = null,
    justificativa_reabertura = null,
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.agroflow_armazenagem_reabrir_mes(
  p_ano integer,
  p_mes integer,
  p_justificativa text
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'USUARIO_NAO_AUTENTICADO'; end if;
  if not public.agroflow_is_admin() then raise exception 'SOMENTE_ADMIN_REABRE_MES'; end if;
  if nullif(btrim(coalesce(p_justificativa, '')), '') is null then
    raise exception 'JUSTIFICATIVA_REABERTURA_OBRIGATORIA';
  end if;

  update public.fechamentos_armazenagem
  set status = 'ABERTO',
      reaberto_por = auth.uid(),
      reaberto_por_nome = private.armazenagem_usuario_nome(),
      reaberto_em = now(),
      justificativa_reabertura = btrim(p_justificativa),
      updated_at = now()
  where empresa_id = public.agroflow_empresa_atual_id()
    and ano = p_ano
    and mes = p_mes
    and status = 'FECHADO';

  if not found then raise exception 'FECHAMENTO_NAO_ENCONTRADO'; end if;
end;
$$;

-- 8. RLS: acesso por permissao e isolamento por empresa.
alter table public.armazenagens_materia_prima enable row level security;
alter table public.armazenagem_itens enable row level security;
alter table public.armazenagem_distribuicoes enable row level security;
alter table public.fechamentos_armazenagem enable row level security;

drop policy if exists armazenagens_select on public.armazenagens_materia_prima;
create policy armazenagens_select on public.armazenagens_materia_prima
for select to authenticated
using (
  public.agroflow_mesma_empresa(empresa_id)
  and public.agroflow_tem_permissao('balancas_armazenagem', 'visualizar')
);

drop policy if exists armazenagem_itens_select on public.armazenagem_itens;
create policy armazenagem_itens_select on public.armazenagem_itens
for select to authenticated
using (
  public.agroflow_mesma_empresa(empresa_id)
  and public.agroflow_tem_permissao('balancas_armazenagem', 'visualizar')
);

drop policy if exists armazenagem_distribuicoes_select on public.armazenagem_distribuicoes;
create policy armazenagem_distribuicoes_select on public.armazenagem_distribuicoes
for select to authenticated
using (
  public.agroflow_mesma_empresa(empresa_id)
  and public.agroflow_tem_permissao('balancas_armazenagem', 'visualizar')
);

drop policy if exists fechamentos_armazenagem_select on public.fechamentos_armazenagem;
create policy fechamentos_armazenagem_select on public.fechamentos_armazenagem
for select to authenticated
using (
  public.agroflow_mesma_empresa(empresa_id)
  and public.agroflow_tem_permissao('balancas_armazenagem', 'visualizar')
);

revoke all on public.armazenagens_materia_prima from anon, authenticated;
revoke all on public.armazenagem_itens from anon, authenticated;
revoke all on public.armazenagem_distribuicoes from anon, authenticated;
revoke all on public.fechamentos_armazenagem from anon, authenticated;
grant select on public.armazenagens_materia_prima to authenticated;
grant select on public.armazenagem_itens to authenticated;
grant select on public.armazenagem_distribuicoes to authenticated;
grant select on public.fechamentos_armazenagem to authenticated;

revoke all on function public.agroflow_armazenagem_iniciar(uuid) from public, anon;
revoke all on function public.agroflow_armazenagem_salvar(uuid, date, text, jsonb) from public, anon;
revoke all on function public.agroflow_armazenagem_cancelar(uuid, text) from public, anon;
revoke all on function public.agroflow_armazenagem_fechar_mes(integer, integer, boolean, text) from public, anon;
revoke all on function public.agroflow_armazenagem_reabrir_mes(integer, integer, text) from public, anon;
grant execute on function public.agroflow_armazenagem_iniciar(uuid) to authenticated;
grant execute on function public.agroflow_armazenagem_salvar(uuid, date, text, jsonb) to authenticated;
grant execute on function public.agroflow_armazenagem_cancelar(uuid, text) to authenticated;
grant execute on function public.agroflow_armazenagem_fechar_mes(integer, integer, boolean, text) to authenticated;
grant execute on function public.agroflow_armazenagem_reabrir_mes(integer, integer, text) to authenticated;

-- 9. Auditoria automatica, incluindo valores anteriores e novos.
drop trigger if exists agroflow_audit_armazenagens_materia_prima on public.armazenagens_materia_prima;
create trigger agroflow_audit_armazenagens_materia_prima
after insert or update or delete on public.armazenagens_materia_prima
for each row execute function public.agroflow_audit_trigger();

drop trigger if exists agroflow_audit_armazenagem_itens on public.armazenagem_itens;
create trigger agroflow_audit_armazenagem_itens
after insert or update or delete on public.armazenagem_itens
for each row execute function public.agroflow_audit_trigger();

drop trigger if exists agroflow_audit_armazenagem_distribuicoes on public.armazenagem_distribuicoes;
create trigger agroflow_audit_armazenagem_distribuicoes
after insert or update or delete on public.armazenagem_distribuicoes
for each row execute function public.agroflow_audit_trigger();

drop trigger if exists agroflow_audit_fechamentos_armazenagem on public.fechamentos_armazenagem;
create trigger agroflow_audit_fechamentos_armazenagem
after insert or update or delete on public.fechamentos_armazenagem
for each row execute function public.agroflow_audit_trigger();

-- 10. Realtime para atualizacao silenciosa entre usuarios.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'armazenagens_materia_prima',
    'armazenagem_itens',
    'armazenagem_distribuicoes',
    'fechamentos_armazenagem'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end $$;

comment on table public.armazenagens_materia_prima is
  'Cabecalho unico de armazenagem por recebimento. Peso baseado exclusivamente na NF.';
comment on table public.armazenagem_itens is
  'Peso da NF controlado por item/produto para evitar repetir o total em notas com varios produtos.';
comment on column public.armazenagem_itens.peso_nota is
  'Peso da nota em KG. Nunca recebe peso bruto, tara, peso liquido de balanca ou diferenca.';

commit;
