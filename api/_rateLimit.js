const SUPABASE_URL = 'https://lyxzqejagdwkrnpfemkd.supabase.co';

function sbHeaders() {
  return {
    apikey: process.env.SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
  };
}

// Conta as chamadas do usuário nesse endpoint desde a meia-noite; se ainda
// estiver dentro do limite, registra a chamada atual e retorna true.
// Em caso de falha ao checar, libera a chamada (não trava o usuário por erro nosso).
export async function checkRateLimit(userId, endpoint, limitPerDay) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const countResp = await fetch(
    `${SUPABASE_URL}/rest/v1/api_usage?user_id=eq.${userId}&endpoint=eq.${encodeURIComponent(endpoint)}&used_at=gte.${startOfDay.toISOString()}&select=id`,
    { headers: { ...sbHeaders(), Prefer: 'count=exact' } }
  );
  if (!countResp.ok) return true;

  const contentRange = countResp.headers.get('content-range');
  const total = contentRange ? Number(contentRange.split('/')[1]) : (await countResp.json()).length;
  if (total >= limitPerDay) return false;

  await fetch(`${SUPABASE_URL}/rest/v1/api_usage`, {
    method: 'POST',
    headers: { ...sbHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, endpoint }),
  });

  return true;
}
