import { supabase } from './supabaseClient.js';
import { navigate } from './router.js';
import { renderNav } from './navigation.js';
import { initPWA } from './pwa.js';
import { listWorkouts, createWorkout, updateWorkout, deleteWorkout } from './services/workoutService.js';

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

  if(workouts.length === 0){
    listPanel.innerHTML = '<p class="muted" style="padding:20px">Nenhuma ficha cadastrada ainda.</p>';
    return;
  }

  listPanel.innerHTML = workouts.map(w => `
    <div class="list-item">
      <div class="list-item-info">
        <span class="list-item-title">${w.name}${w.is_active ? '' : ' (inativa)'}</span>
        <span class="list-item-sub">${w.description || ''}</span>
      </div>
      <div class="list-item-actions">
        ${w.is_active ? `<a href="./train.html?id=${w.id}" class="btn-icon" title="Treinar">▶</a>` : ''}
        <a href="./workout-edit.html?id=${w.id}" class="btn-icon" title="Montar exercícios">🏋</a>
        <button type="button" class="btn-icon" data-edit="${w.id}">✎</button>
        <button type="button" class="btn-icon danger" data-delete="${w.id}">✕</button>
      </div>
    </div>
  `).join('');

  listPanel.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => startEdit(workouts.find(w => w.id === btn.dataset.edit)));
  });
  listPanel.querySelectorAll('[data-delete]').forEach(btn => {
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

resetForm();
await loadList();
