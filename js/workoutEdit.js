import { supabase } from './supabaseClient.js';
import { navigate } from './router.js';
import { renderNav } from './navigation.js';
import { initPWA } from './pwa.js';
import { openExercisePicker } from './exercisePicker.js';
import {
  getWorkout, listWorkoutExercises,
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

let editingId = null;
let editingIsCardio = false;

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

const workout = await getWorkout(workoutId);
workoutNameEl.innerText = workout.name;

showAddMode();
await loadList();
