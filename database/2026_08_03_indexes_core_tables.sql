-- 2026_08_03_indexes_core_tables.sql
-- Índices nas colunas de FK/user_id das tabelas centrais (exercises, workouts,
-- workout_exercises, workout_sessions, session_sets) — sem índice, toda consulta
-- (inclusive as checagens de RLS) faz varredura completa da tabela.

create index if not exists idx_exercises_user on exercises(user_id);

create index if not exists idx_workouts_user on workouts(user_id);

create index if not exists idx_workout_exercises_user on workout_exercises(user_id);
create index if not exists idx_workout_exercises_workout on workout_exercises(workout_id);
create index if not exists idx_workout_exercises_exercise on workout_exercises(exercise_id);

create index if not exists idx_workout_sessions_user on workout_sessions(user_id);
create index if not exists idx_workout_sessions_workout on workout_sessions(workout_id);

create index if not exists idx_session_sets_user on session_sets(user_id);
create index if not exists idx_session_sets_session on session_sets(session_id);
create index if not exists idx_session_sets_exercise on session_sets(exercise_id);
