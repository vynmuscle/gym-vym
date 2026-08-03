import { checkRateLimit } from './_rateLimit.js';

const SUPABASE_URL = 'https://lyxzqejagdwkrnpfemkd.supabase.co';

const MUSCLE_GROUPS = ['peito', 'costas', 'pernas', 'ombros', 'biceps', 'triceps', 'abdomen', 'gluteos', 'cardio'];
const EQUIPMENT_OPTIONS = ['barra', 'halter', 'maquina', 'polia', 'peso corporal'];

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
  const { id: userId } = await authRes.json();

  const allowed = await checkRateLimit(userId, 'ai-review-workout', 20);
  if (!allowed) return res.status(429).json({ error: 'Limite diário de avaliações por IA atingido. Tente novamente amanhã.' });

  try {
    const { workout_name, exercises } = req.body;

    if (!workout_name || !Array.isArray(exercises) || exercises.length === 0) {
      return res.status(400).json({ error: 'Ficha vazia — adicione ao menos um exercício antes de pedir a avaliação.' });
    }

    const prompt = buildPrompt(workout_name, exercises);
    const result = await callClaudeForReview(prompt);

    if (!result) {
      return res.status(502).json({ error: 'Não consegui avaliar a ficha agora. Tente de novo em instantes.' });
    }

    return res.status(200).json(result);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno' });
  }
}

function buildPrompt(workoutName, exercises) {
  const lista = exercises.map((ex, i) => {
    const vol = ex.isDuration
      ? `${Math.round((ex.target_duration_seconds || 0) / 60)}min`
      : `${ex.target_sets}x${ex.target_reps || '?'}`;
    return `${i + 1}. ${ex.name} (${ex.muscle_group}${ex.equipment ? ', ' + ex.equipment : ''}) — ${vol}, descanso ${ex.rest_seconds}s`;
  }).join('\n');

  return `Você é um personal trainer experiente. Avalie a ficha de treino montada manualmente por um aluno, na ordem de execução em que ele colocou:

Ficha: ${workoutName}
${lista}

Responda APENAS com JSON válido, sem markdown, sem texto antes ou depois, no formato exato:
{
  "feedback": "Parecer curto e direto em português (máximo ~150 palavras): pontos fortes, pontos fracos/riscos (ordem ruim, volume desbalanceado, descanso incoerente, exercício redundante ou faltando) e o que foi ajustado abaixo.",
  "exercises": [
    { "name": "Supino reto com barra", "muscle_group": "peito", "equipment": "barra", "target_sets": 4, "target_reps": "8-12", "rest_seconds": 90, "notes": null, "is_duration": false, "target_duration_seconds": null }
  ]
}

O array "exercises" é a MESMA ficha, mas na ordem e configuração corrigidas por você (pode reordenar, ajustar séries/reps/descanso, remover redundância, sugerir 1 exercício novo se fizer falta clara — sem exagerar). Mantenha exercícios de cardio ("is_duration": true, com "target_duration_seconds" em segundos) sempre por último. Sempre inclua TODOS os exercícios da ficha original nesse array (corrigidos), não deixe nenhum de fora.

muscle_group deve ser exatamente um destes valores: ${MUSCLE_GROUPS.join(', ')}.
equipment deve ser exatamente um destes valores (ou vazio): ${EQUIPMENT_OPTIONS.join(', ')}.`;
}

function isValidResult(parsed) {
  if (!parsed || typeof parsed.feedback !== 'string' || !Array.isArray(parsed.exercises) || parsed.exercises.length === 0) return false;
  return parsed.exercises.every(ex => typeof ex.name === 'string');
}

async function callClaudeForReview(prompt, attempt = 1) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    if (attempt < 2) return callClaudeForReview(prompt, attempt + 1);
    return null;
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || '';

  try {
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    if (!isValidResult(parsed)) throw new Error('formato inválido');
    return parsed;
  } catch (err) {
    if (attempt < 2) return callClaudeForReview(prompt, attempt + 1);
    return null;
  }
}
