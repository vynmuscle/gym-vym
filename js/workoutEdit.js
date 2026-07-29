import { supabase } from './supabaseClient.js';
import { navigate } from './router.js';
import { renderNav } from './navigation.js';
import { initPWA } from './pwa.js';
import { openExercisePicker } from './exercisePicker.js';
import {
  getWorkout, listWorkoutExercises, listExercises, createExercise,
  addWorkoutExercise, updateWorkoutExercise, removeWorkoutExercise,
  swapWorkoutExerciseExercise
} from './services/workoutService.js';

const { data: sd } = await supabase.auth.getSession();
if(!sd.session) navigate('../login.html');
const user = sd.session.user;
initPWA();

await renderNav('workouts');

const workoutId = new URLSearchParams(location.search).get('id');
if(!workoutId) navigate('./workouts.html');

const workoutNameEl = document.getElementById('workoutName');
const addSection = document.getElementById('addSection');
const editSection = document.getElementById('editSection');
const btnOpenPicker = document.getElementById('btnOpenPicker');
const targetSetsInput = document.getElementById('targetSets');
const targetRepsInput = document.getElementById('targetReps');
const targetWeightInput = document.getElementById('targetWeight');
const targetDurationInput = document.getElementById('targetDuration');
const restSecondsInput = document.getElementById('restSeconds');
const notesInput = document.getElementById('notes');
const btnSave = document.getElementById('btnSave');
const btnCancel = document.getElementById('btnCancel');
const mensagem = document.getElementById('mensagem');
const listPanel = document.getElementById('listPanel');
const groupTargetSets = document.getElementById('groupTargetSets');
const groupTargetReps = document.getElementById('groupTargetReps');
const groupTargetWeight = document.getElementById('groupTargetWeight');
const groupTargetDuration = document.getElementById('groupTargetDuration');
const btnAskAiReview = document.getElementById('btnAskAiReview');
const aiReviewMsg = document.getElementById('aiReviewMsg');
const aiReviewResult = document.getElementById('aiReviewResult');
const aiReviewSuggestions = document.getElementById('aiReviewSuggestions');
const aiSuggestionsList = document.getElementById('aiSuggestionsList');
const btnApplySuggestions = document.getElementById('btnApplySuggestions');
const btnDiscardSuggestions = document.getElementById('btnDiscardSuggestions');
const aiApplyMsg = document.getElementById('aiApplyMsg');

let suggestedExercises = null;

let editingId = null;
let editingIsCardio = false;
let currentItems = [];

// Cardio sempre por último na ordem de execução — isolado numa faixa alta
// (900+) pra não competir com o sort_order dos exercícios de força.
function getNextSortOrder(isCardio){
  if(isCardio){
    const cardioItems = currentItems.filter(i => i.exercises.tracking_type === 'duration');
    return cardioItems.length ? Math.max(...cardioItems.map(i => i.sort_order)) + 1 : 900;
  }
  const nonCardio = currentItems.filter(i => i.exercises.tracking_type !== 'duration');
  return nonCardio.length ? Math.max(...nonCardio.map(i => i.sort_order)) + 10 : 10;
}

function showMessage(text, type = 'info'){
  mensagem.className = `message ${type}`;
  mensagem.innerText = text;
}

function showAddMode(){
  editingId = null;
  addSection.style.display = 'block';
  editSection.style.display = 'none';
}

function showEditMode(item){
  editingId = item.id;
  editingIsCardio = item.exercises.tracking_type === 'duration';
  targetSetsInput.value = item.target_sets;
  targetRepsInput.value = item.target_reps;
  targetWeightInput.value = item.target_weight || '';
  targetDurationInput.value = item.target_duration_seconds ? Math.round(item.target_duration_seconds / 60) : 20;
  restSecondsInput.value = item.rest_seconds;
  notesInput.value = item.notes || '';
  groupTargetSets.style.display = editingIsCardio ? 'none' : 'block';
  groupTargetReps.style.display = editingIsCardio ? 'none' : 'block';
  groupTargetWeight.style.display = editingIsCardio ? 'none' : 'block';
  groupTargetDuration.style.display = editingIsCardio ? 'block' : 'none';
  addSection.style.display = 'none';
  editSection.style.display = 'block';
  showMessage('');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function loadList(){
  const items = await listWorkoutExercises(workoutId);
  currentItems = items;

  if(items.length === 0){
    listPanel.innerHTML = '<p class="muted" style="padding:20px">Nenhum exercício na ficha ainda.</p>';
    return;
  }

  listPanel.innerHTML = items.map(item => {
    const isCardio = item.exercises.tracking_type === 'duration';
    const sub = isCardio
      ? `${Math.round((item.target_duration_seconds || 0) / 60)}min`
      : `${item.target_sets}x${item.target_reps}${item.target_weight ? ' · ' + item.target_weight + 'kg' : ''} · descanso ${item.rest_seconds}s`;
    return `
    <div class="list-item">
      <div class="list-item-info">
        <span class="list-item-title">${item.exercises.name}</span>
        <span class="list-item-sub">${sub}</span>
      </div>
      <div class="list-item-actions">
        <button type="button" class="btn-icon" data-swap="${item.id}" data-group="${item.exercises.muscle_group}" aria-label="Substituir exercício">🔁</button>
        <button type="button" class="btn-icon" data-edit="${item.id}">✎</button>
        <button type="button" class="btn-icon danger" data-delete="${item.id}">✕</button>
      </div>
    </div>`;
  }).join('');

  listPanel.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => showEditMode(items.find(i => i.id === btn.dataset.edit)));
  });
  listPanel.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => removeItem(btn.dataset.delete));
  });
  listPanel.querySelectorAll('[data-swap]').forEach(btn => {
    btn.addEventListener('click', () => swapItem(btn.dataset.swap, btn.dataset.group));
  });
}

