-- 2026_07_11_biblioteca_exercicios.sql
-- Gym Vym — biblioteca de exercícios (Fase 3), baseada no dataset free-exercise-db

create table library_exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_pt text,
  muscle_group text not null,
  equipment text,
  level text,
  instructions text,
  image_urls text[],
  created_at timestamptz default now()
);

alter table library_exercises enable row level security;

-- Somente leitura para usuários autenticados; escrita só via service_role (script de importação)
create policy "library_exercises_select" on library_exercises
  for select
  to authenticated
  using (true);

alter table exercises add column image_url text;
