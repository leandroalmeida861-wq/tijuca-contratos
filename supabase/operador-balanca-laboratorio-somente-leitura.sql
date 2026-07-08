-- AgroFlow - Operador Balanca com Laboratorio em modo somente leitura
-- SQL incremental: nao apaga dados e nao altera outros perfis.

begin;

-- O menu pai "Balancas" deve permitir entrada na rota, sem liberar acoes amplas.
update public.permissoes_menu
set visualizar = true,
    cadastrar = false,
    editar = false,
    excluir = false,
    cancelar = false,
    aprovar = false,
    exportar = false,
    atualizado_em = now()
where perfil = 'operador_balanca'
  and menu = 'balancas';

-- Na aba "Balancas - Aprovacao Laboratorio", Operador Balanca consulta registros.
-- Exportar permanece como estiver marcado pelo Admin.
update public.permissoes_menu
set visualizar = true,
    cadastrar = false,
    editar = false,
    excluir = false,
    cancelar = false,
    aprovar = false,
    atualizado_em = now()
where perfil = 'operador_balanca'
  and menu = 'balancas_laboratorio';

commit;
