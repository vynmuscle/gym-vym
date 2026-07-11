-- 2026_07_10_schema_inicial.sql
-- Gym Vym — schema inicial (Fase 1)

-- Exercícios cadastrados pelo usuário
create table exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  name text not null,
  muscle_group text not null,      -- peito, costas, pernas, ombros, biceps, triceps, abdomen, gluteos
  equipment text,                  -- barra, halter, maquina, polia, peso corporal
  notes text,
  created_at timestamptz default now()
);

-- Fichas de treino (Treino A, Treino B...)
create table workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  name text not null,              -- "Treino A - Peito e Tríceps"
  description text,
  sort_order int default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Exercícios dentro de uma ficha (a "prescrição")
create table workout_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  workout_id uuid not null references workouts(id) on delete cascade,
  exercise_id uuid not null references exercises(id),
  sort_order int default 0,
  target_sets int not null default 3,
  target_reps text not null default '10',   -- text permite "8-12" ou "até a falha"
  target_weight numeric,                     -- kg sugerido
  rest_seconds int default 90,
  notes text                                 -- notas do exercício na ficha
);

-- Uma sessão de treino realizada (o que aconteceu de verdade)
create table workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  workout_id uuid references workouts(id) on delete set null,
  started_at timestamptz default now(),
  finished_at timestamptz,
  notes text
);

-- Cada série executada dentro da sessão
create table session_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  session_id uuid not null references workout_sessions(id) on delete cascade,
  exercise_id uuid not null references exercises(id),
  set_number int not null,
  reps int,
  weight numeric,                  -- kg
  completed_at timestamptz default now()
);

-- RLS
alter table exercises enable row level security;
alter table workouts enable row level security;
alter table workout_exercises enable row level security;
alter table workout_sessions enable row level security;
alter table session_sets enable row level security;

-- Policies: exercises
create policy "exercises_select" on exercises for select using (auth.uid() = user_id);
create policy "exercises_insert" on exercises for insert with check (auth.uid() = user_id);
create policy "exercises_update" on exercises for update using (auth.uid() = user_id);
create policy "exercises_delete" on exercises for delete using (auth.uid() = user_id);

-- Policies: workouts
create policy "workouts_select" on workouts for select using (auth.uid() = user_id);
create policy "workouts_insert" on workouts for insert with check (auth.uid() = user_id);
create policy "workouts_update" on workouts for update using (auth.uid() = user_id);
create policy "workouts_delete" on workouts for delete using (auth.uid() = user_id);

-- Policies: workout_exercises
create policy "workout_exercises_select" on workout_exercises for select using (auth.uid() = user_id);
create policy "workout_exercises_insert" on workout_exercises for insert with check (auth.uid() = user_id);
create policy "workout_exercises_update" on workout_exercises for update using (auth.uid() = user_id);
create policy "workout_exercises_delete" on workout_exercises for delete using (auth.uid() = user_id);

-- Policies: workout_sessions
create policy "workout_sessions_select" on workout_sessions for select using (auth.uid() = user_id);
create policy "workout_sessions_insert" on workout_sessions for insert with check (auth.uid() = user_id);
create policy "workout_sessions_update" on workout_sessions for update using (auth.uid() = user_id);
create policy "workout_sessions_delete" on workout_sessions for delete using (auth.uid() = user_id);

-- Policies: session_sets
create policy "session_sets_select" on session_sets for select using (auth.uid() = user_id);
create policy "session_sets_insert" on session_sets for insert with check (auth.uid() = user_id);
create policy "session_sets_update" on session_sets for update using (auth.uid() = user_id);
create policy "session_sets_delete" on session_sets for delete using (auth.uid() = user_id);
