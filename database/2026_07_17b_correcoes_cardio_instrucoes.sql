-- Reclassifica exercícios de cardio da biblioteca (importados como "pernas"
-- por falta de mapeamento no script de importação original)
update library_exercises set muscle_group = 'cardio'
where id in (
  '15bdd71e-68a2-4f85-a641-cdcf0d34f00b', -- Bicycling
  'a07e7b11-e764-4144-8664-7ebc1c53827c', -- Bicycling, Stationary
  '80987f1b-5ace-4576-8060-a3ee21e0aad7', -- Elliptical Trainer
  'a75e5533-fd20-40a8-80ed-244fc2cc2e62', -- Jogging, Treadmill
  '8860c349-6439-4900-a43b-12bf0ffdb219', -- Recumbent Bike
  'e41b796d-c0aa-43d4-834b-85f10a6aa298', -- Rowing, Stationary
  '34c5088d-c3e1-48fe-8b4f-f79b48aa75a6', -- Running, Treadmill
  '4b83f616-a58a-465e-82f8-b990b1ebb5f5', -- Stairmaster
  '877c88b5-1938-40f4-8fa9-1140f218d037', -- Step Mill
  '7603544e-933c-4d5b-832f-e7054f43ae81', -- Walking, Treadmill
  '37dbcb07-0c0f-44f0-ad2b-0a66e38f796b', -- Rope Jumping
  'fa91a76f-1751-43f3-8d14-a643ff98b290'  -- Trail Running/Walking
);

-- Backfill: exercícios do usuário criados antes do campo "instructions"
-- existir, recuperando instrução/imagem da biblioteca quando o nome bate
update exercises e
set instructions = coalesce(l.instructions_pt, l.instructions),
    image_url = coalesce(e.image_url, l.image_urls[1])
from library_exercises l
where (lower(l.name) = lower(e.name) or lower(l.name_pt) = lower(e.name))
  and e.instructions is null;
