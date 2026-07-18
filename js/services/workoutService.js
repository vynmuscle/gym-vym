import { supabase } from '../supabaseClient.js';

export const MUSCLE_GROUPS = ['peito', 'costas', 'pernas', 'ombros', 'biceps', 'triceps', 'abdomen', 'gluteos'];
export const EXERCISE_GROUPS = [...MUSCLE_GROUPS, 'cardio'];
export const EQUIPMENT_OPTIONS = ['barra', 'halter', 'maquina', 'polia', 'peso corporal'];

export async function listExercises() {
  const { data, error } = await supabase.from('exercises').select('*').order('name');
  if (error) throw error;
  return data;
}

export async function createExercise(userId, payload) {
  const { data, error } = await supabase.from('exercises').insert({ ...payload, user_id: userId }).select().single();
  if (error) throw error;
  return data;
}

export async function updateExercise(id, payload) {
  const { data, error } = await supabase.from('exercises').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteExercise(id) {
  const { error } = await supabase.from('exercises').delete().eq('id', id);
  if (error) throw error;
}

export async function listWorkouts() {
  const { data, error } = await supabase.from('workouts').select('*').order('sort_order').order('created_at');
  if (error) throw error;
  return data;
}

export async function getWorkout(id) {
  const { data, error } = await supabase.from('workouts').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function createWorkout(userId, payload) {
  const { data, error } = await supabase.from('workouts').insert({ ...payload, user_id: userId }).select().single();
  if (error) throw error;
  return data;
}

export async function updateWorkout(id, payload) {
  const { data, error } = await supabase.from('workouts').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteWorkout(id) {
  const { error } = await supabase.from('workouts').delete().eq('id', id);
  if (error) throw error;
}

export async function listWorkoutExercises(workoutId) {
  const { data, error } = await supabase
    .from('workout_exercises')
    .select('*, exercises(name, muscle_group, equipment, image_url, instructions)')
    .eq('workout_id', workoutId)
    .order('sort_order');
  if (error) throw error;
  return data;
}

export async function swapWorkoutExerciseExercise(id, exerciseId) {
  const { data, error } = await supabase
    .from('workout_exercises')
    .update({ exercise_id: exerciseId })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function addWorkoutExercise(userId, payload) {
  const { data, error } = await supabase.from('workout_exercises').insert({ ...payload, user_id: userId }).select().single();
  if (error) throw error;
  return data;
}

export async function updateWorkoutExercise(id, payload) {
  const { data, error } = await supabase.from('workout_exercises').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function removeWorkoutExercise(id) {
  const { error } = await supabase.from('workout_exercises').delete().eq('id', id);
  if (error) throw error;
}

export async function createWorkoutSession(userId, workoutId) {
  const { data, error } = await supabase.from('workout_sessions').insert({ user_id: userId, workout_id: workoutId }).select().single();
  if (error) throw error;
  return data;
}

export async function finishWorkoutSession(id) {
  const { data, error } = await supabase.from('workout_sessions').update({ finished_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function getLastSets(exerciseId) {
  const { data, error } = await supabase
    .from('session_sets')
    .select('*')
    .eq('exercise_id', exerciseId)
    .order('completed_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  if (data.length === 0) return [];
  const lastSessionId = data[0].session_id;
  return data.filter(s => s.session_id === lastSessionId).sort((a, b) => a.set_number - b.set_number);
}

export async function recordSet(userId, payload) {
  const { data, error } = await supabase.from('session_sets').insert({ ...payload, user_id: userId }).select().single();
  if (error) throw error;
  return data;
}

export async function listCompletedSessions() {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('*, workouts(name)')
    .not('finished_at', 'is', null)
    .order('started_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function listIncompleteSessions() {
  const cutoff = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('*, workouts(name)')
    .is('finished_at', null)
    .lt('started_at', cutoff)
    .order('started_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getSessionSetsSummary(sessionIds) {
  if (sessionIds.length === 0) return {};
  const { data, error } = await supabase
    .from('session_sets')
    .select('session_id, reps, weight')
    .in('session_id', sessionIds);
  if (error) throw error;

  const summary = {};
  for (const row of data) {
    if (!summary[row.session_id]) summary[row.session_id] = { sets: 0, volume: 0 };
    summary[row.session_id].sets++;
    summary[row.session_id].volume += (row.weight || 0) * (row.reps || 0);
  }
  return summary;
}

export async function getSessionDetails(sessionId) {
  const { data, error } = await supabase
    .from('session_sets')
    .select('*, exercises(name, equipment, image_url)')
    .eq('session_id', sessionId)
    .order('completed_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function deleteSession(id) {
  const { error } = await supabase.from('workout_sessions').delete().eq('id', id);
  if (error) throw error;
}

export async function searchLibraryExercises({ query, muscleGroup, equipment, offset = 0, limit = 24 }) {
  let q = supabase
    .from('library_exercises')
    .select('*')
    .order('name')
    .range(offset, offset + limit - 1);

  if (query) q = q.or(`name.ilike.%${query}%,name_pt.ilike.%${query}%`);
  if (muscleGroup) q = q.eq('muscle_group', muscleGroup);
  if (equipment) q = q.eq('equipment', equipment);

  const { data, error } = await q;
  if (error) throw error;
  return data;
}

// Contagem de exercícios da biblioteca por grupo muscular + primeira imagem de
// cada grupo (pro fundo dos cards do seletor). Uma query só, leve (873 linhas
// só com muscle_group + image_urls).
export async function getLibraryGroupCounts() {
  const { data, error } = await supabase.from('library_exercises').select('muscle_group, image_urls');
  if (error) throw error;

  const counts = {};
  const images = {};
  for (const row of data) {
    counts[row.muscle_group] = (counts[row.muscle_group] || 0) + 1;
    if (!images[row.muscle_group] && row.image_urls?.[0]) {
      images[row.muscle_group] = row.image_urls[0];
    }
  }
  return { counts, images };
}

export async function addExerciseFromLibrary(userId, libEx) {
  const targetName = libEx.name_pt || libEx.name;

  const orNames = libEx.name_pt && libEx.name_pt !== libEx.name
    ? `name.ilike.${libEx.name},name.ilike.${libEx.name_pt}`
    : `name.ilike.${libEx.name}`;

  const { data: existing, error: findErr } = await supabase
    .from('exercises')
    .select('*')
    .eq('user_id', userId)
    .or(orNames)
    .maybeSingle();
  if (findErr) throw findErr;
  if (existing) return existing;

  const { data, error } = await supabase
    .from('exercises')
    .insert({
      user_id: userId,
      name: targetName,
      muscle_group: libEx.muscle_group,
      equipment: libEx.equipment,
      image_url: libEx.image_urls?.[0] || null,
      instructions: libEx.instructions_pt || libEx.instructions || null
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listExercisesWithProgress() {
  const { data: sets, error } = await supabase.from('session_sets').select('exercise_id');
  if (error) throw error;

  const uniqueIds = [...new Set(sets.map(s => s.exercise_id))];
  if (uniqueIds.length === 0) return [];

  const { data: exercises, error: exError } = await supabase
    .from('exercises')
    .select('id, name')
    .in('id', uniqueIds)
    .order('name');
  if (exError) throw exError;
  return exercises;
}

export async function getExerciseProgress(exerciseId) {
  const { data, error } = await supabase
    .from('session_sets')
    .select('weight, reps, session_id, completed_at, workout_sessions(started_at)')
    .eq('exercise_id', exerciseId)
    .order('completed_at', { ascending: true });
  if (error) throw error;

  const bySession = new Map();
  for (const row of data) {
    const date = row.workout_sessions?.started_at;
    if (!date) continue;

    if (!bySession.has(row.session_id)) {
      bySession.set(row.session_id, { session_id: row.session_id, date, maxWeight: 0, topReps: 0, volume: 0 });
    }

    const s = bySession.get(row.session_id);
    const w = row.weight || 0;
    const r = row.reps || 0;
    if (w > s.maxWeight) {
      s.maxWeight = w;
      s.topReps = r;
    }
    s.volume += w * r;
  }

  return [...bySession.values()].sort((a, b) => new Date(a.date) - new Date(b.date));
}

// Recorde de carga por exercício (todas as sessões do usuário, exceto a
// atual — RLS já restringe ao dono). Uma query só, buscada uma vez ao montar
// o treino, não a cada série.
export async function getPersonalRecordsMap(excludeSessionId) {
  const { data, error } = await supabase
    .from('session_sets')
    .select('exercise_id, weight, session_id')
    .neq('session_id', excludeSessionId);
  if (error) throw error;

  const byExercise = {};
  for (const row of data) {
    if (!byExercise[row.exercise_id]) byExercise[row.exercise_id] = { maxWeight: 0, sessionIds: new Set() };
    const rec = byExercise[row.exercise_id];
    if ((row.weight || 0) > rec.maxWeight) rec.maxWeight = row.weight || 0;
    rec.sessionIds.add(row.session_id);
  }

  const result = {};
  for (const [exerciseId, rec] of Object.entries(byExercise)) {
    result[exerciseId] = { maxWeight: rec.maxWeight, sessionCount: rec.sessionIds.size };
  }
  return result;
}

// Volume total acumulado (kg) de todo o histórico do usuário — usado pra
// conquistas de volume. Uma query só (weight/reps de todas as séries).
export async function getTotalVolumeKg() {
  const { data, error } = await supabase.from('session_sets').select('weight, reps');
  if (error) throw error;
  return data.reduce((sum, row) => sum + (row.weight || 0) * (row.reps || 0), 0);
}

// Verifica se algum mês do histórico já teve os 8 grupos musculares
// treinados (cardio não conta) — usado pela conquista "todos_grupos".
export async function hasTrainedAllGroupsInAMonth() {
  const { data, error } = await supabase
    .from('session_sets')
    .select('completed_at, exercises(muscle_group)');
  if (error) throw error;

  const byMonth = {};
  for (const row of data) {
    const group = row.exercises?.muscle_group;
    if (!group || group === 'cardio') continue;
    const monthKey = row.completed_at.slice(0, 7);
    if (!byMonth[monthKey]) byMonth[monthKey] = new Set();
    byMonth[monthKey].add(group);
  }

  return Object.values(byMonth).some(set => set.size >= MUSCLE_GROUPS.length);
}

export async function getSessionsByMonth(year, month) {
  const start = new Date(year, month - 1, 1).toISOString();
  const end = new Date(year, month, 1).toISOString();

  const { data: sessions, error } = await supabase
    .from('workout_sessions')
    .select('*, workouts(name)')
    .gte('started_at', start)
    .lt('started_at', end)
    .order('started_at');
  if (error) throw error;
  if (sessions.length === 0) return [];

  const summary = await getSessionSetsSummary(sessions.map(s => s.id));

  return sessions.map(s => ({
    ...s,
    sets: summary[s.id]?.sets || 0,
    volume: summary[s.id]?.volume || 0
  }));
}

// Janela de recuperação por grupo muscular (horas). Grupos grandes recuperam
// mais devagar que os pequenos. Ajustar aqui se necessário.
const RECOVERY_HOURS = {
  peito: 72, costas: 72, pernas: 72, gluteos: 72,
  ombros: 48, biceps: 48, triceps: 48, abdomen: 48
};

// Quantas séries recentes buscar pra descobrir a última data de cada grupo.
// Uma query só (sem N+1); 500 cobre meses de treino em uso pessoal.
const RECOVERY_LOOKBACK_SETS = 500;

export async function getMuscleRecovery() {
  const { data, error } = await supabase
    .from('session_sets')
    .select('completed_at, exercises(muscle_group)')
    .order('completed_at', { ascending: false })
    .limit(RECOVERY_LOOKBACK_SETS);
  if (error) throw error;

  const lastByGroup = {};
  for (const row of data) {
    const group = row.exercises?.muscle_group;
    if (!group || lastByGroup[group]) continue;
    lastByGroup[group] = row.completed_at;
  }

  const now = Date.now();

  return MUSCLE_GROUPS.map(group => {
    const lastTrained = lastByGroup[group] || null;
    const windowHours = RECOVERY_HOURS[group];

    if (!lastTrained) {
      return { group, lastTrained: null, status: 'sem_registro', pct: 100, hoursSince: null, hoursRemaining: 0 };
    }

    const hoursSince = (now - new Date(lastTrained).getTime()) / 3600000;

    if (hoursSince >= windowHours) {
      return { group, lastTrained, status: 'recuperado', pct: 100, hoursSince, hoursRemaining: 0 };
    }

    return {
      group, lastTrained,
      status: 'em_recuperacao',
      pct: Math.round((hoursSince / windowHours) * 100),
      hoursSince,
      hoursRemaining: Math.ceil(windowHours - hoursSince)
    };
  });
}

export async function getRecentCompletedSessionDates(days = 60) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const { data, error } = await supabase
    .from('workout_sessions')
    .select('started_at')
    .not('finished_at', 'is', null)
    .gte('started_at', cutoff.toISOString())
    .order('started_at', { ascending: false });
  if (error) throw error;

  return data.map(s => new Date(s.started_at).toDateString());
}

export async function getActiveSessionToday() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('workout_sessions')
    .select('id, workout_id')
    .is('finished_at', null)
    .not('workout_id', 'is', null)
    .gte('started_at', startOfDay.toISOString())
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Ficha sugerida do dia: maior média de recuperação entre os grupos da ficha;
// se nenhuma ficha está 100% recuperada, sugere a que foi treinada há mais
// tempo (com warn=true pro chamador avisar o usuário).
export async function getSuggestedWorkout() {
  const [workouts, recovery] = await Promise.all([listWorkouts(), getMuscleRecovery()]);
  const activeWorkouts = workouts.filter(w => w.is_active);
  if (activeWorkouts.length === 0) return null;

  const recoveryByGroup = {};
  recovery.forEach(r => { recoveryByGroup[r.group] = r; });

  const candidates = [];

  for (const workout of activeWorkouts) {
    const items = await listWorkoutExercises(workout.id);
    const groups = [...new Set(items.map(i => i.exercises.muscle_group))].filter(g => g !== 'cardio');
    if (groups.length === 0) continue;

    const groupStatuses = groups.map(g => recoveryByGroup[g]);
    const avgPct = groupStatuses.reduce((sum, g) => sum + g.pct, 0) / groupStatuses.length;
    const allRecovered = groupStatuses.every(g => g.status !== 'em_recuperacao');

    const recencyScore = Math.min(...groupStatuses.map(g =>
      g.lastTrained ? new Date(g.lastTrained).getTime() : -Infinity
    ));

    candidates.push({ workout, avgPct, allRecovered, recencyScore, groups });
  }

  if (candidates.length === 0) return null;

  const fullyRecovered = candidates.filter(c => c.allRecovered);

  if (fullyRecovered.length > 0) {
    const chosen = fullyRecovered.reduce((a, b) => b.avgPct > a.avgPct ? b : a);
    return { ...chosen, warn: false };
  }

  const chosen = candidates.reduce((a, b) => b.recencyScore < a.recencyScore ? b : a);
  return { ...chosen, warn: true };
}

// Sessões finalizadas num intervalo [startISO, endISO) — usada pra semana
// atual (grid seg-dom) e pro anel de progresso. Uma query só.
export async function getSessionDatesInRange(startISO, endISO) {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('started_at')
    .not('finished_at', 'is', null)
    .gte('started_at', startISO)
    .lt('started_at', endISO);
  if (error) throw error;

  return data.map(s => new Date(s.started_at).toDateString());
}

export async function getTodaysCompletedSessions() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const { data: sessions, error } = await supabase
    .from('workout_sessions')
    .select('*, workouts(name)')
    .not('finished_at', 'is', null)
    .gte('started_at', startOfDay.toISOString())
    .lte('started_at', endOfDay.toISOString())
    .order('started_at', { ascending: false });
  if (error) throw error;
  if (sessions.length === 0) return [];

  const summary = await getSessionSetsSummary(sessions.map(s => s.id));

  return sessions.map(s => ({
    ...s,
    sets: summary[s.id]?.sets || 0,
    volume: summary[s.id]?.volume || 0
  }));
}
