import { supabase } from '../lib/supabase.js';

export const NEWS_CATEGORIES = [
  { value: 'reforma_tributaria', label: 'Reforma Tributária' },
  { value: 'financeiro_economia', label: 'Financeiro e Economia' },
  { value: 'mercado_graos', label: 'Mercado de Grãos' },
  { value: 'agronegocio', label: 'Agronegócio' },
];

const NEWS_SELECT = [
  'id',
  'categoria',
  'titulo',
  'resumo',
  'conteudo',
  'data_publicacao',
  'fonte',
  'fonte_url',
  'publicado',
  'destaque',
  'created_at',
  'updated_at',
].join(',');

export async function listPublishedNews({
  category = '',
  search = '',
  limit,
  featuredFirst = false,
} = {}) {
  let query = getClient()
    .from('noticias')
    .select(NEWS_SELECT)
    .eq('publicado', true);

  if (category) query = query.eq('categoria', category);
  if (search.trim()) query = query.ilike('titulo', `%${search.trim()}%`);
  if (featuredFirst) query = query.order('destaque', { ascending: false });
  query = query
    .order('data_publicacao', { ascending: false })
    .order('created_at', { ascending: false });
  if (Number.isInteger(limit) && limit > 0) query = query.limit(limit);

  const { data, error } = await query;
  if (error) throw toNewsError(error, 'Não foi possível carregar as notícias.');
  return data || [];
}

export async function getPublishedNews(id) {
  const { data, error } = await getClient()
    .from('noticias')
    .select(NEWS_SELECT)
    .eq('id', id)
    .eq('publicado', true)
    .maybeSingle();

  if (error) throw toNewsError(error, 'Não foi possível abrir a notícia.');
  return data;
}

export async function listAdminNews() {
  const { data, error } = await getClient()
    .from('noticias')
    .select(NEWS_SELECT)
    .order('data_publicacao', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw toNewsError(error, 'Não foi possível carregar a administração de notícias.');
  return data || [];
}

export async function saveNews(news) {
  const payload = normalizeNewsPayload(news);

  if (news.id) {
    const { data, error } = await getClient()
      .from('noticias')
      .update(payload)
      .eq('id', news.id)
      .select(NEWS_SELECT)
      .single();

    if (error) throw toNewsError(error, 'Não foi possível atualizar a notícia.');
    return data;
  }

  const { data, error } = await getClient()
    .from('noticias')
    .insert(payload)
    .select(NEWS_SELECT)
    .single();

  if (error) throw toNewsError(error, 'Não foi possível cadastrar a notícia.');
  return data;
}

export async function setNewsPublished(id, publicado) {
  const { data, error } = await getClient()
    .from('noticias')
    .update({ publicado: Boolean(publicado) })
    .eq('id', id)
    .select(NEWS_SELECT)
    .single();

  if (error) throw toNewsError(error, 'Não foi possível alterar a publicação da notícia.');
  return data;
}

export async function deleteNews(id) {
  const { error } = await getClient().from('noticias').delete().eq('id', id);
  if (error) throw toNewsError(error, 'Não foi possível excluir a notícia.');
}

export function getCategoryLabel(value) {
  return NEWS_CATEGORIES.find((category) => category.value === value)?.label || value;
}

function normalizeNewsPayload(news) {
  const sourceUrl = String(news.fonte_url || '').trim();
  if (sourceUrl && !isValidExternalUrl(sourceUrl)) {
    throw new Error('Informe uma URL segura iniciada por https:// para a fonte original.');
  }

  return {
    categoria: String(news.categoria || '').trim(),
    titulo: String(news.titulo || '').trim(),
    resumo: String(news.resumo || '').trim(),
    conteudo: String(news.conteudo || '').trim(),
    data_publicacao: news.data_publicacao,
    fonte: String(news.fonte || '').trim(),
    fonte_url: sourceUrl || null,
    publicado: Boolean(news.publicado),
    destaque: Boolean(news.destaque),
  };
}

function isValidExternalUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function getClient() {
  if (!supabase) throw new Error('O serviço de notícias não está configurado.');
  return supabase;
}

function toNewsError(error, fallback) {
  if (error?.code === '42501') {
    return new Error('Você não possui permissão para realizar esta ação.');
  }
  return new Error(error?.message ? `${fallback} ${error.message}` : fallback);
}
