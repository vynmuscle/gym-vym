import { supabase } from './supabaseClient.js';
import { navigate } from './router.js';
import { renderNav } from './navigation.js';
import {
  getWorkout, listExercises, listWorkoutExercises,
  addWorkoutExercise, updateWorkoutExercise, removeWorkoutExercise,
  searchLibraryExercises, addExerciseFromLibrary
} from './services/workoutService.js';

const { data: sd } = await supabase.auth.getSession();
if(!sd.session) navigate('../login.html');
const user = sd.session.user;

renderNav('workouts');

const workoutId = new URLSearchParams(location.search).get('id');
if(!workoutId) navigate('./workouts.html');

const workoutNameEl = document.getElementById('workoutName');
const exerciseSelect = document.getElementById('exerciseSelect');
const targetSetsInput = document.getElementById('targetSets');
const targetRepsInput = document.getElementById('targetReps');
const targetWeightInput = document.getElementById('targetWeight');
const restSecondsInput = document.getElementById('restSeconds');
const notesInput = document.getElementById('notes');
const btnSave = document.getElementById('btnSave');
const btnCancel = document.getElementById('btnCancel');
const formTitle = document.getElementById('formTitle');
const mensagem = document.getElementById('mensagem');
const listPanel = document.getElementById('listPanel');

let editingId = null;
let exercisesCache = [];

function showMessage(text, type = 'info'){
  mensagem.className = `message ${type}`;
  mensagem.innerText = text;
}

function resetForm(){
  editingId = null;
  targetSetsInput.value = 3;
  targetRepsInput.value = '10';
  targetWeightInput.value = '';
  restSecondsInput.value = 90;
  notesInput.value = '';
  formTitle.innerText = 'Adicionar exercício';
  btnCancel.style.display = 'none';
}

async function loadExerciseOptions(){
  exercisesCache = await listExercises();
  exerciseSelect.innerHTML = exercisesCache.map(ex => `<option value="${ex.id}">${ex.name}</option>`).join('');
}

async function loadList(){
  const items = await listWorkoutExercises(workoutId);

  if(items.length === 0){
    listPanel.innerHTML = '<p class="muted" style="padding:20px">Nenhum exercício na ficha ainda.</p>';
    return;
  }

  listPanel.innerHTML = items.map(item => `
    <div class="list-item">
      <div class="list-item-info">
        <span class="list-item-title">${item.exercises.name}</span>
        <span class="list-item-sub">${item.target_sets}x${item.target_reps}${item.target_weight ? ' · ' + item.target_weight + 'kg' : ''} · descanso ${item.rest_seconds}s</span>
      </div>
      <div class="list-item-actions">
        <button type="button" class="btn-icon" data-edit="${item.id}">✎</button>
        <button type="button" class="btn-icon danger" data-delete="${item.id}">✕</button>
      </div>
    </div>
  `).join('');

  listPanel.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => startEdit(items.find(i => i.id === btn.dataset.edit)));
  });
  listPanel.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => removeItem(btn.dataset.delete));
  });
}

function startEdit(item){
  editingId = item.id;
  exerciseSelect.value = item.exercise_id;
  targetSetsInput.value = item.target_sets;
  targetRepsInput.value = item.target_reps;
  targetWeightInput.value = item.target_weight || '';
  restSecondsInput.value = item.rest_seconds;
  notesInput.value = item.notes || '';
  formTitle.innerText = 'Editar exercício da ficha';
  btnCancel.style.display = 'inline-block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function removeItem(id){
  if(!confirm('Remover este exercício da ficha?')) return;
  await removeWorkoutExercise(id);
  await loadList();
}

btnSave.addEventListener('click', async () => {
  if(!exerciseSelect.value){
    showMessage('Cadastre um exercício primeiro.', 'warning');
    return;
  }

  const payload = {
    workout_id: workoutId,
    exercise_id: exerciseSelect.value,
    target_sets: Number(targetSetsInput.value) || 1,
    target_reps: targetRepsInput.value.trim() || '10',
    target_weight: targetWeightInput.value ? Number(targetWeightInput.value) : null,
    rest_seconds: Number(restSecondsInput.value) || 0,
    notes: notesInput.value.trim() || null
  };

  if(editingId){
    await updateWorkoutExercise(editingId, payload);
    showMessage('Exercício atualizado.', 'success');
  } else {
    await addWorkoutExercise(user.id, payload);
    showMessage('Exercício adicionado.', 'success');
  }

  resetForm();
  await loadList();
});

btnCancel.addEventListener('click', resetForm);

const workout = await getWorkout(workoutId);
workoutNameEl.innerText = workout.name;

await loadExerciseOptions();
if(exercisesCache.length === 0){
  showMessage('Cadastre exercícios antes de montar a ficha.', 'warning');
}

resetForm();
await loadList();

// ── Buscar na biblioteca ────────────────────────────────────────────
const btnToggleLibSearch = document.getElementById('btnToggleLibSearch');
const libSearchPanel = document.getElementById('libSearchPanel');
const libSearchInput = document.getElementById('libSearchInput');
const libSearchResults = document.getElementById('libSearchResults');

let libDebounceTimer = null;

btnToggleLibSearch.addEventListener('click', () => {
  const isOpen = libSearchPanel.style.display !== 'none';
  libSearchPanel.style.display = isOpen ? 'none' : 'block';
});

async function runLibSearch(){
  const query = libSearchInput.value.trim();

  if(!query){
    libSearchResults.innerHTML = '';
    return;
  }

  const results = await searchLibraryExercises({ query, limit: 10 });

  if(results.length === 0){
    libSearchResults.innerHTML = '<p class="muted" style="padding:8px 0">Nenhum exercício encontrado.</p>';
    return;
  }

  libSearchResults.innerHTML = results.map(ex => `
    <div class="lib-result-item">
      <div class="lib-result-info">
        <strong>${ex.name}</strong><br>
        <span class="muted">${ex.muscle_group}${ex.equipment ? ' · ' + ex.equipment : ''}</span>
      </div>
      <button type="button" class="btn-icon" data-add-lib="${ex.id}">+</button>
    </div>
  `).join('');

  libSearchResults.querySelectorAll('[data-add-lib]').forEach(btn => {
    const ex = results.find(r => r.id === btn.dataset.addLib);
    btn.addEventListener('click', async () => {
      const created = await addExerciseFromLibrary(user.id, ex);
      await loadExerciseOptions();
      exerciseSelect.value = created.id;
      showMessage(`"${ex.name}" adicionado. Já selecionado acima.`, 'success');
      libSearchPanel.style.display = 'none';
      libSearchInput.value = '';
      libSearchResults.innerHTML = '';
    });
  });
}

libSearchInput.addEventListener('input', () => {
  clearTimeout(libDebounceTimer);
  libDebounceTimer = setTimeout(runLibSearch, 300);
});
