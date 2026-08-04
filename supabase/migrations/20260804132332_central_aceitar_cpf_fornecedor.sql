-- AgroFlow | Central de Graos Messejana
-- Fornecedores pessoa fisica usam CPF (11 digitos) no mesmo campo de documento.

do $migration$
declare
  v_definition text;
  v_old_check constant text := 'if not found or length(public.agroflow_apenas_digitos(v_fornecedor_cnpj)) <> 14 then';
  v_new_check constant text := 'if not found or length(public.agroflow_apenas_digitos(v_fornecedor_cnpj)) not in (11, 14) then';
begin
  select pg_catalog.pg_get_functiondef(
    'public.oficina_messejana_salvar_entrada(uuid,jsonb)'::regprocedure
  ) into v_definition;

  if pg_catalog.strpos(v_definition, v_new_check) > 0 then
    return;
  end if;
  if pg_catalog.strpos(v_definition, v_old_check) = 0 then
    raise exception 'OFICINA_VALIDACAO_DOCUMENTO_NAO_ENCONTRADA';
  end if;

  execute pg_catalog.replace(v_definition, v_old_check, v_new_check);
end;
$migration$;

alter table public.oficina_messejana_entradas
  drop constraint oficina_messejana_entradas_fornecedor_cnpj_check;

alter table public.oficina_messejana_entradas
  add constraint oficina_messejana_entradas_fornecedor_cnpj_check
  check (
    length(public.agroflow_apenas_digitos(fornecedor_cnpj)) in (11, 14)
  );

revoke all on function public.oficina_messejana_salvar_entrada(uuid,jsonb) from public, anon;
grant execute on function public.oficina_messejana_salvar_entrada(uuid,jsonb) to authenticated;
