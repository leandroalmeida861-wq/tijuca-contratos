-- AgroFlow | Portaria: sincronizar edicao e exclusao
--
-- Migration incremental e preservadora:
-- - nao altera nem exclui registros durante a aplicacao;
-- - sincroniza somente o recebimento ligado pelo portaria_id;
-- - mantem o balanca_id imutavel entre Portaria e Recebimentos;
-- - bloqueia alteracoes que afetariam uma armazenagem ja criada;
-- - executa cada edicao ou exclusao na mesma transacao do Postgres.

begin;

create or replace function private.agroflow_sincronizar_recebimento_portaria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recebimento_id uuid;
  v_peso_nf_convertido numeric;
  v_dados_alterados boolean;
  v_fluxo_alterado boolean;
begin
  if new.status = 'CANCELADA' then
    return new;
  end if;

  v_dados_alterados :=
    new.data_entrada is distinct from old.data_entrada
    or new.balanca_id is distinct from old.balanca_id
    or new.veiculo_id is distinct from old.veiculo_id
    or new.motorista_id is distinct from old.motorista_id
    or new.transportadora_id is distinct from old.transportadora_id
    or new.fornecedor_id is distinct from old.fornecedor_id
    or new.produto_id is distinct from old.produto_id
    or new.tipo_veiculo is distinct from old.tipo_veiculo
    or new.qtd_eixos is distinct from old.qtd_eixos
    or new.numero_nf is distinct from old.numero_nf
    or new.serie_nf is distinct from old.serie_nf
    or new.peso_nf_kg is distinct from old.peso_nf_kg
    or new.unidade_nota is distinct from old.unidade_nota
    or new.observacao is distinct from old.observacao;

  v_fluxo_alterado :=
    new.dispensa_laboratorio is distinct from old.dispensa_laboratorio;

  if not v_dados_alterados and not v_fluxo_alterado then
    return new;
  end if;

  select r.id
  into v_recebimento_id
  from public.recebimentos r
  where r.portaria_id = new.id
    and r.status <> 'cancelada'
  order by r.created_at desc
  limit 1
  for update;

  if v_recebimento_id is null then
    return new;
  end if;

  if exists (
    select 1
    from public.recebimentos r
    where r.id = v_recebimento_id
      and r.balanca_id is distinct from new.balanca_id
  ) then
    raise exception 'UNIDADE_DIVERGENTE'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.armazenagens_materia_prima a
    where a.recebimento_id = v_recebimento_id
  ) then
    raise exception 'RECEBIMENTO_JA_ARMAZENADO'
      using errcode = '23514';
  end if;

  v_peso_nf_convertido := case upper(btrim(coalesce(new.unidade_nota, 'KG')))
    when 'SC' then new.peso_nf_kg * 60
    when 'SACA' then new.peso_nf_kg * 60
    when 'SACAS' then new.peso_nf_kg * 60
    when 'SCS' then new.peso_nf_kg * 60
    when 'TON' then new.peso_nf_kg * 1000
    when 'TONELADA' then new.peso_nf_kg * 1000
    when 'TONELADAS' then new.peso_nf_kg * 1000
    else new.peso_nf_kg
  end;

  update public.recebimentos r
  set
    data = new.data_entrada,
    veiculo_id = new.veiculo_id,
    motorista_id = new.motorista_id,
    transportadora_id = new.transportadora_id,
    fornecedor_id = new.fornecedor_id,
    produto_id = new.produto_id,
    tipo_veiculo = new.tipo_veiculo,
    qtd_eixos = new.qtd_eixos,
    nf_numero = new.numero_nf,
    nf_serie = new.serie_nf,
    peso_nf = v_peso_nf_convertido,
    quantidade_nota = new.peso_nf_kg,
    unidade_nota = coalesce(new.unidade_nota, 'KG'),
    observacao = new.observacao,
    dispensa_laboratorio = new.dispensa_laboratorio,
    fornecedor_nome_manual = null,
    produto_nome_manual = null,
    veiculo_placa_manual = null,
    status = case
      when old.dispensa_laboratorio = true
        and new.dispensa_laboratorio = false then 'pendente'
      else r.status
    end,
    laboratorio_id = case
      when old.dispensa_laboratorio = true
        and new.dispensa_laboratorio = false then null
      else r.laboratorio_id
    end,
    ticket_numero = case
      when old.dispensa_laboratorio = true
        and new.dispensa_laboratorio = false then null
      else r.ticket_numero
    end,
    umidade = case
      when old.dispensa_laboratorio = true
        and new.dispensa_laboratorio = false then null
      else r.umidade
    end,
    umidade_01 = case
      when old.dispensa_laboratorio = true
        and new.dispensa_laboratorio = false then null
      else r.umidade_01
    end,
    umidade_02 = case
      when old.dispensa_laboratorio = true
        and new.dispensa_laboratorio = false then null
      else r.umidade_02
    end,
    liberado_por = case
      when old.dispensa_laboratorio = true
        and new.dispensa_laboratorio = false then null
      else r.liberado_por
    end,
    motivo_reprovacao = case
      when old.dispensa_laboratorio = true
        and new.dispensa_laboratorio = false then null
      else r.motivo_reprovacao
    end,
    motivo_cancelamento = case
      when old.dispensa_laboratorio = true
        and new.dispensa_laboratorio = false then null
      else r.motivo_cancelamento
    end,
    aprovado_em = case
      when old.dispensa_laboratorio = true
        and new.dispensa_laboratorio = false then null
      else r.aprovado_em
    end,
    reprovado_em = case
      when old.dispensa_laboratorio = true
        and new.dispensa_laboratorio = false then null
      else r.reprovado_em
    end,
    cancelado_em = case
      when old.dispensa_laboratorio = true
        and new.dispensa_laboratorio = false then null
      else r.cancelado_em
    end
  where r.id = v_recebimento_id
    and r.balanca_id = new.balanca_id;

  update public.recebimento_itens i
  set
    produto_id = new.produto_id,
    quantidade = new.peso_nf_kg,
    unidade = coalesce(new.unidade_nota, 'KG'),
    updated_at = now()
  where i.recebimento_id = v_recebimento_id
    and i.ordem = 1;

  if not found then
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
    on conflict (recebimento_id, ordem) do update
    set
      produto_id = excluded.produto_id,
      quantidade = excluded.quantidade,
      unidade = excluded.unidade,
      updated_at = now();
  end if;

  return new;
