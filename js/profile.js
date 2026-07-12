import { supabase } from './supabaseClient.js';
import { navigate } from './router.js';
import { renderNav } from './navigation.js';
import { initPWA } from './pwa.js';
import { getUserSettings, upsertUserSettings } from './services/profileService.js';

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
});

btnLogout.addEventListener('click', async () => {
  await supabase.auth.signOut();
  navigate('../login.html');
});
