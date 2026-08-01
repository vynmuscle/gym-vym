const SUPABASE_URL = 'https://lyxzqejagdwkrnpfemkd.supabase.co';

export default async function handler(req, res) {

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = req.headers['authorization'];
  if (!auth?.startsWith('Bearer ')) return res.status(403).json({ error: 'Forbidden' });
  const token = auth.slice(7);

  try {
    const userId = await findUserByToken(token);
    if (!userId) return res.status(403).json({ error: 'Forbidden' });

    const { date, steps, calories_total, workout } = req.body || {};
    if (!date) return res.status(400).json({ error: 'date é obrigatório' });

    await upsertDailyStats(userId, date, steps, calories_total);

    if (workout) {
      await applyWorkoutMetrics(userId, workout);
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno' });
  }
}

async function findUserByToken(token) {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/user_settings?health_sync_token=eq.${encodeURIComponent(token)}&select=user_id`,
    { headers: sbHeaders() }
  );
  if (!resp.ok) return null;
  const rows = await resp.json();
  return rows[0]?.user_id || null;
}

async function upsertDailyStats(userId, date, steps, calories_total) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/daily_health_stats?on_conflict=user_id,date`, {
    method: 'POST',
    headers: { ...sbHeaders(), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify([{ user_id: userId, date, steps, calories_total, updated_at: new Date().toISOString() }]),
  });
  if (!resp.ok) throw new Error(`upsertDailyStats falhou: ${await resp.text()}`);
}

// Vincula os dados do watch à sessão de treino finalizada mais recente do
// usuário no dia, ainda sem dado de watch preenchido — o Shortcut roda
// depois que o treino já foi encerrado no app.
async function applyWorkoutMetrics(userId, workout) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const sessionResp = await fetch(
    `${SUPABASE_URL}/rest/v1/workout_sessions?user_id=eq.${userId}&finished_at=not.is.null&watch_calories=is.null&started_at=gte.${startOfDay.toISOString()}&select=id&order=started_at.desc&limit=1`,
    { headers: sbHeaders() }
  );
  if (!sessionResp.ok) throw new Error(`buscar sessão falhou: ${await sessionResp.text()}`);
  const sessions = await sessionResp.json();
  const session = sessions[0];
  if (!session) return;

  const updateResp = await fetch(`${SUPABASE_URL}/rest/v1/workout_sessions?id=eq.${session.id}`, {
    method: 'PATCH',
    headers: { ...sbHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      avg_heart_rate: workout.avg_heart_rate ?? null,
      max_heart_rate: workout.max_heart_rate ?? null,
      watch_calories: workout.calories ?? null,
      watch_duration_seconds: workout.duration_seconds ?? null,
    }),
  });
  if (!updateResp.ok) throw new Error(`atualizar sessão falhou: ${await updateResp.text()}`);
}

function sbHeaders() {
  return {
    apikey: process.env.SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
  };
}
