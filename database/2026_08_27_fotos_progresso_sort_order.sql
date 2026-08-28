-- 2026_08_27_fotos_progresso_sort_order.sql
-- Permite reordenar manualmente (arrastar) as fotos de um mesmo dia em
-- "Fotos de progresso". listPhotos passa a ordenar por
-- (taken_at desc, sort_order asc); fotos existentes ficam todas em 0
-- (mantém a ordem atual, que já era estável por created_at implícito).

alter table progress_photos add column sort_order integer not null default 0;
