import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const main = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8');
const home = await readFile(new URL('../src/pages/HomePage.jsx', import.meta.url), 'utf8');
const list = await readFile(new URL('../src/pages/NewsListPage.jsx', import.meta.url), 'utf8');
const detail = await readFile(new URL('../src/pages/NewsDetailPage.jsx', import.meta.url), 'utf8');
const admin = await readFile(new URL('../src/pages/AdminNewsPage.jsx', import.meta.url), 'utf8');
const service = await readFile(new URL('../src/services/noticiasService.js', import.meta.url), 'utf8');
const migration = await readFile(new URL('../supabase/noticias-home.sql', import.meta.url), 'utf8');

assert.ok(
  main.includes('path="noticias"')
    && main.includes('path="noticias/admin"')
    && main.includes('path="noticias/:id"'),
  'As rotas de listagem, administração e detalhe devem existir.',
);

const bannerPosition = home.indexOf('src="/agroflow-home-silos.png"');
const newsPosition = home.indexOf('Informações e Notícias');
const modulesPosition = home.indexOf('Módulos liberados para você');
assert.ok(
  bannerPosition >= 0 && newsPosition > bannerPosition && modulesPosition > newsPosition,
  'A Home deve mostrar banner, notícias e módulos nesta ordem.',
);
assert.ok(
  home.includes('listPublishedNews({ limit: 4, featuredFirst: true })')
    && home.includes('Ver todas as notícias'),
  'A Home deve limitar os destaques a quatro e oferecer a listagem completa.',
);

assert.ok(
  list.includes('Pesquisar por título')
    && list.includes('Todas as categorias')
    && list.includes('NEWS_CATEGORIES'),
  'A listagem deve oferecer pesquisa por título e filtro por categoria.',
);

assert.ok(
  detail.includes('Acessar fonte original')
    && detail.includes('target="_blank"')
    && detail.includes('rel="noopener noreferrer"'),
  'A notícia deve abrir dentro do sistema e proteger o link da fonte externa.',
);

assert.ok(
  admin.includes("profile !== 'admin'")
    && admin.includes('Atualizações desta semana:')
    && admin.includes('deleteNews')
    && admin.includes('setNewsPublished'),
  'A administração deve ser exclusiva do Admin, cumprir a cadência e oferecer o CRUD.',
);

assert.ok(
  migration.includes('alter table public.noticias enable row level security')
    && migration.includes('publicado or public.agroflow_is_admin()')
    && migration.includes('create policy noticias_admin_insert')
    && migration.includes('revoke all on public.noticias from anon'),
  'A tabela deve ter RLS para leitura publicada e escrita exclusiva do Admin.',
);

assert.ok(
  service.includes(".eq('publicado', true)")
    && service.includes("new URL(value).protocol === 'https:'"),
  'A consulta comum deve carregar somente publicadas e validar URLs HTTPS.',
);

console.log('Testes estruturais de notícias da Home aprovados.');
