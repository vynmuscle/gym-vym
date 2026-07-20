-- 2026_07_20e_tracking_type.sql
-- Corrige exercícios isométricos (ex: prancha) que estavam pedindo peso/reps
-- em vez de tempo. Antes, o app só distinguia "cardio" (por muscle_group)
-- de "peso/reps" — mas exercícios isométricos como prancha são abdômen,
-- não cardio, então precisam de um eixo próprio (tracking_type) separado
-- do grupo muscular usado pra recuperação/filtros.

alter table exercises add column tracking_type text not null default 'reps'
  check (tracking_type in ('reps', 'duration'));

alter table library_exercises add column tracking_type text not null default 'reps'
  check (tracking_type in ('reps', 'duration'));

-- Exercícios de cardio já classificados: continuam por tempo.
update exercises set tracking_type = 'duration' where muscle_group = 'cardio';
update library_exercises set tracking_type = 'duration' where muscle_group = 'cardio';

-- Varredura: exercícios isométricos identificados (pranchas e isometrias
-- de segurar), que são por tempo mas não são "cardio" (ficam no grupo
-- muscular correto pra recuperação/filtros, só mudam o tipo de registro).
update exercises set tracking_type = 'duration'
where id = 'f89fdfa9-f721-4975-915e-fbf86a730e67'; -- Prancha frontal (usuário)

update library_exercises set tracking_type = 'duration'
where id in (
  '911e6fca-7f60-478e-bd0f-30530bae5ecb', -- Plank
  'b98d5c42-888b-444d-830f-3a4d1c828693', -- Side Bridge
  'affdd979-3dc0-4460-8ffd-56015accf22e', -- Isometric Chest Squeezes
  '77842c6c-9fec-4dff-9f20-0754ba9cf9ca', -- Isometric Neck Exercise - Front And Back
  '8fb5a2c3-4a80-44f0-9562-21b24fe8fe7e'  -- Isometric Neck Exercise - Sides
);
