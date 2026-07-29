import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const main = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8');
const login = await readFile(new URL('../src/pages/Login.jsx', import.meta.url), 'utf8');
const home = await readFile(new URL('../src/pages/HomePage.jsx', import.meta.url), 'utf8');
const layout = await readFile(new URL('../src/components/AppLayout.jsx', import.meta.url), 'utf8');

assert.ok(
  main.includes('<Route path="inicio" element={<HomePage />} />'),
  'A pagina inicial deve existir dentro do layout autenticado.',
);
assert.ok(
  login.includes('return <Navigate to="/inicio" replace />'),
  'O login autorizado deve abrir a pagina inicial.',
);
assert.ok(
  main.includes('<Route index element={<AuthorizedHome />} />'),
  'A rota interna atual do Dashboard de Contratos deve ser preservada.',
);
assert.ok(
  main.includes('<Route path="contratos"')
    && main.includes('<Route path="balancas"')
    && main.includes('path={`${unidade.rotaBase.replace'),
  'As rotas existentes de Contratos e das unidades devem permanecer ativas.',
);
assert.ok(
  home.includes("can(tab.menu, 'visualizar')")
    && home.includes("can(unidade.permissaoBase, 'visualizar')")
    && home.includes('podeAcessarUnidade(unidade.codigo)')
    && home.includes("can(module.menu, 'visualizar')"),
  'Todos os atalhos devem respeitar as permissoes existentes.',
);
assert.ok(
  home.includes('UNIDADES.forEach')
    && home.includes('rotaInicialDaUnidade(unidade)'),
  'As quatro unidades devem reutilizar a configuracao compartilhada.',
);
assert.ok(
  !/\b(supabase|fetch|insert|update|delete)\b/i.test(home),
  'A pagina inicial deve ser somente visual e nao acessar ou alterar o banco.',
);
assert.ok(
  layout.includes('<Outlet />')
    && !layout.includes('to="/inicio"'),
  'O menu lateral deve continuar com a estrutura e os destinos atuais.',
);

console.log('Testes da pagina inicial pos-login aprovados.');
