-- AgroFlow | Central de Graos Messejana
-- Alteracao aditiva: entradas antigas permanecem compativeis com destino nulo.
-- Reversao antes de novos lancamentos: remover view/funcoes abaixo e a coluna fornecedor_destino_id.

alter table public.oficina_messejana_entradas
  add column if not exists fornecedor_destino_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'oficina_messejana_entradas_fornecedor_destino_id_fkey'
      and conrelid = 'public.oficina_messejana_entradas'::regclass
  ) then
    alter table public.oficina_messejana_entradas
      add constraint oficina_messejana_entradas_fornecedor_destino_id_fkey
      foreign key (fornecedor_destino_id)
      references public.fornecedores(id)
      on delete restrict;
  end if;
end;
$$;

create index if not exists oficina_messejana_entradas_fornecedor_destino_idx
  on public.oficina_messejana_entradas (empresa_id, fornecedor_destino_id, data_entrada desc)
  where fornecedor_destino_id is not null;

create or replace view public.oficina_messejana_entradas_resumo
with (security_invoker = true)
as
select
  e.id,
  e.empresa_id,
  e.deposito_id,
  e.fornecedor_id,
  e.produto_id,
  e.data_entrada,
  e.nf_numero,
  e.nf_serie,
  e.chave_acesso,
  e.fornecedor_nome,
  e.fornecedor_cnpj,
  e.produto_nome,
  e.peso_nf,
  e.placa,
  e.veiculo,
  e.motorista,
  e.transportadora,
  e.origem,
  e.observacao,
  e.responsavel_nome,
  e.status_registro,
  e.motivo_cancelamento,
  e.cancelled_by,
  e.cancelled_at,
  e.created_by,
  e.updated_by,
  e.created_at,
  e.updated_at,
  d.nome as deposito_nome,
  coalesce(s.peso_retirado, 0)::numeric(16,3) as peso_retirado,
  greatest(e.peso_nf - coalesce(s.peso_retirado, 0), 0)::numeric(16,3) as saldo_disponivel,
  case
    when e.status_registro = 'CANCELADA' then 'CANCELADA'
    when coalesce(s.peso_retirado, 0) = 0 then 'SEM_SAIDA'
    when coalesce(s.peso_retirado, 0) < e.peso_nf then 'SAIDA_PARCIAL'
    else 'SAIDA_TOTAL'
  end as status_saldo,
  e.motorista_id,
  e.veiculo_id,
  e.valor_unitario,
  e.valor_total_nota,
  e.fornecedor_destino_id,
  fd.nome as fornecedor_destino_nome,
  fd.cnpj as fornecedor_destino_cnpj
from public.oficina_messejana_entradas e
join public.oficina_messejana_depositos d
  on d.id = e.deposito_id and d.empresa_id = e.empresa_id
left join public.fornecedores fd
  on fd.id = e.fornecedor_destino_id and fd.empresa_id = e.empresa_id
left join lateral (
  select sum(x.peso_saida) as peso_retirado
  from public.oficina_messejana_saidas x
  where x.entrada_id = e.id
    and x.empresa_id = e.empresa_id
    and x.status_registro = 'CONFIRMADA'
) s on true;

