import { supabase } from './supabaseClient.js';
import { navigate } from './router.js';
import { renderNav } from './navigation.js';
import {
  listExercises, createExercise, updateExercise, deleteExercise,
  searchLibraryExercises, addExerciseFromLibrary
} from './services/workoutService.js';

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

// ── Abas ──────────────────────────────────────────────────────────────
const tabMeus = document.getElementById('tabMeus');
const tabBiblioteca = document.getElementById('tabBiblioteca');
const meusSection = document.getElementById('meusSection');
const bibliotecaSection = document.getElementById('bibliotecaSection');

tabMeus.addEventListener('click', () => {
  tabMeus.classList.add('active');
  tabBiblioteca.classList.remove('active');
  meusSection.style.display = 'block';
  bibliotecaSection.style.display = 'none';
});

tabBiblioteca.addEventListener('click', () => {
  tabBiblioteca.classList.add('active');
  tabMeus.classList.remove('active');
  bibliotecaSection.style.display = 'block';
  meusSection.style.display = 'none';
});

// ── Biblioteca ────────────────────────────────────────────────────────
const libSearch = document.getElementById('libSearch');
const libMuscleFilter = document.getElementById('libMuscleFilter');
const libGrid = document.getElementById('libGrid');
const libDetailPanel = document.getElementById('libDetailPanel');
const btnLoadMore = document.getElementById('btnLoadMore');
const libMensagem = document.getElementById('libMensagem');

const LIB_PAGE_SIZE = 24;
let libOffset = 0;
let libResults = [];
let libDebounceTimer = null;

function showLibMessage(text, type = 'info'){
  libMensagem.className = `message ${type}`;
  libMensagem.innerText = text;
}

async function loadLibrary(reset){
  if(reset){
    libOffset = 0;
    libResults = [];
    libGrid.innerHTML = '';
    libDetailPanel.style.display = 'none';
  }

  const page = await searchLibraryExercises({
    query: libSearch.value.trim(),
    muscleGroup: libMuscleFilter.value,
    offset: libOffset,
    limit: LIB_PAGE_SIZE
  });

  libResults = libResults.concat(page);
  libOffset += page.length;

  page.forEach(ex => {
    const card = document.createElement('div');
    card.className = 'lib-card';
    card.dataset.libId = ex.id;
    card.innerHTML = `
      <div class="lib-thumb">${ex.image_urls?.[0] ? `<img src="${ex.image_urls[0]}" alt="">` : '🏋️'}</div>
      <span class="lib-card-name">${ex.name}</span>
      <span class="lib-card-meta">${ex.muscle_group}${ex.equipment ? ' · ' + ex.equipment : ''}</span>
    `;
    card.addEventListener('click', () => showLibDetail(ex));
    libGrid.appendChild(card);
  });

  btnLoadMore.style.display = page.length === LIB_PAGE_SIZE ? 'block' : 'none';

  if(reset && page.length === 0){
    showLibMessage('Nenhum exercício encontrado.', 'warning');
  } else {
    showLibMessage('');
  }
}

function showLibDetail(ex){
  libDetailPanel.style.display = 'block';
  libDetailPanel.innerHTML = `
    <div class="lib-detail-header">
      <div>
        <h3 style="margin-bottom:4px">${ex.name}</h3>
        <span class="lib-card-meta">${ex.muscle_group}${ex.equipment ? ' · ' + ex.equipment : ''}${ex.level ? ' · ' + ex.level : ''}</span>
      </div>
      <button type="button" class="btn-icon" id="btnCloseLibDetail">✕</button>
    </div>
    ${ex.image_urls?.length ? `<div class="lib-detail-images">${ex.image_urls.map(url => `<img src="${url}" alt="">`).join('')}</div>` : ''}
    <div class="lib-detail-instructions">${ex.instructions || 'Sem instruções disponíveis.'}</div>
    <button type="button" class="btn btn-primary full" id="btnAddFromLib">Adicionar aos meus exercícios</button>
  `;

  document.getElementById('btnCloseLibDetail').addEventListener('click', () => {
    libDetailPanel.style.display = 'none';
  });

  document.getElementById('btnAddFromLib').addEventListener('click', async () => {
    await addExerciseFromLibrary(user.id, ex);
    showLibMessage(`"${ex.name}" adicionado aos seus exercícios.`, 'success');
  });

  libDetailPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

libSearch.addEventListener('input', () => {
  clearTimeout(libDebounceTimer);
  libDebounceTimer = setTimeout(() => loadLibrary(true), 300);
});

libMuscleFilter.addEventListener('change', () => loadLibrary(true));
btnLoadMore.addEventListener('click', () => loadLibrary(false));

tabBiblioteca.addEventListener('click', () => {
  if(libResults.length === 0) loadLibrary(true);
}, { once: true });
