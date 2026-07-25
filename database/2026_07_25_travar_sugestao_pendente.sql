-- Trava a sugestão de "treino de hoje": enquanto o treino sugerido não for
-- concluído, a home continua sugerindo o mesmo (em vez de recalcular e pular
-- pra outro treino quando o usuário falta um dia).
alter table user_settings add column pending_suggested_workout_id uuid references workouts(id) on delete set null;
