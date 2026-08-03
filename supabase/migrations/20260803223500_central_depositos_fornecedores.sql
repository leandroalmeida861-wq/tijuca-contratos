-- AgroFlow | Central de Graos Messejana
-- Vincula depositos a fornecedores existentes e protege a exclusao.

alter table public.oficina_messejana_depositos
  add column if not exists fornecedor_id uuid
  references public.fornecedores(id) on delete restrict;

create index if not exists oficina_messejana_depositos_fornecedor_idx
  on public.oficina_messejana_depositos (empresa_id, fornecedor_id)
  where fornecedor_id is not null;

update public.permissoes_menu
set excluir = true
where perfil = 'admin'
  and menu = 'oficina_messejana_depositos';

drop policy if exists oficina_messejana_depositos_select on public.oficina_messejana_depositos;
create policy oficina_messejana_depositos_select on public.oficina_messejana_depositos
for select to authenticated
using (
  auth.uid() is not null
  and public.agroflow_mesma_empresa(empresa_id)
  and (
    public.agroflow_tem_permissao('oficina_messejana', 'visualizar')
    or public.agroflow_tem_permissao('oficina_messejana_entradas', 'visualizar')
    or public.agroflow_tem_permissao('oficina_messejana_saidas', 'visualizar')
    or public.agroflow_tem_permissao('oficina_messejana_depositos', 'visualizar')
  )
);

create or replace function public.oficina_messejana_salvar_deposito(
  p_deposito_id uuid,
  p_fornecedor_id uuid,
  p_nome text,
  p_ativo boolean default true
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_empresa uuid := public.agroflow_empresa_atual_id();
  v_id uuid;
  v_nome text := nullif(btrim(coalesce(p_nome, '')), '');
  v_fornecedor_nome text;
begin
  if v_user is null or v_empresa is null then
    raise exception 'OFICINA_ACESSO_NEGADO' using errcode = '42501';
  end if;

  if p_deposito_id is null then
    if not public.agroflow_tem_permissao('oficina_messejana_depositos', 'cadastrar') then
      raise exception 'OFICINA_ACESSO_NEGADO' using errcode = '42501';
    end if;
  elsif not public.agroflow_tem_permissao('oficina_messejana_depositos', 'editar') then
    raise exception 'OFICINA_ACESSO_NEGADO' using errcode = '42501';
  end if;

  if p_fornecedor_id is not null then
    select f.nome
      into v_fornecedor_nome
    from public.fornecedores f
    where f.id = p_fornecedor_id
      and f.empresa_id = v_empresa;

    if not found then
      raise exception 'OFICINA_FORNECEDOR_INVALIDO' using errcode = 'P0002';
    end if;

    v_nome := coalesce(v_nome, nullif(btrim(v_fornecedor_nome), ''));
  end if;

  if v_nome is null then
    raise exception 'OFICINA_DEPOSITO_NOME_OBRIGATORIO' using errcode = '22023';
  end if;

  if p_deposito_id is null then
    insert into public.oficina_messejana_depositos (
      empresa_id, fornecedor_id, nome, ativo, created_by
    ) values (
      v_empresa, p_fornecedor_id, v_nome, coalesce(p_ativo, true), v_user
    ) returning id into v_id;
  else
    update public.oficina_messejana_depositos d
       set fornecedor_id = p_fornecedor_id,
           nome = v_nome,
           ativo = coalesce(p_ativo, true),
           updated_by = v_user
     where d.id = p_deposito_id
       and d.empresa_id = v_empresa
    returning d.id into v_id;

    if v_id is null then
      raise exception 'OFICINA_REGISTRO_NAO_ENCONTRADO' using errcode = 'P0002';
    end if;
  end if;

  return v_id;
exception
  when unique_violation then
    raise exception 'OFICINA_DEPOSITO_DUPLICADO' using errcode = '23505';
end;
$$;

create or replace function public.oficina_messejana_excluir_deposito(
  p_deposito_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_empresa uuid := public.agroflow_empresa_atual_id();
begin
  if v_user is null or v_empresa is null
     or not public.agroflow_tem_permissao('oficina_messejana_depositos', 'excluir') then
    raise exception 'OFICINA_ACESSO_NEGADO' using errcode = '42501';
  end if;

  perform 1
  from public.oficina_messejana_depositos d
  where d.id = p_deposito_id
    and d.empresa_id = v_empresa
  for update;

  if not found then
    raise exception 'OFICINA_REGISTRO_NAO_ENCONTRADO' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.oficina_messejana_entradas e
    where e.empresa_id = v_empresa
      and e.deposito_id = p_deposito_id
  ) then
    raise exception 'OFICINA_DEPOSITO_EM_USO' using errcode = '23503';
  end if;

  delete from public.oficina_messejana_depositos d
  where d.id = p_deposito_id
    and d.empresa_id = v_empresa;
end;
$$;

drop trigger if exists oficina_messejana_depositos_audit on public.oficina_messejana_depositos;
create trigger oficina_messejana_depositos_audit
after insert or update or delete on public.oficina_messejana_depositos
for each row execute function public.agroflow_audit_trigger();

revoke all on function public.oficina_messejana_salvar_deposito(uuid,uuid,text,boolean)
  from public, anon;
revoke all on function public.oficina_messejana_excluir_deposito(uuid)
  from public, anon;
grant execute on function public.oficina_messejana_salvar_deposito(uuid,uuid,text,boolean)
  to authenticated;
grant execute on function public.oficina_messejana_excluir_deposito(uuid)
  to authenticated;
