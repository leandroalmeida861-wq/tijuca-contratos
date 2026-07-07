-- AgroFlow - Operadores especificos do modulo Balancas
-- SQL incremental: nao apaga dados, nao remove usuarios e nao altera senhas.
-- Execute no Supabase SQL Editor do projeto AgroFlow.

begin;

-- 1) Permitir novos perfis nas tabelas de acesso.
alter table public.profiles drop constraint if exists profiles_perfil_check;
alter table public.profiles
  add constraint profiles_perfil_check
  check (perfil in (
    'admin',
    'gestor',
    'operador',
    'visualizador',
    'operador_laboratorio',
    'operador_balanca',
    'operador_portaria'
  ));

alter table public.usuarios_autorizados drop constraint if exists usuarios_autorizados_perfil_check;
alter table public.usuarios_autorizados
  add constraint usuarios_autorizados_perfil_check
  check (perfil in (
    'admin',
    'gestor',
    'operador',
    'visualizador',
    'operador_laboratorio',
    'operador_balanca',
    'operador_portaria'
  ));

alter table public.permissoes_menu drop constraint if exists permissoes_menu_perfil_check;
alter table public.permissoes_menu
  add constraint permissoes_menu_perfil_check
  check (perfil in (
    'admin',
    'gestor',
    'operador',
    'visualizador',
    'operador_laboratorio',
    'operador_balanca',
    'operador_portaria'
  ));

-- 2) Garantir que os menus internos do modulo existam para todos os perfis editaveis.
insert into public.permissoes_menu (
  perfil, menu, visualizar, cadastrar, editar, excluir, cancelar, aprovar, exportar
)
select perfil, menu, false, false, false, false, false, false, false
from unnest(array[
  'gestor',
  'operador',
  'visualizador',
  'operador_laboratorio',
  'operador_balanca',
  'operador_portaria'
]) as p(perfil)
cross join unnest(array[
  'dashboard',
  'fornecedores',
  'fabricas',
  'produtos',
  'contratos',
  'notas_fiscais',
  'fretes',
  'documentos',
  'financeiro',
  'backup',
  'balancas',
  'balancas_portaria',
  'balancas_laboratorio',
  'balancas_recebimentos',
  'balancas_relatorios'
]) as m(menu)
on conflict (perfil, menu) do nothing;

-- 2.1) Gestor e Operador existentes herdam nas subabas a permissao atual do menu Balancas.
-- Isso evita perda de acesso apos aplicar este SQL em producao.
update public.permissoes_menu sub
set visualizar = base.visualizar,
    cadastrar = base.cadastrar,
    editar = base.editar,
    excluir = base.excluir,
    cancelar = base.cancelar,
    aprovar = base.aprovar,
    exportar = base.exportar,
    atualizado_em = now()
from public.permissoes_menu base
where sub.perfil = base.perfil
  and base.menu = 'balancas'
  and sub.perfil in ('gestor', 'operador')
  and sub.menu in (
    'balancas_portaria',
    'balancas_laboratorio',
    'balancas_recebimentos',
    'balancas_relatorios'
  );

-- 3) Admin sempre tem acesso total, inclusive aos submenus.
insert into public.permissoes_menu (
  perfil, menu, visualizar, cadastrar, editar, excluir, cancelar, aprovar, exportar
)
select 'admin', menu, true, true, true, true, true, true, true
from unnest(array[
  'dashboard',
  'fornecedores',
  'fabricas',
  'produtos',
  'contratos',
  'notas_fiscais',
  'fretes',
  'documentos',
  'financeiro',
  'backup',
  'balancas',
  'balancas_portaria',
  'balancas_laboratorio',
  'balancas_recebimentos',
  'balancas_relatorios',
  'usuarios',
  'auditoria'
]) as m(menu)
on conflict (perfil, menu) do update set
  visualizar = excluded.visualizar,
  cadastrar = excluded.cadastrar,
  editar = excluded.editar,
  excluir = excluded.excluir,
  cancelar = excluded.cancelar,
  aprovar = excluded.aprovar,
  exportar = excluded.exportar,
  atualizado_em = now();

-- 4) Permissoes padrao dos novos operadores.
-- Mantem o menu principal Balancas visivel para permitir acessar a rota /balancas.
update public.permissoes_menu
set visualizar = true, atualizado_em = now()
where perfil in ('operador_laboratorio', 'operador_balanca', 'operador_portaria')
  and menu = 'balancas';

-- Operador Portaria: trabalha na Portaria e envia cargas para o laboratorio.
update public.permissoes_menu
set visualizar = true,
    cadastrar = true,
    editar = true,
    excluir = false,
    cancelar = false,
    aprovar = true,
    exportar = false,
    atualizado_em = now()
