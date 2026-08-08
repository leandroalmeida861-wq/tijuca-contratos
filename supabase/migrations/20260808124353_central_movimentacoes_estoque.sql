-- AgroFlow | Central de Graos Messejana
-- Livro de movimentacoes complementar. Registros antigos permanecem inalterados.

create table public.oficina_messejana_movimentacoes_estoque (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default public.agroflow_empresa_atual_id()
    references public.empresas(id) on delete restrict,
  idempotency_key uuid not null default gen_random_uuid(),
  tipo text not null check (tipo in (
    'SALDO_INICIAL',
    'TRANSFERENCIA_ESTOQUE_PROPRIO',
    'REFATURAMENTO_VENDA',
    'OPERACAO_DIRETA',
    'AJUSTE_ESTOQUE'
  )),
  proprietario_id uuid not null references public.fornecedores(id) on delete restrict,
  local_origem_id uuid references public.fornecedores(id) on delete restrict,
  local_destino_id uuid references public.fornecedores(id) on delete restrict,
  destinatario_id uuid references public.fornecedores(id) on delete restrict,
  unidade_destino_id uuid references public.balancas(id) on delete restrict,
  produto_id uuid not null references public.produtos(id) on delete restrict,
  entrada_id uuid references public.oficina_messejana_entradas(id) on delete restrict,
  data_movimentacao timestamptz not null,
  data_referencia date not null,
  quantidade numeric(16,3) not null check (quantidade > 0),
  sentido_ajuste text check (sentido_ajuste is null or sentido_ajuste in ('POSITIVO','NEGATIVO')),
  documento_compra text,
  documento_venda text,
  valor_unitario_compra numeric(16,4) check (valor_unitario_compra is null or valor_unitario_compra >= 0),
  valor_total_compra numeric(16,2) check (valor_total_compra is null or valor_total_compra >= 0),
  valor_unitario_venda numeric(16,4) check (valor_unitario_venda is null or valor_unitario_venda >= 0),
  valor_total_venda numeric(16,2) check (valor_total_venda is null or valor_total_venda >= 0),
  justificativa text,
  observacao text,
  status_registro text not null default 'CONFIRMADA'
    check (status_registro in ('CONFIRMADA','CANCELADA')),
  motivo_cancelamento text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete restrict,
  cancelled_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  unique (empresa_id, idempotency_key),
  check (tipo <> 'AJUSTE_ESTOQUE' or sentido_ajuste is not null),
  check (tipo not in ('SALDO_INICIAL','AJUSTE_ESTOQUE') or btrim(coalesce(justificativa,'')) <> ''),
  check (status_registro <> 'CANCELADA' or btrim(coalesce(motivo_cancelamento,'')) <> '')
);

create unique index oficina_messejana_saldo_inicial_unico_idx
  on public.oficina_messejana_movimentacoes_estoque
  (empresa_id, proprietario_id, local_destino_id, produto_id, data_referencia)
  where tipo = 'SALDO_INICIAL' and status_registro = 'CONFIRMADA';

create index oficina_messejana_movimentacoes_periodo_idx
  on public.oficina_messejana_movimentacoes_estoque (empresa_id, data_movimentacao desc);
create index oficina_messejana_movimentacoes_saldo_idx
  on public.oficina_messejana_movimentacoes_estoque
  (empresa_id, proprietario_id, produto_id, local_origem_id, local_destino_id)
  where status_registro = 'CONFIRMADA';

alter table public.oficina_messejana_movimentacoes_estoque enable row level security;
alter table public.oficina_messejana_movimentacoes_estoque force row level security;

create policy oficina_messejana_movimentacoes_select
  on public.oficina_messejana_movimentacoes_estoque
  for select to authenticated
  using (
    empresa_id = (select public.agroflow_empresa_atual_id())
    and (select public.agroflow_tem_permissao('oficina_messejana_saidas','visualizar'))
  );

revoke all on table public.oficina_messejana_movimentacoes_estoque from public, anon, authenticated;
grant select on table public.oficina_messejana_movimentacoes_estoque to authenticated;

