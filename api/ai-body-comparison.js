import { checkRateLimit } from './_rateLimit.js';

const SUPABASE_URL = 'https://lyxzqejagdwkrnpfemkd.supabase.co';

const PROMPT = `Você é um personal trainer experiente analisando a evolução física de um aluno a partir de duas fotos de progresso (a primeira imagem é a mais antiga, a segunda é a mais recente).

Analise, em português, de forma direta e objetiva (máximo ~180 palavras):
1. Definição muscular e massa magra — o que mudou entre as fotos.
2. Composição corporal (gordura visível) — estimativa VISUAL apenas, deixando claro que não é uma medição real (não é bioimpedância nem DEXA).
3. Postura — mudanças perceptíveis (ombros, coluna, alinhamento).

Seja honesto mesmo se a mudança for pequena ou não visível. Não dê conselhos médicos. Responda em texto corrido, sem markdown, sem JSON — só o parecer.`;

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

  const allowed = await checkRateLimit(userId, 'ai-body-comparison', 5);
  if (!allowed) return res.status(429).json({ error: 'Limite diário de análises por IA atingido. Tente novamente amanhã.' });

  try {
    const { image1_base64, image2_base64, date1, date2 } = req.body;

    if (!image1_base64 || !image2_base64) {
      return res.status(400).json({ error: 'As duas fotos são obrigatórias.' });
    }

    const analysis = await callClaudeForComparison(image1_base64, image2_base64, date1, date2);

    if (!analysis) {
      return res.status(502).json({ error: 'Não consegui analisar as fotos agora. Tente de novo em instantes.' });
    }

    return res.status(200).json({ analysis });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno' });
  }
}

async function callClaudeForComparison(image1, image2, date1, date2, attempt = 1) {
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
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: `Foto 1 (${date1 || 'mais antiga'}):` },
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image1 } },
          { type: 'text', text: `Foto 2 (${date2 || 'mais recente'}):` },
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image2 } },
          { type: 'text', text: PROMPT }
        ]
      }],
    }),
  });

  if (!response.ok) {
    if (attempt < 2) return callClaudeForComparison(image1, image2, date1, date2, attempt + 1);
    return null;
  }

  const data = await response.json();
  const text = data.content?.[0]?.text?.trim();
  if (!text) {
    if (attempt < 2) return callClaudeForComparison(image1, image2, date1, date2, attempt + 1);
    return null;
  }

  return text;
}