end;
$$;

revoke all on function private.agroflow_sincronizar_recebimento_portaria()
  from public, anon, authenticated;

drop trigger if exists portaria_sincronizar_recebimento
  on public.portaria_entradas;
create trigger portaria_sincronizar_recebimento
after update of
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
execute function private.agroflow_sincronizar_recebimento_portaria();

create or replace function private.agroflow_excluir_recebimento_portaria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.balanca_id is null then
    raise exception 'UNIDADE_OBRIGATORIA'
      using errcode = '23514';
  end if;

  if (select auth.uid()) is not null then
    if not (
      public.agroflow_tem_permissao('balancas', 'excluir')
      or public.agroflow_tem_permissao('balancas_portaria', 'excluir')
    ) then
      raise exception 'SEM_PERMISSAO_EXCLUIR_PORTARIA'
        using errcode = '42501';
    end if;

    if not public.agroflow_pode_editar_unidade(old.balanca_id) then
      raise exception 'SEM_PERMISSAO_NA_UNIDADE'
        using errcode = '42501';
    end if;
  end if;

  if exists (
    select 1
    from public.recebimentos r
    where r.portaria_id = old.id
      and r.balanca_id is distinct from old.balanca_id
  ) then
    raise exception 'UNIDADE_DIVERGENTE'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.recebimentos r
    join public.armazenagens_materia_prima a
      on a.recebimento_id = r.id
    where r.portaria_id = old.id
      and r.balanca_id = old.balanca_id
  ) then
    raise exception 'RECEBIMENTO_JA_ARMAZENADO'
      using errcode = '23514';
  end if;

  delete from public.recebimentos r
  where r.portaria_id = old.id
    and r.balanca_id = old.balanca_id;

  return old;
end;
$$;

revoke all on function private.agroflow_excluir_recebimento_portaria()
  from public, anon, authenticated;

drop trigger if exists portaria_excluir_recebimento
  on public.portaria_entradas;
create trigger portaria_excluir_recebimento
before delete on public.portaria_entradas
for each row
execute function private.agroflow_excluir_recebimento_portaria();

commit;