create or replace function public.oficina_messejana_saldo_fornecedor(
  p_proprietario_id uuid,
  p_local_id uuid,
  p_produto_id uuid,
  p_excluir_movimentacao_id uuid default null
) returns numeric
language sql
stable
security definer
set search_path = ''
as $function$
  select round(coalesce((
    select sum(delta) from (
      select e.peso_nf
        - coalesce((select sum(s.peso_saida)
                    from public.oficina_messejana_saidas s
                    where s.entrada_id=e.id and s.status_registro='CONFIRMADA'),0) as delta
      from public.oficina_messejana_entradas e
      where e.empresa_id=public.agroflow_empresa_atual_id()
        and e.status_registro='CONFIRMADA'
        and e.fornecedor_id=p_proprietario_id
        and coalesce(e.fornecedor_destino_id,e.fornecedor_id)=p_local_id
        and e.produto_id=p_produto_id
      union all
      select case
        when m.tipo='SALDO_INICIAL' and m.local_destino_id=p_local_id then m.quantidade
        when m.tipo='TRANSFERENCIA_ESTOQUE_PROPRIO' and m.local_origem_id=p_local_id then -m.quantidade
        when m.tipo='REFATURAMENTO_VENDA' and m.local_origem_id=p_local_id then -m.quantidade
        when m.tipo='AJUSTE_ESTOQUE' and m.local_destino_id=p_local_id
          then case when m.sentido_ajuste='POSITIVO' then m.quantidade else -m.quantidade end
        else 0 end
      from public.oficina_messejana_movimentacoes_estoque m
      where m.empresa_id=public.agroflow_empresa_atual_id()
        and m.status_registro='CONFIRMADA'
        and m.proprietario_id=p_proprietario_id
        and m.produto_id=p_produto_id
        and (p_excluir_movimentacao_id is null or m.id<>p_excluir_movimentacao_id)
    ) movimentos
  ),0),3);
$function$;

revoke all on function public.oficina_messejana_saldo_fornecedor(uuid,uuid,uuid,uuid) from public, anon, authenticated;

create or replace view public.oficina_messejana_movimentacoes_resumo
with (security_invoker = true)
as
select
  m.*,
  prop.nome as proprietario_nome,
  prop.cnpj as proprietario_documento,
  origem.nome as local_origem_nome,
  origem.cnpj as local_origem_documento,
  destino.nome as local_destino_nome,
  destino.cnpj as local_destino_documento,
  destinatario.nome as destinatario_nome,
  destinatario.cnpj as destinatario_documento,
  unidade.nome as unidade_destino_nome,
  produto.nome as produto_nome
from public.oficina_messejana_movimentacoes_estoque m
join public.fornecedores prop on prop.id=m.proprietario_id and prop.empresa_id=m.empresa_id
left join public.fornecedores origem on origem.id=m.local_origem_id and origem.empresa_id=m.empresa_id
left join public.fornecedores destino on destino.id=m.local_destino_id and destino.empresa_id=m.empresa_id
left join public.fornecedores destinatario on destinatario.id=m.destinatario_id and destinatario.empresa_id=m.empresa_id
left join public.balancas unidade on unidade.id=m.unidade_destino_id and unidade.empresa_id=m.empresa_id
join public.produtos produto on produto.id=m.produto_id and produto.empresa_id=m.empresa_id;

revoke all on public.oficina_messejana_movimentacoes_resumo from public, anon;
grant select on public.oficina_messejana_movimentacoes_resumo to authenticated;

