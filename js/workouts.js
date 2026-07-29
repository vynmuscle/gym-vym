import { supabase } from './supabaseClient.js';
import { navigate } from './router.js';
import { renderNav } from './navigation.js';
import { initPWA } from './pwa.js';
import { listWorkouts, createWorkout, updateWorkout, deleteWorkout, listWorkoutExercises } from './services/workoutService.js';

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

let editingId = null;

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

btnAskAiProgram.addEventListener('click', async () => {
  showAiProgramMessage('Avaliando programa... isso pode levar até 20s.');
  aiProgramResult.style.display = 'none';
  btnAskAiProgram.disabled = true;

  try {
    const active = (await listWorkouts()).filter(w => w.is_active);

    if(active.length === 0){
      showAiProgramMessage('Nenhuma ficha ativa pra avaliar.', 'warning');
      return;
    }

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
  } catch(err){
    showAiProgramMessage('Erro de conexão. Tente de novo.', 'danger');
  } finally {
    btnAskAiProgram.disabled = false;
  }
});

resetForm();
await loadList();
