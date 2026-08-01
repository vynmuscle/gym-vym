-- 2026_08_01_health_sync.sql
-- Gym Vym — Sincronização com smartwatch (Apple Health via automação iOS)

alter table user_settings add column health_sync_token text unique;

create table daily_health_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  date date not null,
  steps int,
  calories_total int,
  updated_at timestamptz default now(),
  unique (user_id, date)
);

alter table daily_health_stats enable row level security;

create policy "daily_health_stats_select" on daily_health_stats for select using (auth.uid() = user_id);
create policy "daily_health_stats_insert" on daily_health_stats for insert with check (auth.uid() = user_id);
create policy "daily_health_stats_update" on daily_health_stats for update using (auth.uid() = user_id);
create policy "daily_health_stats_delete" on daily_health_stats for delete using (auth.uid() = user_id);

alter table workout_sessions add column avg_heart_rate int;
alter table workout_sessions add column max_heart_rate int;
alter table workout_sessions add column watch_calories int;
alter table workout_sessions add column watch_duration_seconds int;
