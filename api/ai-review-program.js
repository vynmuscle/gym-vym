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
    const { workouts } = req.body;

    if (!Array.isArray(workouts) || workouts.length === 0) {
      return res.status(400).json({ error: 'Nenhuma ficha ativa encontrada pra avaliar.' });
    }

    const prompt = buildPrompt(workouts);
    const feedback = await callClaudeForReview(prompt);

    if (!feedback) {
      return res.status(502).json({ error: 'Não consegui avaliar o programa agora. Tente de novo em instantes.' });
    }

    return res.status(200).json({ feedback });

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

Dê um parecer curto e direto em português (máximo ~250 palavras) sobre o PROGRAMA COMO UM TODO (não ficha por ficha isolada), cobrindo:
- Se a divisão entre as fichas faz sentido (grupos musculares bem distribuídos, sem sobrecarga nem grupo esquecido)
- Exercícios redundantes entre fichas diferentes (ex: mesmo movimento repetido sem necessidade)
- Se o volume total por grupo muscular na semana parece adequado
- Sugestões concretas de ajuste na estrutura do programa

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
      max_tokens: 1536,
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
