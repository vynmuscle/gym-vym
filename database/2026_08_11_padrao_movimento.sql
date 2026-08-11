-- 2026_08_11_padrao_movimento.sql
-- Substituição inteligente de exercícios: classifica cada exercício por
-- padrão de movimento principal (empurrar/puxar/agachar/dobradiça de
-- quadril/isolamento/core), além do grupo muscular já existente.

alter table library_exercises add column movement_pattern text
  check (movement_pattern in (
    'agachamento','dobradica_quadril','empurrar_horizontal','empurrar_vertical',
    'puxar_horizontal','puxar_vertical','isolamento','core','cardio','outro'
  ));

alter table exercises add column movement_pattern text
  check (movement_pattern in (
    'agachamento','dobradica_quadril','empurrar_horizontal','empurrar_vertical',
    'puxar_horizontal','puxar_vertical','isolamento','core','cardio','outro'
  ));

-- A classificação dos ~870 exercícios da biblioteca foi aplicada via
-- scripts/classify-movement-patterns.js (roda uma vez, gera o UPDATE em
-- massa) — não replicada aqui por serem centenas de linhas. Rodar de novo
-- se a biblioteca for reimportada (scripts/import-library.js).

-- Backfill: exercícios que o usuário já tinha cadastrados, por correspondência
-- de nome com a biblioteca (mesmo padrão do backfill de instructions/image_url
-- em 2026_07_17b_correcoes_cardio_instrucoes.sql).
update exercises e
set movement_pattern = l.movement_pattern
from library_exercises l
where (lower(l.name) = lower(e.name) or lower(l.name_pt) = lower(e.name))
  and l.movement_pattern is not null
  and e.movement_pattern is null;
