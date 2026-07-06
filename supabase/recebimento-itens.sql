-- AgroFlow - Recebimentos com multiplos produtos
-- SQL incremental: cria itens da nota, totais e migra dados antigos sem apagar registros.

begin;

alter table public.recebimentos
add column if not exists subtotal numeric(18, 2) not null default 0,
add column if not exists desconto_total numeric(18, 2) not null default 0;

create table if not exists public.recebimento_itens (
  id uuid primary key default gen_random_uuid(),
  recebimento_id uuid not null references public.recebimentos(id) on delete cascade,
  produto_id uuid references public.produtos(id) on delete restrict,
  quantidade numeric(18, 3) not null default 0,
  unidade text not null default 'KG',
  valor_unitario numeric(18, 10) not null default 0,
  desconto numeric(18, 2) not null default 0,
  valor_total numeric(18, 2) not null default 0,
  ordem integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recebimento_itens_quantidade_check check (quantidade >= 0),
  constraint recebimento_itens_valor_unitario_check check (valor_unitario >= 0),
  constraint recebimento_itens_desconto_check check (desconto >= 0),
  constraint recebimento_itens_valor_total_check check (valor_total >= 0),
  constraint recebimento_itens_desconto_subtotal_check check (desconto <= round((quantidade * valor_unitario)::numeric, 2))
);

create index if not exists recebimento_itens_recebimento_idx on public.recebimento_itens(recebimento_id);
create index if not exists recebimento_itens_produto_idx on public.recebimento_itens(produto_id);
create unique index if not exists recebimento_itens_ordem_unica on public.recebimento_itens(recebimento_id, ordem);

drop trigger if exists recebimento_itens_updated_at on public.recebimento_itens;
create trigger recebimento_itens_updated_at
before update on public.recebimento_itens
for each row execute function public.recebimento_set_updated_at();

insert into public.recebimento_itens (
  recebimento_id,
  produto_id,
  quantidade,
  unidade,
  valor_unitario,
  desconto,
  valor_total,
  ordem,
  created_at,
  updated_at
)
select
  r.id,
  r.produto_id,
  greatest(coalesce(r.quantidade_nota, r.peso_nf, 0), 0),
  coalesce(nullif(r.unidade_nota, ''), 'KG'),
  greatest(coalesce(r.valor_unitario, 0), 0),
  0,
  greatest(coalesce(r.valor_total, round((coalesce(r.quantidade_nota, r.peso_nf, 0) * coalesce(r.valor_unitario, 0))::numeric, 2), 0), 0),
  1,
  coalesce(r.created_at, now()),
  coalesce(r.updated_at, now())
from public.recebimentos r
where r.produto_id is not null
  and not exists (
    select 1
    from public.recebimento_itens ri
    where ri.recebimento_id = r.id
  );

update public.recebimentos r
set
  subtotal = coalesce(t.subtotal, 0),
  desconto_total = coalesce(t.desconto_total, 0),
  valor_total = coalesce(t.valor_total, r.valor_total, 0)
from (
  select
    recebimento_id,
    round(sum(quantidade * valor_unitario)::numeric, 2) as subtotal,
    round(sum(desconto)::numeric, 2) as desconto_total,
    round(sum(valor_total)::numeric, 2) as valor_total
  from public.recebimento_itens
  group by recebimento_id
) t
where r.id = t.recebimento_id;

alter table public.recebimento_itens enable row level security;

drop policy if exists recebimento_itens_select on public.recebimento_itens;
create policy recebimento_itens_select
on public.recebimento_itens
for select to authenticated
using (public.agroflow_tem_permissao('balancas', 'visualizar'));

drop policy if exists recebimento_itens_insert on public.recebimento_itens;
create policy recebimento_itens_insert
on public.recebimento_itens
for insert to authenticated
with check (public.agroflow_tem_permissao('balancas', 'cadastrar') or public.agroflow_tem_permissao('balancas', 'editar'));

drop policy if exists recebimento_itens_update on public.recebimento_itens;
create policy recebimento_itens_update
on public.recebimento_itens
for update to authenticated
using (public.agroflow_tem_permissao('balancas', 'editar'))
with check (public.agroflow_tem_permissao('balancas', 'editar'));

drop policy if exists recebimento_itens_delete on public.recebimento_itens;
create policy recebimento_itens_delete
on public.recebimento_itens
for delete to authenticated
using (public.agroflow_tem_permissao('balancas', 'editar') or public.agroflow_tem_permissao('balancas', 'excluir'));

grant select, insert, update, delete on public.recebimento_itens to authenticated;

commit;
