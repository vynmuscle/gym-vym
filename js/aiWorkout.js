import { supabase } from './supabaseClient.js';
import { navigate } from './router.js';
import { renderNav } from './navigation.js';
import { initPWA } from './pwa.js';
import { listExercises, createExercise, createWorkout, addWorkoutExercise, listWorkouts, updateWorkout } from './services/workoutService.js';

const { data: sd } = await supabase.auth.getSession();
if(!sd.session) navigate('../login.html');
const user = sd.session.user;
initPWA();

await renderNav('workouts');

const formPanel = document.getElementById('formPanel');
const reviewSection = document.getElementById('reviewSection');
const objetivoInput = document.getElementById('objetivo');
const nivelInput = document.getElementById('nivel');
const diasSemanaInput = document.getElementById('diasSemana');
const tempoTreinoInput = document.getElementById('tempoTreino');
const equipamentoInput = document.getElementById('equipamento');
const restricoesInput = document.getElementById('restricoes');
const btnGerar = document.getElementById('btnGerar');
const mensagem = document.getElementById('mensagem');
const rationaleEl = document.getElementById('rationale');
const workoutsListEl = document.getElementById('workoutsList');
const btnGerarNovo = document.getElementById('btnGerarNovo');
const btnSalvar = document.getElementById('btnSalvar');
const mensagemSalvar = document.getElementById('mensagemSalvar');
const modeReplace = document.getElementById('modeReplace');
const modeAdd = document.getElementById('modeAdd');
const renewWarning = document.getElementById('renewWarning');

function updateRenewWarning(){
  renewWarning.style.display = modeReplace.checked ? 'block' : 'none';
}
modeReplace.addEventListener('change', updateRenewWarning);
modeAdd.addEventListener('change', updateRenewWarning);

let reviewData = null;

function showMessage(text, type = 'info'){
  mensagem.className = `message ${type}`;
  mensagem.innerText = text;
}

function showSaveMessage(text, type = 'info'){
  mensagemSalvar.className = `message ${type}`;
  mensagemSalvar.innerText = text;
}

function renderReview(){
  rationaleEl.textContent = reviewData.rationale || '';

  workoutsListEl.innerHTML = reviewData.workouts.map((w, wi) => `
    <div class="panel ai-workout-card">
      <div class="ai-workout-head">
        <h3>${w.name}</h3>
        <button type="button" class="btn-icon danger" data-remove-workout="${wi}">✕</button>
      </div>
      ${w.exercises.map((ex, ei) => `
        <div class="ai-exercise-row">
          <div class="ai-exercise-head">
            <span class="ai-exercise-name">${ex.name}</span>
            <span class="ai-exercise-meta">${ex.muscle_group || ''}${ex.equipment ? ' · ' + ex.equipment : ''}</span>
            <button type="button" class="btn-icon danger" data-remove-exercise data-workout="${wi}" data-exercise="${ei}">✕</button>
          </div>
          <div class="ai-exercise-fields">
            <label>Séries
              <input type="number" min="1" value="${ex.target_sets}" data-field="target_sets" data-workout="${wi}" data-exercise="${ei}">
            </label>
            <label>Reps
              <input type="text" value="${ex.target_reps || ''}" data-field="target_reps" data-workout="${wi}" data-exercise="${ei}">
            </label>
            <label>Descanso (s)
              <input type="number" min="0" value="${ex.rest_seconds || 90}" data-field="rest_seconds" data-workout="${wi}" data-exercise="${ei}">
            </label>
          </div>
        </div>
      `).join('')}
    </div>
  `).join('');

  workoutsListEl.querySelectorAll('[data-remove-workout]').forEach(btn => {
    btn.addEventListener('click', () => {
      reviewData.workouts.splice(Number(btn.dataset.removeWorkout), 1);
      renderReview();
    });
  });

  workoutsListEl.querySelectorAll('[data-remove-exercise]').forEach(btn => {
    btn.addEventListener('click', () => {
      const wi = Number(btn.dataset.workout);
      const ei = Number(btn.dataset.exercise);
      reviewData.workouts[wi].exercises.splice(ei, 1);
      renderReview();
    });
  });

  workoutsListEl.querySelectorAll('[data-field]').forEach(input => {
    input.addEventListener('change', () => {
      const wi = Number(input.dataset.workout);
      const ei = Number(input.dataset.exercise);
      const field = input.dataset.field;
      reviewData.workouts[wi].exercises[ei][field] = field === 'target_sets' || field === 'rest_seconds'
        ? Number(input.value)
        : input.value;
    });
  });
}

btnGerar.addEventListener('click', async () => {
  showMessage('Gerando treino... isso pode levar até 30s.');
  btnGerar.disabled = true;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const res = await fetch('/api/ai-workout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        objetivo: objetivoInput.value,
        nivel: nivelInput.value,
        dias_semana: diasSemanaInput.value,
        tempo_treino: tempoTreinoInput.value,
        equipamento: equipamentoInput.value,
        restricoes: restricoesInput.value.trim()
      })
    });

    const data = await res.json();

    if(!res.ok){
      showMessage(data.error || 'Não consegui gerar o treino agora.', 'danger');
      return;
    }

    reviewData = data;
    renderReview();
    modeReplace.checked = true;
    updateRenewWarning();
    showMessage('');
    formPanel.style.display = 'none';
    reviewSection.style.display = 'block';
  } catch(err){
    showMessage('Erro de conexão. Tente de novo.', 'danger');
  } finally {
    btnGerar.disabled = false;
  }
});

btnGerarNovo.addEventListener('click', () => {
  reviewData = null;
  reviewSection.style.display = 'none';
  formPanel.style.display = 'block';
  showSaveMessage('');
});

btnSalvar.addEventListener('click', async () => {
  const workoutsToSave = reviewData.workouts.filter(w => w.exercises.length > 0);

  if(workoutsToSave.length === 0){
    showSaveMessage('Não há nenhuma ficha com exercícios pra salvar.', 'warning');
    return;
  }

  btnSalvar.disabled = true;
  showSaveMessage('Salvando...');

  try {
    if(modeReplace.checked){
      const currentActive = (await listWorkouts()).filter(w => w.is_active);
      for(const w of currentActive){
        await updateWorkout(w.id, { is_active: false });
      }
    }

    const existing = await listExercises();
    const exerciseCache = new Map(existing.map(e => [e.name.trim().toLowerCase(), e.id]));

    for(const w of workoutsToSave){
      const workout = await createWorkout(user.id, { name: w.name, is_active: true });

      for(let ei = 0; ei < w.exercises.length; ei++){
        const ex = w.exercises[ei];
        const key = ex.name.trim().toLowerCase();
        let exerciseId = exerciseCache.get(key);

        if(!exerciseId){
          const created = await createExercise(user.id, {
            name: ex.name.trim(),
            muscle_group: ex.muscle_group || 'peito',
            equipment: ex.equipment || null
          });
          exerciseId = created.id;
          exerciseCache.set(key, exerciseId);
        }

        await addWorkoutExercise(user.id, {
          workout_id: workout.id,
          exercise_id: exerciseId,
          sort_order: ei,
          target_sets: ex.target_sets || 3,
          target_reps: ex.target_reps || '10',
          target_weight: null,
          rest_seconds: ex.rest_seconds || 90,
          notes: ex.notes || null
        });
      }
    }

    showSaveMessage('Fichas salvas!', 'success');
    setTimeout(() => navigate('./workouts.html'), 800);
  } catch(err){
    showSaveMessage('Erro ao salvar. Tente de novo.', 'danger');
    btnSalvar.disabled = false;
  }
});
