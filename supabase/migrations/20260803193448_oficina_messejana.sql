-- AgroFlow | Central de Graos Messejana
-- Migration aditiva. Nao copia, altera ou remove dados dos modulos existentes.

insert into public.permissoes_menu (
  perfil, menu, visualizar, cadastrar, editar, excluir, cancelar, aprovar, exportar
)
select p.perfil, m.menu,
  p.perfil in ('admin', 'visualizador'),
  p.perfil = 'admin',
  p.perfil = 'admin',
  false,
  p.perfil = 'admin',
  p.perfil = 'admin',
  p.perfil in ('admin', 'visualizador')
from (select distinct perfil from public.permissoes_menu) p
cross join (values
  ('oficina_messejana'),
  ('oficina_messejana_entradas'),
  ('oficina_messejana_saidas'),
  ('oficina_messejana_relatorios'),
  ('oficina_messejana_depositos')
) m(menu)
on conflict (perfil, menu) do nothing;

create table if not exists public.oficina_messejana_depositos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default public.agroflow_empresa_atual_id()
    references public.empresas(id) on delete restrict,
  nome text not null check (btrim(nome) <> ''),
  ativo boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists oficina_messejana_depositos_nome_key
  on public.oficina_messejana_depositos (empresa_id, lower(btrim(nome)));
create index if not exists oficina_messejana_depositos_empresa_ativo_idx
  on public.oficina_messejana_depositos (empresa_id, ativo, nome);

insert into public.oficina_messejana_depositos (empresa_id, nome, created_by)
select e.id, d.nome, coalesce(
  (select p.user_id from public.profiles p where p.empresa_id = e.id and p.perfil = 'admin' and p.ativo order by p.criado_em limit 1),
  (select u.id from auth.users u order by u.created_at limit 1)
)
from public.empresas e
cross join (values ('Feliana'), ('Jairo'), ('Nicodemos'), ('Guaraves'), ('Paulo Dalto')) d(nome)
where exists (select 1 from auth.users)
on conflict do nothing;

create table if not exists public.oficina_messejana_entradas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default public.agroflow_empresa_atual_id()
    references public.empresas(id) on delete restrict,
  deposito_id uuid not null references public.oficina_messejana_depositos(id) on delete restrict,
  fornecedor_id uuid references public.fornecedores(id) on delete restrict,
  produto_id uuid references public.produtos(id) on delete restrict,
  data_entrada timestamptz not null,
  nf_numero text not null check (btrim(nf_numero) <> ''),
  nf_serie text not null default '1' check (btrim(nf_serie) <> ''),
  chave_acesso text,
  fornecedor_nome text not null check (btrim(fornecedor_nome) <> ''),
  fornecedor_cnpj text not null check (length(public.agroflow_apenas_digitos(fornecedor_cnpj)) = 14),
  produto_nome text not null check (btrim(produto_nome) <> ''),
  peso_nf numeric(16,3) not null check (peso_nf > 0),
  placa text,
  veiculo text,
  motorista text,
  transportadora text,
  origem text,
  observacao text,
  responsavel_nome text not null check (btrim(responsavel_nome) <> ''),
  status_registro text not null default 'CONFIRMADA'
    check (status_registro in ('CONFIRMADA', 'CANCELADA')),
  motivo_cancelamento text,
  cancelled_by uuid references auth.users(id) on delete restrict,
  cancelled_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (chave_acesso is null or length(public.agroflow_apenas_digitos(chave_acesso)) = 44),
  check (status_registro <> 'CANCELADA' or btrim(coalesce(motivo_cancelamento, '')) <> '')
);

create unique index if not exists oficina_messejana_entradas_nf_key
  on public.oficina_messejana_entradas (
    empresa_id,
    public.agroflow_apenas_digitos(fornecedor_cnpj),
    public.agroflow_nf_numero_normalizado(nf_numero),
    public.agroflow_nf_serie_normalizada(nf_serie)
  );
create unique index if not exists oficina_messejana_entradas_chave_key
  on public.oficina_messejana_entradas (empresa_id, public.agroflow_apenas_digitos(chave_acesso))
  where chave_acesso is not null and btrim(chave_acesso) <> '';
create index if not exists oficina_messejana_entradas_data_idx
  on public.oficina_messejana_entradas (empresa_id, data_entrada desc);
