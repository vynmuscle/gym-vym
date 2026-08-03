const SUPABASE_URL = 'https://lyxzqejagdwkrnpfemkd.supabase.co';

export default async function handler(req, res) {

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = req.headers['authorization'];
  if (!auth?.startsWith('Bearer ')) return res.status(403).json({ error: 'Forbidden' });
  const token = auth.slice(7);

  const rawBody = await readRawBody(req);
  const contentType = req.headers['content-type'] || '';
  let payload;
  try {
    payload = contentType.includes('application/json')
      ? JSON.parse(rawBody)
      : parseForm(rawBody);
  } catch (err) {
    console.error('Corpo inválido recebido do Shortcut:', rawBody);
    return res.status(400).json({ error: 'Corpo inválido', raw: rawBody });
  }

  try {
    const userId = await findUserByToken(token);
    if (!userId) return res.status(403).json({ error: 'Forbidden' });

    const date = payload.date;
    if (!date) return res.status(400).json({ error: 'date é obrigatório' });

    const steps = toNum(payload.steps);
    const calories_total = toNum(payload.calories_total);
    await upsertDailyStats(userId, date, steps, calories_total);

    const avg_heart_rate = toNum(payload.avg_heart_rate);
    const max_heart_rate = toNum(payload.max_heart_rate);
    const workout_calories = toNum(payload.workout_calories);
    const workout_duration_seconds = toNum(payload.workout_duration_seconds);
    if (avg_heart_rate != null || max_heart_rate != null || workout_calories != null || workout_duration_seconds != null) {
      await applyWorkoutMetrics(userId, { avg_heart_rate, max_heart_rate, calories: workout_calories, duration_seconds: workout_duration_seconds });
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno' });
  }
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

// Corpo enviado como Formulário (application/x-www-form-urlencoded) pelo
// Shortcut — campo vazio vira string vazia em vez de quebrar a sintaxe,
// diferente do JSON montado à mão.
function parseForm(rawBody) {
  const obj = {};
  for (const [key, value] of new URLSearchParams(rawBody)) obj[key] = value;
  return obj;
}

function toNum(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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
