// Ligas de anilha — nível do usuário conforme XP acumulado (js/services/workoutService.js:getUserXP).
export const LEAGUES = [
  { key: 'verde', name: 'Anilha Verde', color: 'var(--green)', emoji: '🟢', minXP: 0 },
  { key: 'amarela', name: 'Anilha Amarela', color: 'var(--yellow)', emoji: '🟡', minXP: 2500 },
  { key: 'azul', name: 'Anilha Azul', color: '#3b6fd9', emoji: '🔵', minXP: 7000 },
  { key: 'vermelha', name: 'Anilha Vermelha', color: 'var(--red)', emoji: '🔴', minXP: 15000 },
  { key: 'preta', name: 'Anilha Preta', color: '#1a1a1a', border: 'var(--yellow)', emoji: '⚫', minXP: 30000 },
];

export function getLeagueForXP(xp){
  return [...LEAGUES].reverse().find(l => xp >= l.minXP);
}

export function getNextLeague(league){
  const idx = LEAGUES.findIndex(l => l.key === league.key);
  return LEAGUES[idx + 1] || null;
}
