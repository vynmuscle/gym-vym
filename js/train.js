import { supabase } from './supabaseClient.js';
import { navigate } from './router.js';
import { initPWA } from './pwa.js';
import { openExercisePicker } from './exercisePicker.js';
import { queueSet, flushQueue, onSetSynced } from './services/offlineQueue.js';
import {
  getWorkout, listWorkoutExercises,
  createWorkoutSession, finishWorkoutSession,
  getLastSets, recordSet, swapWorkoutExerciseExercise
} from './services/workoutService.js';

const { data: sd } = await supabase.auth.getSession();
if(!sd.session) navigate('../login.html');
const user = sd.session.user;

initPWA();

const urlParams = new URLSearchParams(location.search);
const workoutId = urlParams.get('id');
const existingSessionId = urlParams.get('session');
const workoutIdValid = !!workoutId && workoutId !== 'null' && workoutId !== 'undefined';

const trainError = document.getElementById('trainError');
const trainErrorMsg = document.getElementById('trainErrorMsg');
const trainErrorLink = document.getElementById('trainErrorLink');

function showTrainError(msg, linkHref, linkLabel){
  document.querySelector('header').style.display = 'none';
  document.querySelector('.finish-bar').style.display = 'none';
  document.getElementById('workout').style.display = 'none';
  trainErrorMsg.textContent = msg;
  trainErrorLink.href = linkHref;
  trainErrorLink.textContent = linkLabel;
  trainError.style.display = 'block';
}

const workoutNameEl = document.getElementById('workoutName');
const elapsedEl = document.getElementById('elapsed');
const progressFill = document.getElementById('progressFill');
const doneCountEl = document.getElementById('doneCount');
const totalCountEl = document.getElementById('totalCount');
const workoutMain = document.getElementById('workout');
const finishBtn = document.getElementById('finishBtn');
const restSheet = document.getElementById('restSheet');
const restTime = document.getElementById('restTime');
const restContext = document.getElementById('restContext');
const summaryOverlay = document.getElementById('summary');
const summarySub = document.getElementById('summarySub');
const sumTime = document.getElementById('sumTime');
const sumSets = document.getElementById('sumSets');
const sumVolume = document.getElementById('sumVolume');

let doneSets = 0;
let totalSets = 0;
let totalVolume = 0;
const startTime = Date.now();
let restInterval = null;
let restEndTime = 0;
let restExName = '';
let restDone = 0;
let restTotal = 0;
let session = null;
let exercisesData = [];

const REST_STORAGE_KEY = 'gymvym_rest_end';

if('Notification' in window && Notification.permission === 'default'){
  Notification.requestPermission().catch(() => {});
}

function playRestSound(){
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
    osc.onended = () => ctx.close();
  } catch(err) {}
}

function notifyRestOver(exName){
  if(!('Notification' in window) || Notification.permission !== 'granted') return;
  if(!document.hidden) return;
  try {
    new Notification('Descanso terminado!', {
      body: `Hora de voltar: ${exName}`,
      icon: '/icons/icon-192.png',
      tag: 'gymvym-rest'
    });
  } catch(err) {}
}

