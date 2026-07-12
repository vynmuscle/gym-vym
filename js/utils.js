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
