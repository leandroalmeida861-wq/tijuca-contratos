-- AgroFlow - notas complementares na Armazenagem M.P.
-- Migracao incremental: nao remove nem altera registros existentes.

alter table public.armazenagem_itens
add column if not exists recebimento_complemento_id uuid
  references public.recebimento_notas_complementares(id) on delete set null,
add column if not exists nf_numero_origem text;

create unique index if not exists armazenagem_itens_complemento_unico
  on public.armazenagem_itens(recebimento_complemento_id)
  where recebimento_complemento_id is not null;

create or replace function private.armazenagem_sincronizar_complementos(
  p_armazenagem_id uuid,
  p_recebimento_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_armazenagem public.armazenagens_materia_prima%rowtype;
  v_complemento record;
  v_item public.armazenagem_itens%rowtype;
  v_produto_id uuid;
  v_peso numeric(18, 3);
  v_ordem integer;
  v_total numeric(18, 3);
  v_distribuido numeric(18, 3);
  v_origem text;
begin
  select * into v_armazenagem
  from public.armazenagens_materia_prima a
  where a.id = p_armazenagem_id
    and a.recebimento_id = p_recebimento_id
  for update;

  if v_armazenagem.id is null then
    raise exception 'ARMAZENAGEM_RECEBIMENTO_DIVERGENTE';
  end if;

  select coalesce(
    r.produto_id,
    (
      select ri.produto_id
      from public.recebimento_itens ri
      where ri.recebimento_id = r.id
        and ri.produto_id is not null
      order by ri.ordem, ri.created_at, ri.id
      limit 1
    )
  ) into v_produto_id
  from public.recebimentos r
  where r.id = p_recebimento_id;

  for v_complemento in
    select c.*
    from public.recebimento_notas_complementares c
    where c.recebimento_id = p_recebimento_id
    order by c.criado_em, c.id
  loop
    v_peso := case
      when coalesce(v_complemento.quantidade_nota, 0) > 0 then
        private.armazenagem_peso_nota_kg(
          v_complemento.quantidade_nota,
          v_complemento.unidade_nota,
          v_complemento.peso_por_saca
        )
      else round(coalesce(v_complemento.peso_nf, 0)::numeric, 3)
    end;

    if coalesce(v_peso, 0) <= 0 then
      continue;
    end if;

    select * into v_item
    from public.armazenagem_itens i
    where i.recebimento_complemento_id = v_complemento.id
    for update;

    v_origem := case
      when nullif(btrim(coalesce(v_complemento.chave_nfe, '')), '') is not null then 'XML'
      else 'NOTA'
    end;

    if v_item.id is null then
      select coalesce(max(i.ordem), 0) + 1
      into v_ordem
      from public.armazenagem_itens i
      where i.armazenagem_id = v_armazenagem.id;

      insert into public.armazenagem_itens (
        empresa_id,
        armazenagem_id,
        recebimento_complemento_id,
        produto_id,
        ordem,
        nf_numero_origem,
        peso_nota,
        origem_peso,
        peso_distribuido,
        saldo_distribuir,
        status
      ) values (
        v_armazenagem.empresa_id,
        v_armazenagem.id,
        v_complemento.id,
        v_produto_id,
        v_ordem,
        v_complemento.numero_nf,
        v_peso,
        v_origem,
        0,
        v_peso,
        'PENDENTE'
      );
    else
      if v_item.armazenagem_id <> v_armazenagem.id then
        raise exception 'COMPLEMENTO_VINCULADO_OUTRA_ARMAZENAGEM';
      end if;
      if v_peso < v_item.peso_distribuido then
        raise exception 'PESO_COMPLEMENTO_INFERIOR_DISTRIBUIDO';
      end if;

      update public.armazenagem_itens
      set produto_id = coalesce(produto_id, v_produto_id),
          nf_numero_origem = v_complemento.numero_nf,
          peso_nota = v_peso,
          origem_peso = v_origem,
          saldo_distribuir = greatest(v_peso - peso_distribuido, 0),
          status = case
            when status = 'CANCELADO' then 'CANCELADO'
            when peso_distribuido = 0 then 'PENDENTE'
            when peso_distribuido < v_peso then 'PARCIALMENTE_ARMAZENADO'
            else 'ARMAZENADO'
          end,
          updated_at = now()
      where id = v_item.id;
    end if;
  end loop;

  select
    coalesce(sum(i.peso_nota), 0)::numeric(18, 3),
    coalesce(sum(i.peso_distribuido), 0)::numeric(18, 3),
    case
      when bool_or(i.origem_peso = 'XML') then 'XML'
      when bool_or(i.origem_peso = 'NOTA') then 'NOTA'
      else 'RECEBIMENTO'
    end
  into v_total, v_distribuido, v_origem
  from public.armazenagem_itens i
  where i.armazenagem_id = v_armazenagem.id
    and i.status <> 'CANCELADO';

  if coalesce(v_total, 0) <= 0 then
    raise exception 'PESO_NOTA_NAO_INFORMADO';
  end if;

  update public.armazenagens_materia_prima
  set peso_nota = v_total,
      peso_distribuido = v_distribuido,
      saldo_distribuir = greatest(v_total - v_distribuido, 0),
      origem_peso = coalesce(v_origem, origem_peso),
      status = case
        when status = 'CANCELADO' then 'CANCELADO'
        when v_distribuido = 0 then 'PENDENTE'
        when v_distribuido < v_total then 'PARCIALMENTE_ARMAZENADO'
        else 'ARMAZENADO'
      end,
      updated_at = now()
  where id = v_armazenagem.id;
end;
$$;

create or replace function private.armazenagem_complemento_sync_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_armazenagem_id uuid;
begin
  select a.id into v_armazenagem_id
  from public.armazenagens_materia_prima a
  where a.recebimento_id = new.recebimento_id;

  if v_armazenagem_id is not null then
    perform private.armazenagem_sincronizar_complementos(v_armazenagem_id, new.recebimento_id);
  end if;

  return new;
end;
$$;

drop trigger if exists recebimento_complemento_sincronizar_armazenagem
  on public.recebimento_notas_complementares;
create trigger recebimento_complemento_sincronizar_armazenagem
after insert or update of numero_nf, chave_nfe, quantidade_nota, unidade_nota, peso_por_saca, peso_nf
on public.recebimento_notas_complementares
for each row execute function private.armazenagem_complemento_sync_trigger();

do $$
declare
  v_registro record;
begin
  for v_registro in
    select a.id, a.recebimento_id
    from public.armazenagens_materia_prima a
    where exists (
      select 1
      from public.recebimento_notas_complementares c
      where c.recebimento_id = a.recebimento_id
    )
  loop
    perform private.armazenagem_sincronizar_complementos(v_registro.id, v_registro.recebimento_id);
  end loop;
end;
$$;

revoke all on function private.armazenagem_sincronizar_complementos(uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.armazenagem_complemento_sync_trigger()
  from public, anon, authenticated;

