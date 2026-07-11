import { supabase } from '../supabaseClient.js';

export const MUSCLE_GROUPS = ['peito', 'costas', 'pernas', 'ombros', 'biceps', 'triceps', 'abdomen', 'gluteos'];
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
    .select('*, exercises(name, muscle_group, equipment, image_url)')
    .eq('workout_id', workoutId)
    .order('sort_order');
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

export async function searchLibraryExercises({ query, muscleGroup, offset = 0, limit = 24 }) {
  let q = supabase
    .from('library_exercises')
    .select('*')
    .order('name')
    .range(offset, offset + limit - 1);

  if (query) q = q.ilike('name', `%${query}%`);
  if (muscleGroup) q = q.eq('muscle_group', muscleGroup);

  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function addExerciseFromLibrary(userId, libEx) {
  const { data: existing, error: findErr } = await supabase
    .from('exercises')
    .select('*')
    .eq('user_id', userId)
    .ilike('name', libEx.name)
    .maybeSingle();
  if (findErr) throw findErr;
  if (existing) return existing;

  const { data, error } = await supabase
    .from('exercises')
    .insert({
      user_id: userId,
      name: libEx.name,
      muscle_group: libEx.muscle_group,
      equipment: libEx.equipment,
      image_url: libEx.image_urls?.[0] || null
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
