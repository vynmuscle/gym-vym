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
    .select('*, exercises(name, muscle_group, equipment)')
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