where perfil = 'operador_portaria'
  and menu = 'balancas_portaria';

-- Operador Laboratorio: registra, aprova, reprova e cancela analises.
update public.permissoes_menu
set visualizar = true,
    cadastrar = true,
    editar = true,
    excluir = false,
    cancelar = true,
    aprovar = true,
    exportar = false,
    atualizado_em = now()
where perfil = 'operador_laboratorio'
  and menu = 'balancas_laboratorio';

-- Operador Balanca: finaliza recebimentos e ajusta dados de pesagem.
update public.permissoes_menu
set visualizar = true,
    cadastrar = true,
    editar = true,
    excluir = false,
    cancelar = false,
    aprovar = false,
    exportar = false,
    atualizado_em = now()
where perfil = 'operador_balanca'
  and menu = 'balancas_recebimentos';

-- Visualizador: apenas consulta. O Admin pode liberar exportacao se quiser.
update public.permissoes_menu
set visualizar = true,
    cadastrar = false,
    editar = false,
    excluir = false,
    cancelar = false,
    aprovar = false,
    exportar = false,
    atualizado_em = now()
where perfil = 'visualizador'
  and menu in ('dashboard', 'balancas');

-- 5) RLS do modulo Balancas reconhecendo submenus.
-- A rota principal continua protegida por "balancas", e as tabelas aceitam
-- permissoes internas para evitar liberar tudo a um operador especifico.

drop policy if exists portaria_entradas_select on public.portaria_entradas;
create policy portaria_entradas_select
on public.portaria_entradas
for select to authenticated
using (
  public.agroflow_tem_permissao('balancas', 'visualizar')
  or public.agroflow_tem_permissao('balancas_portaria', 'visualizar')
);

drop policy if exists portaria_entradas_insert on public.portaria_entradas;
create policy portaria_entradas_insert
on public.portaria_entradas
for insert to authenticated
with check (
  public.agroflow_tem_permissao('balancas', 'cadastrar')
  or public.agroflow_tem_permissao('balancas_portaria', 'cadastrar')
);

drop policy if exists portaria_entradas_update on public.portaria_entradas;
create policy portaria_entradas_update
on public.portaria_entradas
for update to authenticated
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

drop policy if exists portaria_entradas_delete on public.portaria_entradas;
create policy portaria_entradas_delete
on public.portaria_entradas
for delete to authenticated
using (
  public.agroflow_tem_permissao('balancas', 'excluir')
  or public.agroflow_tem_permissao('balancas_portaria', 'excluir')
);

-- Recebimentos: Laboratorio e Balanca usam a mesma tabela.
drop policy if exists balancas_select_recebimentos on public.recebimentos;
create policy balancas_select_recebimentos
on public.recebimentos
for select to authenticated
using (
  public.agroflow_tem_permissao('balancas', 'visualizar')
  or public.agroflow_tem_permissao('balancas_laboratorio', 'visualizar')
  or public.agroflow_tem_permissao('balancas_recebimentos', 'visualizar')
  or public.agroflow_tem_permissao('balancas_relatorios', 'visualizar')
  or public.agroflow_tem_permissao('balancas_portaria', 'visualizar')
);

drop policy if exists balancas_insert_recebimentos on public.recebimentos;
create policy balancas_insert_recebimentos
on public.recebimentos
for insert to authenticated
with check (
  public.agroflow_tem_permissao('balancas', 'cadastrar')
  or public.agroflow_tem_permissao('balancas_laboratorio', 'cadastrar')
  or public.agroflow_tem_permissao('balancas_recebimentos', 'cadastrar')
  or public.agroflow_tem_permissao('balancas_portaria', 'cadastrar')
);

drop policy if exists balancas_update_recebimentos on public.recebimentos;
create policy balancas_update_recebimentos
on public.recebimentos
for update to authenticated
using (
  public.agroflow_tem_permissao('balancas', 'editar')
  or public.agroflow_tem_permissao('balancas', 'aprovar')
  or public.agroflow_tem_permissao('balancas', 'cancelar')
  or public.agroflow_tem_permissao('balancas_laboratorio', 'editar')
  or public.agroflow_tem_permissao('balancas_laboratorio', 'aprovar')
  or public.agroflow_tem_permissao('balancas_laboratorio', 'cancelar')
  or public.agroflow_tem_permissao('balancas_recebimentos', 'editar')
)
with check (
  public.agroflow_tem_permissao('balancas', 'editar')
  or public.agroflow_tem_permissao('balancas', 'aprovar')
  or public.agroflow_tem_permissao('balancas', 'cancelar')
  or public.agroflow_tem_permissao('balancas_laboratorio', 'editar')
  or public.agroflow_tem_permissao('balancas_laboratorio', 'aprovar')
  or public.agroflow_tem_permissao('balancas_laboratorio', 'cancelar')
  or public.agroflow_tem_permissao('balancas_recebimentos', 'editar')
);

