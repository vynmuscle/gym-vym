import { supabase } from './supabaseClient.js';
import { navigate } from './router.js';
import { renderNav } from './navigation.js';
import { initPWA } from './pwa.js';
import { getUserSettings, upsertUserSettings } from './services/profileService.js';
import { getUserXP } from './services/workoutService.js';
import { listUnlockedAchievements } from './services/achievementsService.js';
import { ACHIEVEMENTS } from './achievements.js';
import { getLeagueForXP, getNextLeague } from './leagues.js';

const { data: sd } = await supabase.auth.getSession();
if(!sd.session) navigate('../login.html');
const user = sd.session.user;
initPWA();

await renderNav('profile');

const displayNameInput = document.getElementById('displayName');
const emailField = document.getElementById('emailField');
const goalValue = document.getElementById('goalValue');
const btnGoalMinus = document.getElementById('btnGoalMinus');
const btnGoalPlus = document.getElementById('btnGoalPlus');
const btnSave = document.getElementById('btnSave');
const btnLogout = document.getElementById('btnLogout');
const mensagem = document.getElementById('mensagem');
const achievementsGrid = document.getElementById('achievementsGrid');
const leagueAvatar = document.getElementById('leagueAvatar');
const leagueName = document.getElementById('leagueName');
const leagueXP = document.getElementById('leagueXP');
const leagueProgressFill = document.getElementById('leagueProgressFill');
const leagueProgressLabel = document.getElementById('leagueProgressLabel');

let weeklyGoal = 4;

function showMessage(text, type = 'info'){
  mensagem.className = `message ${type}`;
  mensagem.innerText = text;
}

emailField.value = user.email;

let settings = await getUserSettings(user.id);
if(!settings){
  settings = await upsertUserSettings(user.id, { weekly_goal: 4 });
}

displayNameInput.value = settings.display_name || '';
weeklyGoal = settings.weekly_goal || 4;
goalValue.textContent = weeklyGoal;

btnGoalMinus.addEventListener('click', () => {
  if(weeklyGoal > 1){
    weeklyGoal--;
    goalValue.textContent = weeklyGoal;
  }
});

btnGoalPlus.addEventListener('click', () => {
  if(weeklyGoal < 7){
    weeklyGoal++;
    goalValue.textContent = weeklyGoal;
  }
});

btnSave.addEventListener('click', async () => {
  await upsertUserSettings(user.id, {
    display_name: displayNameInput.value.trim() || null,
    weekly_goal: weeklyGoal
  });
  showMessage('Perfil atualizado.', 'success');
  renderLeague();
});

btnLogout.addEventListener('click', async () => {
  await supabase.auth.signOut();
  navigate('../login.html');
});

async function renderLeague(){
  const name = displayNameInput.value.trim() || user.email.split('@')[0];
  const xp = await getUserXP();
  const league = getLeagueForXP(xp);
  const next = getNextLeague(league);

  leagueAvatar.textContent = name.charAt(0).toUpperCase();
  leagueAvatar.style.borderColor = league.border || league.color;
  leagueName.textContent = `Liga ${league.name}`;
  leagueName.style.color = league.color;
  leagueXP.textContent = `${xp.toLocaleString('pt-BR')} XP`;

  if(next){
    const pct = Math.min(100, ((xp - league.minXP) / (next.minXP - league.minXP)) * 100);
    leagueProgressFill.style.width = pct + '%';
    leagueProgressFill.style.background = next.color;
    leagueProgressLabel.textContent = `Faltam ${(next.minXP - xp).toLocaleString('pt-BR')} XP para a ${next.name}`;
  } else {
    leagueProgressFill.style.width = '100%';
    leagueProgressFill.style.background = league.color;
    leagueProgressLabel.textContent = 'Liga máxima alcançada!';
  }
}

async function renderAchievements(){
  const unlocked = await listUnlockedAchievements();
  const unlockedByKey = {};
  unlocked.forEach(u => { unlockedByKey[u.achievement_key] = u.unlocked_at; });

  achievementsGrid.innerHTML = ACHIEVEMENTS.map(a => {
    const unlockedAt = unlockedByKey[a.key];
    if(unlockedAt){
      const date = new Date(unlockedAt).toLocaleDateString('pt-BR');
      return `
        <div class="achievement-badge unlocked">
          <div class="achievement-icon">${a.icon}</div>
          <div class="achievement-name">${a.name}</div>
          <div class="achievement-date">${date}</div>
        </div>`;
    }
    return `
      <div class="achievement-badge locked">
        <div class="achievement-icon">${a.icon}</div>
        <div class="achievement-name">${a.name}</div>
        <div class="achievement-desc">${a.desc}</div>
      </div>`;
  }).join('');
}

renderLeague();
renderAchievements();
