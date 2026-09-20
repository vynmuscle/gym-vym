-- 2026_09_20b_dedupe_e_trava_series_duplicadas.sql
-- Corrige gravação de série sem trava contra duplicidade: um toque duplo no
-- ✓ (ou timeout de rede + reenvio) mandava dois INSERTs da mesma série,
-- porque não havia constraint única em (session_id, exercise_id, set_number)
-- nem lock no client enquanto a gravação estava em andamento (ver
-- js/train.js completeSet e js/services/workoutService.js recordSet,
-- corrigidos separadamente no código).

-- 1) Remove as duplicatas já existentes, mantendo a série gravada primeiro
--    (completed_at mais antigo) de cada grupo.
delete from session_sets a
using session_sets b
where a.session_id = b.session_id
  and a.exercise_id = b.exercise_id
  and a.set_number = b.set_number
  and (a.completed_at, a.id) > (b.completed_at, b.id);

-- 2) Trava daqui pra frente: recordSet agora faz upsert nessa chave, então
--    reenviar a mesma série (retry após timeout, toque duplo) atualiza a
--    linha existente em vez de criar outra.
alter table session_sets
  add constraint session_sets_session_exercise_set_unique
  unique (session_id, exercise_id, set_number);