function swapItem(itemId, group){
  openExercisePicker({
    userId: user.id,
    initialGroup: group,
    onPick: async (ex) => {
      await swapWorkoutExerciseExercise(itemId, ex.id);
      await loadList();
    }
  });
}

async function removeItem(id){
  if(!confirm('Remover este exercício da ficha?')) return;
  await removeWorkoutExercise(id);
  await loadList();
}

btnOpenPicker.addEventListener('click', () => {
  openExercisePicker({
    userId: user.id,
    onPick: async (ex) => {
      const isCardio = ex.tracking_type === 'duration';
      await addWorkoutExercise(user.id, {
        workout_id: workoutId,
        exercise_id: ex.id,
        sort_order: getNextSortOrder(isCardio),
        target_sets: isCardio ? 1 : 3,
        target_reps: isCardio ? null : '10',
        target_weight: null,
        target_duration_seconds: isCardio ? 1200 : null,
        rest_seconds: isCardio ? 0 : 90,
        notes: null
      });
      await loadList();
    }
  });
});

btnSave.addEventListener('click', async () => {
  if(!editingId) return;

  const payload = editingIsCardio
    ? {
      target_sets: 1,
      target_reps: null,
      target_weight: null,
      target_duration_seconds: (Number(targetDurationInput.value) || 20) * 60,
      rest_seconds: Number(restSecondsInput.value) || 0,
      notes: notesInput.value.trim() || null
    }
    : {
      target_sets: Number(targetSetsInput.value) || 1,
      target_reps: targetRepsInput.value.trim() || '10',
      target_weight: targetWeightInput.value ? Number(targetWeightInput.value) : null,
      target_duration_seconds: null,
      rest_seconds: Number(restSecondsInput.value) || 0,
      notes: notesInput.value.trim() || null
    };

  await updateWorkoutExercise(editingId, payload);
  showMessage('Exercício atualizado.', 'success');
  showAddMode();
  await loadList();
});

btnCancel.addEventListener('click', showAddMode);

function showAiReviewMessage(text, type = 'info'){
  aiReviewMsg.className = `message ${type}`;
  aiReviewMsg.innerText = text;
}

function showAiApplyMessage(text, type = 'info'){
  aiApplyMsg.className = `message ${type}`;
  aiApplyMsg.innerText = text;
}

function renderSuggestions(){
  aiSuggestionsList.innerHTML = suggestedExercises.map((ex, i) => `
    <div class="ai-exercise-row">
      <div class="ai-exercise-head">
        <span class="ai-exercise-name">${ex.name}</span>
        <span class="ai-exercise-meta">${ex.muscle_group || ''}${ex.equipment ? ' · ' + ex.equipment : ''}</span>
        <button type="button" class="btn-icon danger" data-remove-exercise="${i}">✕</button>
      </div>
      <div class="ai-exercise-fields">
        ${ex.is_duration ? `
          <label>Min
            <input type="number" min="1" value="${Math.round((ex.target_duration_seconds || 0) / 60)}" data-field="target_duration_min" data-exercise="${i}">
          </label>
        ` : `
          <label>Séries
            <input type="number" min="1" value="${ex.target_sets}" data-field="target_sets" data-exercise="${i}">
          </label>
          <label>Reps
            <input type="text" value="${ex.target_reps || ''}" data-field="target_reps" data-exercise="${i}">
          </label>
        `}
        <label>Descanso (s)
          <input type="number" min="0" value="${ex.rest_seconds || 90}" data-field="rest_seconds" data-exercise="${i}">
        </label>
      </div>
    </div>
  `).join('');

  aiSuggestionsList.querySelectorAll('[data-remove-exercise]').forEach(btn => {
    btn.addEventListener('click', () => {
      suggestedExercises.splice(Number(btn.dataset.removeExercise), 1);
      renderSuggestions();
    });
  });

  aiSuggestionsList.querySelectorAll('[data-field]').forEach(input => {
    input.addEventListener('change', () => {
      const i = Number(input.dataset.exercise);
      const field = input.dataset.field;
      if(field === 'target_duration_min') suggestedExercises[i].target_duration_seconds = Number(input.value) * 60;
      else if(field === 'target_sets' || field === 'rest_seconds') suggestedExercises[i][field] = Number(input.value);
      else suggestedExercises[i][field] = input.value;
    });
  });
}