create index if not exists oficina_messejana_entradas_fornecedor_idx
  on public.oficina_messejana_entradas (empresa_id, fornecedor_id, fornecedor_nome);
create index if not exists oficina_messejana_entradas_produto_idx
  on public.oficina_messejana_entradas (empresa_id, produto_id, produto_nome);
create index if not exists oficina_messejana_entradas_deposito_idx
  on public.oficina_messejana_entradas (empresa_id, deposito_id, data_entrada desc);

create table if not exists public.oficina_messejana_saidas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default public.agroflow_empresa_atual_id()
    references public.empresas(id) on delete restrict,
  entrada_id uuid not null references public.oficina_messejana_entradas(id) on delete restrict,
  idempotency_key uuid not null,
  data_saida timestamptz not null,
  nf_saida_numero text not null check (btrim(nf_saida_numero) <> ''),
  nf_saida_serie text not null default '1' check (btrim(nf_saida_serie) <> ''),
  chave_saida text,
  peso_saida numeric(16,3) not null check (peso_saida > 0),
  destino text not null check (btrim(destino) <> ''),
  destinatario text,
  destinatario_cnpj text,
  placa text,
  veiculo text,
  motorista text,
  transportadora text,
  responsavel_nome text not null check (btrim(responsavel_nome) <> ''),
  observacao text,
  status_registro text not null default 'CONFIRMADA'
    check (status_registro in ('CONFIRMADA', 'CANCELADA')),
  motivo_cancelamento text,
  cancelled_by uuid references auth.users(id) on delete restrict,
  cancelled_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (chave_saida is null or length(public.agroflow_apenas_digitos(chave_saida)) = 44),
  check (destinatario_cnpj is null or btrim(destinatario_cnpj) = '' or length(public.agroflow_apenas_digitos(destinatario_cnpj)) = 14),
  check (status_registro <> 'CANCELADA' or btrim(coalesce(motivo_cancelamento, '')) <> '')
);

create unique index if not exists oficina_messejana_saidas_idempotency_key
  on public.oficina_messejana_saidas (empresa_id, idempotency_key);
create unique index if not exists oficina_messejana_saidas_chave_key
  on public.oficina_messejana_saidas (empresa_id, public.agroflow_apenas_digitos(chave_saida))
  where chave_saida is not null and btrim(chave_saida) <> '';
create index if not exists oficina_messejana_saidas_entrada_idx
  on public.oficina_messejana_saidas (entrada_id, status_registro, data_saida desc);
create index if not exists oficina_messejana_saidas_data_idx
  on public.oficina_messejana_saidas (empresa_id, data_saida desc);
create index if not exists oficina_messejana_saidas_destino_idx
  on public.oficina_messejana_saidas (empresa_id, destino, data_saida desc);

create table if not exists public.oficina_messejana_notas_complementares (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default public.agroflow_empresa_atual_id()
    references public.empresas(id) on delete restrict,
  entrada_id uuid not null references public.oficina_messejana_entradas(id) on delete restrict,
  nf_numero text not null check (btrim(nf_numero) <> ''),
  nf_serie text not null default '1' check (btrim(nf_serie) <> ''),
  chave_acesso text,
  observacao text,
  status_registro text not null default 'ATIVA' check (status_registro in ('ATIVA', 'CANCELADA')),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (chave_acesso is null or length(public.agroflow_apenas_digitos(chave_acesso)) = 44)
);

create unique index if not exists oficina_messejana_complementares_nf_key
  on public.oficina_messejana_notas_complementares (
    empresa_id, entrada_id,
    public.agroflow_nf_numero_normalizado(nf_numero),
    public.agroflow_nf_serie_normalizada(nf_serie)
  );

