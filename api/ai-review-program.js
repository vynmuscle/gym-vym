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

  const allowed = await checkRateLimit(userId, 'ai-review-program', 20);
  if (!allowed) return res.status(429).json({ error: 'Limite diário de avaliações por IA atingido. Tente novamente amanhã.' });

  try {
    const { workouts } = req.body;

    if (!Array.isArray(workouts) || workouts.length === 0) {
      return res.status(400).json({ error: 'Nenhuma ficha ativa encontrada pra avaliar.' });
    }

    const prompt = buildPrompt(workouts);
    const result = await callClaudeForReview(prompt);

    if (!result) {
      return res.status(502).json({ error: 'Não consegui avaliar o programa agora. Tente de novo em instantes.' });
    }

    return res.status(200).json(result);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno' });
  }
}

function buildPrompt(workouts) {
  const fichas = workouts.map(w => {
    const lista = w.exercises.map((ex, i) => {
      const vol = ex.isDuration
        ? `${Math.round((ex.target_duration_seconds || 0) / 60)}min`
        : `${ex.target_sets}x${ex.target_reps || '?'}`;
      return `  ${i + 1}. ${ex.name} (${ex.muscle_group}${ex.equipment ? ', ' + ex.equipment : ''}) — ${vol}, descanso ${ex.rest_seconds}s`;
    }).join('\n');
    return `${w.name}:\n${lista}`;
  }).join('\n\n');

  return `Você é um personal trainer experiente. Avalie o programa de treino completo abaixo — as fichas ativas de um aluno, cada uma na ordem de execução que ele montou:

${fichas}

Responda APENAS com JSON válido, sem markdown, sem texto antes ou depois, no formato exato:
{
  "feedback": "Parecer curto e direto em português (máximo ~250 palavras) sobre o PROGRAMA COMO UM TODO: divisão entre fichas, exercícios redundantes entre fichas diferentes, volume semanal por grupo muscular, e o que foi ajustado abaixo.",
  "workouts": [
    {
      "name": "Nome EXATO de uma das fichas acima",
      "exercises": [
        { "name": "Supino reto com barra", "muscle_group": "peito", "equipment": "barra", "target_sets": 4, "target_reps": "8-12", "rest_seconds": 90, "notes": null, "is_duration": false, "target_duration_seconds": null }
      ]
    }
  ]
}

O campo "workouts" deve conter TODAS as fichas ativas listadas acima (use o "name" EXATAMENTE igual ao original pra eu conseguir casar), cada uma com seus exercícios corrigidos (pode mover exercício redundante de uma ficha pra outra, reordenar, ajustar séries/reps/descanso, remover redundância). Não invente uma ficha nova que não esteja na lista original. Mantenha exercícios de cardio ("is_duration": true, com "target_duration_seconds" em segundos) sempre por último em cada ficha.

muscle_group deve ser exatamente um destes valores: ${MUSCLE_GROUPS.join(', ')}.
equipment deve ser exatamente um destes valores (ou vazio): ${EQUIPMENT_OPTIONS.join(', ')}.`;
}

function isValidResult(parsed) {
  if (!parsed || typeof parsed.feedback !== 'string' || !Array.isArray(parsed.workouts) || parsed.workouts.length === 0) return false;
  return parsed.workouts.every(w =>
    typeof w.name === 'string' &&
    Array.isArray(w.exercises) &&
    w.exercises.every(ex => typeof ex.name === 'string')
  );
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
      max_tokens: 4096,
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
