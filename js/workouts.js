import { supabase } from './supabaseClient.js';
import { navigate } from './router.js';
import { renderNav } from './navigation.js';
import { initPWA } from './pwa.js';
import {
  listWorkouts, createWorkout, updateWorkout, deleteWorkout, listWorkoutExercises,
  removeWorkoutExercise, addWorkoutExercise, listExercises, createExercise
} from './services/workoutService.js';

const { data: sd } = await supabase.auth.getSession();
if(!sd.session) navigate('../login.html');
const user = sd.session.user;
initPWA();

await renderNav('workouts');

const nameInput = document.getElementById('name');
const descriptionInput = document.getElementById('description');
const activeInput = document.getElementById('active');
const btnSave = document.getElementById('btnSave');
const btnCancel = document.getElementById('btnCancel');
const formTitle = document.getElementById('formTitle');
const mensagem = document.getElementById('mensagem');
const listPanel = document.getElementById('listPanel');
const archivedSection = document.getElementById('archivedSection');
const archivedSummary = document.getElementById('archivedSummary');
const archivedList = document.getElementById('archivedList');
const btnAskAiProgram = document.getElementById('btnAskAiProgram');
const aiProgramMsg = document.getElementById('aiProgramMsg');
const aiProgramResult = document.getElementById('aiProgramResult');
const aiProgramSuggestions = document.getElementById('aiProgramSuggestions');
const aiProgramSuggestionsList = document.getElementById('aiProgramSuggestionsList');
const btnApplyProgramSuggestions = document.getElementById('btnApplyProgramSuggestions');
const btnDiscardProgramSuggestions = document.getElementById('btnDiscardProgramSuggestions');
const aiProgramApplyMsg = document.getElementById('aiProgramApplyMsg');

let editingId = null;
let suggestedWorkouts = null;
let activeWorkoutIdByName = new Map();

function showMessage(text, type = 'info'){
  mensagem.className = `message ${type}`;
  mensagem.innerText = text;
}

function resetForm(){
  editingId = null;
  nameInput.value = '';
  descriptionInput.value = '';
  activeInput.checked = true;
  formTitle.innerText = 'Nova ficha';
  btnCancel.style.display = 'none';
}

async function loadList(){
  const workouts = await listWorkouts();
  const active = workouts.filter(w => w.is_active);
  const archived = workouts.filter(w => !w.is_active);

  if(active.length === 0){
    listPanel.innerHTML = `
      <div class="gv-empty-state gv-anim-card">
        <div class="gv-empty-state__icon">🏋️</div>
        <div class="gv-empty-state__title">Nenhuma ficha ainda</div>
        <div class="gv-empty-state__desc">Monte sua primeira ficha de treino no formulário acima.</div>
      </div>`;
  } else {
    listPanel.innerHTML = active.map(w => `
      <div class="list-item">
        <div class="list-item-info">
          <span class="list-item-title">${w.name}</span>
          <span class="list-item-sub">${w.description || ''}</span>
        </div>
        <div class="list-item-actions">
          <a href="./train.html?id=${w.id}" class="btn-icon" title="Treinar">▶</a>
          <a href="./workout-edit.html?id=${w.id}" class="btn-icon" title="Montar exercícios">🏋</a>
          <button type="button" class="btn-icon" data-edit="${w.id}">✎</button>
          <button type="button" class="btn-icon danger" data-delete="${w.id}">✕</button>
        </div>
      </div>
    `).join('');

    listPanel.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => startEdit(active.find(w => w.id === btn.dataset.edit)));
    });
    listPanel.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', () => removeWorkout(btn.dataset.delete));
    });
  }

  archivedSection.style.display = archived.length === 0 ? 'none' : 'block';
  archivedSummary.textContent = `Arquivadas (${archived.length})`;

  archivedList.innerHTML = archived.map(w => `
    <div class="list-item">
      <div class="list-item-info">
        <span class="list-item-title">${w.name}</span>
        <span class="list-item-sub">${w.description || ''}</span>
      </div>
      <div class="list-item-actions">
        <button type="button" class="btn-icon" data-reactivate="${w.id}" title="Reativar">↺</button>
        <button type="button" class="btn-icon" data-edit="${w.id}">✎</button>
        <button type="button" class="btn-icon danger" data-delete="${w.id}">✕</button>
      </div>
    </div>
  `).join('');

  archivedList.querySelectorAll('[data-reactivate]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await updateWorkout(btn.dataset.reactivate, { is_active: true });
      await loadList();
    });
  });
  archivedList.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => startEdit(archived.find(w => w.id === btn.dataset.edit)));
  });
  archivedList.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => removeWorkout(btn.dataset.delete));
  });
}

