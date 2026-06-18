-- AgroFlow: armazenamento privado e permanente de PDFs.
-- Execute uma vez no SQL Editor do Supabase.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documentos',
  'documentos',
  false,
  10485760,
  array['application/pdf']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "agroflow_documentos_storage_select" on storage.objects;
drop policy if exists "agroflow_documentos_storage_insert" on storage.objects;
drop policy if exists "agroflow_documentos_storage_update" on storage.objects;
drop policy if exists "agroflow_documentos_storage_delete" on storage.objects;

create policy "agroflow_documentos_storage_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'documentos'
  and public.is_tijuca_authorized()
);

create policy "agroflow_documentos_storage_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'documentos'
  and public.agroflow_can_write()
);

create policy "agroflow_documentos_storage_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'documentos'
  and public.agroflow_can_write()
)
with check (
  bucket_id = 'documentos'
  and public.agroflow_can_write()
);

create policy "agroflow_documentos_storage_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'documentos'
  and public.agroflow_can_write()
);
