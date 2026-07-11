import { supabase } from './supabaseClient.js';
import { navigate } from './router.js';
import {
  getWorkout, listWorkoutExercises,
  createWorkoutSession, finishWorkoutSession,
  getLastSets, recordSet
} from './services/workoutService.js';

const { data: sd } = await supabase.auth.getSession();
if(!sd.session) navigate('../login.html');
const user = sd.session.user;

const workoutId = new URLSearchParams(location.search).get('id');
if(!workoutId) navigate('./workouts.html');

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
let restRemaining = 0;
let session = null;
let exercisesData = [];

function setRowHTML(ei, setNumber, prevLabel, kg, reps){
  return `
    <div class="set-row" id="set-${ei}-${setNumber}">
      <div class="set-num">${setNumber}</div>
      <div class="set-prev">${prevLabel || '—'}</div>
      <input class="set-input" type="number" inputmode="decimal" value="${kg ?? ''}" aria-label="Carga em kg">
      <input class="set-input" type="number" inputmode="numeric" value="${reps ?? ''}" aria-label="Repetições">
      <button type="button" class="check-btn" data-exercise="${ei}" data-set="${setNumber}" aria-label="Concluir série ${setNumber}">✓</button>
    </div>`;
}

async function buildWorkout(){
  const items = await listWorkoutExercises(workoutId);
  exercisesData = [];

  for(const item of items){
    const lastSets = await getLastSets(item.exercise_id);

    const ex = {
      exerciseId: item.exercise_id,
      name: item.exercises.name,
      equipment: item.exercises.equipment,
      imageUrl: item.exercises.image_url,
      rest: item.rest_seconds,
      sets: []
    };

    for(let i = 0; i < item.target_sets; i++){
      const prev = lastSets[i];
      ex.sets.push({
        prev: prev ? `${prev.weight ?? 0}kg x ${prev.reps ?? 0}` : null,
        kg: prev ? prev.weight : item.target_weight,
        reps: prev ? prev.reps : (parseInt(item.target_reps) || '')
      });
    }

    exercisesData.push(ex);
  }

  totalSets = exercisesData.reduce((sum, ex) => sum + ex.sets.length, 0);
  totalCountEl.textContent = totalSets;

  workoutMain.innerHTML = '';

  exercisesData.forEach((ex, ei) => {
    const card = document.createElement('section');
    card.className = 'exercise';
    card.id = 'ex-' + ei;

    let rows = '';
    ex.sets.forEach((set, i) => rows += setRowHTML(ei, i + 1, set.prev, set.kg, set.reps));

    card.innerHTML = `
      <div class="ex-head">
        <div class="ex-thumb">${ex.imageUrl ? `<img src="${ex.imageUrl}" alt="">` : '🏋️'}</div>
        <div class="ex-name">${ex.name}${ex.equipment ? ' (' + ex.equipment + ')' : ''}</div>
      </div>
      <div class="ex-rest">⏱ Descanso: ${Math.floor(ex.rest / 60)}min ${ex.rest % 60}s</div>
      <div class="sets-header">
        <div>Série</div><div class="left">Anterior</div><div>KG</div><div>Reps</div><div>✓</div>
      </div>
      <div class="sets-body" id="sets-${ei}">${rows}</div>
      <button type="button" class="add-set-btn" data-exercise="${ei}">+ Adicionar série</button>`;

    workoutMain.appendChild(card);
  });

  workoutMain.querySelectorAll('.check-btn').forEach(btn => {
    btn.addEventListener('click', () => completeSet(Number(btn.dataset.exercise), Number(btn.dataset.set)));
  });
  workoutMain.querySelectorAll('.add-set-btn').forEach(btn => {
    btn.addEventListener('click', () => addSet(Number(btn.dataset.exercise)));
  });
}

async function completeSet(ei, setNumber){
  const row = document.getElementById(`set-${ei}-${setNumber}`);
  if(row.classList.contains('completed')) return;

  const inputs = row.querySelectorAll('.set-input');
  const kg = parseFloat(inputs[0].value) || 0;
  const reps = parseInt(inputs[1].value) || 0;
  const ex = exercisesData[ei];

  await recordSet(user.id, {
    session_id: session.id,
    exercise_id: ex.exerciseId,
    set_number: setNumber,
    reps,
    weight: kg
  });

  row.classList.add('completed');
  totalVolume += kg * reps;
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

  startRest(ex.rest, ex.name, done, total);
}

function addSet(ei){
  const ex = exercisesData[ei];
  const body = document.getElementById('sets-' + ei);
  const setNumber = body.querySelectorAll('.set-row').length + 1;
  const last = ex.sets[ex.sets.length - 1];
  const newSet = { prev: null, kg: last.kg, reps: last.reps };
  ex.sets.push(newSet);
  body.insertAdjacentHTML('beforeend', setRowHTML(ei, setNumber, null, newSet.kg, newSet.reps));

  document.querySelector(`#set-${ei}-${setNumber} .check-btn`)
    .addEventListener('click', () => completeSet(ei, setNumber));

  totalSets++;
  totalCountEl.textContent = totalSets;
  progressFill.style.width = (doneSets / totalSets * 100) + '%';
  finishBtn.classList.remove('ready');
  document.getElementById('ex-' + ei).classList.remove('done');
}

function startRest(seconds, exName, done, total){
  restRemaining = seconds;
  restContext.textContent = `${exName} — série ${done}/${total} feita`;
  updateRestDisplay();
  restSheet.classList.add('open');
  clearInterval(restInterval);
  restInterval = setInterval(() => {
    restRemaining--;
    updateRestDisplay();
    if(restRemaining <= 0){
      if(navigator.vibrate) navigator.vibrate([200, 100, 200]);
      closeRest();
    }
  }, 1000);
}

function updateRestDisplay(){
  restTime.textContent = Math.floor(restRemaining / 60) + ':' + String(restRemaining % 60).padStart(2, '0');
  restTime.classList.toggle('ending', restRemaining <= 10);
}

function closeRest(){
  clearInterval(restInterval);
  restSheet.classList.remove('open');
}

document.getElementById('btnAddRest').addEventListener('click', () => {
  restRemaining += 30;
  updateRestDisplay();
});

document.getElementById('btnSkipRest').addEventListener('click', closeRest);

finishBtn.addEventListener('click', async () => {
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

setInterval(() => {
  const t = Math.floor((Date.now() - startTime) / 1000);
  elapsedEl.textContent = String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
}, 1000);

const workout = await getWorkout(workoutId);
workoutNameEl.textContent = workout.name;
session = await createWorkoutSession(user.id, workoutId);
await buildWorkout();
