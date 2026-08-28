import { checkRateLimit } from './_rateLimit.js';

const SUPABASE_URL = 'https://lyxzqejagdwkrnpfemkd.supabase.co';

const PROMPT = `Você é um coach de fisiculturismo/preparação física com olho clínico treinado em avaliação visual de físico (o tipo de análise que um coach faz numa foto de "check-in" de aluno). Vai comparar duas fotos de progresso do mesmo aluno (primeira imagem = mais antiga, segunda imagem = mais recente) e dar um parecer honesto, técnico mas acessível, em português.

Baseie a leitura em sinais visuais concretos, não em impressão geral — cite o que especificamente mudou (ou não) em cada ponto:

1. DEFINIÇÃO MUSCULAR E MASSA MAGRA: separação entre grupos musculares, estriações/vascularização visíveis, volume aparente de ombros/braços/costas/pernas, presença ou não de "V-taper" (cintura x ombros). Compare grupo a grupo o que for visível nas fotos (nem sempre dá pra ver pernas, por exemplo — só comente o que a foto mostra).

2. COMPOSIÇÃO CORPORAL (gordura visível): distribuição de gordura subcutânea (abdômen, flancos, lombar, quadril), nitidez de vincos/linhas abdominais, "inchaço"/retenção aparente vs. secura. Dê uma leitura qualitativa (ex: "reduziu bastante no abdômen, pouca mudança nos flancos") — só estime uma faixa percentual de % de gordura se os sinais visuais forem realmente claros o suficiente pra isso, e SEMPRE deixe explícito que é um chute visual grosseiro, não uma medição (nada substitui bioimpedância, DEXA ou adipômetro).

3. POSTURA: alinhamento de ombros, curvatura da coluna (cifose/lordose aparente), inclinação pélvica, simetria lateral — só comente o que for realmente perceptível nas fotos, sem forçar achado.

Regras:
- Seja honesto mesmo se a mudança for pequena, ambígua ou não houver mudança visível nítida — não infle elogios pra soar positivo.
- Se o ângulo, iluminação ou enquadramento das fotos dificultar alguma leitura, diga isso em vez de arriscar um palpite.
- Não dê conselhos médicos nem prescreva treino/dieta — isso não é o que foi pedido aqui, é só o parecer visual.
- Responda em texto corrido dividido em parágrafos curtos (um por tópico acima), sem markdown, sem listas numeradas, sem JSON — linguagem direta, sem enrolação, máximo ~200 palavras.
- NUNCA mencione datas, meses ou anos específicos — você não tem como saber quando cada foto foi tirada só pela imagem (o app já mostra a data certa na tela). Refira-se só a "a foto mais antiga" e "a foto mais recente".`;

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
    const { image1_base64, image2_base64 } = req.body;

    if (!image1_base64 || !image2_base64) {
      return res.status(400).json({ error: 'As duas fotos são obrigatórias.' });
    }

    const analysis = await callClaudeForComparison(image1_base64, image2_base64);

    if (!analysis) {
      return res.status(502).json({ error: 'Não consegui analisar as fotos agora. Tente de novo em instantes.' });
    }

    return res.status(200).json({ analysis });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno' });
  }
}

async function callClaudeForComparison(image1, image2, attempt = 1) {
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
          { type: 'text', text: 'Foto mais antiga:' },
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image1 } },
          { type: 'text', text: 'Foto mais recente:' },
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image2 } },
          { type: 'text', text: PROMPT }
        ]
      }],
    }),
  });

  if (!response.ok) {
    if (attempt < 2) return callClaudeForComparison(image1, image2, attempt + 1);
    return null;
  }

  const data = await response.json();
  const text = data.content?.[0]?.text?.trim();
  if (!text) {
    if (attempt < 2) return callClaudeForComparison(image1, image2, attempt + 1);
    return null;
  }

  return text;
}
