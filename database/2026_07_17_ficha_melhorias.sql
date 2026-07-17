-- Instruções de "como executar" copiadas da biblioteca pro exercício do usuário
alter table exercises add column instructions text;

-- Duração alvo (segundos) para exercícios de cardio na ficha (em vez de séries/reps/carga)
alter table workout_exercises add column target_duration_seconds int;

-- Observação por série + duração registrada (cardio) na execução do treino
alter table session_sets add column notes text;
alter table session_sets add column duration_seconds int;

-- Exercícios de cardio não têm repetições
alter table workout_exercises alter column target_reps drop not null;
