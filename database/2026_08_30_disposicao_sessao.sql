-- 2026_08_30_disposicao_sessao.sql
-- Amarra o check-in de disposição (antes só no localStorage do card da
-- home) à sessão de treino real, pra permitir correlacionar disposição
-- com desempenho/volume (card "Disposição x Desempenho" em Progresso).

alter table workout_sessions add column feeling text check (feeling in ('mal', 'normal', 'otimo', 'cansado'));
