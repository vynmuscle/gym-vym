const SUPABASE_URL = 'https://lyxzqejagdwkrnpfemkd.supabase.co';

// CORS + método + autenticação Supabase -- igual nos 5 endpoints de IA.
// Em caso de falha já escreve a resposta de erro em `res` e retorna null;
// o handler só precisa checar `if (!userId) return;`.
export async function authenticateRequest(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://gym-vym.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return null;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return null;
  }

  const auth = req.headers['authorization'];
  if (!auth?.startsWith('Bearer ')) {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }

  const token = auth.slice(7);
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: process.env.SUPABASE_SERVICE_KEY },
  });
  if (!authRes.ok) {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }

  const { id: userId } = await authRes.json();
  return userId;
}
