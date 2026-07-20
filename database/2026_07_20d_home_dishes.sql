-- 2026_07_20d_home_dishes.sql
-- Gym Vym — pratos caseiros brasileiros comuns que não constam na Tabela TACO
-- (pratos prontos/receitas, não alimentos-base medidos em laboratório).
-- Valores são ESTIMATIVAS baseadas em proporções típicas de receita, não
-- medição oficial — por isso ficam numa tabela separada da TACO, marcados
-- na busca como "(Caseiro)" pra deixar clara a diferença.
-- Catálogo compartilhado (mesmo padrão de taco_foods/library_exercises):
-- somente leitura para usuários autenticados, escrita só via migration/service_role.

create table home_dishes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  calories numeric not null,
  protein_g numeric,
  fat_g numeric,
  carbs_g numeric,
  created_at timestamptz default now()
);

create index home_dishes_name_idx on home_dishes using gin (to_tsvector('portuguese', name));

alter table home_dishes enable row level security;

create policy "home_dishes_select" on home_dishes
  for select
  to authenticated
  using (true);

insert into home_dishes (name, calories, protein_g, fat_g, carbs_g) values
('Purê de batata', 105, 2.0, 4.0, 15.0),
('Purê de mandioquinha', 100, 1.5, 3.0, 17.0),
('Batata gratinada', 145, 4.5, 8.0, 14.0),
('Batata doce assada', 90, 1.5, 0.2, 21.0),
('Arroz de forno', 160, 6.0, 7.0, 18.0),
('Macarrão ao molho branco', 150, 5.0, 6.0, 19.0),
('Macarronada, molho de carne', 145, 6.0, 5.0, 19.0),
('Nhoque ao sugo', 140, 4.0, 3.0, 24.0),
('Lasanha à bolonhesa, pronta', 170, 8.0, 8.0, 16.0),
('Escondidinho de carne seca', 190, 9.0, 10.0, 16.0),
('Torta de frango, caseira', 220, 8.0, 13.0, 18.0),
('Torta salgada de legumes', 210, 6.0, 12.0, 20.0),
('Quiche de legumes', 230, 7.0, 15.0, 17.0),
('Risoto de frango', 165, 7.0, 6.0, 20.0),
('Risoto de camarão', 155, 8.0, 5.0, 19.0),
('Frango à parmegiana', 220, 15.0, 12.0, 13.0),
('Bife à parmegiana', 230, 17.0, 13.0, 12.0),
('Frango xadrez', 130, 12.0, 5.0, 9.0),
('Carne de panela', 190, 20.0, 11.0, 3.0),
('Pão de alho', 320, 7.0, 18.0, 33.0),
('Molho branco, bechamel', 110, 3.0, 7.0, 9.0),
('Molho de tomate, caseiro', 45, 1.5, 1.5, 7.0),
('Salada de batata com maionese', 145, 2.0, 9.0, 14.0),
('Suflê de legumes', 130, 6.0, 8.0, 9.0),
('Bolinho de bacalhau', 230, 10.0, 13.0, 18.0),
('Panqueca de carne', 160, 8.0, 8.0, 14.0),
('Panqueca doce', 220, 6.0, 8.0, 30.0),
('Pudim de leite', 180, 4.0, 5.0, 30.0),
('Arroz doce', 140, 3.0, 2.0, 27.0),
('Sanduíche natural, frango ou atum', 210, 10.0, 8.0, 24.0),
('Omelete de legumes', 145, 10.0, 10.0, 3.0),
('Ovo mexido', 165, 11.0, 13.0, 1.0),
('Abobrinha grelhada', 30, 1.2, 1.0, 4.5),
('Berinjela grelhada', 35, 1.0, 1.5, 5.0),
('Pimentão grelhado', 35, 1.2, 0.8, 6.0),
('Cebola grelhada', 55, 1.2, 1.5, 9.0),
('Abacaxi grelhado', 60, 0.5, 0.2, 15.0),
('Banana da terra grelhada', 130, 1.3, 0.3, 32.0),
('Queijo coalho grelhado', 320, 24.0, 24.0, 2.0),
('Camarão grelhado', 105, 20.0, 2.0, 1.0),
('Filé de peixe grelhado (tilápia)', 125, 24.0, 2.5, 0.0),
('Linguiça toscana grelhada', 300, 18.0, 25.0, 1.0),
('Frango grelhado com legumes', 140, 15.0, 5.0, 8.0),
('Picanha grelhada com farofa e vinagrete', 230, 15.0, 14.0, 12.0);
