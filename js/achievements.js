import { showToast } from './toast.js';
import { listUnlockedAchievements, unlockAchievement } from './services/achievementsService.js';
import {
  listCompletedSessions, getRecentCompletedSessionDates,
  getTotalVolumeKg, hasTrainedAllGroupsInAMonth
} from './services/workoutService.js';
import { listPhotos } from './services/photosService.js';
import { computeStreak } from './utils.js';

export const ACHIEVEMENTS = [
  { key: 'primeiro_treino', name: 'Primeiro Treino', desc: 'Finalize seu primeiro treino', icon: '🎉' },
  { key: 'treinos_10', name: '10 Treinos', desc: 'Finalize 10 treinos', icon: '🥉' },
  { key: 'treinos_50', name: '50 Treinos', desc: 'Finalize 50 treinos', icon: '🥈' },
  { key: 'treinos_100', name: '100 Treinos', desc: 'Finalize 100 treinos', icon: '🥇' },
  { key: 'streak_7', name: 'Sequência de 7 dias', desc: 'Treine 7 dias seguidos', icon: '🔥' },
  { key: 'streak_30', name: 'Sequência de 30 dias', desc: 'Treine 30 dias seguidos', icon: '🔥' },
  { key: 'volume_10t', name: '10 Toneladas', desc: 'Acumule 10 toneladas levantadas', icon: '💪' },
  { key: 'volume_50t', name: '50 Toneladas', desc: 'Acumule 50 toneladas levantadas', icon: '💪' },
  { key: 'todos_grupos', name: 'Corpo Todo', desc: 'Treine os 8 grupos musculares no mesmo mês', icon: '🌐' },
  { key: 'primeiro_pr', name: 'Recordista', desc: 'Bata seu primeiro recorde pessoal', icon: '🏆' },
  { key: 'fotografo', name: 'Fotógrafo', desc: 'Registre sua primeira foto de progresso', icon: '📸' },
];

// Roda ao finalizar treino e ao salvar foto. Recalcula tudo a partir do
// histórico completo — por isso desbloqueia retroativamente quem já
// merecia a conquista antes dela existir.
export async function checkAchievements(userId, { hadPRThisSession = false } = {}) {
  const unlocked = await listUnlockedAchievements();
  const unlockedKeys = new Set(unlocked.map(u => u.achievement_key));

  const [sessions, recentDates, volumeKg, allGroups, photos] = await Promise.all([
    listCompletedSessions(),
    getRecentCompletedSessionDates(60),
    getTotalVolumeKg(),
    hasTrainedAllGroupsInAMonth(),
    listPhotos(userId)
  ]);

  const streak = computeStreak(recentDates);
  const sessionCount = sessions.length;

  const qualifies = {
    primeiro_treino: sessionCount >= 1,
    treinos_10: sessionCount >= 10,
    treinos_50: sessionCount >= 50,
    treinos_100: sessionCount >= 100,
    streak_7: streak >= 7,
    streak_30: streak >= 30,
    volume_10t: volumeKg >= 10000,
    volume_50t: volumeKg >= 50000,
    todos_grupos: allGroups,
    primeiro_pr: hadPRThisSession,
    fotografo: photos.length >= 1
  };

  const newlyUnlocked = [];
  for (const achievement of ACHIEVEMENTS) {
    if (unlockedKeys.has(achievement.key)) continue;
    if (!qualifies[achievement.key]) continue;
    await unlockAchievement(userId, achievement.key);
    newlyUnlocked.push(achievement);
  }

  for (const achievement of newlyUnlocked) {
    showToast(`${achievement.icon} Conquista desbloqueada: ${achievement.name}`);
  }

  return newlyUnlocked;
}
