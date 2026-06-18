import { supabase } from './supabase.js';

const BUCKET = 'documentos';
const STORAGE_PREFIX = `storage://${BUCKET}/`;

export async function uploadDocumentPdf(file) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    throw new Error('Sessao expirada. Como corrigir: entre novamente no AgroFlow antes de anexar o PDF.');
  }

  const safeName = sanitizeFileName(file.name || 'documento.pdf');
  const path = `${userData.user.id}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: 'application/pdf',
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw storageError('enviar', error);

  return `${STORAGE_PREFIX}${path}`;
}

export async function openDocumentPdf(value) {
  const reference = String(value || '').trim();
  if (!reference) {
    throw new Error('PDF nao encontrado. Como corrigir: edite o documento e anexe o arquivo novamente.');
  }

  const popup = window.open('', '_blank');
  if (!popup) {
    throw new Error('O navegador bloqueou a abertura do PDF. Como corrigir: permita pop-ups para o AgroFlow e tente novamente.');
  }

  try {
    if (reference.startsWith(STORAGE_PREFIX)) {
      const path = reference.slice(STORAGE_PREFIX.length);
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
      if (error || !data?.signedUrl) throw storageError('abrir', error);
      popup.location.replace(data.signedUrl);
      return;
    }

    if (reference.startsWith('data:application/pdf')) {
      const blob = await fetch(reference).then((response) => response.blob());
      const objectUrl = URL.createObjectURL(blob);
      popup.location.replace(objectUrl);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      return;
    }

    if (/^https?:\/\//i.test(reference) || reference.startsWith('blob:')) {
      popup.location.replace(reference);
      return;
    }

    popup.close();
    throw new Error('Formato antigo de PDF invalido. Como corrigir: edite o documento e anexe o arquivo novamente.');
  } catch (error) {
    popup.close();
    throw error;
  }
}

export async function deleteDocumentPdf(value) {
  const reference = String(value || '').trim();
  if (!reference.startsWith(STORAGE_PREFIX)) return;

  const path = reference.slice(STORAGE_PREFIX.length);
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw storageError('excluir', error);
}

function sanitizeFileName(name) {
  const normalized = String(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return normalized.toLowerCase().endsWith('.pdf') ? normalized : `${normalized || 'documento'}.pdf`;
}

function storageError(action, error) {
  const detail = String(error?.message || '').toLowerCase();
  if (detail.includes('bucket') || detail.includes('not found')) {
    return new Error(`Armazenamento de documentos nao configurado. Como corrigir: aplique o SQL documentos-storage.sql no Supabase e tente ${action} novamente.`);
  }
  if (detail.includes('policy') || detail.includes('row-level security') || detail.includes('unauthorized')) {
    return new Error(`Acesso negado ao ${action} o PDF. Como corrigir: entre novamente e confirme que seu usuario esta ativo no AgroFlow.`);
  }
  return new Error(`Nao foi possivel ${action} o PDF. Como corrigir: verifique sua internet e tente novamente.`);
}
