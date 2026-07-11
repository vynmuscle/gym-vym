// scripts/import-library.js
// Importa o dataset free-exercise-db (github.com/yuhonas/free-exercise-db) pra tabela
// library_exercises. Roda uma vez, localmente — não faz parte do app.
//
// Uso (PowerShell):
//   $env:SUPABASE_SERVICE_KEY="sua_service_key_aqui"
//   node scripts/import-library.js

const SUPABASE_URL = 'https://lyxzqejagdwkrnpfemkd.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SERVICE_KEY) {
  console.error('Defina SUPABASE_SERVICE_KEY no ambiente antes de rodar.');
  process.exit(1);
}

const SOURCE_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const IMAGE_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
const BATCH_SIZE = 200;

const MUSCLE_MAP = {
  chest: 'peito',
  lats: 'costas',
  'middle back': 'costas',
  'lower back': 'costas',
  traps: 'costas',
  neck: 'costas',
  quadriceps: 'pernas',
  hamstrings: 'pernas',
  calves: 'pernas',
  glutes: 'pernas',
  adductors: 'pernas',
  abductors: 'pernas',
  shoulders: 'ombros',
  biceps: 'biceps',
  forearms: 'biceps',
  triceps: 'triceps',
  abdominals: 'abdomen',
};

const EQUIPMENT_MAP = {
  barbell: 'barra',
  dumbbell: 'halter',
  machine: 'maquina',
  cable: 'polia',
  'body only': 'peso corporal',
};

async function main() {
  console.log('Baixando dataset...');
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`Falha ao baixar dataset: ${res.status}`);
  const list = await res.json();
  console.log(`${list.length} exercícios encontrados.`);

  const rows = list.map(ex => ({
    name: ex.name,
    name_pt: null,
    muscle_group: MUSCLE_MAP[ex.primaryMuscles?.[0]] || 'peito',
    equipment: EQUIPMENT_MAP[ex.equipment] || null,
    level: ex.level || null,
    instructions: Array.isArray(ex.instructions) ? ex.instructions.join('\n') : null,
    image_urls: (ex.images || []).map(img => IMAGE_BASE + img),
  }));

  console.log('Inserindo no Supabase em lotes...');
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/library_exercises`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(batch),
    });

    if (!insertRes.ok) {
      const text = await insertRes.text();
      throw new Error(`Falha ao inserir lote ${i}: ${insertRes.status} ${text}`);
    }

    console.log(`Lote ${Math.floor(i / BATCH_SIZE) + 1} inserido (${batch.length} itens).`);
  }

  console.log('Importação concluída.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