function setRowHTML(ei, setNumber, set, isCardio){
  const checkCol = `
    <div class="check-col">
      <button type="button" class="check-btn" data-exercise="${ei}" data-set="${setNumber}" aria-label="Concluir série ${setNumber}">✓</button>
      <button type="button" class="note-btn" aria-label="Observação">📝</button>
    </div>`;

  if(isCardio){
    return `
      <div class="set-row" id="set-${ei}-${setNumber}">
        <div class="set-num">${setNumber}</div>
        <div class="set-prev">${set.prev || '—'}</div>
        <div class="stepper-col">
          <button type="button" class="step-btn" data-step="1" data-field="durationMin">+</button>
          <input class="set-input" type="number" inputmode="numeric" value="${set.durationMin ?? ''}" aria-label="Minutos" data-field="durationMin">
          <button type="button" class="step-btn" data-step="-1" data-field="durationMin">−</button>
        </div>
        <div class="set-cardio-unit">min</div>
        ${checkCol}
      </div>
      <div class="set-note-row" id="note-${ei}-${setNumber}" style="display:none">
        <input type="text" class="set-note-input" placeholder="Observação (opcional)">
      </div>`;
  }

  return `
    <div class="set-row" id="set-${ei}-${setNumber}">
      <div class="set-num">${setNumber}</div>
      <div class="set-prev">${set.prev || '—'}</div>
      <div class="stepper-col">
        <button type="button" class="step-btn" data-step="1" data-field="kg">+</button>
        <input class="set-input" type="number" inputmode="decimal" value="${set.kg ?? ''}" aria-label="Carga em kg" data-field="kg">
        <button type="button" class="step-btn" data-step="-1" data-field="kg">−</button>
      </div>
      <div class="stepper-col">
        <button type="button" class="step-btn" data-step="1" data-field="reps">+</button>
        <input class="set-input" type="number" inputmode="numeric" value="${set.reps ?? ''}" aria-label="Repetições" data-field="reps">
        <button type="button" class="step-btn" data-step="-1" data-field="reps">−</button>
      </div>
      ${checkCol}
    </div>
    <div class="set-note-row" id="note-${ei}-${setNumber}" style="display:none">
      <input type="text" class="set-note-input" placeholder="Observação (opcional)">
    </div>`;
}

function wireRow(ei, setNumber){
  const row = document.getElementById(`set-${ei}-${setNumber}`);
  if(!row) return;

  row.querySelector('.check-btn').addEventListener('click', () => completeSet(ei, setNumber));

  row.querySelectorAll('.step-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = row.querySelector(`[data-field="${btn.dataset.field}"]`);
      const step = Number(btn.dataset.step);
      const next = Math.max(0, (parseFloat(input.value) || 0) + step);
      input.value = next;
    });
  });

  const noteBtn = row.querySelector('.note-btn');
  if(noteBtn){
    noteBtn.addEventListener('click', () => {
      const noteRow = document.getElementById(`note-${ei}-${setNumber}`);
      const open = noteRow.style.display !== 'none';
      noteRow.style.display = open ? 'none' : 'block';
      if(!open) noteRow.querySelector('.set-note-input').focus();
    });
  }
}

