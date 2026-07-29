const SUPABASE_URL = 'https://lyxzqejagdwkrnpfemkd.supabase.co';

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
    const { workout_name, exercises } = req.body;

    if (!workout_name || !Array.isArray(exercises) || exercises.length === 0) {
      return res.status(400).json({ error: 'Ficha vazia — adicione ao menos um exercício antes de pedir a avaliação.' });
    }

    const prompt = buildPrompt(workout_name, exercises);
    const feedback = await callClaudeForReview(prompt);

    if (!feedback) {
      return res.status(502).json({ error: 'Não consegui avaliar a ficha agora. Tente de novo em instantes.' });
    }

    return res.status(200).json({ feedback });

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

Dê um parecer curto e direto em português (máximo ~150 palavras), cobrindo:
- Pontos fortes da ficha
- Pontos fracos ou riscos (ex: ordem de execução ruim, volume desbalanceado entre grupos, descanso incoerente, exercício redundante ou faltando)
- Sugestões concretas de ajuste

Responda em texto simples (sem markdown, sem JSON), direto ao aluno.`;
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
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    if (attempt < 2) return callClaudeForReview(prompt, attempt + 1);
    return null;
  }

  const data = await response.json();
  const text = data.content?.[0]?.text?.trim();
  return text || null;
}