create or replace function public.oficina_messejana_salvar_entrada(p_entrada_id uuid, p_dados jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_empresa uuid := public.agroflow_empresa_atual_id();
  v_id uuid;
  v_old jsonb;
  v_deposito uuid;
  v_action text := case when p_entrada_id is null then 'cadastrar' else 'editar' end;
  v_fornecedor uuid := nullif(p_dados->>'fornecedor_id', '')::uuid;
  v_fornecedor_destino uuid := nullif(p_dados->>'fornecedor_destino_id', '')::uuid;
  v_produto uuid := nullif(p_dados->>'produto_id', '')::uuid;
  v_motorista uuid := nullif(p_dados->>'motorista_id', '')::uuid;
  v_veiculo uuid := nullif(p_dados->>'veiculo_id', '')::uuid;
  v_fornecedor_nome text;
  v_fornecedor_cnpj text;
  v_fornecedor_destino_nome text;
  v_fornecedor_destino_cnpj text;
  v_produto_nome text;
  v_motorista_nome text;
  v_placa text;
  v_tipo_veiculo text;
  v_peso numeric(16,3) := nullif(p_dados->>'peso_nf', '')::numeric;
  v_valor_total numeric(16,2) := nullif(p_dados->>'valor_total_nota', '')::numeric;
  v_valor_unitario numeric(16,6) := nullif(p_dados->>'valor_unitario', '')::numeric;
begin
  if v_user is null or v_empresa is null
     or not public.agroflow_tem_permissao('oficina_messejana_entradas', v_action) then
    raise exception 'OFICINA_ACESSO_NEGADO' using errcode = '42501';
  end if;

  if v_fornecedor is null then
    raise exception 'OFICINA_FORNECEDOR_OBRIGATORIO' using errcode = '23514';
  end if;
  select f.nome, f.cnpj into v_fornecedor_nome, v_fornecedor_cnpj
  from public.fornecedores f
  where f.id = v_fornecedor and f.empresa_id = v_empresa;
  if not found or length(public.agroflow_apenas_digitos(v_fornecedor_cnpj)) <> 14 then
    raise exception 'OFICINA_FORNECEDOR_INVALIDO' using errcode = '23514';
  end if;

  if v_fornecedor_destino is null then
    raise exception 'OFICINA_FORNECEDOR_DESTINO_OBRIGATORIO' using errcode = '23514';
  end if;
  select f.nome, f.cnpj into v_fornecedor_destino_nome, v_fornecedor_destino_cnpj
  from public.fornecedores f
  where f.id = v_fornecedor_destino and f.empresa_id = v_empresa;
  if not found then
    raise exception 'OFICINA_FORNECEDOR_DESTINO_INVALIDO' using errcode = '23514';
  end if;

  if v_produto is null then
    raise exception 'OFICINA_PRODUTO_OBRIGATORIO' using errcode = '23514';
  end if;
  select p.nome into v_produto_nome
  from public.produtos p
  where p.id = v_produto and p.empresa_id = v_empresa;
  if not found then
    raise exception 'OFICINA_PRODUTO_INVALIDO' using errcode = '23514';
  end if;

  if v_motorista is not null then
    select m.nome into v_motorista_nome
    from public.recebimento_motoristas m
    where m.id = v_motorista and m.empresa_id = v_empresa and m.ativo;
    if not found then raise exception 'OFICINA_MOTORISTA_INVALIDO' using errcode = '23514'; end if;
  end if;

  if v_veiculo is not null then
    select v.placa, v.tipo_veiculo into v_placa, v_tipo_veiculo
    from public.recebimento_veiculos v
    where v.id = v_veiculo and v.empresa_id = v_empresa and v.ativo;
    if not found then raise exception 'OFICINA_VEICULO_INVALIDO' using errcode = '23514'; end if;
  end if;

  if v_peso is null or v_peso <= 0 then
    raise exception 'OFICINA_PESO_INVALIDO' using errcode = '23514';
  end if;
  if (v_valor_total is not null and v_valor_total < 0)
     or (v_valor_unitario is not null and v_valor_unitario < 0) then
    raise exception 'OFICINA_VALOR_INVALIDO' using errcode = '23514';
  end if;
  if v_valor_total is not null then
    v_valor_unitario := round(v_valor_total / v_peso, 6);
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_fornecedor::text, 0));

  select d.id into v_deposito
  from public.oficina_messejana_depositos d
  where d.empresa_id = v_empresa and d.fornecedor_id = v_fornecedor
  for update;

  if v_deposito is null then
    select d.id into v_deposito
    from public.oficina_messejana_depositos d
    where d.empresa_id = v_empresa
      and d.fornecedor_id is null
      and lower(btrim(d.nome)) = lower(btrim(v_fornecedor_nome))
    for update;

    if v_deposito is not null then
      update public.oficina_messejana_depositos
      set fornecedor_id = v_fornecedor, nome = v_fornecedor_nome, ativo = true, updated_by = v_user
      where id = v_deposito;
    else
      insert into public.oficina_messejana_depositos (
        empresa_id, fornecedor_id, nome, ativo, created_by
      ) values (
        v_empresa, v_fornecedor, v_fornecedor_nome, true, v_user
      ) returning id into v_deposito;
    end if;
  else
    update public.oficina_messejana_depositos
    set nome = v_fornecedor_nome, ativo = true, updated_by = v_user
    where id = v_deposito;
  end if;

  if p_entrada_id is null then
    insert into public.oficina_messejana_entradas (
      empresa_id, deposito_id, fornecedor_id, fornecedor_destino_id, produto_id,
      motorista_id, veiculo_id, data_entrada, nf_numero, nf_serie, chave_acesso,
      fornecedor_nome, fornecedor_cnpj, produto_nome, peso_nf, valor_unitario,
      valor_total_nota, placa, veiculo, motorista, transportadora, origem,
      observacao, responsavel_nome, created_by
    ) values (
      v_empresa, v_deposito, v_fornecedor, v_fornecedor_destino, v_produto,
      v_motorista, v_veiculo, (p_dados->>'data_entrada')::timestamptz,
      btrim(p_dados->>'nf_numero'), coalesce(nullif(btrim(p_dados->>'nf_serie'), ''), '1'),
      nullif(btrim(p_dados->>'chave_acesso'), ''), v_fornecedor_nome,
      v_fornecedor_cnpj, v_produto_nome, v_peso, v_valor_unitario, v_valor_total,
      v_placa, v_tipo_veiculo, v_motorista_nome,
      nullif(btrim(p_dados->>'transportadora'), ''), v_fornecedor_nome,
      nullif(btrim(p_dados->>'observacao'), ''), btrim(p_dados->>'responsavel_nome'), v_user
    ) returning id into v_id;
  else
    select to_jsonb(e) into v_old
    from public.oficina_messejana_entradas e
    where e.id = p_entrada_id and e.empresa_id = v_empresa and e.status_registro = 'CONFIRMADA'
    for update;
    if v_old is null then
      raise exception 'OFICINA_REGISTRO_NAO_ENCONTRADO' using errcode = 'P0002';
    end if;

    update public.oficina_messejana_entradas set
      deposito_id = v_deposito, fornecedor_id = v_fornecedor,
      fornecedor_destino_id = v_fornecedor_destino, produto_id = v_produto,
      motorista_id = v_motorista, veiculo_id = v_veiculo,
      data_entrada = (p_dados->>'data_entrada')::timestamptz,
      nf_numero = btrim(p_dados->>'nf_numero'),
      nf_serie = coalesce(nullif(btrim(p_dados->>'nf_serie'), ''), '1'),
      chave_acesso = nullif(btrim(p_dados->>'chave_acesso'), ''),
      fornecedor_nome = v_fornecedor_nome, fornecedor_cnpj = v_fornecedor_cnpj,
      produto_nome = v_produto_nome, peso_nf = v_peso,
      valor_unitario = v_valor_unitario, valor_total_nota = v_valor_total,
      placa = v_placa, veiculo = v_tipo_veiculo, motorista = v_motorista_nome,
      transportadora = nullif(btrim(p_dados->>'transportadora'), ''),
      origem = v_fornecedor_nome, observacao = nullif(btrim(p_dados->>'observacao'), ''),
      responsavel_nome = btrim(p_dados->>'responsavel_nome'), updated_by = v_user
    where id = p_entrada_id and empresa_id = v_empresa
    returning id into v_id;

    if (select coalesce(sum(s.peso_saida), 0) from public.oficina_messejana_saidas s
        where s.entrada_id = v_id and s.status_registro = 'CONFIRMADA')
       > (select peso_nf from public.oficina_messejana_entradas where id = v_id) then
      raise exception 'OFICINA_PESO_MENOR_QUE_SAIDAS' using errcode = '23514';
    end if;
  end if;

  perform public.agroflow_auditar(
    case when p_entrada_id is null then 'criar' else 'editar' end,
    'oficina_messejana_entradas', v_id::text, v_old,
    (select to_jsonb(e) from public.oficina_messejana_entradas e where e.id = v_id)
  );
  return v_id;