function showExerciseInfo(ex){
  const overlay = document.createElement('div');
  overlay.className = 'ex-info-overlay';
  overlay.innerHTML = `
    <div class="ex-info-card">
      <button type="button" class="ex-info-close" aria-label="Fechar">✕</button>
      <h3>${ex.name}</h3>
      ${ex.imageUrl ? `<img src="${ex.imageUrl}" alt="" class="ex-info-img">` : ''}
      <div class="ex-info-text">${ex.instructions || 'Sem instruções disponíveis para este exercício.'}</div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.ex-info-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if(e.target === overlay) overlay.remove(); });
}

function swapExercise(ei){
  const ex = exercisesData[ei];
  openExercisePicker({
    userId: user.id,
    initialGroup: ex.muscleGroup,
    onPick: async (newEx) => {
      await swapWorkoutExerciseExercise(ex.workoutExerciseId, newEx.id);
      await refreshExerciseCard(ei, newEx);
    }
  });
}

async function refreshExerciseCard(ei, newEx){
  const ex = exercisesData[ei];
  const card = document.getElementById('ex-' + ei);
  const doneInCard = card.querySelectorAll('.set-row.completed').length;
  doneSets = Math.max(0, doneSets - doneInCard);
  doneCountEl.textContent = doneSets;

  const isCardio = newEx.muscle_group === 'cardio';
  const lastSets = await getLastSets(newEx.id);
  const setCount = ex.sets.length;

  ex.exerciseId = newEx.id;
  ex.name = newEx.name;
  ex.equipment = newEx.equipment;
  ex.imageUrl = newEx.image_url;
  ex.instructions = newEx.instructions;
  ex.muscleGroup = newEx.muscle_group;
  ex.isCardio = isCardio;
  ex.sets = [];

  for(let i = 0; i < setCount; i++){
    const prev = lastSets[i];
    if(isCardio){
      ex.sets.push({
        prev: prev ? `${Math.round((prev.duration_seconds || 0) / 60)}min` : null,
        durationMin: prev ? Math.round((prev.duration_seconds || 0) / 60) : 20
      });
    } else {
      ex.sets.push({
        prev: prev ? `${prev.weight ?? 0}kg x ${prev.reps ?? 0}` : null,
        kg: prev ? prev.weight : null,
        reps: prev ? prev.reps : null
      });
    }
  }

  renderExerciseCard(ei);
  progressFill.style.width = totalSets ? (doneSets / totalSets * 100) + '%' : '0%';
  finishBtn.classList.remove('ready');
}

function renderExerciseCard(ei){
  const ex = exercisesData[ei];
  let card = document.getElementById('ex-' + ei);
  if(!card){
    card = document.createElement('section');
    card.className = 'exercise';
    card.id = 'ex-' + ei;
    workoutMain.appendChild(card);
  }
  card.classList.remove('done');

  let rows = '';
  ex.sets.forEach((set, i) => rows += setRowHTML(ei, i + 1, set, ex.isCardio));

  const restLabel = ex.isCardio ? '' : `<div class="ex-rest">⏱ Descanso: ${Math.floor(ex.rest / 60)}min ${ex.rest % 60}s</div>`;
  const headerLabels = ex.isCardio
    ? `<div>Série</div><div class="left">Anterior</div><div>Min</div><div></div><div>✓</div>`
    : `<div>Série</div><div class="left">Anterior</div><div>KG</div><div>Reps</div><div>✓</div>`;

  card.innerHTML = `
    <div class="ex-head">
      <div class="ex-thumb">${ex.imageUrl ? `<img src="${ex.imageUrl}" alt="">` : '🏋️'}</div>
      <div class="ex-name">${ex.name}${ex.equipment ? ' (' + ex.equipment + ')' : ''}</div>
      <button type="button" class="ex-action-btn" aria-label="Como executar">ℹ️</button>
      <button type="button" class="ex-action-btn" aria-label="Substituir exercício">🔁</button>
    </div>
    ${restLabel}
    <div class="sets-header">${headerLabels}</div>
    <div class="sets-body" id="sets-${ei}">${rows}</div>
    <button type="button" class="add-set-btn" data-exercise="${ei}">+ Adicionar série</button>`;

  ex.sets.forEach((_, i) => wireRow(ei, i + 1));

  card.querySelector('.add-set-btn').addEventListener('click', () => addSet(ei));
  const [infoBtn, swapBtn] = card.querySelectorAll('.ex-action-btn');
  infoBtn.addEventListener('click', () => showExerciseInfo(ex));
  swapBtn.addEventListener('click', () => swapExercise(ei));
}

async function buildWorkout(){
  const items = await listWorkoutExercises(workoutId);
  exercisesData = [];

  for(const item of items){
    const lastSets = await getLastSets(item.exercise_id);
    const isCardio = item.exercises.muscle_group === 'cardio';

    const ex = {
      workoutExerciseId: item.id,
      exerciseId: item.exercise_id,
      name: item.exercises.name,
      equipment: item.exercises.equipment,
      imageUrl: item.exercises.image_url,
      instructions: item.exercises.instructions,
      muscleGroup: item.exercises.muscle_group,
      isCardio,
      rest: item.rest_seconds,
      sets: []
    };

    const setCount = isCardio ? 1 : item.target_sets;
    for(let i = 0; i < setCount; i++){
      const prev = lastSets[i];
      if(isCardio){
        ex.sets.push({
          prev: prev ? `${Math.round((prev.duration_seconds || 0) / 60)}min` : null,
          durationMin: prev ? Math.round((prev.duration_seconds || 0) / 60) : Math.round((item.target_duration_seconds || 1200) / 60)
        });
      } else {
        ex.sets.push({
          prev: prev ? `${prev.weight ?? 0}kg x ${prev.reps ?? 0}` : null,
          kg: prev ? prev.weight : item.target_weight,
          reps: prev ? prev.reps : (parseInt(item.target_reps) || '')
        });
      }
    }

    exercisesData.push(ex);
  }

  totalSets = exercisesData.reduce((sum, ex) => sum + ex.sets.length, 0);
  totalCountEl.textContent = totalSets;

  workoutMain.innerHTML = '';
  exercisesData.forEach((ex, ei) => renderExerciseCard(ei));
}

onSetSynced((item) => {
  if(!item.meta) return;
  const row = document.getElementById(`set-${item.meta.ei}-${item.meta.setNumber}`);
  if(!row) return;
  row.classList.remove('pending');
  const checkBtn = row.querySelector('.check-btn');
  if(checkBtn) checkBtn.textContent = '✓';
});

async function completeSet(ei, setNumber){
  const row = document.getElementById(`set-${ei}-${setNumber}`);
  if(row.classList.contains('completed')) return;

  const ex = exercisesData[ei];
  const noteRow = document.getElementById(`note-${ei}-${setNumber}`);
  const noteValue = noteRow?.querySelector('.set-note-input')?.value.trim() || null;

  let payload;
  let kg = 0, reps = 0;

  if(ex.isCardio){
    const minutes = parseFloat(row.querySelector('[data-field="durationMin"]').value) || 0;
    payload = {
      session_id: session.id,
      exercise_id: ex.exerciseId,
      set_number: setNumber,
      duration_seconds: Math.round(minutes * 60),
      notes: noteValue
    };
  } else {
    kg = parseFloat(row.querySelector('[data-field="kg"]').value) || 0;
    reps = parseInt(row.querySelector('[data-field="reps"]').value) || 0;
    payload = {
      session_id: session.id,
      exercise_id: ex.exerciseId,
      set_number: setNumber,
      reps,
      weight: kg,
      notes: noteValue
    };
  }

  let pending = false;
  try {
    await recordSet(user.id, payload);
  } catch(err) {
    queueSet(user.id, payload, { ei, setNumber });
    pending = true;
  }

  row.classList.add('completed');
  if(pending){
    row.classList.add('pending');
    row.querySelector('.check-btn').textContent = '⏳';
  }
  if(!ex.isCardio) totalVolume += kg * reps;
  doneSets++;
  doneCountEl.textContent = doneSets;
  progressFill.style.width = (doneSets / totalSets * 100) + '%';

  const card = document.getElementById('ex-' + ei);
  const total = card.querySelectorAll('.set-row').length;
  const done = card.querySelectorAll('.set-row.completed').length;
  if(done === total) card.classList.add('done');

  if(doneSets >= totalSets){
    finishBtn.classList.add('ready');
    closeRest();
    return;
  }

  if(ex.rest > 0) startRest(ex.rest, ex.name, done, total);
}

function addSet(ei){
  const ex = exercisesData[ei];
  const body = document.getElementById('sets-' + ei);
  const setNumber = body.querySelectorAll('.set-row').length + 1;
  const last = ex.sets[ex.sets.length - 1];
  const newSet = ex.isCardio ? { prev: null, durationMin: last.durationMin } : { prev: null, kg: last.kg, reps: last.reps };
  ex.sets.push(newSet);
  body.insertAdjacentHTML('beforeend', setRowHTML(ei, setNumber, newSet, ex.isCardio));
  wireRow(ei, setNumber);

  totalSets++;
  totalCountEl.textContent = totalSets;
  progressFill.style.width = (doneSets / totalSets * 100) + '%';
  finishBtn.classList.remove('ready');
  document.getElementById('ex-' + ei).classList.remove('done');
}

function startRest(seconds, exName, done, total){
  restEndTime = Date.now() + seconds * 1000;
  restExName = exName;
  restDone = done;
  restTotal = total;
  localStorage.setItem(REST_STORAGE_KEY, JSON.stringify({ endTime: restEndTime, exName, done, total }));
  restContext.textContent = `${exName} — série ${done}/${total} feita`;
  restSheet.classList.add('open');
  updateRestDisplay();
  clearInterval(restInterval);
  restInterval = setInterval(updateRestDisplay, 1000);
}

function updateRestDisplay(){
  const remaining = Math.max(0, Math.round((restEndTime - Date.now()) / 1000));
  restTime.textContent = Math.floor(remaining / 60) + ':' + String(remaining % 60).padStart(2, '0');
  restTime.classList.toggle('ending', remaining <= 10);
  if(remaining <= 0){
    if(navigator.vibrate) navigator.vibrate([200, 100, 200]);
    playRestSound();
    notifyRestOver(restExName);
    closeRest();
  }
}

function closeRest(){
  clearInterval(restInterval);
  restSheet.classList.remove('open');
  localStorage.removeItem(REST_STORAGE_KEY);
}

document.addEventListener('visibilitychange', () => {
  if(document.hidden) return;
  if(!restSheet.classList.contains('open')) return;
  updateRestDisplay();
});

document.getElementById('btnAddRest').addEventListener('click', () => {
  restEndTime += 30000;
  localStorage.setItem(REST_STORAGE_KEY, JSON.stringify({ endTime: restEndTime, exName: restExName, done: restDone, total: restTotal }));
  updateRestDisplay();
});

document.getElementById('btnSkipRest').addEventListener('click', closeRest);

(function restoreRestFromStorage(){
  const raw = localStorage.getItem(REST_STORAGE_KEY);
  if(!raw) return;
  try {
    const saved = JSON.parse(raw);
    if(saved.endTime > Date.now()){
      restEndTime = saved.endTime;
      restExName = saved.exName;
      restDone = saved.done;
      restTotal = saved.total;
      restContext.textContent = `${saved.exName} — série ${saved.done}/${saved.total} feita`;
      restSheet.classList.add('open');
      updateRestDisplay();
      clearInterval(restInterval);
      restInterval = setInterval(updateRestDisplay, 1000);
    } else {
      localStorage.removeItem(REST_STORAGE_KEY);
    }
  } catch(err) {
    localStorage.removeItem(REST_STORAGE_KEY);
  }
})();

finishBtn.addEventListener('click', async () => {
  await flushQueue();
  await finishWorkoutSession(session.id);

  const t = Math.floor((Date.now() - startTime) / 1000);
  summarySub.textContent = workoutNameEl.textContent;
  sumTime.textContent = Math.floor(t / 60) + 'min';
  sumSets.textContent = doneSets;
  sumVolume.textContent = totalVolume.toLocaleString('pt-BR');
  closeRest();
  summaryOverlay.classList.add('open');
});

document.getElementById('btnBackToWorkouts').addEventListener('click', () => navigate('./workouts.html'));
document.getElementById('btnViewProgress').addEventListener('click', () => navigate('./progress.html'));

setInterval(() => {
  const t = Math.floor((Date.now() - startTime) / 1000);
  elapsedEl.textContent = String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
}, 1000);

if(!workoutIdValid){
  showTrainError('Nenhuma ficha selecionada.', './workouts.html', 'Ver fichas');
} else {
  let workout;
  try {
    workout = await getWorkout(workoutId);
  } catch(err) {
    showTrainError('Essa ficha não foi encontrada.', './workouts.html', 'Ver fichas');
  }

  if(workout){
    const items = await listWorkoutExercises(workoutId);
    if(items.length === 0){
      showTrainError('Essa ficha ainda não tem exercícios.', `./workout-edit.html?id=${workoutId}`, 'Montar exercícios');
    } else {
      workoutNameEl.textContent = workout.name;
      session = existingSessionId ? { id: existingSessionId } : await createWorkoutSession(user.id, workoutId);
      await buildWorkout();
      flushQueue();
    }
  }
}
