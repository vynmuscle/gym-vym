import { supabase } from '../supabaseClient.js';

// 1kg de gordura corporal ≈ 7700 kcal (aproximação padrão usada em nutrição).
const KCAL_PER_KG_FAT = 7700;

const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  intense: 1.725,
};

export const ACTIVITY_LABELS = {
  sedentary: 'Sedentário (pouco ou nenhum exercício)',
  light: 'Leve (exercício leve 1-3x/semana)',
  moderate: 'Moderado (exercício moderado 3-5x/semana)',
  intense: 'Intenso (exercício pesado 6-7x/semana)',
};

export const GOAL_LABELS = {
  lose: 'Emagrecer',
  maintain: 'Manter peso',
  gain: 'Ganhar massa',
};

export const MEAL_TYPE_LABELS = {
  cafe: 'Café da manhã',
  almoco: 'Almoço',
  lanche: 'Lanche',
  jantar: 'Jantar',
  outro: 'Outro',
};

// Piso de segurança pra não sugerir uma meta perigosamente baixa em déficit agressivo.
const MIN_SAFE_CALORIES = { M: 1500, F: 1200 };

export async function getDietProfile(userId) {
  const { data, error } = await supabase
    .from('diet_profile')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertDietProfile(userId, payload) {
  const { data, error } = await supabase
    .from('diet_profile')
    .upsert({ ...payload, user_id: userId, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getLatestWeight(userId) {
  const { data, error } = await supabase
    .from('body_measurements')
    .select('weight_kg, measured_at')
    .eq('user_id', userId)
    .order('measured_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getLatestHeight(userId) {
  const { data, error } = await supabase
    .from('body_measurements')
    .select('height_cm')
    .eq('user_id', userId)
    .not('height_cm', 'is', null)
    .order('measured_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.height_cm ?? null;
}

export async function listFoodLogs(userId, date) {
  const { data, error } = await supabase
    .from('food_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('logged_at', date)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createFoodLog(userId, payload) {
  const { data, error } = await supabase
    .from('food_logs')
    .insert({ ...payload, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteFoodLog(id) {
  const { error } = await supabase.from('food_logs').delete().eq('id', id);
  if (error) throw error;
}

export function calculateAge(birthDateStr) {
  const birthDate = new Date(birthDateStr);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

// Fórmula de Mifflin-St Jeor — a mais usada/precisa hoje para TMB (Taxa Metabólica Basal).
export function calculateBMR({ weightKg, heightCm, age, sex }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'M' ? base + 5 : base - 161;
}

export function calculateTDEE(bmr, activityLevel) {
  return bmr * (ACTIVITY_MULTIPLIERS[activityLevel] || ACTIVITY_MULTIPLIERS.sedentary);
}

// Retorna { targetCalories, dailyAdjustment, wasClamped }
export function calculateCalorieTarget({ tdee, goal, goalRateKgPerWeek, sex }) {
  const dailyAdjustment = ((goalRateKgPerWeek || 0) * KCAL_PER_KG_FAT) / 7;
  const minSafe = MIN_SAFE_CALORIES[sex] || MIN_SAFE_CALORIES.F;

  let targetCalories = tdee;
  if (goal === 'lose') targetCalories = tdee - dailyAdjustment;
  else if (goal === 'gain') targetCalories = tdee + dailyAdjustment;

  const wasClamped = goal === 'lose' && targetCalories < minSafe;
  if (wasClamped) targetCalories = minSafe;

  return { targetCalories: Math.round(targetCalories), dailyAdjustment: Math.round(dailyAdjustment), wasClamped };
}

// Distribuição de macros com prioridade em proteína (preserva massa magra em déficit/ganho).
export function calculateMacros({ targetCalories, goal, weightKg }) {
  const proteinPerKg = goal === 'lose' ? 2.0 : goal === 'gain' ? 1.8 : 1.6;
  const proteinG = Math.round(proteinPerKg * weightKg);
  const proteinKcal = proteinG * 4;

  const fatKcal = targetCalories * 0.25;
  const fatG = Math.round(fatKcal / 9);

  const carbsKcal = Math.max(0, targetCalories - proteinKcal - fatKcal);
  const carbsG = Math.round(carbsKcal / 4);

  return { protein_g: proteinG, fat_g: fatG, carbs_g: carbsG };
}

// Junta tudo: a partir do perfil + peso/altura mais recentes (de Medidas), calcula TMB, TDEE, meta e macros.
export function calculateDietTargets(profile, weightKg, heightCm) {
  const age = calculateAge(profile.birth_date);
  const bmr = calculateBMR({ weightKg, heightCm, age, sex: profile.sex });
  const tdee = calculateTDEE(bmr, profile.activity_level);
  const { targetCalories, dailyAdjustment, wasClamped } = calculateCalorieTarget({
    tdee,
    goal: profile.goal,
    goalRateKgPerWeek: profile.goal_rate_kg_per_week,
    sex: profile.sex,
  });
  const macros = calculateMacros({ targetCalories, goal: profile.goal, weightKg });
  const estimatedWeeklyChangeKg = (dailyAdjustment * 7) / KCAL_PER_KG_FAT;

  return {
    age,
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    targetCalories,
    macros,
    wasClamped,
    estimatedWeeklyChangeKg: profile.goal === 'maintain' ? 0 : estimatedWeeklyChangeKg,
  };
}