create or replace function private.oficina_messejana_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists oficina_messejana_depositos_touch on public.oficina_messejana_depositos;
create trigger oficina_messejana_depositos_touch before update on public.oficina_messejana_depositos
for each row execute function private.oficina_messejana_touch_updated_at();
drop trigger if exists oficina_messejana_depositos_audit on public.oficina_messejana_depositos;
create trigger oficina_messejana_depositos_audit after insert or update on public.oficina_messejana_depositos
for each row execute function public.agroflow_audit_trigger();
drop trigger if exists oficina_messejana_entradas_touch on public.oficina_messejana_entradas;
create trigger oficina_messejana_entradas_touch before update on public.oficina_messejana_entradas
for each row execute function private.oficina_messejana_touch_updated_at();
drop trigger if exists oficina_messejana_saidas_touch on public.oficina_messejana_saidas;
create trigger oficina_messejana_saidas_touch before update on public.oficina_messejana_saidas
for each row execute function private.oficina_messejana_touch_updated_at();
drop trigger if exists oficina_messejana_complementares_touch on public.oficina_messejana_notas_complementares;
create trigger oficina_messejana_complementares_touch before update on public.oficina_messejana_notas_complementares
for each row execute function private.oficina_messejana_touch_updated_at();

alter table public.oficina_messejana_depositos enable row level security;
alter table public.oficina_messejana_entradas enable row level security;
alter table public.oficina_messejana_saidas enable row level security;
alter table public.oficina_messejana_notas_complementares enable row level security;

drop policy if exists oficina_messejana_depositos_select on public.oficina_messejana_depositos;
create policy oficina_messejana_depositos_select on public.oficina_messejana_depositos
for select to authenticated
using (public.agroflow_mesma_empresa(empresa_id) and public.agroflow_tem_permissao('oficina_messejana', 'visualizar'));
drop policy if exists oficina_messejana_depositos_admin_insert on public.oficina_messejana_depositos;
create policy oficina_messejana_depositos_admin_insert on public.oficina_messejana_depositos
for insert to authenticated
with check (public.agroflow_mesma_empresa(empresa_id) and public.agroflow_is_admin() and created_by = auth.uid());
drop policy if exists oficina_messejana_depositos_admin_update on public.oficina_messejana_depositos;
create policy oficina_messejana_depositos_admin_update on public.oficina_messejana_depositos
for update to authenticated
using (public.agroflow_mesma_empresa(empresa_id) and public.agroflow_is_admin())
with check (public.agroflow_mesma_empresa(empresa_id) and public.agroflow_is_admin());

drop policy if exists oficina_messejana_entradas_select on public.oficina_messejana_entradas;
create policy oficina_messejana_entradas_select on public.oficina_messejana_entradas
for select to authenticated
using (public.agroflow_mesma_empresa(empresa_id) and public.agroflow_tem_permissao('oficina_messejana_entradas', 'visualizar'));
drop policy if exists oficina_messejana_saidas_select on public.oficina_messejana_saidas;
create policy oficina_messejana_saidas_select on public.oficina_messejana_saidas
for select to authenticated
using (public.agroflow_mesma_empresa(empresa_id) and public.agroflow_tem_permissao('oficina_messejana_saidas', 'visualizar'));
drop policy if exists oficina_messejana_complementares_select on public.oficina_messejana_notas_complementares;
create policy oficina_messejana_complementares_select on public.oficina_messejana_notas_complementares
for select to authenticated
using (public.agroflow_mesma_empresa(empresa_id) and public.agroflow_tem_permissao('oficina_messejana_entradas', 'visualizar'));

create or replace view public.oficina_messejana_entradas_resumo
with (security_invoker = true)
as
select
  e.*,
  d.nome as deposito_nome,
  coalesce(s.peso_retirado, 0)::numeric(16,3) as peso_retirado,
  greatest(e.peso_nf - coalesce(s.peso_retirado, 0), 0)::numeric(16,3) as saldo_disponivel,
  case
    when e.status_registro = 'CANCELADA' then 'CANCELADA'
    when coalesce(s.peso_retirado, 0) = 0 then 'SEM_SAIDA'
    when coalesce(s.peso_retirado, 0) < e.peso_nf then 'SAIDA_PARCIAL'
    else 'SAIDA_TOTAL'
  end as status_saldo
from public.oficina_messejana_entradas e
join public.oficina_messejana_depositos d on d.id = e.deposito_id and d.empresa_id = e.empresa_id
left join lateral (
  select sum(x.peso_saida) as peso_retirado
  from public.oficina_messejana_saidas x
  where x.entrada_id = e.id and x.empresa_id = e.empresa_id and x.status_registro = 'CONFIRMADA'
) s on true;

