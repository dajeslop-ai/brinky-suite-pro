-- BRINKY FIESTA SUITE v1.4
-- RESPALDO SEGURO DE CONTRATOS Y COTIZACIONES
-- Ejecuta este archivo UNA SOLA VEZ en Supabase > SQL Editor.
-- Esta estructura es de respaldo de una sola vía: la app sube copias,
-- pero NO aplica cambios remotos automáticamente sobre tus documentos locales.

create table if not exists public.brinky_document_backups (
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id text not null,
  document_type text not null check (document_type in ('contract','quote')),
  payload jsonb not null,
  pdf_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, document_id)
);

create index if not exists brinky_document_backups_user_idx
  on public.brinky_document_backups(user_id, updated_at desc);

alter table public.brinky_document_backups enable row level security;

drop policy if exists "brinky_backup_select_own" on public.brinky_document_backups;
create policy "brinky_backup_select_own"
on public.brinky_document_backups
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "brinky_backup_insert_own" on public.brinky_document_backups;
create policy "brinky_backup_insert_own"
on public.brinky_document_backups
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "brinky_backup_update_own" on public.brinky_document_backups;
create policy "brinky_backup_update_own"
on public.brinky_document_backups
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update on public.brinky_document_backups to authenticated;

-- Bucket PRIVADO para PDFs.
insert into storage.buckets (id, name, public)
values ('brinky-documents', 'brinky-documents', false)
on conflict (id) do update set public = false;

-- Cada usuario solo puede ver/escribir dentro de su propia carpeta user_id/...
drop policy if exists "brinky_storage_select_own" on storage.objects;
create policy "brinky_storage_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'brinky-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "brinky_storage_insert_own" on storage.objects;
create policy "brinky_storage_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'brinky-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "brinky_storage_update_own" on storage.objects;
create policy "brinky_storage_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'brinky-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'brinky-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- No se crea política DELETE intencionalmente.
-- La app no puede borrar automáticamente las copias de seguridad de la nube.
