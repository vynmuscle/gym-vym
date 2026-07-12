-- 2026_07_12_user_settings.sql
-- Gym Vym — Etapa 2: perfil e meta semanal

create table user_settings (
  user_id uuid primary key references auth.users(id),
  weekly_goal int not null default 4,
  display_name text,
  updated_at timestamptz default now()
);

alter table user_settings enable row level security;

create policy "user_settings_select" on user_settings for select using (auth.uid() = user_id);
create policy "user_settings_insert" on user_settings for insert with check (auth.uid() = user_id);
create policy "user_settings_update" on user_settings for update using (auth.uid() = user_id);
create policy "user_settings_delete" on user_settings for delete using (auth.uid() = user_id);
