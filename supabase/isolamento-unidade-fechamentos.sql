-- ============================================================================
-- AgroFlow | Isolamento dos fechamentos de Armazenagem M.P. por unidade
--
-- Migration preservadora:
-- - nao apaga nem move recebimentos, portarias ou armazenagens;
-- - associa os fechamentos historicos, anteriores as novas unidades, a Beberibe;
-- - passa a exigir balanca_id em toda leitura e operacao de fechamento.
-- ============================================================================

begin;

alter table public.fechamentos_armazenagem
  add column if not exists balanca_id uuid references public.balancas(id) on delete restrict;

update public.fechamentos_armazenagem f
set balanca_id = b.id
from public.balancas b
where f.balanca_id is null
  and b.codigo = 'beberibe';

do $$
begin
  if exists (select 1 from public.fechamentos_armazenagem where balanca_id is null) then
    raise exception 'Nao foi possivel associar os fechamentos historicos a Beberibe.';
  end if;
end;
$$;

alter table public.fechamentos_armazenagem
  alter column balanca_id set not null;

alter table public.fechamentos_armazenagem
  drop constraint if exists fechamentos_armazenagem_periodo_unico;

create unique index if not exists fechamentos_armazenagem_unidade_periodo_key
  on public.fechamentos_armazenagem (empresa_id, balanca_id, ano, mes);

create index if not exists fechamentos_armazenagem_balanca_idx
  on public.fechamentos_armazenagem (balanca_id, ano desc, mes);

-- A verificacao efetiva passa a receber a unidade explicitamente.
create or replace function private.armazenagem_mes_fechado(
  p_empresa_id uuid,
  p_balanca_id uuid,
  p_data date
)
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
      and f.balanca_id = p_balanca_id
      and f.ano = extract(year from p_data)::integer
      and f.mes = extract(month from p_data)::integer
      and f.status = 'FECHADO'
  );
$$;

-- Compatibilidade interna: as validacoes antigas de duas chaves deixam de
-- bloquear todas as unidades. Os triggers abaixo fazem a validacao completa.
create or replace function private.armazenagem_mes_fechado(p_empresa_id uuid, p_data date)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select false;
$$;

create or replace function private.armazenagem_validar_cabecalho_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_balanca_antiga uuid;
  v_balanca_nova uuid;
begin
  if tg_op = 'UPDATE' then
    select r.balanca_id into v_balanca_antiga
    from public.recebimentos r
    where r.id = old.recebimento_id;

    select r.balanca_id into v_balanca_nova
    from public.recebimentos r
    where r.id = new.recebimento_id;

    if private.armazenagem_mes_fechado(old.empresa_id, v_balanca_antiga, old.data_armazenagem) then
      raise exception 'MES_ARMAZENAGEM_FECHADO';
    end if;

    if new.data_armazenagem is distinct from old.data_armazenagem
       and private.armazenagem_mes_fechado(new.empresa_id, v_balanca_nova, new.data_armazenagem) then
      raise exception 'MES_ARMAZENAGEM_DESTINO_FECHADO';
    end if;
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
  v_balanca_id uuid;
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

  select r.balanca_id into v_balanca_id
  from public.recebimentos r
  where r.id = v_armazenagem.recebimento_id;

  if private.armazenagem_mes_fechado(
    v_armazenagem.empresa_id,
    v_balanca_id,
    v_armazenagem.data_armazenagem
  ) then
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

create or replace function public.agroflow_armazenagem_fechar_mes(
  p_ano integer,
  p_mes integer,
  p_balanca_id uuid,
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
  if p_balanca_id is null or not public.agroflow_pode_editar_unidade(p_balanca_id) then
    raise exception 'SEM_PERMISSAO_UNIDADE';
  end if;
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
    and r.balanca_id = p_balanca_id
    and r.data >= v_inicio and r.data < v_fim
    and r.status = 'aprovada'
    and nullif(btrim(coalesce(r.nf_numero, '')), '') is not null
    and coalesce(r.peso_bruto, 0) > 0
    and coalesce(r.tara, 0) > 0
    and not exists (
      select 1 from public.armazenagens_materia_prima a
      where a.recebimento_id = r.id and a.status = 'ARMAZENADO'
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
    empresa_id, balanca_id, ano, mes, status, fechado_por, fechado_por_nome,
    fechado_em, justificativa_pendencias
  ) values (
    v_empresa_id, p_balanca_id, p_ano, p_mes, 'FECHADO', auth.uid(),
    private.armazenagem_usuario_nome(), now(),
    case when v_pendencias > 0 then btrim(p_justificativa) else null end
  )
  on conflict (empresa_id, balanca_id, ano, mes) do update set
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
  p_balanca_id uuid,
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
  if p_balanca_id is null or not public.agroflow_acessa_unidade(p_balanca_id) then
    raise exception 'SEM_PERMISSAO_UNIDADE';
  end if;
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
    and balanca_id = p_balanca_id
    and ano = p_ano
    and mes = p_mes
    and status = 'FECHADO';

  if not found then raise exception 'FECHAMENTO_NAO_ENCONTRADO'; end if;
end;
$$;

drop policy if exists unidade_fechamentos_armazenagem on public.fechamentos_armazenagem;
create policy unidade_fechamentos_armazenagem
on public.fechamentos_armazenagem
as restrictive
for select
to authenticated
using (public.agroflow_acessa_unidade(balanca_id));

revoke execute on function public.agroflow_armazenagem_fechar_mes(integer, integer, boolean, text)
  from public, anon, authenticated;
revoke execute on function public.agroflow_armazenagem_reabrir_mes(integer, integer, text)
  from public, anon, authenticated;

revoke all on function public.agroflow_armazenagem_fechar_mes(integer, integer, uuid, boolean, text)
  from public, anon;
revoke all on function public.agroflow_armazenagem_reabrir_mes(integer, integer, uuid, text)
  from public, anon;
grant execute on function public.agroflow_armazenagem_fechar_mes(integer, integer, uuid, boolean, text)
  to authenticated;
grant execute on function public.agroflow_armazenagem_reabrir_mes(integer, integer, uuid, text)
  to authenticated;

revoke all on function private.armazenagem_mes_fechado(uuid, uuid, date)
  from public, anon, authenticated;

commit;
