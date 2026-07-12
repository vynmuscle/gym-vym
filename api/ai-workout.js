const SUPABASE_URL = 'https://lyxzqejagdwkrnpfemkd.supabase.co';

const MUSCLE_GROUPS = ['peito', 'costas', 'pernas', 'ombros', 'biceps', 'triceps', 'abdomen', 'gluteos'];
const EQUIPMENT_OPTIONS = ['barra', 'halter', 'maquina', 'polia', 'peso corporal'];

// Quanto tempo (minutos) por treino -> orientação de volume pro prompt
const TIME_GUIDANCE = {
  '30': '4 a 5 exercícios, 3 séries cada',
  '45': '5 a 6 exercícios, 3 a 4 séries cada',
  '60': '6 a 7 exercícios, 3 a 4 séries cada',
  '90': '7 a 8 exercícios, 4 séries cada'
};

export default async function handler(req, res) {

  res.setHeader('Access-Control-Allow-Origin', 'https://gym-vym.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = req.headers['authorization'];
  if (!auth?.startsWith('Bearer ')) return res.status(403).json({ error: 'Forbidden' });
  const token = auth.slice(7);
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: process.env.SUPABASE_SERVICE_KEY },
  });
  if (!authRes.ok) return res.status(403).json({ error: 'Forbidden' });

  try {
    const { objetivo, nivel, dias_semana, equipamento, restricoes, tempo_treino } = req.body;

    if (!objetivo || !nivel || !dias_semana || !equipamento || !tempo_treino) {
      return res.status(400).json({ error: 'Preencha objetivo, nível, dias por semana, equipamento e tempo por treino.' });
    }

    const prompt = buildPrompt({ objetivo, nivel, dias_semana, equipamento, restricoes, tempo_treino });
    const result = await callClaudeForWorkout(prompt);

    if (!result) {
      return res.status(502).json({ error: 'Não consegui gerar o treino agora. Tente de novo em instantes.' });
    }

    return res.status(200).json(result);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno' });
  }
}

function buildPrompt({ objetivo, nivel, dias_semana, equipamento, restricoes, tempo_treino }) {
  const volumeGuidance = TIME_GUIDANCE[tempo_treino] || TIME_GUIDANCE['60'];

  return `Você é um personal trainer experiente e cuidadoso, especializado em montar fichas de treino de academia.

Monte uma divisão de treino com base em:
- Objetivo: ${objetivo}
- Nível: ${nivel}
- Dias de treino por semana: ${dias_semana}
- Tempo disponível por treino: ${tempo_treino} minutos
- Equipamento disponível: ${equipamento}
- Restrições ou lesões: ${restricoes || 'nenhuma informada'}

Monte exatamente ${dias_semana} ficha(s) de treino (uma por dia de treino), adequadas ao equipamento disponível e respeitando as restrições informadas. Ajuste o volume pro tempo disponível: aproximadamente ${volumeGuidance} — inclua descanso (rest_seconds) coerente com esse volume caber no tempo informado.

Responda APENAS com JSON válido, sem markdown, sem texto antes ou depois, no formato exato:
{
  "workouts": [
    {
      "name": "Treino A - Peito e Tríceps",
      "exercises": [
        { "name": "Supino reto", "muscle_group": "peito", "equipment": "barra", "target_sets": 4, "target_reps": "8-12", "rest_seconds": 90, "notes": "Foco na fase excêntrica" }
      ]
    }
  ],
  "rationale": "Explicação curta da estrutura do treino"
}

muscle_group deve ser exatamente um destes valores: ${MUSCLE_GROUPS.join(', ')}.
equipment deve ser exatamente um destes valores (ou vazio): ${EQUIPMENT_OPTIONS.join(', ')}.`;
}

function isValidResult(parsed) {
  if (!parsed || !Array.isArray(parsed.workouts) || parsed.workouts.length === 0) return false;
  return parsed.workouts.every(w =>
    typeof w.name === 'string' &&
    Array.isArray(w.exercises) &&
    w.exercises.every(ex => typeof ex.name === 'string' && ex.target_sets)
  );
}

async function callClaudeForWorkout(prompt, attempt = 1) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    if (attempt < 2) return callClaudeForWorkout(prompt, attempt + 1);
    return null;
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || '';

  try {
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    if (!isValidResult(parsed)) throw new Error('formato inválido');
    return parsed;
  } catch (err) {
    if (attempt < 2) return callClaudeForWorkout(prompt, attempt + 1);
    return null;
  }
}
