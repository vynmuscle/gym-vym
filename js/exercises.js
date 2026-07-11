import { supabase } from './supabaseClient.js';
import { navigate } from './router.js';
import { renderNav } from './navigation.js';
import { listExercises, createExercise, updateExercise, deleteExercise } from './services/workoutService.js';

const { data: sd } = await supabase.auth.getSession();
if(!sd.session) navigate('../login.html');
const user = sd.session.user;

renderNav('exercises');

const nameInput = document.getElementById('name');
const muscleGroupInput = document.getElementById('muscleGroup');
const equipmentInput = document.getElementById('equipment');
const notesInput = document.getElementById('notes');
const btnSave = document.getElementById('btnSave');
const btnCancel = document.getElementById('btnCancel');
const formTitle = document.getElementById('formTitle');
const mensagem = document.getElementById('mensagem');
const listPanel = document.getElementById('listPanel');

let editingId = null;

function showMessage(text, type = 'info'){
  mensagem.className = `message ${type}`;
  mensagem.innerText = text;
}

function resetForm(){
  editingId = null;
  nameInput.value = '';
  muscleGroupInput.value = 'peito';
  equipmentInput.value = '';
  notesInput.value = '';
  formTitle.innerText = 'Novo exercício';
  btnCancel.style.display = 'none';
}

async function loadList(){
  const exercises = await listExercises();

  if(exercises.length === 0){
    listPanel.innerHTML = '<p class="muted" style="padding:20px">Nenhum exercício cadastrado ainda.</p>';
    return;
  }

  listPanel.innerHTML = exercises.map(ex => `
    <div class="list-item">
      <div class="list-item-info">
        <span class="list-item-title">${ex.name}</span>
        <span class="list-item-sub">${ex.muscle_group}${ex.equipment ? ' · ' + ex.equipment : ''}</span>
      </div>
      <div class="list-item-actions">
        <button type="button" class="btn-icon" data-edit="${ex.id}">✎</button>
        <button type="button" class="btn-icon danger" data-delete="${ex.id}">✕</button>
      </div>
    </div>
  `).join('');

  listPanel.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => startEdit(exercises.find(e => e.id === btn.dataset.edit)));
  });
  listPanel.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => removeExercise(btn.dataset.delete));
  });
}

function startEdit(ex){
  editingId = ex.id;
  nameInput.value = ex.name;
  muscleGroupInput.value = ex.muscle_group;
  equipmentInput.value = ex.equipment || '';
  notesInput.value = ex.notes || '';
  formTitle.innerText = 'Editar exercício';
  btnCancel.style.display = 'inline-block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function removeExercise(id){
  if(!confirm('Excluir este exercício?')) return;
  await deleteExercise(id);
  await loadList();
}

btnSave.addEventListener('click', async () => {
  const name = nameInput.value.trim();

  if(!name){
    showMessage('Informe o nome do exercício.', 'warning');
    return;
  }

  const payload = {
    name,
    muscle_group: muscleGroupInput.value,
    equipment: equipmentInput.value || null,
    notes: notesInput.value.trim() || null
  };

  if(editingId){
    await updateExercise(editingId, payload);
    showMessage('Exercício atualizado.', 'success');
  } else {
    await createExercise(user.id, payload);
    showMessage('Exercício criado.', 'success');
  }

  resetForm();
  await loadList();
});

btnCancel.addEventListener('click', resetForm);

resetForm();
await loadList();