function startEdit(w){
  editingId = w.id;
  nameInput.value = w.name;
  descriptionInput.value = w.description || '';
  activeInput.checked = w.is_active;
  formTitle.innerText = 'Editar ficha';
  btnCancel.style.display = 'inline-block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function removeWorkout(id){
  if(!confirm('Excluir esta ficha? Os exercícios dela também serão removidos.')) return;
  await deleteWorkout(id);
  await loadList();
}

btnSave.addEventListener('click', async () => {
  const name = nameInput.value.trim();

  if(!name){
    showMessage('Informe o nome da ficha.', 'warning');
    return;
  }

  const payload = {
    name,
    description: descriptionInput.value.trim() || null,
    is_active: activeInput.checked
  };

  if(editingId){
    await updateWorkout(editingId, payload);
    showMessage('Ficha atualizada.', 'success');
  } else {
    await createWorkout(user.id, payload);
    showMessage('Ficha criada.', 'success');
  }

  resetForm();
  await loadList();
});

btnCancel.addEventListener('click', resetForm);

function showAiProgramMessage(text, type = 'info'){
  aiProgramMsg.className = `message ${type}`;
  aiProgramMsg.innerText = text;
}

function showAiApplyMessage(text, type = 'info'){
  aiProgramApplyMsg.className = `message ${type}`;
  aiProgramApplyMsg.innerText = text;
}

function renderProgramSuggestions(){
  aiProgramSuggestionsList.innerHTML = suggestedWorkouts.map((w, wi) => `
    <div class="panel ai-workout-card">
      <div class="ai-workout-head">
        <h3>${w.name}${!activeWorkoutIdByName.has(w.name.trim().toLowerCase()) ? ' (não encontrada — será ignorada)' : ''}</h3>
      </div>
      ${w.exercises.map((ex, ei) => `
        <div class="ai-exercise-row">
          <div class="ai-exercise-head">
            <span class="ai-exercise-name">${ex.name}</span>
            <span class="ai-exercise-meta">${ex.muscle_group || ''}${ex.equipment ? ' · ' + ex.equipment : ''}</span>
            <button type="button" class="btn-icon danger" data-remove-exercise data-workout="${wi}" data-exercise="${ei}">✕</button>
          </div>
          <div class="ai-exercise-fields">
            ${ex.is_duration ? `
              <label>Min
                <input type="number" min="1" value="${Math.round((ex.target_duration_seconds || 0) / 60)}" data-field="target_duration_min" data-workout="${wi}" data-exercise="${ei}">
              </label>
            ` : `
              <label>Séries
                <input type="number" min="1" value="${ex.target_sets}" data-field="target_sets" data-workout="${wi}" data-exercise="${ei}">
              </label>
              <label>Reps
                <input type="text" value="${ex.target_reps || ''}" data-field="target_reps" data-workout="${wi}" data-exercise="${ei}">
              </label>
            `}
            <label>Descanso (s)
              <input type="number" min="0" value="${ex.rest_seconds || 90}" data-field="rest_seconds" data-workout="${wi}" data-exercise="${ei}">
            </label>
          </div>
        </div>
      `).join('')}
    </div>
  `).join('');

  aiProgramSuggestionsList.querySelectorAll('[data-remove-exercise]').forEach(btn => {
    btn.addEventListener('click', () => {
      const wi = Number(btn.dataset.workout);
      const ei = Number(btn.dataset.exercise);
      suggestedWorkouts[wi].exercises.splice(ei, 1);
      renderProgramSuggestions();
    });
  });

  aiProgramSuggestionsList.querySelectorAll('[data-field]').forEach(input => {
    input.addEventListener('change', () => {
      const wi = Number(input.dataset.workout);
      const ei = Number(input.dataset.exercise);
      const field = input.dataset.field;
      const ex = suggestedWorkouts[wi].exercises[ei];
      if(field === 'target_duration_min') ex.target_duration_seconds = Number(input.value) * 60;
      else if(field === 'target_sets' || field === 'rest_seconds') ex[field] = Number(input.value);
      else ex[field] = input.value;
    });
  });
}

