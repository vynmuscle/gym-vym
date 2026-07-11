import { supabase } from './supabaseClient.js';
import { navigate } from './router.js';
import { renderNav } from './navigation.js';
import { getMuscleRecovery, listWorkouts, listWorkoutExercises } from './services/workoutService.js';

const { data: sd } = await supabase.auth.getSession();
if(!sd.session) navigate('./login.html');
const user = sd.session.user;

renderNav('dashboard');

document.getElementById('userEmail').innerText = user.email;

document.getElementById('btnLogout').addEventListener('click', async () => {
  await supabase.auth.signOut();
  navigate('./login.html');
});

const MUSCLE_GROUP_LABELS = {
  peito: 'Peito', costas: 'Costas', pernas: 'Pernas', ombros: 'Ombros',
  biceps: 'Bíceps', triceps: 'Tríceps', abdomen: 'Abdômen', gluteos: 'Glúteos'
};

const STATUS_LABELS = {
  recuperado: 'Recuperado',
  em_recuperacao: 'Em recuperação',
  sem_registro: 'Sem registro'
};

const recoveryGrid = document.getElementById('recoveryGrid');
const suggestionCard = document.getElementById('suggestionCard');
const suggestionName = document.getElementById('suggestionName');
const suggestionWarning = document.getElementById('suggestionWarning');
const btnStartSuggestion = document.getElementById('btnStartSuggestion');

function formatTimeSince(hoursSince){
  if(hoursSince == null) return 'Nunca treinado';
  const h = Math.floor(hoursSince);
  if(h < 1) return 'há menos de 1h';
  if(h < 48) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

function renderRecoveryGrid(recovery){
  recoveryGrid.innerHTML = recovery.map(r => `
    <div class="recovery-card">
      <div class="recovery-card-name">${MUSCLE_GROUP_LABELS[r.group]}</div>
      <div class="recovery-card-status">${STATUS_LABELS[r.status]}${r.status === 'em_recuperacao' ? ` · ${r.pct}%` : ''}</div>
      <div class="recovery-bar-track">
        <div class="recovery-bar-fill ${r.status}" style="width:${r.pct}%"></div>
      </div>
      <div class="recovery-card-time">${formatTimeSince(r.hoursSince)}</div>
    </div>
  `).join('');
}

async function buildSuggestion(recovery){
  const workouts = (await listWorkouts()).filter(w => w.is_active);
  if(workouts.length === 0) return;

  const recoveryByGroup = {};
  recovery.forEach(r => { recoveryByGroup[r.group] = r; });

  const candidates = [];

  for(const workout of workouts){
    const items = await listWorkoutExercises(workout.id);
    const groups = [...new Set(items.map(i => i.exercises.muscle_group))];
    if(groups.length === 0) continue;

    const groupStatuses = groups.map(g => recoveryByGroup[g]);
    const avgPct = groupStatuses.reduce((sum, g) => sum + g.pct, 0) / groupStatuses.length;
    const allRecovered = groupStatuses.every(g => g.status !== 'em_recuperacao');

    // "Recência" da ficha: treino do grupo trabalhado mais recentemente.
    // Grupo nunca treinado conta como muito antigo (prioriza a sugestão).
    const recencyScore = Math.min(...groupStatuses.map(g =>
      g.lastTrained ? new Date(g.lastTrained).getTime() : -Infinity
    ));

    candidates.push({ workout, avgPct, allRecovered, recencyScore });
  }

  if(candidates.length === 0) return;

  const fullyRecovered = candidates.filter(c => c.allRecovered);

  let chosen, warn;
  if(fullyRecovered.length > 0){
    chosen = fullyRecovered.reduce((a, b) => b.avgPct > a.avgPct ? b : a);
    warn = false;
  } else {
    chosen = candidates.reduce((a, b) => b.recencyScore < a.recencyScore ? b : a);
    warn = true;
  }

  suggestionCard.style.display = 'block';
  suggestionName.textContent = chosen.workout.name;
  suggestionWarning.style.display = warn ? 'block' : 'none';
  suggestionWarning.textContent = warn
    ? 'Todos os grupos dessa ficha ainda estão em recuperação — sugestão baseada na que foi treinada há mais tempo.'
    : '';

  btnStartSuggestion.addEventListener('click', () => {
    navigate('./pages/train.html?id=' + chosen.workout.id);
  });
}

const recovery = await getMuscleRecovery();
renderRecoveryGrid(recovery);
await buildSuggestion(recovery);
