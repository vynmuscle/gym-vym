// scripts/translate-library.js
// Traduz name/instructions de library_exercises para pt-BR via Claude.
// Roda uma vez localmente — pode ser re-rodado, continua de onde parou
// (busca só registros com name_pt nulo).
//
// Uso (PowerShell):
//   $env:SUPABASE_SERVICE_KEY="sua_service_key_aqui"
//   $env:ANTHROPIC_API_KEY="sua_chave_anthropic_aqui"
//   node scripts/translate-library.js

const SUPABASE_URL = 'https://lyxzqejagdwkrnpfemkd.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!SERVICE_KEY) {
  console.error('Defina SUPABASE_SERVICE_KEY no ambiente antes de rodar.');
  process.exit(1);
}
if (!ANTHROPIC_API_KEY) {
  console.error('Defina ANTHROPIC_API_KEY no ambiente antes de rodar.');
  process.exit(1);
}

const BATCH_SIZE = 25;
const PAUSE_MS = 2000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPending() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/library_exercises?name_pt=is.null&select=id,name,instructions&order=name`,
    {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    }
  );
  if (!res.ok) throw new Error(`Falha ao buscar pendentes: ${res.status} ${await res.text()}`);
  return res.json();
}

function buildPrompt(batch) {
  const input = batch.map(ex => ({ id: ex.id, name: ex.name, instructions: ex.instructions || '' }));

  return `Você é um tradutor especializado em musculação e educação física, com profundo conhecimento da terminologia usada em academias brasileiras.

Traduza o "name" e as "instructions" de cada exercício abaixo para português do Brasil, usando a terminologia real de academia (NÃO tradução literal). Exemplos: "Bench Press" → "Supino reto", "Lat Pulldown" → "Puxada frontal", "Deadlift" → "Levantamento terra", "Curl" → "Rosca".

Exercícios:
${JSON.stringify(input, null, 2)}

Responda APENAS com um JSON array válido, sem markdown, sem texto antes ou depois, no formato exato:
[
  { "id": "mesmo id de entrada", "name_pt": "...", "instructions_pt": "..." }
]

Mantenha exatamente o mesmo "id" de cada item de entrada. Traduza as instructions completas, mantendo as quebras de linha entre os passos.`;
}

function isValidResult(parsed, batch) {
  if (!Array.isArray(parsed) || parsed.length !== batch.length) return false;
  const batchIds = new Set(batch.map(ex => ex.id));
  return parsed.every(item =>
    typeof item.id === 'string' && batchIds.has(item.id) &&
    typeof item.name_pt === 'string' && item.name_pt.length > 0
  );
}

async function translateBatch(batch, attempt = 1) {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        messages: [{ role: 'user', content: buildPrompt(batch) }],
      }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);

    const data = await res.json();
    const text = data.content?.[0]?.text || '';

    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    if (!isValidResult(parsed, batch)) throw new Error('formato inválido');
    return parsed;
  } catch (err) {
    if (attempt < 2) return translateBatch(batch, attempt + 1);
    console.warn(`  Erro no lote: ${err.message}`);
    return null;
  }
}

async function updateExercise(id, namePt, instructionsPt) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/library_exercises?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ name_pt: namePt, instructions_pt: instructionsPt || '' }),
  });
  if (!res.ok) throw new Error(`Falha ao atualizar ${id}: ${res.status} ${await res.text()}`);
}

async function main() {
  console.log('Buscando exercícios pendentes de tradução...');
  const pending = await fetchPending();
  console.log(`${pending.length} exercícios pendentes.`);

  if (pending.length === 0) {
    console.log('Nada a traduzir.');
    return;
  }

  const totalBatches = Math.ceil(pending.length / BATCH_SIZE);
  const skipped = [];
  let translated = 0;

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    console.log(`Lote ${batchNum} de ${totalBatches} (${batch.length} exercícios)...`);

    const results = await translateBatch(batch);

    if (!results) {
      console.warn(`  Lote ${batchNum} falhou após retry — pulando.`);
      skipped.push(...batch.map(ex => ex.id));
    } else {
      for (const item of results) {
        try {
          await updateExercise(item.id, item.name_pt, item.instructions_pt);
          translated++;
        } catch (err) {
          console.warn(`  Falha ao salvar ${item.id}: ${err.message}`);
          skipped.push(item.id);
        }
      }
      console.log(`  Lote ${batchNum} traduzido e salvo.`);
    }

    if (i + BATCH_SIZE < pending.length) await sleep(PAUSE_MS);
  }

  console.log('\nResumo:');
  console.log(`  Traduzidos: ${translated}`);
  console.log(`  Pulados: ${skipped.length}`);
  if (skipped.length > 0) {
    console.log('  IDs pulados:', skipped.join(', '));
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