create or replace function public.oficina_messejana_salvar_movimentacao(
  p_movimentacao_id uuid,
  p_idempotency_key uuid,
  p_dados jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_empresa uuid := public.agroflow_empresa_atual_id();
  v_id uuid;
  v_old jsonb;
  v_old_mov public.oficina_messejana_movimentacoes_estoque%rowtype;
  v_tipo text := upper(btrim(p_dados->>'tipo'));
  v_proprietario uuid := nullif(p_dados->>'proprietario_id','')::uuid;
  v_origem uuid := nullif(p_dados->>'local_origem_id','')::uuid;
  v_destino uuid := nullif(p_dados->>'local_destino_id','')::uuid;
  v_destinatario uuid := nullif(p_dados->>'destinatario_id','')::uuid;
  v_unidade uuid := nullif(p_dados->>'unidade_destino_id','')::uuid;
  v_produto uuid := nullif(p_dados->>'produto_id','')::uuid;
  v_entrada uuid := nullif(p_dados->>'entrada_id','')::uuid;
  v_quantidade numeric(16,3) := nullif(p_dados->>'quantidade','')::numeric;
  v_sentido text := nullif(upper(btrim(p_dados->>'sentido_ajuste')),'');
  v_data timestamptz := nullif(p_dados->>'data_movimentacao','')::timestamptz;
  v_referencia date := coalesce(nullif(p_dados->>'data_referencia','')::date, v_data::date);
  v_justificativa text := nullif(btrim(p_dados->>'justificativa'),'');
  v_saldo numeric;
begin
  if v_user is null or v_empresa is null
     or not public.agroflow_tem_permissao(
       'oficina_messejana_saidas',
       case when p_movimentacao_id is null then 'cadastrar' else 'editar' end
     ) then
    raise exception 'OFICINA_ACESSO_NEGADO' using errcode='42501';
  end if;
  if v_tipo not in ('SALDO_INICIAL','TRANSFERENCIA_ESTOQUE_PROPRIO','REFATURAMENTO_VENDA','OPERACAO_DIRETA','AJUSTE_ESTOQUE')
     or v_quantidade is null or v_quantidade<=0 or v_data is null then
    raise exception 'OFICINA_MOVIMENTACAO_INVALIDA' using errcode='23514';
  end if;
  if not exists(select 1 from public.fornecedores f where f.id=v_proprietario and f.empresa_id=v_empresa)
     or not exists(select 1 from public.produtos p where p.id=v_produto and p.empresa_id=v_empresa) then
    raise exception 'OFICINA_CADASTRO_FORA_EMPRESA' using errcode='23514';
  end if;
  if v_origem is not null and not exists(select 1 from public.fornecedores f where f.id=v_origem and f.empresa_id=v_empresa) then
    raise exception 'OFICINA_LOCAL_INVALIDO' using errcode='23514';
  end if;
  if v_destino is not null and not exists(select 1 from public.fornecedores f where f.id=v_destino and f.empresa_id=v_empresa) then
    raise exception 'OFICINA_LOCAL_INVALIDO' using errcode='23514';
  end if;
  if v_destinatario is not null and not exists(select 1 from public.fornecedores f where f.id=v_destinatario and f.empresa_id=v_empresa) then
    raise exception 'OFICINA_DESTINO_INVALIDO' using errcode='23514';
  end if;
  if v_unidade is not null and not exists(
    select 1 from public.balancas b where b.id=v_unidade and b.empresa_id=v_empresa and b.ativo
      and public.agroflow_acessa_unidade(b.id)
  ) then
    raise exception 'OFICINA_UNIDADE_INVALIDA' using errcode='23514';
  end if;
  if v_entrada is not null and not exists(select 1 from public.oficina_messejana_entradas e where e.id=v_entrada and e.empresa_id=v_empresa) then
    raise exception 'OFICINA_REGISTRO_NAO_ENCONTRADO' using errcode='P0002';
  end if;

  if v_tipo in ('SALDO_INICIAL','AJUSTE_ESTOQUE') and (v_destino is null or v_justificativa is null) then
    raise exception 'OFICINA_JUSTIFICATIVA_OBRIGATORIA' using errcode='23514';
  elsif v_tipo='TRANSFERENCIA_ESTOQUE_PROPRIO' and (v_origem is null or v_unidade is null) then
    raise exception 'OFICINA_MOVIMENTACAO_INVALIDA' using errcode='23514';
  elsif v_tipo='REFATURAMENTO_VENDA' and (v_origem is null or v_destinatario is null or nullif(btrim(p_dados->>'documento_venda'),'') is null) then
    raise exception 'OFICINA_MOVIMENTACAO_INVALIDA' using errcode='23514';
  elsif v_tipo='OPERACAO_DIRETA' and (v_origem is null or v_destinatario is null or nullif(btrim(p_dados->>'documento_compra'),'') is null) then
    raise exception 'OFICINA_MOVIMENTACAO_INVALIDA' using errcode='23514';
  elsif v_tipo='AJUSTE_ESTOQUE' and v_sentido not in ('POSITIVO','NEGATIVO') then
    raise exception 'OFICINA_MOVIMENTACAO_INVALIDA' using errcode='23514';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    concat_ws('|',v_empresa,v_proprietario,v_origem,v_destino,v_produto),0
  ));

  if p_movimentacao_id is not null then
    select m.* into v_old_mov
    from public.oficina_messejana_movimentacoes_estoque m
    where m.id=p_movimentacao_id and m.empresa_id=v_empresa and m.status_registro='CONFIRMADA'
    for update;
    if not found then raise exception 'OFICINA_REGISTRO_NAO_ENCONTRADO' using errcode='P0002'; end if;
    v_old := to_jsonb(v_old_mov);

    if v_old_mov.tipo='SALDO_INICIAL'
       or (v_old_mov.tipo='AJUSTE_ESTOQUE' and v_old_mov.sentido_ajuste='POSITIVO') then
      v_saldo := public.oficina_messejana_saldo_fornecedor(
        v_old_mov.proprietario_id,v_old_mov.local_destino_id,v_old_mov.produto_id,p_movimentacao_id
      );
      if v_tipo='SALDO_INICIAL'
         or (v_tipo='AJUSTE_ESTOQUE' and v_sentido='POSITIVO') then
        if v_proprietario is not distinct from v_old_mov.proprietario_id
           and v_destino is not distinct from v_old_mov.local_destino_id
           and v_produto is not distinct from v_old_mov.produto_id then
          v_saldo := v_saldo + v_quantidade;
        end if;
      end if;
      if v_saldo<0 then
        raise exception 'OFICINA_SALDO_INSUFICIENTE' using errcode='23514';
      end if;
    end if;
  end if;

  if v_tipo in ('TRANSFERENCIA_ESTOQUE_PROPRIO','REFATURAMENTO_VENDA')
     or (v_tipo='AJUSTE_ESTOQUE' and v_sentido='NEGATIVO') then
    v_saldo := public.oficina_messejana_saldo_fornecedor(
      v_proprietario,coalesce(v_origem,v_destino),v_produto,p_movimentacao_id
    );
    if v_quantidade>v_saldo then
      raise exception 'OFICINA_SALDO_INSUFICIENTE' using errcode='23514';
    end if;
  end if;

  insert into public.oficina_messejana_movimentacoes_estoque (
    id,empresa_id,idempotency_key,tipo,proprietario_id,local_origem_id,local_destino_id,
    destinatario_id,unidade_destino_id,produto_id,entrada_id,data_movimentacao,data_referencia,
    quantidade,sentido_ajuste,documento_compra,documento_venda,
    valor_unitario_compra,valor_total_compra,valor_unitario_venda,valor_total_venda,
    justificativa,observacao,created_by,updated_by
  ) values (
    coalesce(p_movimentacao_id,gen_random_uuid()),v_empresa,p_idempotency_key,v_tipo,v_proprietario,
    v_origem,v_destino,v_destinatario,v_unidade,v_produto,v_entrada,v_data,v_referencia,
    v_quantidade,v_sentido,nullif(btrim(p_dados->>'documento_compra'),''),
    nullif(btrim(p_dados->>'documento_venda'),''),
    nullif(p_dados->>'valor_unitario_compra','')::numeric,
    nullif(p_dados->>'valor_total_compra','')::numeric,
    nullif(p_dados->>'valor_unitario_venda','')::numeric,
    nullif(p_dados->>'valor_total_venda','')::numeric,
    v_justificativa,nullif(btrim(p_dados->>'observacao'),''),v_user,
    case when p_movimentacao_id is null then null else v_user end
  )
  on conflict (id) do update set
    tipo=excluded.tipo,proprietario_id=excluded.proprietario_id,
    local_origem_id=excluded.local_origem_id,local_destino_id=excluded.local_destino_id,
    destinatario_id=excluded.destinatario_id,unidade_destino_id=excluded.unidade_destino_id,
    produto_id=excluded.produto_id,entrada_id=excluded.entrada_id,
    data_movimentacao=excluded.data_movimentacao,data_referencia=excluded.data_referencia,
    quantidade=excluded.quantidade,sentido_ajuste=excluded.sentido_ajuste,
    documento_compra=excluded.documento_compra,documento_venda=excluded.documento_venda,
    valor_unitario_compra=excluded.valor_unitario_compra,valor_total_compra=excluded.valor_total_compra,
    valor_unitario_venda=excluded.valor_unitario_venda,valor_total_venda=excluded.valor_total_venda,
    justificativa=excluded.justificativa,observacao=excluded.observacao,
    updated_by=v_user,updated_at=now()
  returning id into v_id;

  perform public.agroflow_auditar(
    case when p_movimentacao_id is null then 'criar' else 'editar' end,
    'oficina_messejana_movimentacoes_estoque',v_id::text,v_old,
    (select to_jsonb(m) from public.oficina_messejana_movimentacoes_estoque m where m.id=v_id)
  );
  return v_id;
