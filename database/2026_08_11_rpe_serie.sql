-- 2026_08_11_rpe_serie.sql
-- Fase 1 do treino adaptativo: RPE opcional por série, base pro motor de
-- progressão (Fase 2) diferenciar "bateu a meta fácil" de "bateu quase
-- falhando" em vez de só olhar reps vs. faixa alvo.

alter table session_sets add column rpe numeric check (rpe between 1 and 10);