drop policy if exists balancas_delete_recebimentos on public.recebimentos;
create policy balancas_delete_recebimentos
on public.recebimentos
for delete to authenticated
using (
  public.agroflow_tem_permissao('balancas', 'excluir')
  or public.agroflow_tem_permissao('balancas_laboratorio', 'excluir')
  or public.agroflow_tem_permissao('balancas_recebimentos', 'excluir')
);

-- Itens e complementos pertencem ao fluxo de Recebimentos.
drop policy if exists recebimento_itens_select on public.recebimento_itens;
create policy recebimento_itens_select
on public.recebimento_itens
for select to authenticated
using (
  public.agroflow_tem_permissao('balancas', 'visualizar')
  or public.agroflow_tem_permissao('balancas_recebimentos', 'visualizar')
  or public.agroflow_tem_permissao('balancas_relatorios', 'visualizar')
);

drop policy if exists recebimento_itens_insert on public.recebimento_itens;
create policy recebimento_itens_insert
on public.recebimento_itens
for insert to authenticated
with check (
  public.agroflow_tem_permissao('balancas', 'cadastrar')
  or public.agroflow_tem_permissao('balancas_recebimentos', 'cadastrar')
  or public.agroflow_tem_permissao('balancas_recebimentos', 'editar')
);

drop policy if exists recebimento_itens_update on public.recebimento_itens;
create policy recebimento_itens_update
on public.recebimento_itens
for update to authenticated
using (
  public.agroflow_tem_permissao('balancas', 'editar')
  or public.agroflow_tem_permissao('balancas_recebimentos', 'editar')
)
with check (
  public.agroflow_tem_permissao('balancas', 'editar')
  or public.agroflow_tem_permissao('balancas_recebimentos', 'editar')
);

drop policy if exists recebimento_itens_delete on public.recebimento_itens;
create policy recebimento_itens_delete
on public.recebimento_itens
for delete to authenticated
using (
  public.agroflow_tem_permissao('balancas', 'excluir')
  or public.agroflow_tem_permissao('balancas_recebimentos', 'excluir')
  or public.agroflow_tem_permissao('balancas_recebimentos', 'editar')
);

drop policy if exists balancas_select_recebimento_notas_complementares on public.recebimento_notas_complementares;
create policy balancas_select_recebimento_notas_complementares
on public.recebimento_notas_complementares
for select to authenticated
using (
  public.agroflow_tem_permissao('balancas', 'visualizar')
  or public.agroflow_tem_permissao('balancas_recebimentos', 'visualizar')
  or public.agroflow_tem_permissao('balancas_relatorios', 'visualizar')
);

drop policy if exists balancas_insert_recebimento_notas_complementares on public.recebimento_notas_complementares;
create policy balancas_insert_recebimento_notas_complementares
on public.recebimento_notas_complementares
for insert to authenticated
with check (
  public.agroflow_tem_permissao('balancas', 'cadastrar')
  or public.agroflow_tem_permissao('balancas', 'editar')
  or public.agroflow_tem_permissao('balancas_recebimentos', 'cadastrar')
  or public.agroflow_tem_permissao('balancas_recebimentos', 'editar')
);

drop policy if exists balancas_update_recebimento_notas_complementares on public.recebimento_notas_complementares;
create policy balancas_update_recebimento_notas_complementares
on public.recebimento_notas_complementares
for update to authenticated
using (
  public.agroflow_tem_permissao('balancas', 'editar')
  or public.agroflow_tem_permissao('balancas_recebimentos', 'editar')
)
with check (
  public.agroflow_tem_permissao('balancas', 'editar')
  or public.agroflow_tem_permissao('balancas_recebimentos', 'editar')
);

drop policy if exists balancas_delete_recebimento_notas_complementares on public.recebimento_notas_complementares;
create policy balancas_delete_recebimento_notas_complementares
on public.recebimento_notas_complementares
for delete to authenticated
using (
  public.agroflow_tem_permissao('balancas', 'excluir')
  or public.agroflow_tem_permissao('balancas_recebimentos', 'excluir')
);

-- 6) Grants explicitos para manter compatibilidade com Data API do Supabase.
grant select, insert, update, delete on public.permissoes_menu to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.usuarios_autorizados to authenticated;
grant select, insert, update, delete on public.portaria_entradas to authenticated;
grant select, insert, update, delete on public.recebimentos to authenticated;
grant select, insert, update, delete on public.recebimento_itens to authenticated;
grant select, insert, update, delete on public.recebimento_notas_complementares to authenticated;

commit;
