-- AgroFlow | Portaria: permitir cadastro de veiculos e motoristas
--
-- Migration incremental e preservadora:
-- - nao altera registros existentes;
-- - nao amplia acesso a outros cadastros;
-- - respeita cada acao concedida em balancas ou balancas_portaria;
-- - mantem RLS ativa e o acesso exclusivo de usuarios autenticados.

begin;

drop policy if exists balancas_select_recebimento_veiculos
  on public.recebimento_veiculos;
create policy balancas_select_recebimento_veiculos
on public.recebimento_veiculos
for select
to authenticated
using (
  public.agroflow_tem_permissao('balancas', 'visualizar')
  or public.agroflow_tem_permissao('balancas_portaria', 'visualizar')
);

drop policy if exists balancas_insert_recebimento_veiculos
  on public.recebimento_veiculos;
create policy balancas_insert_recebimento_veiculos
on public.recebimento_veiculos
for insert
to authenticated
with check (
  public.agroflow_tem_permissao('balancas', 'cadastrar')
  or public.agroflow_tem_permissao('balancas_portaria', 'cadastrar')
);

drop policy if exists balancas_update_recebimento_veiculos
  on public.recebimento_veiculos;
create policy balancas_update_recebimento_veiculos
on public.recebimento_veiculos
for update
to authenticated
using (
  public.agroflow_tem_permissao('balancas', 'editar')
  or public.agroflow_tem_permissao('balancas', 'aprovar')
  or public.agroflow_tem_permissao('balancas', 'cancelar')
  or public.agroflow_tem_permissao('balancas_portaria', 'editar')
  or public.agroflow_tem_permissao('balancas_portaria', 'aprovar')
  or public.agroflow_tem_permissao('balancas_portaria', 'cancelar')
)
with check (
  public.agroflow_tem_permissao('balancas', 'editar')
  or public.agroflow_tem_permissao('balancas', 'aprovar')
  or public.agroflow_tem_permissao('balancas', 'cancelar')
  or public.agroflow_tem_permissao('balancas_portaria', 'editar')
  or public.agroflow_tem_permissao('balancas_portaria', 'aprovar')
  or public.agroflow_tem_permissao('balancas_portaria', 'cancelar')
);

drop policy if exists balancas_delete_recebimento_veiculos
  on public.recebimento_veiculos;
create policy balancas_delete_recebimento_veiculos
on public.recebimento_veiculos
for delete
to authenticated
using (
  public.agroflow_tem_permissao('balancas', 'excluir')
  or public.agroflow_tem_permissao('balancas_portaria', 'excluir')
);

drop policy if exists balancas_select_recebimento_motoristas
  on public.recebimento_motoristas;
create policy balancas_select_recebimento_motoristas
on public.recebimento_motoristas
for select
to authenticated
using (
  public.agroflow_tem_permissao('balancas', 'visualizar')
  or public.agroflow_tem_permissao('balancas_portaria', 'visualizar')
);

drop policy if exists balancas_insert_recebimento_motoristas
  on public.recebimento_motoristas;
create policy balancas_insert_recebimento_motoristas
on public.recebimento_motoristas
for insert
to authenticated
with check (
  public.agroflow_tem_permissao('balancas', 'cadastrar')
  or public.agroflow_tem_permissao('balancas_portaria', 'cadastrar')
);

drop policy if exists balancas_update_recebimento_motoristas
  on public.recebimento_motoristas;
create policy balancas_update_recebimento_motoristas
on public.recebimento_motoristas
for update
to authenticated
using (
  public.agroflow_tem_permissao('balancas', 'editar')
  or public.agroflow_tem_permissao('balancas', 'aprovar')
  or public.agroflow_tem_permissao('balancas', 'cancelar')
  or public.agroflow_tem_permissao('balancas_portaria', 'editar')
  or public.agroflow_tem_permissao('balancas_portaria', 'aprovar')
  or public.agroflow_tem_permissao('balancas_portaria', 'cancelar')
)
with check (
  public.agroflow_tem_permissao('balancas', 'editar')
  or public.agroflow_tem_permissao('balancas', 'aprovar')
  or public.agroflow_tem_permissao('balancas', 'cancelar')
  or public.agroflow_tem_permissao('balancas_portaria', 'editar')
  or public.agroflow_tem_permissao('balancas_portaria', 'aprovar')
  or public.agroflow_tem_permissao('balancas_portaria', 'cancelar')
);

drop policy if exists balancas_delete_recebimento_motoristas
  on public.recebimento_motoristas;
create policy balancas_delete_recebimento_motoristas
on public.recebimento_motoristas
for delete
to authenticated
using (
  public.agroflow_tem_permissao('balancas', 'excluir')
  or public.agroflow_tem_permissao('balancas_portaria', 'excluir')
);

grant select, insert, update, delete
  on public.recebimento_veiculos, public.recebimento_motoristas
  to authenticated;

commit;