create or replace view public.oficina_messejana_saidas_resumo
with (security_invoker = true)
as
select
  s.*,
  e.nf_numero as nf_origem_numero,
  e.nf_serie as nf_origem_serie,
  e.fornecedor_nome,
  e.produto_nome,
  e.deposito_id,
  e.peso_nf as peso_entrada,
  d.nome as deposito_origem,
  greatest(e.peso_nf - coalesce(x.peso_retirado, 0), 0)::numeric(16,3) as saldo_apos_saida
from public.oficina_messejana_saidas s
join public.oficina_messejana_entradas e on e.id = s.entrada_id and e.empresa_id = s.empresa_id
join public.oficina_messejana_depositos d on d.id = e.deposito_id and d.empresa_id = e.empresa_id
left join lateral (
  select sum(sx.peso_saida) as peso_retirado
  from public.oficina_messejana_saidas sx
  where sx.entrada_id = e.id
    and sx.empresa_id = e.empresa_id
    and sx.status_registro = 'CONFIRMADA'
    and (sx.data_saida < s.data_saida or (sx.data_saida = s.data_saida and sx.id <= s.id))
) x on true;

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
  v_deposito uuid := nullif(p_dados->>'deposito_id', '')::uuid;
  v_action text := case when p_entrada_id is null then 'cadastrar' else 'editar' end;
  v_fornecedor uuid := nullif(p_dados->>'fornecedor_id', '')::uuid;
  v_produto uuid := nullif(p_dados->>'produto_id', '')::uuid;
begin
  if v_user is null or v_empresa is null or not public.agroflow_tem_permissao('oficina_messejana_entradas', v_action) then
    raise exception 'OFICINA_ACESSO_NEGADO' using errcode = '42501';
  end if;
  if v_deposito is null or not exists (
    select 1 from public.oficina_messejana_depositos d
    where d.id = v_deposito and d.empresa_id = v_empresa and d.ativo
  ) then raise exception 'OFICINA_DEPOSITO_INVALIDO' using errcode = '23514'; end if;
  if v_fornecedor is not null and not exists (
    select 1 from public.fornecedores f where f.id = v_fornecedor and f.empresa_id = v_empresa
  ) then raise exception 'OFICINA_FORNECEDOR_INVALIDO' using errcode = '23514'; end if;
  if v_produto is not null and not exists (
    select 1 from public.produtos p where p.id = v_produto and p.empresa_id = v_empresa
  ) then raise exception 'OFICINA_PRODUTO_INVALIDO' using errcode = '23514'; end if;

  if p_entrada_id is null then
    insert into public.oficina_messejana_entradas (
      empresa_id, deposito_id, fornecedor_id, produto_id, data_entrada, nf_numero, nf_serie,
      chave_acesso, fornecedor_nome, fornecedor_cnpj, produto_nome, peso_nf, placa, veiculo,
      motorista, transportadora, origem, observacao, responsavel_nome, created_by
    ) values (
      v_empresa, v_deposito, v_fornecedor,
      v_produto, (p_dados->>'data_entrada')::timestamptz,
      btrim(p_dados->>'nf_numero'), coalesce(nullif(btrim(p_dados->>'nf_serie'),''),'1'),
      nullif(btrim(p_dados->>'chave_acesso'),''), btrim(p_dados->>'fornecedor_nome'),
      btrim(p_dados->>'fornecedor_cnpj'), btrim(p_dados->>'produto_nome'),
      (p_dados->>'peso_nf')::numeric, nullif(upper(btrim(p_dados->>'placa')),''),
      nullif(btrim(p_dados->>'veiculo'),''), nullif(btrim(p_dados->>'motorista'),''),
      nullif(btrim(p_dados->>'transportadora'),''), nullif(btrim(p_dados->>'origem'),''),
      nullif(btrim(p_dados->>'observacao'),''), btrim(p_dados->>'responsavel_nome'), v_user
    ) returning id into v_id;
  else
    select to_jsonb(e) into v_old from public.oficina_messejana_entradas e
    where e.id = p_entrada_id and e.empresa_id = v_empresa and e.status_registro = 'CONFIRMADA' for update;
    if v_old is null then raise exception 'OFICINA_REGISTRO_NAO_ENCONTRADO' using errcode = 'P0002'; end if;
    update public.oficina_messejana_entradas set
      deposito_id = v_deposito, fornecedor_id = v_fornecedor,
      produto_id = v_produto, data_entrada = (p_dados->>'data_entrada')::timestamptz,
      nf_numero = btrim(p_dados->>'nf_numero'), nf_serie = coalesce(nullif(btrim(p_dados->>'nf_serie'),''),'1'),
      chave_acesso = nullif(btrim(p_dados->>'chave_acesso'),''), fornecedor_nome = btrim(p_dados->>'fornecedor_nome'),
      fornecedor_cnpj = btrim(p_dados->>'fornecedor_cnpj'), produto_nome = btrim(p_dados->>'produto_nome'),
      peso_nf = (p_dados->>'peso_nf')::numeric, placa = nullif(upper(btrim(p_dados->>'placa')),''),
      veiculo = nullif(btrim(p_dados->>'veiculo'),''), motorista = nullif(btrim(p_dados->>'motorista'),''),
      transportadora = nullif(btrim(p_dados->>'transportadora'),''), origem = nullif(btrim(p_dados->>'origem'),''),
      observacao = nullif(btrim(p_dados->>'observacao'),''), responsavel_nome = btrim(p_dados->>'responsavel_nome'),
      updated_by = v_user
    where id = p_entrada_id and empresa_id = v_empresa returning id into v_id;
    if (select coalesce(sum(s.peso_saida),0) from public.oficina_messejana_saidas s where s.entrada_id=v_id and s.status_registro='CONFIRMADA')
      > (select peso_nf from public.oficina_messejana_entradas where id=v_id) then
      raise exception 'OFICINA_PESO_MENOR_QUE_SAIDAS' using errcode = '23514';
    end if;
  end if;
  perform public.agroflow_auditar(case when p_entrada_id is null then 'criar' else 'editar' end,
    'oficina_messejana_entradas', v_id::text, v_old,
    (select to_jsonb(e) from public.oficina_messejana_entradas e where e.id=v_id));
  return v_id;