exception
  when unique_violation then
    raise exception 'OFICINA_NF_DUPLICADA' using errcode = '23505';
end;
$$;

create or replace function public.oficina_messejana_dashboard(p_inicio timestamptz, p_fim timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_empresa uuid:=public.agroflow_empresa_atual_id();
  v_result jsonb;
  v_pode_relatorios boolean:=public.agroflow_tem_permissao('oficina_messejana_relatorios','visualizar');
begin
  if auth.uid() is null or not public.agroflow_tem_permissao('oficina_messejana','visualizar') then
    raise exception 'OFICINA_ACESSO_NEGADO' using errcode='42501'; end if;
  select jsonb_build_object(
    'quantidade_entradas',(select count(*) from public.oficina_messejana_entradas e where e.empresa_id=v_empresa and e.status_registro='CONFIRMADA' and e.data_entrada>=p_inicio and e.data_entrada<p_fim),
    'peso_entradas',(select coalesce(sum(e.peso_nf),0) from public.oficina_messejana_entradas e where e.empresa_id=v_empresa and e.status_registro='CONFIRMADA' and e.data_entrada>=p_inicio and e.data_entrada<p_fim),
    'quantidade_saidas',(select count(*) from public.oficina_messejana_saidas s where s.empresa_id=v_empresa and s.status_registro='CONFIRMADA' and s.data_saida>=p_inicio and s.data_saida<p_fim),
    'peso_saidas',(select coalesce(sum(s.peso_saida),0) from public.oficina_messejana_saidas s where s.empresa_id=v_empresa and s.status_registro='CONFIRMADA' and s.data_saida>=p_inicio and s.data_saida<p_fim),
    'saldo_total',(select coalesce(sum(e.saldo_disponivel),0) from public.oficina_messejana_entradas_resumo e where e.empresa_id=v_empresa and e.status_registro='CONFIRMADA'),
    'sem_saida',(select count(*) from public.oficina_messejana_entradas_resumo e where e.empresa_id=v_empresa and e.status_saldo='SEM_SAIDA'),
    'saida_parcial',(select count(*) from public.oficina_messejana_entradas_resumo e where e.empresa_id=v_empresa and e.status_saldo='SAIDA_PARCIAL'),
    'saida_total',(select count(*) from public.oficina_messejana_entradas_resumo e where e.empresa_id=v_empresa and e.status_saldo='SAIDA_TOTAL'),
    'saldo_por_produto',(select coalesce(jsonb_agg(to_jsonb(q) order by q.saldo desc),'[]'::jsonb) from (select e.produto_nome produto,sum(e.saldo_disponivel) saldo from public.oficina_messejana_entradas_resumo e where e.empresa_id=v_empresa and e.status_registro='CONFIRMADA' group by e.produto_nome) q),
    'saldo_por_deposito',(select coalesce(jsonb_agg(to_jsonb(q) order by q.saldo desc),'[]'::jsonb) from (select e.deposito_nome deposito,sum(e.saldo_disponivel) saldo from public.oficina_messejana_entradas_resumo e where e.empresa_id=v_empresa and e.status_registro='CONFIRMADA' group by e.deposito_nome) q),
    'entradas_por_fornecedor',(select coalesce(jsonb_agg(to_jsonb(q) order by q.peso desc),'[]'::jsonb) from (select e.fornecedor_nome fornecedor,sum(e.peso_nf) peso from public.oficina_messejana_entradas e where e.empresa_id=v_empresa and e.status_registro='CONFIRMADA' and e.data_entrada>=p_inicio and e.data_entrada<p_fim group by e.fornecedor_nome) q),
    'entradas_por_fornecedor_destino',(select coalesce(jsonb_agg(to_jsonb(q) order by q.peso desc),'[]'::jsonb) from (select coalesce(f.nome,'Não informado') fornecedor_destino,sum(e.peso_nf) peso from public.oficina_messejana_entradas e left join public.fornecedores f on f.id=e.fornecedor_destino_id and f.empresa_id=e.empresa_id where e.empresa_id=v_empresa and e.status_registro='CONFIRMADA' and e.data_entrada>=p_inicio and e.data_entrada<p_fim group by coalesce(f.nome,'Não informado')) q),
    'saidas_por_destino',(select coalesce(jsonb_agg(to_jsonb(q) order by q.peso desc),'[]'::jsonb) from (select s.destino,sum(s.peso_saida) peso from public.oficina_messejana_saidas s where s.empresa_id=v_empresa and s.status_registro='CONFIRMADA' and s.data_saida>=p_inicio and s.data_saida<p_fim group by s.destino) q),
    'movimentacoes_por_placa',(select coalesce(jsonb_agg(to_jsonb(q) order by q.peso desc),'[]'::jsonb) from (select coalesce(nullif(s.placa,''),'Sem placa') placa,sum(s.peso_saida) peso from public.oficina_messejana_saidas s where s.empresa_id=v_empresa and s.status_registro='CONFIRMADA' and s.data_saida>=p_inicio and s.data_saida<p_fim group by coalesce(nullif(s.placa,''),'Sem placa')) q),
    'notas_complementares',(select coalesce(jsonb_agg(to_jsonb(q) order by q.nota),'[]'::jsonb) from (select n.nf_numero||'/'||n.nf_serie nota,1::numeric quantidade from public.oficina_messejana_notas_complementares n where n.empresa_id=v_empresa and n.status_registro='ATIVA' and n.created_at>=p_inicio and n.created_at<p_fim) q),
    'movimentacoes_canceladas',jsonb_build_array(
      jsonb_build_object('tipo','Entradas canceladas','quantidade',(select count(*) from public.oficina_messejana_entradas e where e.empresa_id=v_empresa and e.status_registro='CANCELADA' and e.cancelled_at>=p_inicio and e.cancelled_at<p_fim)),
      jsonb_build_object('tipo','Saídas canceladas','quantidade',(select count(*) from public.oficina_messejana_saidas s where s.empresa_id=v_empresa and s.status_registro='CANCELADA' and s.cancelled_at>=p_inicio and s.cancelled_at<p_fim))
    ),
    'movimentacao_mensal',(select coalesce(jsonb_agg(to_jsonb(q) order by q.mes),'[]'::jsonb) from (
      select to_char(m.mes,'YYYY-MM') mes,
        coalesce((select sum(e.peso_nf) from public.oficina_messejana_entradas e where e.empresa_id=v_empresa and e.status_registro='CONFIRMADA' and e.data_entrada>=m.mes and e.data_entrada<m.mes+interval '1 month'),0) entradas,
        coalesce((select sum(s.peso_saida) from public.oficina_messejana_saidas s where s.empresa_id=v_empresa and s.status_registro='CONFIRMADA' and s.data_saida>=m.mes and s.data_saida<m.mes+interval '1 month'),0) saidas
      from generate_series(date_trunc('year',p_inicio),date_trunc('year',p_inicio)+interval '11 months',interval '1 month') m(mes)
    ) q)
  ) into v_result;
  if not v_pode_relatorios then
    v_result := v_result - array[
      'entradas_por_fornecedor', 'entradas_por_fornecedor_destino', 'saidas_por_destino',
      'movimentacoes_por_placa', 'notas_complementares',
      'movimentacoes_canceladas', 'movimentacao_mensal'
    ];
  end if;
  return coalesce(v_result,'{}'::jsonb);
end;
$$;

revoke all on function public.oficina_messejana_salvar_entrada(uuid,jsonb) from public, anon;
grant execute on function public.oficina_messejana_salvar_entrada(uuid,jsonb) to authenticated;
