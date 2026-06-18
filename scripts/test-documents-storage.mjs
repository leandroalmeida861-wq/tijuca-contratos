import { readFileSync } from 'node:fs';

const results = [];

const pageSource = readFileSync('src/pages/ManagementPage.jsx', 'utf8');
const storageSource = readFileSync('src/lib/documentStorage.js', 'utf8');
const sqlSource = readFileSync('supabase/documentos-storage.sql', 'utf8');

assert('PDF novo usa Supabase Storage', pageSource.includes('uploadDocumentPdf(form.pdfFile)'));
assert('Banco recebe apenas referencia do arquivo', storageSource.includes('storage://') && !pageSource.includes('readAsDataURL'));
assert('Abrir PDF usa URL temporaria', storageSource.includes('createSignedUrl(path, 300)'));
assert('PDF antigo em data URL continua abrindo', storageSource.includes("reference.startsWith('data:application/pdf')"));
assert('Exclusao remove arquivo do Storage', pageSource.includes('deleteDocumentPdf(row.url)'));
assert('Bucket privado limita PDF a 10 MB', sqlSource.includes('10485760') && sqlSource.includes("array['application/pdf']"));
assert('Storage possui politicas RLS', sqlSource.includes('agroflow_documentos_storage_select') && sqlSource.includes('agroflow_documentos_storage_insert'));
assert('Link Abrir PDF usa manipulador seguro', pageSource.includes('onOpenDocument?.(String(value))'));

console.log('\nTESTES DE DOCUMENTOS E STORAGE');
for (const result of results) {
  console.log(`${result.ok ? 'OK' : 'FALHOU'} - ${result.name}`);
}

const failed = results.filter((result) => !result.ok);
if (failed.length) {
  process.exitCode = 1;
  console.error(`\n${failed.length} teste(s) falharam.`);
} else {
  console.log('\nTodos os testes passaram.');
}

function assert(name, ok) {
  results.push({ name, ok: Boolean(ok) });
}
