// Check-in de disposição — só informativo por enquanto (não altera a
// sugestão de treino nem o motor de progressão). Guardado no aparelho, não
// no banco: não pergunta de novo no mesmo dia, sem precisar de tabela nova.

export const CHECKIN_ACK = {
  mal: 'Anotado. Vai com calma hoje, sem exagerar na carga.',
  normal: 'Anotado. Bom treino!',
  otimo: 'Anotado! Aproveita esse gás. 🔥',
  cansado: 'Anotado. Fique de olho no corpo — reduza o volume se precisar.'
};

function todayStr(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function storageKey(userId){
  return `gymvym_checkin_${userId}`;
}

export function getTodayCheckin(userId){
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if(!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.date === todayStr() ? parsed.feeling : null;
  } catch(err) {
    return null;
  }
}

export function saveTodayCheckin(userId, feeling){
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify({ date: todayStr(), feeling }));
  } catch(err) {}
}