btnAskAiProgram.addEventListener('click', async () => {
  showAiProgramMessage('Avaliando programa... isso pode levar até 20s.');
  aiProgramResult.style.display = 'none';
  aiProgramSuggestions.style.display = 'none';
  showAiApplyMessage('');
  btnAskAiProgram.disabled = true;

  try {
    const active = (await listWorkouts()).filter(w => w.is_active);

    if(active.length === 0){
      showAiProgramMessage('Nenhuma ficha ativa pra avaliar.', 'warning');
      return;
    }

    activeWorkoutIdByName = new Map(active.map(w => [w.name.trim().toLowerCase(), w.id]));

    const workouts = [];
    for(const w of active){
      const items = await listWorkoutExercises(w.id);
      workouts.push({
        name: w.name,
        exercises: items.map(item => ({
          name: item.exercises.name,
          muscle_group: item.exercises.muscle_group,
          equipment: item.exercises.equipment,
          isDuration: item.exercises.tracking_type === 'duration',
          target_sets: item.target_sets,
          target_reps: item.target_reps,
          target_duration_seconds: item.target_duration_seconds,
          rest_seconds: item.rest_seconds
        }))
      });
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const res = await fetch('/api/ai-review-program', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ workouts })
    });

    const data = await res.json();

    if(!res.ok){
      showAiProgramMessage(data.error || 'Não consegui avaliar o programa agora.', 'danger');
      return;
    }

    showAiProgramMessage('');
    aiProgramResult.textContent = data.feedback;
    aiProgramResult.style.display = 'block';

    suggestedWorkouts = data.workouts;
    renderProgramSuggestions();
    aiProgramSuggestions.style.display = 'block';
  } catch(err){
    showAiProgramMessage('Erro de conexão. Tente de novo.', 'danger');
  } finally {
    btnAskAiProgram.disabled = false;
  }
});

btnDiscardProgramSuggestions.addEventListener('click', () => {
  suggestedWorkouts = null;
  aiProgramSuggestions.style.display = 'none';
  showAiApplyMessage('');
});

btnApplyProgramSuggestions.addEventListener('click', async () => {
  if(!suggestedWorkouts || suggestedWorkouts.length === 0){
    showAiApplyMessage('Nada pra aplicar.', 'warning');
    return;
  }

  const matched = suggestedWorkouts.filter(w => activeWorkoutIdByName.has(w.name.trim().toLowerCase()));

  if(matched.length === 0){
    showAiApplyMessage('Nenhuma ficha sugerida bateu com as fichas ativas atuais.', 'danger');
    return;
  }

  if(!confirm(`Isso substitui todos os exercícios de ${matched.length} ficha(s) pela sugestão da IA. Continuar?`)) return;

  btnApplyProgramSuggestions.disabled = true;
  showAiApplyMessage('Aplicando...');

  try {
    const existing = await listExercises();
    const exerciseCache = new Map(existing.map(e => [e.name.trim().toLowerCase(), e.id]));

    for(const w of matched){
      const workoutId = activeWorkoutIdByName.get(w.name.trim().toLowerCase());
      const currentItems = await listWorkoutExercises(workoutId);

      for(const item of currentItems){
        await removeWorkoutExercise(item.id);
      }

      let nonCardioOrder = 10;
      let cardioOrder = 900;

      for(const ex of w.exercises){
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
    }

    suggestedWorkouts = null;
    aiProgramSuggestions.style.display = 'none';
    aiProgramResult.style.display = 'none';
    showAiApplyMessage('');
    await loadList();
  } catch(err){
    showAiApplyMessage('Erro ao aplicar. Tente de novo.', 'danger');
  } finally {
    btnApplyProgramSuggestions.disabled = false;
  }
});

resetForm();
await loadList();
