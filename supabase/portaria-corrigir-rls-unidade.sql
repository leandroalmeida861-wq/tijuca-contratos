-- AgroFlow | Portaria: combinar permissao de menu e unidade
--
-- Policies permissivas sao combinadas com OR no PostgreSQL. As policies de
-- unidade precisam ser RESTRICTIVE para que nenhuma operacao seja autorizada
-- apenas pelo acesso a unidade, ignorando a permissao do menu.

begin;

drop policy if exists unidade_portaria_entradas on public.portaria_entradas;
create policy unidade_portaria_entradas
on public.portaria_entradas
as restrictive
for all
to authenticated
using (public.agroflow_acessa_unidade(balanca_id))
with check (public.agroflow_acessa_unidade(balanca_id));

drop policy if exists unidade_recebimentos on public.recebimentos;
create policy unidade_recebimentos
on public.recebimentos
as restrictive
for all
to authenticated
using (public.agroflow_acessa_unidade(balanca_id))
with check (public.agroflow_acessa_unidade(balanca_id));

commit;