exception
  when unique_violation then
    if v_tipo='SALDO_INICIAL' then
      raise exception 'OFICINA_SALDO_INICIAL_DUPLICADO' using errcode='23505';
    end if;
    raise exception 'OFICINA_MOVIMENTACAO_DUPLICADA' using errcode='23505';
end;
$function$;

create or replace function public.oficina_messejana_cancelar_movimentacao(
  p_movimentacao_id uuid,
  p_motivo text
) returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_empresa uuid := public.agroflow_empresa_atual_id();
  v_old jsonb;
  v_mov public.oficina_messejana_movimentacoes_estoque%rowtype;
  v_saldo_sem_movimento numeric;
begin
  if v_user is null or v_empresa is null
     or not public.agroflow_tem_permissao('oficina_messejana_saidas','cancelar') then
    raise exception 'OFICINA_ACESSO_NEGADO' using errcode='42501';
  end if;
  if btrim(coalesce(p_motivo,''))='' then
    raise exception 'OFICINA_JUSTIFICATIVA_OBRIGATORIA' using errcode='23514';
  end if;
  select * into v_mov from public.oficina_messejana_movimentacoes_estoque m
  where m.id=p_movimentacao_id and m.empresa_id=v_empresa and m.status_registro='CONFIRMADA' for update;
  if not found then raise exception 'OFICINA_REGISTRO_NAO_ENCONTRADO' using errcode='P0002'; end if;
  v_old := to_jsonb(v_mov);
  if v_mov.tipo='SALDO_INICIAL'
     or (v_mov.tipo='AJUSTE_ESTOQUE' and v_mov.sentido_ajuste='POSITIVO') then
    v_saldo_sem_movimento := public.oficina_messejana_saldo_fornecedor(
      v_mov.proprietario_id,v_mov.local_destino_id,v_mov.produto_id,v_mov.id
    );
    if v_saldo_sem_movimento<0 then
      raise exception 'OFICINA_SALDO_INSUFICIENTE' using errcode='23514';
    end if;
  end if;
  update public.oficina_messejana_movimentacoes_estoque set
    status_registro='CANCELADA',motivo_cancelamento=btrim(p_motivo),
    cancelled_by=v_user,cancelled_at=now(),updated_by=v_user,updated_at=now()
  where id=p_movimentacao_id and empresa_id=v_empresa;
  perform public.agroflow_auditar(
    'cancelar','oficina_messejana_movimentacoes_estoque',p_movimentacao_id::text,v_old,
    (select to_jsonb(m) from public.oficina_messejana_movimentacoes_estoque m where m.id=p_movimentacao_id)
  );