btnAskAiReview.addEventListener('click', async () => {
  if(currentItems.length === 0){
    showAiReviewMessage('Adicione ao menos um exercício antes de pedir a avaliação.', 'warning');
    return;
  }

  showAiReviewMessage('Avaliando ficha... isso pode levar até 15s.');
  aiReviewResult.style.display = 'none';
  aiReviewSuggestions.style.display = 'none';
  showAiApplyMessage('');
  btnAskAiReview.disabled = true;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const exercises = currentItems.map(item => ({
      name: item.exercises.name,
      muscle_group: item.exercises.muscle_group,
      equipment: item.exercises.equipment,
      isDuration: item.exercises.tracking_type === 'duration',
      target_sets: item.target_sets,
      target_reps: item.target_reps,
      target_duration_seconds: item.target_duration_seconds,
      rest_seconds: item.rest_seconds
    }));

    const res = await fetch('/api/ai-review-workout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ workout_name: workoutNameEl.innerText, exercises })
    });

    const data = await res.json();

    if(!res.ok){
      showAiReviewMessage(data.error || 'Não consegui avaliar a ficha agora.', 'danger');
      return;
    }

    showAiReviewMessage('');
    aiReviewResult.textContent = data.feedback;
    aiReviewResult.style.display = 'block';

    suggestedExercises = data.exercises;
    renderSuggestions();
    aiReviewSuggestions.style.display = 'block';
  } catch(err){
    showAiReviewMessage('Erro de conexão. Tente de novo.', 'danger');
  } finally {
    btnAskAiReview.disabled = false;
  }
});

btnDiscardSuggestions.addEventListener('click', () => {
  suggestedExercises = null;
  aiReviewSuggestions.style.display = 'none';
  showAiApplyMessage('');
});

btnApplySuggestions.addEventListener('click', async () => {
  if(!suggestedExercises || suggestedExercises.length === 0){
    showAiApplyMessage('Nada pra aplicar.', 'warning');
    return;
  }

  if(!confirm('Isso substitui todos os exercícios atuais dessa ficha pela sugestão da IA. Continuar?')) return;

  btnApplySuggestions.disabled = true;
  showAiApplyMessage('Aplicando...');

  try {
    for(const item of currentItems){
      await removeWorkoutExercise(item.id);
    }

    const existing = await listExercises();
    const exerciseCache = new Map(existing.map(e => [e.name.trim().toLowerCase(), e.id]));

    let nonCardioOrder = 10;
    let cardioOrder = 900;

    for(const ex of suggestedExercises){
      const key = ex.name.trim().toLowerCase();
      let exerciseId = exerciseCache.get(key);

      if(!exerciseId){
        const created = await createExercise(user.id, {
          name: ex.name.trim(),
          muscle_group: ex.muscle_group || 'peito',
          equipment: ex.equipment || null,
          tracking_type: ex.is_duration ? 'duration' : 'reps'
        });
        exerciseId = created.id;
        exerciseCache.set(key, exerciseId);
      }

      await addWorkoutExercise(user.id, {
        workout_id: workoutId,
        exercise_id: exerciseId,
        sort_order: ex.is_duration ? cardioOrder++ : nonCardioOrder,
        target_sets: ex.is_duration ? 1 : (ex.target_sets || 3),
        target_reps: ex.is_duration ? null : (ex.target_reps || '10'),
        target_weight: null,
        target_duration_seconds: ex.is_duration ? (ex.target_duration_seconds || 1200) : null,
        rest_seconds: ex.rest_seconds ?? (ex.is_duration ? 0 : 90),
        notes: ex.notes || null
      });

      if(!ex.is_duration) nonCardioOrder += 10;
    }

    suggestedExercises = null;
    aiReviewSuggestions.style.display = 'none';
    aiReviewResult.style.display = 'none';
    showAiApplyMessage('');
    await loadList();
  } catch(err){
    showAiApplyMessage('Erro ao aplicar. Tente de novo.', 'danger');
  } finally {
    btnApplySuggestions.disabled = false;
  }
});

const workout = await getWorkout(workoutId);
workoutNameEl.innerText = workout.name;

showAddMode();
await loadList();
