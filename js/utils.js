export function computeStreak(dateStrings){
  const daySet = new Set(dateStrings);
  let checkDate = new Date();

  if(!daySet.has(checkDate.toDateString())){
    checkDate.setDate(checkDate.getDate() - 1);
    if(!daySet.has(checkDate.toDateString())) return 0;
  }

  let streak = 0;
  while(daySet.has(checkDate.toDateString())){
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }
  return streak;
}

export function formatDuration(startIso, endIso){
  const totalMin = Math.round((new Date(endIso) - new Date(startIso)) / 60000);
  if(totalMin < 60) return `${totalMin}min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${String(m).padStart(2, '0')}min`;
}

// MET (Metabolic Equivalent of Task) graduado pela densidade da sessão
// (séries ÷ minutos) — fonte: Compendium of Physical Activities, códigos
// 02050 (resistance training, effort leve/moderado) e 02052 (vigoroso).
export const MET_TABLE = {
  leve: 3.5,
  moderado: 5.0,
  intenso: 6.0
};

// kcal = MET × 3,5 × peso_kg ÷ 200 × duração_minutos.
export function estimateWorkoutKcal({ weightKg, totalSets, durationMinutes }){
  if(!weightKg || durationMinutes <= 0) return null;

  const density = totalSets / durationMinutes;
  const met = density > 0.7 ? MET_TABLE.intenso : density >= 0.4 ? MET_TABLE.moderado : MET_TABLE.leve;

  return Math.round(met * 3.5 * weightKg / 200 * durationMinutes);
}

// Acha o peso mais recente registrado na data ou anterior. `measurements`
// precisa vir ordenado ascendente por measured_at (ver bodyService.listMeasurements).
export function findWeightAtDate(measurements, dateIso){
  const target = new Date(dateIso).getTime();
  let found = null;
  for(const m of measurements){
    if(new Date(m.measured_at).getTime() > target) break;
    found = m.weight_kg;
  }
  return found;
}
