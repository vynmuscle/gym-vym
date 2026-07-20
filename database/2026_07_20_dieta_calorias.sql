-- 2026_07_20_dieta_calorias.sql
-- Gym Vym — Dieta e calorias: perfil para cálculo de meta calórica + diário alimentar
-- Peso é lido de body_measurements (já existente) — não duplicado aqui.

create table diet_profile (
  user_id uuid primary key references auth.users(id),
  birth_date date not null,
  sex text not null check (sex in ('M','F')),
  height_cm numeric not null,
  activity_level text not null check (activity_level in ('sedentary','light','moderate','intense')),
  goal text not null check (goal in ('lose','maintain','gain')),
  goal_rate_kg_per_week numeric not null default 0.5,
  updated_at timestamptz default now()
);

alter table diet_profile enable row level security;

create policy "diet_profile_select" on diet_profile for select using (auth.uid() = user_id);
create policy "diet_profile_insert" on diet_profile for insert with check (auth.uid() = user_id);
create policy "diet_profile_update" on diet_profile for update using (auth.uid() = user_id);
create policy "diet_profile_delete" on diet_profile for delete using (auth.uid() = user_id);

create table food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  logged_at date not null default current_date,
  meal_type text not null check (meal_type in ('cafe','almoco','lanche','jantar','outro')),
  name text not null,
  calories numeric not null,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  created_at timestamptz default now()
);

create index food_logs_user_date_idx on food_logs (user_id, logged_at);

alter table food_logs enable row level security;

create policy "food_logs_select" on food_logs for select using (auth.uid() = user_id);
create policy "food_logs_insert" on food_logs for insert with check (auth.uid() = user_id);
create policy "food_logs_update" on food_logs for update using (auth.uid() = user_id);
create policy "food_logs_delete" on food_logs for delete using (auth.uid() = user_id);
