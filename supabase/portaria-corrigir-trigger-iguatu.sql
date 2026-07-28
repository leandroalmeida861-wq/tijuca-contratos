-- AgroFlow | Portaria: corrigir trigger da unidade Iguatu
--
-- O mesmo trigger atende portaria_entradas e recebimentos. A Portaria nao
-- possui laboratorio_id, portanto a leitura direta de NEW.laboratorio_id
-- falhava antes de salvar. A regra existente permanece: Iguatu segue sem
-- laboratorio e fica disponivel diretamente em Recebimentos.

begin;

create or replace function public.agroflow_forcar_fluxo_sem_laboratorio()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.balanca_id is null then
    return new;
  end if;

  if public.agroflow_unidade_codigo(new.balanca_id) <> 'iguatu' then
    return new;
  end if;

  new.dispensa_laboratorio := true;

  if tg_table_name = 'recebimentos'
     and nullif(to_jsonb(new)->>'laboratorio_id', '') is not null then
    raise exception 'O Armazem Iguatu nao possui laboratorio. Remova o vinculo de laboratorio deste recebimento.';
  end if;

  return new;
end;
$$;

revoke all on function public.agroflow_forcar_fluxo_sem_laboratorio()
  from public, anon, authenticated;

commit;
