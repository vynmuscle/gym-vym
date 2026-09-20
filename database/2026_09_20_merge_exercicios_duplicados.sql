-- 2026_09_20_merge_exercicios_duplicados.sql
-- Corrige exercícios duplicados (mesmo exercício, nomes ligeiramente
-- diferentes vindos da biblioteca) que quebravam o histórico de progressão
-- por ficarem com exercise_id diferente. Ver addExerciseFromLibrary em
-- js/services/workoutService.js — corrigido separadamente no código.

-- 1) "Tríceps pulley na polia" -> "Tríceps pulley com corda"
--    (4 séries reais gravadas em 2026-07-21 ficaram presas no ID errado)
update session_sets
set exercise_id = 'a707c8a5-7d80-4941-9c9c-9f9aed4be753'
where exercise_id = '80b02f62-a2d0-4086-93db-def837faa369';

delete from exercises where id = '80b02f62-a2d0-4086-93db-def837faa369';

-- 2) "Rosca martelo com halteres" (órfão, 0 séries) -> excluído,
--    "Rosca martelo com halter" já concentra todo o histórico
delete from exercises where id = 'af59ca4c-0221-4072-87bf-9d32f26d6754';

-- 3) "Remada Sentada na Polia Baixa" (órfão, 0 séries) -> excluído,
--    "Remada na polia baixa (sentado)" já concentra todo o histórico
delete from exercises where id = 'a1201a78-29ab-47d4-84b6-a2c5a587f729';

-- 4) "Supino Declinado com Barra" duplicado (ambos órfãos, 0 séries) -> excluído o mais novo
delete from exercises where id = '62daa32f-c2f4-4188-bba7-b802b04b29da';