exception when unique_violation then
  raise exception 'OFICINA_NF_DUPLICADA' using errcode = '23505';
end;
$$;

create or replace function public.oficina_messejana_salvar_saida(p_saida_id uuid, p_entrada_id uuid, p_idempotency_key uuid, p_dados jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_empresa uuid := public.agroflow_empresa_atual_id();
  v_entrada public.oficina_messejana_entradas%rowtype;
  v_id uuid;
  v_old jsonb;
  v_retirado numeric(16,3);
  v_peso numeric(16,3) := (p_dados->>'peso_saida')::numeric;
  v_action text := case when p_saida_id is null then 'cadastrar' else 'editar' end;
begin
  if v_user is null or v_empresa is null or not public.agroflow_tem_permissao('oficina_messejana_saidas', v_action) then
    raise exception 'OFICINA_ACESSO_NEGADO' using errcode = '42501';
  end if;
  select * into v_entrada from public.oficina_messejana_entradas e
  where e.id = p_entrada_id and e.empresa_id = v_empresa for update;
  if not found then raise exception 'OFICINA_REGISTRO_NAO_ENCONTRADO' using errcode = 'P0002'; end if;
  if v_entrada.status_registro = 'CANCELADA' then raise exception 'OFICINA_ENTRADA_CANCELADA' using errcode = '23514'; end if;
  if v_peso is null or v_peso <= 0 or btrim(coalesce(p_dados->>'destino','')) = '' then
    raise exception 'OFICINA_SAIDA_INVALIDA' using errcode = '23514';
  end if;
  if p_saida_id is not null then
    select to_jsonb(s) into v_old from public.oficina_messejana_saidas s
    where s.id=p_saida_id and s.entrada_id=p_entrada_id and s.empresa_id=v_empresa and s.status_registro='CONFIRMADA' for update;
    if v_old is null then raise exception 'OFICINA_REGISTRO_NAO_ENCONTRADO' using errcode = 'P0002'; end if;
  end if;
  select coalesce(sum(s.peso_saida),0) into v_retirado
  from public.oficina_messejana_saidas s
  where s.entrada_id=p_entrada_id and s.empresa_id=v_empresa and s.status_registro='CONFIRMADA'
    and (p_saida_id is null or s.id <> p_saida_id);
  if v_peso > v_entrada.peso_nf - v_retirado then
    raise exception 'OFICINA_SALDO_INSUFICIENTE' using errcode = '23514';
  end if;

  if p_saida_id is null then
    insert into public.oficina_messejana_saidas (
      empresa_id, entrada_id, idempotency_key, data_saida, nf_saida_numero, nf_saida_serie,
      chave_saida, peso_saida, destino, destinatario, destinatario_cnpj, placa, veiculo,
      motorista, transportadora, responsavel_nome, observacao, created_by
    ) values (
      v_empresa, p_entrada_id, p_idempotency_key, (p_dados->>'data_saida')::timestamptz,
      btrim(p_dados->>'nf_saida_numero'), coalesce(nullif(btrim(p_dados->>'nf_saida_serie'),''),'1'),
      nullif(btrim(p_dados->>'chave_saida'),''), v_peso, btrim(p_dados->>'destino'),
      nullif(btrim(p_dados->>'destinatario'),''), nullif(btrim(p_dados->>'destinatario_cnpj'),''),
      nullif(upper(btrim(p_dados->>'placa')),''), nullif(btrim(p_dados->>'veiculo'),''),
      nullif(btrim(p_dados->>'motorista'),''), nullif(btrim(p_dados->>'transportadora'),''),
      btrim(p_dados->>'responsavel_nome'), nullif(btrim(p_dados->>'observacao'),''), v_user
    ) on conflict (empresa_id, idempotency_key) do update set idempotency_key=excluded.idempotency_key
    returning id into v_id;
  else
    update public.oficina_messejana_saidas set
      data_saida=(p_dados->>'data_saida')::timestamptz, nf_saida_numero=btrim(p_dados->>'nf_saida_numero'),
      nf_saida_serie=coalesce(nullif(btrim(p_dados->>'nf_saida_serie'),''),'1'),
      chave_saida=nullif(btrim(p_dados->>'chave_saida'),''), peso_saida=v_peso,
      destino=btrim(p_dados->>'destino'), destinatario=nullif(btrim(p_dados->>'destinatario'),''),
      destinatario_cnpj=nullif(btrim(p_dados->>'destinatario_cnpj'),''), placa=nullif(upper(btrim(p_dados->>'placa')),''),
      veiculo=nullif(btrim(p_dados->>'veiculo'),''), motorista=nullif(btrim(p_dados->>'motorista'),''),
      transportadora=nullif(btrim(p_dados->>'transportadora'),''), responsavel_nome=btrim(p_dados->>'responsavel_nome'),
      observacao=nullif(btrim(p_dados->>'observacao'),''), updated_by=v_user
    where id=p_saida_id and entrada_id=p_entrada_id and empresa_id=v_empresa returning id into v_id;
  end if;
  perform public.agroflow_auditar(case when p_saida_id is null then 'criar' else 'editar' end,
    'oficina_messejana_saidas', v_id::text, v_old,
    (select to_jsonb(s) from public.oficina_messejana_saidas s where s.id=v_id));
  return v_id;
exception when unique_violation then
  raise exception 'OFICINA_SAIDA_DUPLICADA' using errcode = '23505';
end;
$$;

create or replace function public.oficina_messejana_cancelar_saida(p_saida_id uuid, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=auth.uid(); v_empresa uuid:=public.agroflow_empresa_atual_id(); v_old jsonb; v_entrada uuid;
begin
  if v_user is null or not public.agroflow_tem_permissao('oficina_messejana_saidas','cancelar') then
    raise exception 'OFICINA_ACESSO_NEGADO' using errcode='42501'; end if;
  if btrim(coalesce(p_motivo,''))='' then raise exception 'OFICINA_MOTIVO_OBRIGATORIO' using errcode='23514'; end if;
  select s.entrada_id,to_jsonb(s) into v_entrada,v_old from public.oficina_messejana_saidas s
  where s.id=p_saida_id and s.empresa_id=v_empresa and s.status_registro='CONFIRMADA' for update;
  if v_old is null then raise exception 'OFICINA_REGISTRO_NAO_ENCONTRADO' using errcode='P0002'; end if;
  perform 1 from public.oficina_messejana_entradas e where e.id=v_entrada and e.empresa_id=v_empresa for update;
  update public.oficina_messejana_saidas set status_registro='CANCELADA',motivo_cancelamento=btrim(p_motivo),
    cancelled_by=v_user,cancelled_at=now(),updated_by=v_user where id=p_saida_id and empresa_id=v_empresa;
  perform public.agroflow_auditar('cancelar','oficina_messejana_saidas',p_saida_id::text,v_old,
    (select to_jsonb(s) from public.oficina_messejana_saidas s where s.id=p_saida_id));
end; $$;

create or replace function public.oficina_messejana_cancelar_entrada(p_entrada_id uuid, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=auth.uid(); v_empresa uuid:=public.agroflow_empresa_atual_id(); v_old jsonb;
begin
  if v_user is null or not public.agroflow_tem_permissao('oficina_messejana_entradas','cancelar') then
    raise exception 'OFICINA_ACESSO_NEGADO' using errcode='42501'; end if;
  if btrim(coalesce(p_motivo,''))='' then raise exception 'OFICINA_MOTIVO_OBRIGATORIO' using errcode='23514'; end if;
  select to_jsonb(e) into v_old from public.oficina_messejana_entradas e
  where e.id=p_entrada_id and e.empresa_id=v_empresa and e.status_registro='CONFIRMADA' for update;
  if v_old is null then raise exception 'OFICINA_REGISTRO_NAO_ENCONTRADO' using errcode='P0002'; end if;
  if exists(select 1 from public.oficina_messejana_saidas s where s.entrada_id=p_entrada_id and s.status_registro='CONFIRMADA') then
    raise exception 'OFICINA_ENTRADA_COM_SAIDAS' using errcode='23514'; end if;
  update public.oficina_messejana_entradas set status_registro='CANCELADA',motivo_cancelamento=btrim(p_motivo),
    cancelled_by=v_user,cancelled_at=now(),updated_by=v_user where id=p_entrada_id and empresa_id=v_empresa;
  perform public.agroflow_auditar('cancelar','oficina_messejana_entradas',p_entrada_id::text,v_old,
    (select to_jsonb(e) from public.oficina_messejana_entradas e where e.id=p_entrada_id));
end; $$;

create or replace function public.oficina_messejana_dashboard(p_inicio timestamptz, p_fim timestamptz)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
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
      'entradas_por_fornecedor', 'saidas_por_destino', 'movimentacoes_por_placa',
      'notas_complementares', 'movimentacoes_canceladas', 'movimentacao_mensal'
    ];
  end if;
  return coalesce(v_result,'{}'::jsonb);
end; $$;

create or replace function public.oficina_messejana_exportar(
  p_tipo text, p_inicio timestamptz, p_fim timestamptz, p_offset integer default 0, p_limit integer default 500
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_empresa uuid:=public.agroflow_empresa_atual_id();
  v_offset integer:=greatest(coalesce(p_offset,0),0);
  v_limit integer:=least(greatest(coalesce(p_limit,500),1),500);
  v_rows jsonb;
begin
  if auth.uid() is null or v_empresa is null
    or not public.agroflow_tem_permissao('oficina_messejana','visualizar')
    or not public.agroflow_tem_permissao('oficina_messejana_relatorios','visualizar')
    or not public.agroflow_tem_permissao('oficina_messejana_relatorios','exportar') then
    raise exception 'OFICINA_ACESSO_NEGADO' using errcode='42501';
  end if;
  if p_inicio is null or p_fim is null or p_inicio >= p_fim then
    raise exception 'OFICINA_PERIODO_INVALIDO' using errcode='22023';
  end if;

  if p_tipo = 'entradas' then
    if not public.agroflow_tem_permissao('oficina_messejana_entradas','visualizar') then
      raise exception 'OFICINA_ACESSO_NEGADO' using errcode='42501';
    end if;
    select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into v_rows from (
      select e.* from public.oficina_messejana_entradas_resumo e
      where e.empresa_id=v_empresa and e.data_entrada>=p_inicio and e.data_entrada<p_fim
      order by e.data_entrada desc, e.id
      offset v_offset limit v_limit
    ) q;
  elsif p_tipo = 'saidas' then
    if not public.agroflow_tem_permissao('oficina_messejana_saidas','visualizar') then
      raise exception 'OFICINA_ACESSO_NEGADO' using errcode='42501';
    end if;
    select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into v_rows from (
      select s.* from public.oficina_messejana_saidas_resumo s
      where s.empresa_id=v_empresa and s.data_saida>=p_inicio and s.data_saida<p_fim
      order by s.data_saida desc, s.id
      offset v_offset limit v_limit
    ) q;
  else
    raise exception 'OFICINA_TIPO_EXPORTACAO_INVALIDO' using errcode='22023';
  end if;

  if v_offset = 0 then
    perform public.agroflow_auditar('exportar','oficina_messejana_'||p_tipo,null,null,
      jsonb_build_object('inicio',p_inicio,'fim',p_fim));
  end if;
  return v_rows;
end; $$;

create or replace function public.oficina_messejana_salvar_nota_complementar(
  p_entrada_id uuid, p_nf_numero text, p_nf_serie text, p_chave_acesso text, p_observacao text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=auth.uid(); v_empresa uuid:=public.agroflow_empresa_atual_id(); v_id uuid;
begin
  if v_user is null or not (
    public.agroflow_tem_permissao('oficina_messejana_entradas','cadastrar')
    or public.agroflow_tem_permissao('oficina_messejana_entradas','editar')
  ) then raise exception 'OFICINA_ACESSO_NEGADO' using errcode='42501'; end if;
  perform 1 from public.oficina_messejana_entradas e
  where e.id=p_entrada_id and e.empresa_id=v_empresa and e.status_registro='CONFIRMADA' for update;
  if not found then raise exception 'OFICINA_REGISTRO_NAO_ENCONTRADO' using errcode='P0002'; end if;
  insert into public.oficina_messejana_notas_complementares(
    empresa_id,entrada_id,nf_numero,nf_serie,chave_acesso,observacao,created_by
  ) values (
    v_empresa,p_entrada_id,btrim(p_nf_numero),coalesce(nullif(btrim(p_nf_serie),''),'1'),
    nullif(btrim(p_chave_acesso),''),nullif(btrim(p_observacao),''),v_user
  ) returning id into v_id;
  perform public.agroflow_auditar('criar','oficina_messejana_notas_complementares',v_id::text,null,
    (select to_jsonb(n) from public.oficina_messejana_notas_complementares n where n.id=v_id));
  return v_id;
exception when unique_violation then
  raise exception 'OFICINA_NF_DUPLICADA' using errcode='23505';
end; $$;

revoke all on public.oficina_messejana_depositos, public.oficina_messejana_entradas,
  public.oficina_messejana_saidas, public.oficina_messejana_notas_complementares from anon;
grant select on public.oficina_messejana_depositos, public.oficina_messejana_entradas,
  public.oficina_messejana_saidas, public.oficina_messejana_notas_complementares to authenticated;
grant insert, update on public.oficina_messejana_depositos to authenticated;
grant select on public.oficina_messejana_entradas_resumo, public.oficina_messejana_saidas_resumo to authenticated;

revoke all on function public.oficina_messejana_salvar_entrada(uuid,jsonb) from public, anon;
revoke all on function public.oficina_messejana_salvar_saida(uuid,uuid,uuid,jsonb) from public, anon;
revoke all on function public.oficina_messejana_cancelar_saida(uuid,text) from public, anon;
revoke all on function public.oficina_messejana_cancelar_entrada(uuid,text) from public, anon;
revoke all on function public.oficina_messejana_dashboard(timestamptz,timestamptz) from public, anon;
revoke all on function public.oficina_messejana_exportar(text,timestamptz,timestamptz,integer,integer) from public, anon;
revoke all on function public.oficina_messejana_salvar_nota_complementar(uuid,text,text,text,text) from public, anon;
grant execute on function public.oficina_messejana_salvar_entrada(uuid,jsonb) to authenticated;
grant execute on function public.oficina_messejana_salvar_saida(uuid,uuid,uuid,jsonb) to authenticated;
grant execute on function public.oficina_messejana_cancelar_saida(uuid,text) to authenticated;
grant execute on function public.oficina_messejana_cancelar_entrada(uuid,text) to authenticated;
grant execute on function public.oficina_messejana_dashboard(timestamptz,timestamptz) to authenticated;
grant execute on function public.oficina_messejana_exportar(text,timestamptz,timestamptz,integer,integer) to authenticated;
grant execute on function public.oficina_messejana_salvar_nota_complementar(uuid,text,text,text,text) to authenticated;
