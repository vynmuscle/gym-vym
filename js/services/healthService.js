import { supabase } from '../supabaseClient.js';

export async function getDailyHealthStats(userId, date) {
  const { data, error } = await supabase
    .from('daily_health_stats')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listDailyHealthStats(userId) {
  const { data, error } = await supabase
    .from('daily_health_stats')
    .select('*')
    .eq('user_id', userId)
    .order('date');
  if (error) throw error;
  return data;
}
