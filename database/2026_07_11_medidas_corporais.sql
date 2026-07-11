-- 2026_07_11_medidas_corporais.sql
-- Gym Vym — Fase 4.3: registro de medidas corporais

create table body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  measured_at date not null default current_date,
  weight_kg numeric not null,
  height_cm numeric,
  arm_cm numeric,
  waist_cm numeric,
  chest_cm numeric,
  hip_cm numeric,
  thigh_cm numeric,
  calf_cm numeric,
  notes text,
  created_at timestamptz default now()
);

create index body_measurements_user_date_idx on body_measurements (user_id, measured_at);

alter table body_measurements enable row level security;

create policy "body_measurements_select" on body_measurements for select using (auth.uid() = user_id);
create policy "body_measurements_insert" on body_measurements for insert with check (auth.uid() = user_id);
create policy "body_measurements_update" on body_measurements for update using (auth.uid() = user_id);
create policy "body_measurements_delete" on body_measurements for delete using (auth.uid() = user_id);
