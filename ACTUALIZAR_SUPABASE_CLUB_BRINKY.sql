-- BRINKY FIESTA SUITE v2.0 BETA · ANDROID + CLUB BRINKY
-- Ejecuta este archivo UNA SOLA VEZ en el mismo proyecto Supabase usado por v1.4.
-- Esta tabla respalda únicamente Club Brinky. La app móvil sigue trabajando localmente
-- aunque Supabase esté temporalmente sin conexión.

create table if not exists public.brinky_club_backups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.brinky_club_backups enable row level security;

drop policy if exists "brinky_club_select_own" on public.brinky_club_backups;
create policy "brinky_club_select_own"
on public.brinky_club_backups
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "brinky_club_insert_own" on public.brinky_club_backups;
create policy "brinky_club_insert_own"
on public.brinky_club_backups
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "brinky_club_update_own" on public.brinky_club_backups;
create policy "brinky_club_update_own"
on public.brinky_club_backups
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update on public.brinky_club_backups to authenticated;

-- No se crea política DELETE: la app no puede borrar por accidente el respaldo de Club.
