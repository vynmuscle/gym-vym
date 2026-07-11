import { supabase } from '../supabaseClient.js';

export const MEASUREMENT_METRICS = [
  { key: 'weight_kg', label: 'Peso' },
  { key: 'waist_cm', label: 'Cintura' },
  { key: 'arm_cm', label: 'Braço' },
  { key: 'chest_cm', label: 'Peito' },
  { key: 'hip_cm', label: 'Quadril' },
  { key: 'thigh_cm', label: 'Coxa' },
  { key: 'calf_cm', label: 'Panturrilha' },
];

export async function listMeasurements() {
  const { data, error } = await supabase
    .from('body_measurements')
    .select('*')
    .order('measured_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createMeasurement(userId, payload) {
  const { data, error } = await supabase
    .from('body_measurements')
    .insert({ ...payload, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateMeasurement(id, payload) {
  const { data, error } = await supabase
    .from('body_measurements')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMeasurement(id) {
  const { error } = await supabase.from('body_measurements').delete().eq('id', id);
  if (error) throw error;
}
