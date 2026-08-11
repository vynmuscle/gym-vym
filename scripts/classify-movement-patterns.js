// scripts/classify-movement-patterns.js
// Classifica os exercícios de library_exercises por padrão de movimento
// principal, usando o dataset original free-exercise-db (force/mechanic/
// category) + palavras-chave no nome pra separar o que o dataset sozinho
// não distingue (empurrar horizontal x vertical, agachamento x dobradiça
// de quadril, golpes olímpicos/strongman ficam fora — heterogêneos demais
// pra virar 1:1 de substituição). Roda uma vez — ou de novo se a biblioteca
// for reimportada (scripts/import-library.js).
//
// Não escreve no Supabase sozinho: gera o UPDATE em massa num arquivo .sql
// local, que depois é aplicado no SQL Editor do Supabase (ou via MCP).
//
// Uso:
//   node scripts/classify-movement-patterns.js
//   → gera movement_patterns_update.sql na raiz do projeto

const fs = require('fs');

const SOURCE_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const OUTPUT_FILE = 'movement_patterns_update.sql';

function classify(ex) {
  const name = ex.name.toLowerCase();

  if (ex.category === 'stretching' || ex.category === 'plyometrics') return null;
  if (ex.category === 'cardio' || /\bbike\b|elliptical|treadmill|rowing.?machine|stairmaster|stepmill/.test(name)) return 'cardio';
  if (/clean and jerk|\bclean\b|\bsnatch\b|\bjerk\b|thruster/.test(name)) return 'outro';

  // Nome manda mais que a categoria pra padrão de movimento — pega antes do
  // fallback por force/mechanic, que é mais grosseiro.
  if (/squat|leg press|lunge|step.?up|hack squat|box jump/.test(name)) return 'agachamento';
  if (/deadlift|\brdl\b|good morning|hip thrust|glute bridge|kettlebell swing/.test(name)) return 'dobradica_quadril';
  if (/sit.?up|crunch|\bplank\b|leg raise|ab wheel|ab roller|ab rollout|rollout|hip raise|russian twist|wood chop|hyperextension|hollow|side bend/.test(name)) return 'core';
  if (/pulldown|pull.?up|chin.?up/.test(name)) return 'puxar_vertical';
  if (/\brow\b/.test(name)) return 'puxar_horizontal';
  if (/overhead press|military press|shoulder press|push press|arnold press/.test(name)) return 'empurrar_vertical';
  if (/bench press|floor press|chest press|push.?up|\bdip\b/.test(name)) return 'empurrar_horizontal';

  if (ex.mechanic === 'isolation') return 'isolamento';
  if (ex.category === 'strongman' || ex.category === 'olympic weightlifting') return 'outro';

  if (ex.category === 'strength' || ex.category === 'powerlifting') {
    if (ex.force === 'push') return 'empurrar_horizontal';
    if (ex.force === 'pull') return 'puxar_horizontal';
    if (ex.force === 'static') return 'core';
  }

  return 'outro';
}

async function main() {
  console.log('Baixando dataset...');
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`Falha ao baixar dataset: ${res.status}`);
  const list = await res.json();

  const classified = list
    .map(ex => ({ name: ex.name, pattern: classify(ex) }))
    .filter(c => c.pattern !== null);

  console.log(`${classified.length} de ${list.length} exercícios classificados (o resto fica sem padrão — alongamento, pliometria, golpes olímpicos/strongman).`);

  const values = classified
    .map(c => `('${c.name.replace(/'/g, "''")}', '${c.pattern}')`)
    .join(',\n');

  const sql = `update library_exercises le set movement_pattern = v.pattern
from (values
${values}
) as v(name, pattern)
where le.name = v.name;

-- Depois de rodar o UPDATE acima, faça o backfill de exercises (usuário):
update exercises e
set movement_pattern = l.movement_pattern
from library_exercises l
where (lower(l.name) = lower(e.name) or lower(l.name_pt) = lower(e.name))
  and l.movement_pattern is not null
  and e.movement_pattern is null;
`;

  fs.writeFileSync(OUTPUT_FILE, sql);
  console.log(`SQL gerado em ${OUTPUT_FILE} — aplique no SQL Editor do Supabase.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
