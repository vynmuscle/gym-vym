-- Adiciona campo de elevação/inclinação (%) por série, usado nos exercícios
-- de duração (esteira, bike etc.) — mesmo padrão de duration_seconds/distance_km
-- adicionados em 2026_07_21_cardio_distancia.sql.

alter table session_sets
  add column if not exists incline_pct numeric;
