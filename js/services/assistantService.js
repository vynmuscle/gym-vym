import { supabase } from '../supabaseClient.js';
import {
  getMuscleRecovery, getSessionDatesInRange, listCompletedSessions, getUserXP,
  getRecentlyTrainedExercises, getExerciseProgress
} from './workoutService.js';

// Limite de exercícios verificados por chamada -- evita N+1 grande (só
// dispara quando o usuário pede a avaliação, não em toda tela de Progresso).
const MAX_STAGNATION_CHECKS = 8;

// "Estagnado" = peso máximo não subiu nas últimas 3 sessões desse exercício.
// Sinal aproximado (não usa target_reps/RPE como o motor de progressão
// de verdade) -- serve só pra alimentar o assistente, não decide nada.
async function findStagnantExercises() {
  const recent = await getRecentlyTrainedExercises(21);
  const bounded = recent.slice(0, MAX_STAGNATION_CHECKS);

  const results = await Promise.all(bounded.map(async ({ id, name }) => {
    const progress = await getExerciseProgress(id);
    const last3 = progress.filter(s => s.maxWeight > 0).slice(-3);
    if (last3.length < 3) return null;
    const stagnant = last3.every(s => s.maxWeight <= last3[0].maxWeight);
    return stagnant ? name : null;
  }));

  return results.filter(Boolean);
}

// Número de sessões (peso/reps) por exercício que o assistente enxerga.
// Antes o contexto só mandava um "estagnado sim/não" -- sem os números, a
// IA não tinha como avaliar progressão de verdade, só repetir que não tinha
// dado suficiente. Isso dá pra ela o mesmo histórico que o app mostra na
// tela de cada exercício, dentro de um orçamento de caracteres controlado.
const MAX_TREND_EXERCISES = 10;
const MAX_TREND_SESSIONS = 4;

async function buildExerciseTrends() {
  const recent = await getRecentlyTrainedExercises(30);
  // Pool maior que MAX_TREND_EXERCISES porque exercícios de cardio/duração
  // são descartados depois (sem peso/reps) -- sem folga, um treino recente
  // cheio de esteira/bike empurraria exercício de carga de verdade pra fora.
  const bounded = recent.slice(0, MAX_TREND_EXERCISES * 2);

  const results = await Promise.all(bounded.map(async ({ id, name }) => {
    const progress = await getExerciseProgress(id);
    // Só exercícios de carga (peso/reps) -- cardio/duração não tem "progressão"
    // nesse sentido e só geraria linhas de peso/reps nulos pro assistente.
    const last = progress.filter(s => s.maxWeight > 0).slice(-MAX_TREND_SESSIONS);
    if (last.length === 0) return null;

    return {
      nome: name,
      sessoes: last.map(s => ({
        data: s.date?.slice(0, 10),
        peso: s.maxWeight || null,
        reps: s.topReps || null,
        rpe: s.topRpe ?? null
      }))
    };
  }));

  return results.filter(Boolean).slice(0, MAX_TREND_EXERCISES);
}

// Mesma chave de js/index.js (CHECKIN_STORAGE_KEY) — check-in de disposição
// é só local (localStorage), não tem tabela própria.
function todaysCheckin(userId) {
  try {
    const raw = localStorage.getItem(`gymvym_checkin_${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return parsed.date === todayStr ? parsed.feeling : null;
  } catch {
    return null;
  }
}

const CHECKIN_LABELS = {
  mal: 'dormiu mal', normal: 'disposição normal', otimo: 'disposição ótima', cansado: 'está cansado(a)'
};

// Contexto compacto (não dump completo do histórico) que o assistente usa
// pra responder — monta a partir de serviços que já existem, sem query nova
// além das que a tela Início/Progresso já fazem.
export async function buildAssistantContext() {
  const now = new Date();
  const weekStart = new Date(now);
  const day = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() + (day === 0 ? -6 : 1 - day));
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const [{ data: sd }, recovery, weekSessions, recentSessions, xp, exerciciosEstagnados, progressaoExercicios] = await Promise.all([
    supabase.auth.getSession(),
    getMuscleRecovery(),
    getSessionDatesInRange(weekStart.toISOString(), weekEnd.toISOString()),
    listCompletedSessions(8),
    getUserXP(),
    findStagnantExercises(),
    buildExerciseTrends()
  ]);

  const checkin = todaysCheckin(sd.session?.user?.id);

  return {
    xp,
    treinosEstaSemana: weekSessions.length,
    recuperacaoPorGrupo: recovery.map(r => ({
      grupo: r.group, status: r.status,
      diasDesdeUltimo: r.hoursSince != null ? Math.floor(r.hoursSince / 24) : null
    })),
    ultimasSessoes: recentSessions.slice(0, 8).map(s => ({
      ficha: s.workouts ? s.workouts.name : 'Treino avulso',
      data: s.started_at?.slice(0, 10)
    })),
    ...(exerciciosEstagnados.length > 0 ? { exerciciosEstagnados } : {}),
    ...(progressaoExercicios.length > 0 ? { progressaoExercicios } : {}),
    ...(checkin ? { disposicaoHoje: CHECKIN_LABELS[checkin] || checkin } : {})
  };
}

export async function askAssistant(question, context) {
  const { data: sd } = await supabase.auth.getSession();
  const token = sd.session?.access_token;

  const res = await fetch('/api/ai-assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ question, context })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Não consegui responder agora.');
  return data.answer;
}
