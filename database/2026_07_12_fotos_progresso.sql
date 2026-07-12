-- 2026_07_12_fotos_progresso.sql
-- Gym Vym — fotos de progresso (hub Evolução)

create table progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  taken_at date not null default current_date,
  storage_path text not null,
  notes text,
  created_at timestamptz default now()
);

create index progress_photos_user_date_idx on progress_photos (user_id, taken_at);

alter table progress_photos enable row level security;

create policy "progress_photos_select" on progress_photos for select using (auth.uid() = user_id);
create policy "progress_photos_insert" on progress_photos for insert with check (auth.uid() = user_id);
create policy "progress_photos_update" on progress_photos for update using (auth.uid() = user_id);
create policy "progress_photos_delete" on progress_photos for delete using (auth.uid() = user_id);
