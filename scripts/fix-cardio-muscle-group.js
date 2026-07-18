// scripts/fix-cardio-muscle-group.js
// Corrige exercícios de categoria "cardio" que foram importados com muscle_group
// errado (import-library.js não tratava essa categoria e usava 'peito' como fallback).
// Roda uma vez, localmente — não faz parte do app.
//
// Uso (PowerShell):
//   $env:SUPABASE_SERVICE_KEY="sua_service_key_aqui"
//   node scripts/fix-cardio-muscle-group.js

const SUPABASE_URL = 'https://lyxzqejagdwkrnpfemkd.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SERVICE_KEY) {
  console.error('Defina SUPABASE_SERVICE_KEY no ambiente antes de rodar.');
  process.exit(1);
}

const SOURCE_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';

async function main() {
  console.log('Baixando dataset...');
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`Falha ao baixar dataset: ${res.status}`);
  const list = await res.json();

  const cardioNames = list.filter(ex => ex.category === 'cardio').map(ex => ex.name);
  console.log(`${cardioNames.length} exercícios de cardio encontrados no dataset.`);

  let fixed = 0;
  for (const name of cardioNames) {
    const url = `${SUPABASE_URL}/rest/v1/library_exercises?name=eq.${encodeURIComponent(name)}&muscle_group=neq.cardio`;
    const updateRes = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ muscle_group: 'cardio' }),
    });

    if (!updateRes.ok) {
      const text = await updateRes.text();
      throw new Error(`Falha ao atualizar "${name}": ${updateRes.status} ${text}`);
    }

    const updated = await updateRes.json();
    if (updated.length > 0) {
      fixed += updated.length;
      console.log(`Corrigido: ${name}`);
    }
  }

  console.log(`Concluído. ${fixed} exercício(s) corrigido(s) para muscle_group = 'cardio'.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
