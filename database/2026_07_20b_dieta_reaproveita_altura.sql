-- 2026_07_20b_dieta_reaproveita_altura.sql
-- Gym Vym — remove height_cm de diet_profile: altura passa a vir de body_measurements
-- (mesma fonte já usada pro peso), evitando pedir o mesmo dado duas vezes ao usuário.

alter table diet_profile drop column height_cm;
