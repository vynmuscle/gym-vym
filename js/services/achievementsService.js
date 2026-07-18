import { supabase } from '../supabaseClient.js';

export async function listUnlockedAchievements() {
  const { data, error } = await supabase
    .from('user_achievements')
    .select('achievement_key, unlocked_at');
  if (error) throw error;
  return data;
}

export async function unlockAchievement(userId, achievementKey) {
  const { error } = await supabase
    .from('user_achievements')
    .insert({ user_id: userId, achievement_key: achievementKey });
  if (error) throw error;
}