end;
$function$;

revoke all on function public.oficina_messejana_salvar_movimentacao(uuid,uuid,jsonb) from public, anon;
revoke all on function public.oficina_messejana_cancelar_movimentacao(uuid,text) from public, anon;
grant execute on function public.oficina_messejana_salvar_movimentacao(uuid,uuid,jsonb) to authenticated;
grant execute on function public.oficina_messejana_cancelar_movimentacao(uuid,text) to authenticated;

create or replace function public.oficina_messejana_dashboard_estoque(
  p_inicio timestamptz,
  p_fim timestamptz
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_empresa uuid := public.agroflow_empresa_atual_id();
  v_result jsonb;
begin
  if auth.uid() is null or v_empresa is null
     or not public.agroflow_tem_permissao('oficina_messejana','visualizar') then
    raise exception 'OFICINA_ACESSO_NEGADO' using errcode='42501';
  end if;
  select jsonb_build_object(
    'quantidade_movimentacoes',count(*) filter(where status_registro='CONFIRMADA'),
    'saldo_inicial',coalesce(sum(quantidade) filter(where status_registro='CONFIRMADA' and tipo='SALDO_INICIAL'),0),
    'transferencias',coalesce(sum(quantidade) filter(where status_registro='CONFIRMADA' and tipo='TRANSFERENCIA_ESTOQUE_PROPRIO'),0),
    'vendas',coalesce(sum(quantidade) filter(where status_registro='CONFIRMADA' and tipo='REFATURAMENTO_VENDA'),0),
    'operacoes_diretas',coalesce(sum(quantidade) filter(where status_registro='CONFIRMADA' and tipo='OPERACAO_DIRETA'),0),
    'ajustes',coalesce(sum(case when sentido_ajuste='POSITIVO' then quantidade else -quantidade end)
      filter(where status_registro='CONFIRMADA' and tipo='AJUSTE_ESTOQUE'),0),
    'saldo_complementar',coalesce(sum(case
      when tipo='SALDO_INICIAL' then quantidade
      when tipo='REFATURAMENTO_VENDA' then -quantidade
      when tipo='AJUSTE_ESTOQUE' and sentido_ajuste='POSITIVO' then quantidade
      when tipo='AJUSTE_ESTOQUE' and sentido_ajuste='NEGATIVO' then -quantidade
      else 0 end) filter(where status_registro='CONFIRMADA'),0)
  ) into v_result
  from public.oficina_messejana_movimentacoes_estoque
  where empresa_id=v_empresa and data_movimentacao>=p_inicio and data_movimentacao<p_fim;
  return coalesce(v_result,'{}'::jsonb);
end;
$function$;

revoke all on function public.oficina_messejana_dashboard_estoque(timestamptz,timestamptz) from public, anon;
grant execute on function public.oficina_messejana_dashboard_estoque(timestamptz,timestamptz) to authenticated;
