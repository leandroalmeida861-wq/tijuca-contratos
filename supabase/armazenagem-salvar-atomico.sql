-- Correção incremental: o primeiro registro de armazenagem somente é criado
-- quando o usuário confirma o salvamento. Se qualquer etapa falhar, toda a
-- operação é revertida pela mesma transação do PostgreSQL.

create or replace function public.agroflow_armazenagem_salvar_recebimento(
  p_recebimento_id uuid,
  p_data_armazenagem date,
  p_observacao text,
  p_distribuicoes jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_armazenagem_id uuid;
  v_distribuicoes_mapeadas jsonb;
  v_quantidade_informada integer;
  v_quantidade_mapeada integer;
begin
  if auth.uid() is null then
    raise exception 'USUARIO_NAO_AUTENTICADO';
  end if;

  if not (
    public.agroflow_tem_permissao('balancas_armazenagem', 'cadastrar')
    or public.agroflow_tem_permissao('balancas_armazenagem', 'editar')
  ) then
    raise exception 'SEM_PERMISSAO_ARMAZENAGEM';
  end if;

  if jsonb_typeof(coalesce(p_distribuicoes, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_distribuicoes, '[]'::jsonb)) = 0 then
    raise exception 'DISTRIBUICAO_OBRIGATORIA';
  end if;

  v_armazenagem_id := public.agroflow_armazenagem_iniciar(p_recebimento_id);
  v_quantidade_informada := jsonb_array_length(p_distribuicoes);

  select jsonb_agg(
    jsonb_build_object(
      'armazenagem_item_id', i.id,
      'silo', d.value->>'silo',
      'baia', d.value->>'baia',
      'peso_armazenado', d.value->>'peso_armazenado',
      'observacao', d.value->>'observacao'
    ) order by d.ordem_json
  ), count(*)::integer
  into v_distribuicoes_mapeadas, v_quantidade_mapeada
  from jsonb_array_elements(p_distribuicoes) with ordinality as d(value, ordem_json)
  join public.armazenagem_itens i
    on i.armazenagem_id = v_armazenagem_id
   and i.ordem = nullif(d.value->>'item_ordem', '')::integer;

  if coalesce(v_quantidade_mapeada, 0) <> v_quantidade_informada then
    raise exception 'ITEM_ARMAZENAGEM_INVALIDO';
  end if;

  return public.agroflow_armazenagem_salvar(
    v_armazenagem_id,
    p_data_armazenagem,
    p_observacao,
    v_distribuicoes_mapeadas
  );
end;
$$;

revoke all on function public.agroflow_armazenagem_salvar_recebimento(uuid, date, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.agroflow_armazenagem_salvar_recebimento(uuid, date, text, jsonb)
  to authenticated;

