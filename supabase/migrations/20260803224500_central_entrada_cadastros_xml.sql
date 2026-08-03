-- AgroFlow | Central de Graos Messejana
-- Fornecedor passa a definir o deposito operacional das novas entradas.

alter table public.oficina_messejana_entradas
  add column if not exists motorista_id uuid
    references public.recebimento_motoristas(id) on delete restrict,
  add column if not exists veiculo_id uuid
    references public.recebimento_veiculos(id) on delete restrict,
  add column if not exists valor_unitario numeric(16,6)
    check (valor_unitario is null or valor_unitario >= 0),
  add column if not exists valor_total_nota numeric(16,2)
    check (valor_total_nota is null or valor_total_nota >= 0);

create index if not exists oficina_messejana_entradas_motorista_idx
  on public.oficina_messejana_entradas (empresa_id, motorista_id)
  where motorista_id is not null;
create index if not exists oficina_messejana_entradas_veiculo_idx
  on public.oficina_messejana_entradas (empresa_id, veiculo_id)
  where veiculo_id is not null;
create unique index if not exists oficina_messejana_depositos_fornecedor_key
  on public.oficina_messejana_depositos (empresa_id, fornecedor_id)
  where fornecedor_id is not null;

create or replace function public.oficina_messejana_opcoes_entrada()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_empresa uuid := public.agroflow_empresa_atual_id();
begin
  if v_user is null or v_empresa is null or not (
    public.agroflow_tem_permissao('oficina_messejana_entradas', 'visualizar')
    or public.agroflow_tem_permissao('oficina_messejana_entradas', 'cadastrar')
    or public.agroflow_tem_permissao('oficina_messejana_entradas', 'editar')
  ) then
    raise exception 'OFICINA_ACESSO_NEGADO' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'fornecedores', coalesce((
      select jsonb_agg(jsonb_build_object('id', f.id, 'nome', f.nome, 'cnpj', f.cnpj) order by f.nome)
      from public.fornecedores f
      where f.empresa_id = v_empresa
    ), '[]'::jsonb),
    'produtos', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome, 'unidade', p.unidade) order by p.nome)
      from public.produtos p
      where p.empresa_id = v_empresa
    ), '[]'::jsonb),
    'motoristas', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'nome', m.nome) order by m.nome)
      from public.recebimento_motoristas m
      where m.empresa_id = v_empresa and m.ativo
    ), '[]'::jsonb),
    'veiculos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', v.id, 'placa', v.placa, 'tipo_veiculo', v.tipo_veiculo, 'qtd_eixos', v.qtd_eixos
      ) order by v.placa)
      from public.recebimento_veiculos v
      where v.empresa_id = v_empresa and v.ativo
    ), '[]'::jsonb)
  );
end;
$$;

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
  v_produto uuid := nullif(p_dados->>'produto_id', '')::uuid;
  v_motorista uuid := nullif(p_dados->>'motorista_id', '')::uuid;
  v_veiculo uuid := nullif(p_dados->>'veiculo_id', '')::uuid;
  v_fornecedor_nome text;
  v_fornecedor_cnpj text;
  v_produto_nome text;
  v_motorista_nome text;
  v_placa text;
  v_tipo_veiculo text;
  v_valor_unitario numeric(16,6) := nullif(p_dados->>'valor_unitario', '')::numeric;
  v_valor_total numeric(16,2) := nullif(p_dados->>'valor_total_nota', '')::numeric;
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

  if (v_valor_unitario is not null and v_valor_unitario < 0)
     or (v_valor_total is not null and v_valor_total < 0) then
    raise exception 'OFICINA_VALOR_INVALIDO' using errcode = '23514';
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
      empresa_id, deposito_id, fornecedor_id, produto_id, motorista_id, veiculo_id,
      data_entrada, nf_numero, nf_serie, chave_acesso, fornecedor_nome, fornecedor_cnpj,
      produto_nome, peso_nf, valor_unitario, valor_total_nota, placa, veiculo,
      motorista, transportadora, origem, observacao, responsavel_nome, created_by
    ) values (
      v_empresa, v_deposito, v_fornecedor, v_produto, v_motorista, v_veiculo,
      (p_dados->>'data_entrada')::timestamptz, btrim(p_dados->>'nf_numero'),
      coalesce(nullif(btrim(p_dados->>'nf_serie'), ''), '1'),
      nullif(btrim(p_dados->>'chave_acesso'), ''), v_fornecedor_nome, v_fornecedor_cnpj,
      v_produto_nome, (p_dados->>'peso_nf')::numeric, v_valor_unitario, v_valor_total,
      v_placa, v_tipo_veiculo, v_motorista_nome, nullif(btrim(p_dados->>'transportadora'), ''),
      v_fornecedor_nome, nullif(btrim(p_dados->>'observacao'), ''),
      btrim(p_dados->>'responsavel_nome'), v_user
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
      deposito_id = v_deposito, fornecedor_id = v_fornecedor, produto_id = v_produto,
      motorista_id = v_motorista, veiculo_id = v_veiculo,
      data_entrada = (p_dados->>'data_entrada')::timestamptz,
      nf_numero = btrim(p_dados->>'nf_numero'),
      nf_serie = coalesce(nullif(btrim(p_dados->>'nf_serie'), ''), '1'),
      chave_acesso = nullif(btrim(p_dados->>'chave_acesso'), ''),
      fornecedor_nome = v_fornecedor_nome, fornecedor_cnpj = v_fornecedor_cnpj,
      produto_nome = v_produto_nome, peso_nf = (p_dados->>'peso_nf')::numeric,
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

revoke all on function public.oficina_messejana_opcoes_entrada() from public, anon;
grant execute on function public.oficina_messejana_opcoes_entrada() to authenticated;
revoke all on function public.oficina_messejana_salvar_entrada(uuid,jsonb) from public, anon;
grant execute on function public.oficina_messejana_salvar_entrada(uuid,jsonb) to authenticated;
