-- AgroFlow | Dashboard das balancas: decisao "Nao complementar"
--
-- Migration incremental e preservadora:
-- - nao altera nem apaga recebimentos existentes;
-- - registra a decisao por recebimento e unidade;
-- - permite a acao somente para Admin e Gestor com edicao na unidade;
-- - mantem novas cargas visiveis ate que recebam uma decisao propria.

begin;

create table if not exists public.recebimento_decisoes_complemento (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default public.agroflow_empresa_atual_id()
    references public.empresas(id) on delete restrict,
  recebimento_id uuid not null
    references public.recebimentos(id) on delete cascade,
  balanca_id uuid not null
    references public.balancas(id) on delete restrict,
  decisao text not null default 'NAO_COMPLEMENTAR'
    check (decisao in ('NAO_COMPLEMENTAR')),
  decidido_por uuid not null default auth.uid()
    references auth.users(id) on delete restrict,
  decidido_em timestamptz not null default now(),
  constraint recebimento_decisoes_complemento_recebimento_key unique (recebimento_id)
);

comment on table public.recebimento_decisoes_complemento is
  'Decisoes auditaveis que retiram recebimentos ja avaliados do grafico de complemento ao fornecedor.';

create index if not exists recebimento_decisoes_complemento_balanca_idx
  on public.recebimento_decisoes_complemento (balanca_id);

create index if not exists recebimento_decisoes_complemento_empresa_idx
  on public.recebimento_decisoes_complemento (empresa_id);

create index if not exists recebimento_decisoes_complemento_decidido_por_idx
  on public.recebimento_decisoes_complemento (decidido_por);

alter table public.recebimento_decisoes_complemento enable row level security;

drop policy if exists recebimento_decisoes_complemento_select
  on public.recebimento_decisoes_complemento;
create policy recebimento_decisoes_complemento_select
on public.recebimento_decisoes_complemento
for select
to authenticated
using (
  empresa_id = public.agroflow_empresa_atual_id()
  and public.agroflow_acessa_unidade(balanca_id)
);

revoke all on table public.recebimento_decisoes_complemento from anon;
revoke insert, update, delete on table public.recebimento_decisoes_complemento from authenticated;
grant select on table public.recebimento_decisoes_complemento to authenticated;

create or replace function public.agroflow_marcar_nao_complementar(
  p_balanca_id uuid,
  p_recebimento_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_perfil text;
  v_empresa_id uuid;
  v_total_solicitado integer := coalesce(cardinality(p_recebimento_ids), 0);
  v_total_encontrado integer;
  v_fornecedores integer;
  v_diferenca_kg numeric;
  v_total_marcado integer;
begin
  if v_user_id is null then
    raise exception 'SESSAO_OBRIGATORIA' using errcode = '42501';
  end if;

  select p.perfil, p.empresa_id
  into v_perfil, v_empresa_id
  from public.profiles p
  where p.user_id = v_user_id
    and p.ativo
  limit 1;

  if coalesce(v_perfil, '') not in ('admin', 'gestor') then
    raise exception 'SOMENTE_ADMIN_GESTOR' using errcode = '42501';
  end if;

  if p_balanca_id is null
    or not public.agroflow_acessa_unidade(p_balanca_id)
    or not public.agroflow_pode_editar_unidade(p_balanca_id) then
    raise exception 'SEM_PERMISSAO_UNIDADE' using errcode = '42501';
  end if;

  if v_total_solicitado < 1 or v_total_solicitado > 500 then
    raise exception 'RECEBIMENTOS_INVALIDOS' using errcode = '22023';
  end if;

  select
    count(*),
    count(distinct coalesce(
      r.fornecedor_id::text,
      'manual:' || lower(regexp_replace(btrim(coalesce(r.fornecedor_nome_manual, '')), '\s+', ' ', 'g'))
    )),
    sum(
      coalesce(r.peso_liquido, 0)
      - coalesce(r.peso_nf, 0)
      - coalesce((
        select sum(coalesce(c.peso_nf, 0))
        from public.recebimento_notas_complementares c
        where c.recebimento_id = r.id
          and coalesce(c.afeta_peso, true)
      ), 0)
    )
  into v_total_encontrado, v_fornecedores, v_diferenca_kg
  from public.recebimentos r
  where r.id = any(p_recebimento_ids)
    and r.balanca_id = p_balanca_id
    and r.empresa_id = v_empresa_id
    and r.status = 'aprovada'
    and r.peso_bruto > 0
    and r.tara > 0
    and r.peso_bruto >= r.tara;

  if v_total_encontrado <> v_total_solicitado then
    raise exception 'RECEBIMENTO_FORA_DA_UNIDADE' using errcode = '42501';
  end if;

  if v_fornecedores <> 1 then
    raise exception 'FORNECEDOR_DIVERGENTE' using errcode = '22023';
  end if;

  if coalesce(v_diferenca_kg, 0) <= 0 then
    raise exception 'DIFERENCA_NAO_POSITIVA' using errcode = '22023';
  end if;

  insert into public.recebimento_decisoes_complemento (
    empresa_id,
    recebimento_id,
    balanca_id,
    decisao,
    decidido_por,
    decidido_em
  )
  select
    r.empresa_id,
    r.id,
    r.balanca_id,
    'NAO_COMPLEMENTAR',
    v_user_id,
    now()
  from public.recebimentos r
  where r.id = any(p_recebimento_ids)
    and r.balanca_id = p_balanca_id
    and r.empresa_id = v_empresa_id
  on conflict (recebimento_id) do update
  set
    decisao = excluded.decisao,
    decidido_por = excluded.decidido_por,
    decidido_em = excluded.decidido_em;

  get diagnostics v_total_marcado = row_count;

  insert into public.audit_logs (
    user_id,
    perfil,
    acao,
    tabela,
    registro_id,
    dados_novos,
    balanca_id
  )
  values (
    v_user_id,
    v_perfil,
    'nao_complementar_fornecedor',
    'recebimento_decisoes_complemento',
    p_balanca_id::text,
    jsonb_build_object(
      'recebimento_ids', to_jsonb(p_recebimento_ids),
      'quantidade', v_total_marcado,
      'diferenca_kg', v_diferenca_kg
    ),
    p_balanca_id
  );

  return v_total_marcado;
end;
$$;

comment on function public.agroflow_marcar_nao_complementar(uuid, uuid[]) is
  'Marca, de forma transacional, recebimentos de um fornecedor que nao terao nota complementar. Restrito a Admin/Gestor e a unidade autorizada.';

revoke all on function public.agroflow_marcar_nao_complementar(uuid, uuid[]) from public, anon;
grant execute on function public.agroflow_marcar_nao_complementar(uuid, uuid[]) to authenticated;

commit;
