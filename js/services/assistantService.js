import { supabase } from '../supabaseClient.js';
import { getMuscleRecovery, getSessionDatesInRange, listCompletedSessions, getUserXP } from './workoutService.js';

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

  const [{ data: sd }, recovery, weekSessions, recentSessions, xp] = await Promise.all([
    supabase.auth.getSession(),
    getMuscleRecovery(),
    getSessionDatesInRange(weekStart.toISOString(), weekEnd.toISOString()),
    listCompletedSessions(8),
    getUserXP()
  ]);

  const checkin = todaysCheckin(sd.session?.user?.id);

  return {
    xp,
    treinosEstaSemana: weekSessions.length,
    recuperacaoPorGrupo: recovery.map(r => ({ grupo: r.group, status: r.status })),
    ultimasSessoes: recentSessions.slice(0, 8).map(s => ({
      ficha: s.workouts ? s.workouts.name : 'Treino avulso',
      data: s.started_at?.slice(0, 10)
    })),
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
