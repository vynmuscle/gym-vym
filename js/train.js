import { supabase } from './supabaseClient.js';
import { navigate } from './router.js';
import { initPWA } from './pwa.js';
import { openExercisePicker } from './exercisePicker.js';
import { queueSet, flushQueue, onSetSynced, removeQueuedSet, renumberQueuedSet } from './services/offlineQueue.js';
import {
  getWorkout, listWorkoutExercises,
  createWorkoutSession, finishWorkoutSession, findIncompleteSessionForWorkout,
  getLastSets, getSessionSets, recordSet, deleteSessionSet, updateSessionSetNumber, swapWorkoutExerciseExercise,
  getProgressionForExercise, getPersonalRecordsMap, getUserXP, getSessionStartedAt
} from './services/workoutService.js';
import { showToast } from './toast.js';
import { checkAchievements } from './achievements.js';
import { getLeagueForXP } from './leagues.js';
import { listMeasurements } from './services/bodyService.js';
import { escapeHtml } from './utils/escapeHtml.js';
import { celebrate } from './design-system/motion.js';
import { estimateWorkoutKcal, findWeightAtDate } from './utils.js';

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
const summaryPRs = document.getElementById('summaryPRs');
const summaryProgressNote = document.getElementById('summaryProgressNote');
const summaryXP = document.getElementById('summaryXP');
const summaryKcal = document.getElementById('summaryKcal');

let doneSets = 0;
let totalSets = 0;
let totalVolume = 0;
// Ajustado pro horário real de início assim que a sessão é resolvida (ver
// bloco final do arquivo) — sessões retomadas não devem zerar o cronômetro
// nem contar a duração final a partir de quando a aba foi reaberta.
let startTime = Date.now();
let restInterval = null;
let restEndTime = 0;
let restExName = '';
let restDone = 0;
let restTotal = 0;
let session = null;
let isResumedSession = false;
let exercisesData = [];
let recordsMap = {};
const prsByExercise = new Map();

const REST_STORAGE_KEY = 'gymvym_rest_end';

// Avisa o sistema (iOS Safari 16.4+) que nosso áudio é "ambiente" — pra ele
// tocar junto com o que já estiver rodando (YouTube, Spotify etc.) em vez de
// pausar o outro app. Sem isso, o beep do descanso e o loop silencioso que
// mantém o cronômetro vivo em segundo plano tomam o controle exclusivo do
// áudio do aparelho.
if('audioSession' in navigator){
  try { navigator.audioSession.type = 'ambient'; } catch(err) {}
}

// Áudio precisa ser criado/desbloqueado dentro de um gesto real do usuário
// (toque no ✓), senão o navegador mantém o AudioContext suspenso e o som
// não toca. Reaproveitamos o mesmo contexto depois, no setInterval do
// descanso, que não é um gesto do usuário.
let audioCtx = null;
function unlockAudio(){
  if(audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch(err) {}
}

function playRestSound(){
  if(!audioCtx) return;
  try {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    [0, 0.35].forEach(delay => {
      const startAt = audioCtx.currentTime + delay;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.7, startAt);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.9);
      osc.start(startAt);
      osc.stop(startAt + 0.9);
    });
  } catch(err) {}
}

// Loop de áudio silencioso: mantém a aba "tocando mídia" pro Android/Chrome
// não suspender o JS quando o app é minimizado ou a tela apaga — sem isso,
// o setInterval do descanso simplesmente para e nada dispara na hora certa.
// Só funciona enquanto tiver sido iniciado dentro de um gesto do usuário.
let keepAliveAudio = null;
let keepAliveStarted = false;

function createSilentAudioURL(durationSec, sampleRate){
  const numSamples = sampleRate * durationSec;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);
  function writeString(offset, str){
    for(let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

function startKeepAlive(){
  if(keepAliveStarted) return;
  keepAliveStarted = true;
  try {
    keepAliveAudio = new Audio(createSilentAudioURL(2, 8000));
    keepAliveAudio.loop = true;
    keepAliveAudio.play().catch(() => {});
  } catch(err) {}
}

function stopKeepAlive(){
  if(keepAliveAudio){
    keepAliveAudio.pause();
    keepAliveAudio = null;
  }
  keepAliveStarted = false;
}

// Tela sempre acesa durante o treino (não resolve app minimizado, só
// evita a tela apagar sozinha enquanto o app está aberto).
let wakeLock = null;
async function requestWakeLock(){
  if(!('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch(err) {}
}
document.addEventListener('visibilitychange', () => {
  if(document.visibilityState === 'visible' && !wakeLock) requestWakeLock();
});

let notificationPermissionRequested = false;
function ensureNotificationPermission(){
  if(notificationPermissionRequested) return;
  notificationPermissionRequested = true;
  if('Notification' in window && Notification.permission === 'default'){
    Notification.requestPermission().catch(() => {});
  }
}

async function notifyRestOver(exName){
  if(!('Notification' in window) || Notification.permission !== 'granted') return;
  if(!document.hidden) return;
  if(!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    reg.showNotification('Descanso terminado!', {
      body: `Hora de voltar: ${exName}`,
      icon: '/icons/icon-192.png',
      tag: 'gymvym-rest'
    });
  } catch(err) {}
}

const wheelPopover = document.getElementById('wheelPopover');
const wheelCol = document.getElementById('wheelCol');

const WHEEL_ITEM_HEIGHT = 40;
const WHEEL_VISIBLE_HEIGHT = 160;
const WHEEL_FIELD_CONFIG = {
  kg: { min: 0, max: 300, step: 0.5, unit: 'kg' },
  reps: { min: 0, max: 50, step: 1, unit: '' },
  durationMin: { min: 0, max: 180, step: 1, unit: 'min' },
  distanceKm: { min: 0, max: 100, step: 0.1, unit: 'km' },
  inclinePct: { min: 0, max: 15, step: 0.5, unit: '%' },
  rpe: { min: 1, max: 10, step: 0.5, unit: '' }
};

function formatWheelValue(v){
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

const PROGRESSION_ICONS = { increase: '🔼', reduce: '🔽', hold: 'ℹ️' };
const PROGRESSION_CLASS = { increase: 'up', reduce: 'down', hold: 'hold' };

// Só mostra a linha quando o motor tem algo a dizer — "hold" sem motivo
// (sem histórico suficiente, ou tudo normal) fica em silêncio, igual antes.
function progressionLabel(progression){
  if(!progression || !progression.reason) return '';
  const suffix = progression.suggestedWeight != null ? ` — sugestão: ${formatWheelValue(progression.suggestedWeight)}kg` : '';
  return `<div class="ex-uplevel ex-uplevel--${PROGRESSION_CLASS[progression.action]}">${PROGRESSION_ICONS[progression.action]} ${escapeHtml(progression.reason)}${suffix}</div>`;
}

// Resumo pós-treino: compara o que foi feito hoje contra a sugestão do
// motor que já apareceu no início do treino (ex.progression, calculado em
// buildWorkout) — só pros exercícios onde havia sugestão de subir/reduzir.
// Sem dado novo, sem query nova — só interpreta o que já está em memória.
function buildProgressionNarrative(){
  let met = 0, missed = 0;

  for(const ex of exercisesData){
    if(ex.isDuration || !ex.progression) continue;
    if(ex.progression.action !== 'increase' && ex.progression.action !== 'reduce') continue;

    const completed = ex.sets.filter(s => s.completed);
    if(completed.length === 0) continue;

    // "Seguiu a sugestão" compara sempre com suggestedWeight (o alvo), nunca
    // com previousWeight — senão quem ignora o conselho de reduzir e mantém
    // o peso antigo contaria como "bateu a meta" por engano.
    const topWeight = Math.max(...completed.map(s => s.kg || 0));
    if(ex.progression.action === 'increase'){
      if(topWeight >= ex.progression.suggestedWeight) met++; else missed++;
    } else {
      if(topWeight <= ex.progression.suggestedWeight + 0.01) met++; else missed++;
    }
  }

  if(met === 0 && missed === 0) return null;
  if(missed === 0) return `Bateu a meta sugerida em ${met} exercício${met > 1 ? 's' : ''} hoje. 💪`;
  if(met === 0) return `Não chegou na carga sugerida em ${missed} exercício${missed > 1 ? 's' : ''} — sem problema, ajusta no seu ritmo.`;
  return `Bateu a meta sugerida em ${met} de ${met + missed} exercícios com sugestão de mudança hoje.`;
}

function openWheelPicker(field, currentValue, anchorEl){
  const config = WHEEL_FIELD_CONFIG[field];
  return new Promise(resolve => {
    const values = [];
    for(let v = config.min; v <= config.max + 1e-9; v += config.step){
      values.push(Math.round(v * 10) / 10);
    }
    let selectedIndex = values.findIndex(v => v === currentValue);
    if(selectedIndex < 0) selectedIndex = 0;

    wheelCol.innerHTML = values.map((v, i) => `<div class="wheel-item" data-index="${i}">${formatWheelValue(v)}${config.unit ? ' ' + config.unit : ''}</div>`).join('');
    wheelCol.style.paddingTop = WHEEL_ITEM_HEIGHT + 'px';
    wheelCol.style.paddingBottom = WHEEL_ITEM_HEIGHT + 'px';

    const rect = anchorEl.getBoundingClientRect();
    const popH = WHEEL_VISIBLE_HEIGHT;
    wheelPopover.style.display = 'block';
    const width = Math.max(rect.width, 90);
    wheelPopover.style.width = width + 'px';
    wheelPopover.style.top = (rect.top - popH - 10 > 8 ? rect.top - popH - 10 : rect.bottom + 10) + 'px';
    const left = Math.max(8, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 8));
    wheelPopover.style.left = left + 'px';

    wheelCol.scrollTop = selectedIndex * WHEEL_ITEM_HEIGHT;

    let settled = false;

    function finish(result){
      if(settled) return;
      settled = true;
      wheelPopover.style.display = 'none';
      wheelCol.removeEventListener('click', onItemClick);
      document.removeEventListener('click', onOutsideClick, true);
      resolve(result);
    }

    function onItemClick(e){
      const item = e.target.closest('.wheel-item');
      if(!item) return;
      finish(values[Number(item.dataset.index)]);
    }
    wheelCol.addEventListener('click', onItemClick);

    function onOutsideClick(e){
      if(!wheelPopover.contains(e.target)){
        finish(null);
      }
    }
    setTimeout(() => document.addEventListener('click', onOutsideClick, true), 0);
  });
}

function setRowHTML(ei, setNumber, set, isDuration){
  const rowClass = `set-row${isDuration ? ' duration' : ''}${set.completed ? ' completed' : ''}`;
  const checkCol = `
    <div class="check-col">
      <button type="button" class="check-btn" data-exercise="${ei}" data-set="${setNumber}" aria-label="Concluir série ${setNumber}">✓</button>
      <button type="button" class="del-btn" data-exercise="${ei}" data-set="${setNumber}" aria-label="Remover série ${setNumber}">✕</button>
    </div>`;

  if(isDuration){
    return `
      <div class="${rowClass}" id="set-${ei}-${setNumber}">
        <div class="set-num">${setNumber}</div>
        <div class="set-prev">${set.prev || '—'}</div>
        <button type="button" class="value-btn" data-field="durationMin" data-value="${set.durationMin ?? 0}">${formatWheelValue(set.durationMin ?? 0)}</button>
        <button type="button" class="value-btn" data-field="distanceKm" data-value="${set.distanceKm ?? 0}">${formatWheelValue(set.distanceKm ?? 0)}</button>
        <button type="button" class="value-btn" data-field="inclinePct" data-value="${set.inclinePct ?? 0}">${formatWheelValue(set.inclinePct ?? 0)}</button>
        ${checkCol}
      </div>`;
  }

  const rpeValue = set.rpe ?? 0;
  return `
    <div class="${rowClass}" id="set-${ei}-${setNumber}">
      <div class="set-num">${setNumber}</div>
      <div class="set-prev">${set.prev || '—'}</div>
      <button type="button" class="value-btn" data-field="kg" data-value="${set.kg ?? 0}">${formatWheelValue(set.kg ?? 0)}</button>
      <button type="button" class="value-btn" data-field="reps" data-value="${set.reps ?? 0}">${formatWheelValue(set.reps ?? 0)}</button>
      <button type="button" class="value-btn rpe${rpeValue ? ' set' : ''}" data-field="rpe" data-value="${rpeValue}" aria-label="RPE (esforço percebido), opcional">${rpeValue ? formatWheelValue(rpeValue) : '—'}</button>
      ${checkCol}
    </div>`;
}

function wireRow(ei, setNumber){
  const row = document.getElementById(`set-${ei}-${setNumber}`);
  if(!row) return;

  row.querySelector('.check-btn').addEventListener('click', () => {
    unlockAudio();
    ensureNotificationPermission();
    requestWakeLock();
    toggleSet(ei, setNumber);
  });

  row.querySelector('.del-btn').addEventListener('click', () => deleteSet(ei, setNumber));

  row.querySelectorAll('.value-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const field = btn.dataset.field;
      const current = parseFloat(btn.dataset.value) || 0;
      const result = await openWheelPicker(field, current, btn);
      if(result !== null){
        btn.dataset.value = result;
        btn.textContent = formatWheelValue(result);
      }
    });
  });
}

function showExerciseInfo(ex){
  const overlay = document.createElement('div');
  overlay.className = 'ex-info-overlay';
  overlay.innerHTML = `
    <div class="ex-info-card">
      <button type="button" class="ex-info-close" aria-label="Fechar">✕</button>
      <h3>${escapeHtml(ex.name)}</h3>
      ${ex.imageUrl ? `<img src="${escapeHtml(ex.imageUrl)}" alt="${escapeHtml(ex.name)}" class="ex-info-img" loading="lazy">` : ''}
      <div class="ex-info-text">${escapeHtml(ex.instructions || 'Sem instruções disponíveis para este exercício.')}</div>
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

  const isDuration = newEx.tracking_type === 'duration';
  const lastSets = await getLastSets(newEx.id);
  const setCount = ex.sets.length;

  ex.exerciseId = newEx.id;
  ex.name = newEx.name;
  ex.equipment = newEx.equipment;
  ex.imageUrl = newEx.image_url;
  ex.instructions = newEx.instructions;
  ex.muscleGroup = newEx.muscle_group;
  ex.isDuration = isDuration;
  ex.sets = [];

  for(let i = 0; i < setCount; i++){
    const prev = lastSets[i];
    if(isDuration){
      ex.sets.push({
        prev: prev ? `${Math.round((prev.duration_seconds || 0) / 60)}min${prev.distance_km ? ' · ' + prev.distance_km + 'km' : ''}${prev.incline_pct ? ' · ' + prev.incline_pct + '%' : ''}` : null,
        durationMin: prev ? Math.round((prev.duration_seconds || 0) / 60) : 20,
        distanceKm: prev ? (prev.distance_km || 0) : 0,
        inclinePct: prev ? (prev.incline_pct || 0) : 0
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
  ex.sets.forEach((set, i) => rows += setRowHTML(ei, i + 1, set, ex.isDuration));

  const restLabel = ex.isDuration ? '' : `<div class="ex-rest">⏱ Descanso: ${Math.floor(ex.rest / 60)}min ${ex.rest % 60}s</div>`;
  const uplevelLabel = progressionLabel(ex.progression);
  const headerLabels = ex.isDuration
    ? `<div>Nº</div><div class="left">Ant.</div><div>Min</div><div>Km</div><div>Elev%</div><div>✓</div>`
    : `<div>Nº</div><div class="left">Ant.</div><div>KG</div><div>Reps</div><div>RPE</div><div>✓</div>`;

  card.innerHTML = `
    <div class="ex-head">
      <div class="ex-thumb">${ex.imageUrl ? `<img src="${escapeHtml(ex.imageUrl)}" alt="${escapeHtml(ex.name)}" loading="lazy">` : '🏋️'}</div>
      <div class="ex-name">${escapeHtml(ex.name)}${ex.equipment ? ' (' + escapeHtml(ex.equipment) + ')' : ''}</div>
      <button type="button" class="ex-action-btn" aria-label="Como executar">ℹ️</button>
      <button type="button" class="ex-action-btn" aria-label="Substituir exercício">🔁</button>
      <button type="button" class="ex-action-btn" aria-label="Observação">📝</button>
    </div>
    <div class="ex-note-row" id="exnote-${ei}" style="display:none">
      <input type="text" class="ex-note-input" placeholder="Observação sobre este exercício (opcional)" value="${escapeHtml(ex.note || '')}">
    </div>
    ${uplevelLabel}
    ${restLabel}
    <div class="sets-header${ex.isDuration ? ' duration' : ''}">${headerLabels}</div>
    <div class="sets-body" id="sets-${ei}">${rows}</div>
    <button type="button" class="add-set-btn" data-exercise="${ei}">+ Adicionar série</button>`;

  ex.sets.forEach((_, i) => wireRow(ei, i + 1));
  if(ex.sets.length > 0 && ex.sets.every(s => s.completed)) card.classList.add('done');

  card.querySelector('.add-set-btn').addEventListener('click', () => addSet(ei));
  const [infoBtn, swapBtn, noteBtn] = card.querySelectorAll('.ex-action-btn');
  infoBtn.addEventListener('click', () => showExerciseInfo(ex));
  swapBtn.addEventListener('click', () => swapExercise(ei));

  const exNoteRow = document.getElementById(`exnote-${ei}`);
  const exNoteInput = exNoteRow.querySelector('.ex-note-input');
  noteBtn.addEventListener('click', () => {
    const open = exNoteRow.style.display !== 'none';
    exNoteRow.style.display = open ? 'none' : 'block';
    if(!open) exNoteInput.focus();
  });
  exNoteInput.addEventListener('input', () => { ex.note = exNoteInput.value; });
}

async function buildWorkout(){
  const items = await listWorkoutExercises(workoutId);
  exercisesData = [];
  recordsMap = await getPersonalRecordsMap(session.id);

  // Ao reabrir uma ficha já finalizada, recupera o que já foi gravado nessa
  // sessão pra marcar como concluído em vez de deixar em branco de novo.
  const existingSets = isResumedSession ? await getSessionSets(session.id) : [];
  const existingByExercise = new Map();
  existingSets.forEach(s => {
    if(!existingByExercise.has(s.exercise_id)) existingByExercise.set(s.exercise_id, new Map());
    existingByExercise.get(s.exercise_id).set(s.set_number, s);
  });

  // Busca o histórico e a sugestão de progressão de todos os exercícios da
  // ficha em paralelo — antes era um exercício de cada vez (uma query
  // esperando a outra), o que deixava fichas com mais exercícios abrirem
  // proporcionalmente mais devagar.
  const [allLastSets, allProgressions] = await Promise.all([
    Promise.all(items.map(item => getLastSets(item.exercise_id))),
    Promise.all(items.map(item =>
      item.exercises.tracking_type === 'duration'
        ? null
        : getProgressionForExercise(item.exercise_id, item.target_reps, session?.id)
    ))
  ]);

  items.forEach((item, itemIndex) => {
    const lastSets = allLastSets[itemIndex];
    const isDuration = item.exercises.tracking_type === 'duration';
    const doneForExercise = existingByExercise.get(item.exercise_id);
    const progression = allProgressions[itemIndex];

    const ex = {
      workoutExerciseId: item.id,
      exerciseId: item.exercise_id,
      name: item.exercises.name,
      equipment: item.exercises.equipment,
      imageUrl: item.exercises.image_url,
      instructions: item.exercises.instructions,
      muscleGroup: item.exercises.muscle_group,
      isDuration,
      rest: item.rest_seconds,
      note: '',
      progression,
      sets: []
    };

    const maxDoneSetNumber = doneForExercise ? Math.max(...doneForExercise.keys()) : 0;
    const setCount = Math.max(isDuration ? 1 : item.target_sets, maxDoneSetNumber);
    for(let i = 0; i < setCount; i++){
      const done = doneForExercise?.get(i + 1) || null;
      const prev = lastSets[i];
      if(isDuration){
        ex.sets.push({
          prev: prev ? `${Math.round((prev.duration_seconds || 0) / 60)}min${prev.distance_km ? ' · ' + prev.distance_km + 'km' : ''}${prev.incline_pct ? ' · ' + prev.incline_pct + '%' : ''}` : null,
          durationMin: done ? Math.round((done.duration_seconds || 0) / 60) : (prev ? Math.round((prev.duration_seconds || 0) / 60) : Math.round((item.target_duration_seconds || 1200) / 60)),
          distanceKm: done ? (done.distance_km || 0) : (prev ? (prev.distance_km || 0) : 0),
          inclinePct: done ? (done.incline_pct || 0) : (prev ? (prev.incline_pct || 0) : 0),
          completed: !!done
        });
      } else {
        // Peso sugerido pelo motor de progressão substitui o "repete o de
        // sempre" (prev.weight) quando ele decidiu subir/reduzir a carga.
        const suggestedWeight = progression?.suggestedWeight;
        ex.sets.push({
          prev: prev ? `${prev.weight ?? 0}kg x ${prev.reps ?? 0}` : null,
          kg: done ? done.weight : (suggestedWeight ?? (prev ? prev.weight : (item.target_weight || 0))),
          reps: done ? done.reps : (prev ? prev.reps : (parseInt(item.target_reps) || 0)),
          completed: !!done
        });
      }
    }

    exercisesData.push(ex);
  });

  totalSets = exercisesData.reduce((sum, ex) => sum + ex.sets.length, 0);
  totalCountEl.textContent = totalSets;

  workoutMain.innerHTML = '';
  exercisesData.forEach((ex, ei) => renderExerciseCard(ei));

  // Contabiliza o que já veio pronto da sessão reaberta.
  doneSets = exercisesData.reduce((sum, ex) => sum + ex.sets.filter(s => s.completed).length, 0);
  totalVolume = exercisesData.reduce((sum, ex) => {
    if(ex.isDuration) return sum;
    return sum + ex.sets.filter(s => s.completed).reduce((s2, set) => s2 + (set.kg || 0) * (set.reps || 0), 0);
  }, 0);
  doneCountEl.textContent = doneSets;
  progressFill.style.width = (totalSets > 0 ? (doneSets / totalSets * 100) : 0) + '%';
  if(doneSets >= totalSets && totalSets > 0) finishBtn.classList.add('ready');
}

onSetSynced((item) => {
  if(!item.meta) return;
  const row = document.getElementById(`set-${item.meta.ei}-${item.meta.setNumber}`);
  if(!row) return;
  row.classList.remove('pending');
  const checkBtn = row.querySelector('.check-btn');
  if(checkBtn) checkBtn.textContent = '✓';
});

// Marca recorde pessoal: exige pelo menos 2 sessões anteriores com esse
// exercício (evita "PR" na primeira vez que ele é feito). Atualiza o mapa em
// memória pra permitir novo PR na mesma sessão (ex: pirâmide de cargas).
function checkPersonalRecord(ex, kg, row){
  const rec = recordsMap[ex.exerciseId];
  if(!rec || rec.sessionCount < 2 || kg <= rec.maxWeight) return;

  rec.maxWeight = kg;
  prsByExercise.set(ex.exerciseId, { name: ex.name, weight: kg });

  if(navigator.vibrate) navigator.vibrate([100, 50, 200]);
  showToast(`🏆 NOVO RECORDE — ${ex.name}: ${formatWheelValue(kg)}kg`);
  row.querySelector('.set-num').insertAdjacentHTML('beforeend', '<span class="pr-badge">🏆</span>');
  celebrate({ count: 16 });
}

function toggleSet(ei, setNumber){
  const row = document.getElementById(`set-${ei}-${setNumber}`);
  if(row.classList.contains('completed')) return uncompleteSet(ei, setNumber, row);
  return completeSet(ei, setNumber, row);
}

async function uncompleteSet(ei, setNumber, row){
  const ex = exercisesData[ei];
  const wasPending = row.classList.contains('pending');

  try {
    if(wasPending) removeQueuedSet(session.id, ex.exerciseId, setNumber);
    else await deleteSessionSet(session.id, ex.exerciseId, setNumber);
  } catch(err) {
    showToast('Não foi possível desmarcar. Tente de novo.');
    return;
  }

  if(!ex.isDuration){
    const kg = parseFloat(row.querySelector('[data-field="kg"]').dataset.value) || 0;
    const reps = parseInt(row.querySelector('[data-field="reps"]').dataset.value) || 0;
    totalVolume = Math.max(0, totalVolume - kg * reps);
  }

  ex.sets[setNumber - 1].completed = false;
  row.classList.remove('completed', 'pending');
  row.querySelector('.check-btn').textContent = '✓';
  row.querySelector('.pr-badge')?.remove();

  doneSets = Math.max(0, doneSets - 1);
  doneCountEl.textContent = doneSets;
  progressFill.style.width = (totalSets > 0 ? (doneSets / totalSets * 100) : 0) + '%';
  finishBtn.classList.remove('ready');
  document.getElementById('ex-' + ei).classList.remove('done');
}

// Sincroniza os valores atuais da linha (editados via seletor) de volta pro
// objeto em memória — necessário antes de recriar a lista de séries (delete).
function syncSetFromDOM(ei, setNumber){
  const ex = exercisesData[ei];
  const row = document.getElementById(`set-${ei}-${setNumber}`);
  const set = ex.sets[setNumber - 1];
  if(!row || !set) return;
  set.completed = row.classList.contains('completed');
  if(ex.isDuration){
    set.durationMin = parseFloat(row.querySelector('[data-field="durationMin"]').dataset.value) || 0;
    set.distanceKm = parseFloat(row.querySelector('[data-field="distanceKm"]').dataset.value) || 0;
    set.inclinePct = parseFloat(row.querySelector('[data-field="inclinePct"]').dataset.value) || 0;
  } else {
    set.kg = parseFloat(row.querySelector('[data-field="kg"]').dataset.value) || 0;
    set.reps = parseInt(row.querySelector('[data-field="reps"]').dataset.value) || 0;
    set.rpe = parseFloat(row.querySelector('[data-field="rpe"]').dataset.value) || 0;
  }
}

async function deleteSet(ei, setNumber){
  if(!confirm('Remover esta série?')) return;

  const ex = exercisesData[ei];
  ex.sets.forEach((_, idx) => syncSetFromDOM(ei, idx + 1));

  const row = document.getElementById(`set-${ei}-${setNumber}`);
  const wasCompleted = row.classList.contains('completed');
  const wasPending = row.classList.contains('pending');

  if(wasCompleted){
    try {
      if(wasPending) removeQueuedSet(session.id, ex.exerciseId, setNumber);
      else await deleteSessionSet(session.id, ex.exerciseId, setNumber);
    } catch(err) {
      showToast('Não foi possível remover. Tente de novo.');
      return;
    }
    doneSets = Math.max(0, doneSets - 1);
    if(!ex.isDuration){
      const set = ex.sets[setNumber - 1];
      totalVolume = Math.max(0, totalVolume - (set.kg || 0) * (set.reps || 0));
    }
  }

  for(let n = setNumber + 1; n <= ex.sets.length; n++){
    const laterSet = ex.sets[n - 1];
    if(!laterSet.completed) continue;
    const laterRow = document.getElementById(`set-${ei}-${n}`);
    try {
      if(laterRow?.classList.contains('pending')) renumberQueuedSet(session.id, ex.exerciseId, n, n - 1);
      else await updateSessionSetNumber(session.id, ex.exerciseId, n, n - 1);
    } catch(err) {}
  }

  ex.sets.splice(setNumber - 1, 1);
  totalSets--;
  totalCountEl.textContent = totalSets;

  renderExerciseCard(ei);
  doneCountEl.textContent = doneSets;
  progressFill.style.width = (totalSets > 0 ? (doneSets / totalSets * 100) : 0) + '%';
  finishBtn.classList.toggle('ready', totalSets > 0 && doneSets >= totalSets);
}

async function completeSet(ei, setNumber, row){
  if(row.classList.contains('completed')) return;

  const ex = exercisesData[ei];
  const noteValue = ex.note?.trim() || null;

  let payload;
  let kg = 0, reps = 0;

  if(ex.isDuration){
    const minutes = parseFloat(row.querySelector('[data-field="durationMin"]').dataset.value) || 0;
    const distanceKm = parseFloat(row.querySelector('[data-field="distanceKm"]').dataset.value) || 0;
    const inclinePct = parseFloat(row.querySelector('[data-field="inclinePct"]').dataset.value) || 0;
    payload = {
      session_id: session.id,
      exercise_id: ex.exerciseId,
      set_number: setNumber,
      duration_seconds: Math.round(minutes * 60),
      distance_km: distanceKm || null,
      incline_pct: inclinePct || null,
      notes: noteValue
    };
  } else {
    kg = parseFloat(row.querySelector('[data-field="kg"]').dataset.value) || 0;
    reps = parseInt(row.querySelector('[data-field="reps"]').dataset.value) || 0;
    const rpe = parseFloat(row.querySelector('[data-field="rpe"]').dataset.value) || 0;
    payload = {
      session_id: session.id,
      exercise_id: ex.exerciseId,
      set_number: setNumber,
      reps,
      weight: kg,
      rpe: rpe || null,
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

  ex.sets[setNumber - 1].completed = true;
  row.classList.add('completed');
  if(pending){
    row.classList.add('pending');
    row.querySelector('.check-btn').textContent = '⏳';
  }
  if(!ex.isDuration){
    totalVolume += kg * reps;
    checkPersonalRecord(ex, kg, row);
  }
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
  const newSet = ex.isDuration ? { prev: null, durationMin: last.durationMin, distanceKm: last.distanceKm, inclinePct: last.inclinePct } : { prev: null, kg: last.kg, reps: last.reps };
  ex.sets.push(newSet);
  body.insertAdjacentHTML('beforeend', setRowHTML(ei, setNumber, newSet, ex.isDuration));
  wireRow(ei, setNumber);

  totalSets++;
  totalCountEl.textContent = totalSets;
  progressFill.style.width = (doneSets / totalSets * 100) + '%';
  finishBtn.classList.remove('ready');
  document.getElementById('ex-' + ei).classList.remove('done');
}

// UI primeiro, localStorage depois (só serve pra restaurar o descanso se a
// aba recarregar) — um setItem que falhe (Safari modo privado, storage
// cheio) não pode impedir a sheet de abrir.
function startRest(seconds, exName, done, total){
  restEndTime = Date.now() + seconds * 1000;
  restExName = exName;
  restDone = done;
  restTotal = total;
  restContext.textContent = `${exName} — série ${done}/${total} feita`;
  restSheet.classList.add('open');
  updateRestDisplay();
  clearInterval(restInterval);
  restInterval = setInterval(updateRestDisplay, 1000);
  startKeepAlive();
  try {
    localStorage.setItem(REST_STORAGE_KEY, JSON.stringify({ endTime: restEndTime, exName, done, total }));
  } catch(err) {}
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
  try { localStorage.removeItem(REST_STORAGE_KEY); } catch(err) {}
  stopKeepAlive();
}

document.addEventListener('visibilitychange', () => {
  if(document.hidden) return;
  if(!restSheet.classList.contains('open')) return;
  updateRestDisplay();
});

document.getElementById('btnAddRest').addEventListener('click', () => {
  restEndTime += 30000;
  try {
    localStorage.setItem(REST_STORAGE_KEY, JSON.stringify({ endTime: restEndTime, exName: restExName, done: restDone, total: restTotal }));
  } catch(err) {}
  updateRestDisplay();
  // Reinicia o interval e o keep-alive: se o navegador já tinha throttlado/
  // pausado o setInterval anterior (aba em segundo plano por um tempo), só
  // atualizar restEndTime não é suficiente — sem isso o alarme não dispara
  // na hora certa depois de adicionar tempo.
  clearInterval(restInterval);
  restInterval = setInterval(updateRestDisplay, 1000);
  startKeepAlive();
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
      startKeepAlive();
    } else {
      localStorage.removeItem(REST_STORAGE_KEY);
    }
  } catch(err) {
    localStorage.removeItem(REST_STORAGE_KEY);
  }
})();

finishBtn.addEventListener('click', async () => {
  if(!confirm('Finalizar o treino?')) return;
  await flushQueue();
  await finishWorkoutSession(session.id);

  const t = Math.floor((Date.now() - startTime) / 1000);
  const durationMinutes = t / 60;
  summarySub.textContent = workoutNameEl.textContent;
  sumTime.textContent = Math.floor(t / 60) + 'min';
  sumSets.textContent = doneSets;
  sumVolume.textContent = totalVolume.toLocaleString('pt-BR');

  const measurements = await listMeasurements();
  const weightKg = findWeightAtDate(measurements, new Date().toISOString());
  if(weightKg){
    const kcal = estimateWorkoutKcal({ weightKg, totalSets: doneSets, durationMinutes });
    summaryKcal.innerHTML = `~ ${kcal} kcal`;
  } else {
    summaryKcal.innerHTML = '— <a href="./body.html" class="kcal-link">Cadastre seu peso em Medidas para estimar calorias</a>';
  }

  if(prsByExercise.size > 0){
    summaryPRs.innerHTML = '<h3>Recordes de hoje</h3>' + [...prsByExercise.values()]
      .map(pr => `<div class="summary-pr-item">🏆 ${escapeHtml(pr.name)}: ${formatWheelValue(pr.weight)}kg</div>`)
      .join('');
    summaryPRs.style.display = 'block';
  }

  const progressNote = buildProgressionNarrative();
  if(progressNote){
    summaryProgressNote.textContent = progressNote;
    summaryProgressNote.style.display = 'block';
  }

  closeRest();
  stopKeepAlive();
  if(wakeLock) wakeLock.release().catch(() => {});
  summaryOverlay.classList.add('open');

  try {
    const [xpBefore, xpAfter] = await Promise.all([getUserXP(session.id), getUserXP()]);
    summaryXP.textContent = `+${xpAfter - xpBefore} XP`;

    await checkAchievements(user.id, { hadPRThisSession: prsByExercise.size > 0 });

    const leagueBefore = getLeagueForXP(xpBefore);
    const leagueAfter = getLeagueForXP(xpAfter);
    if(leagueAfter.key !== leagueBefore.key){
      showToast(`Você subiu para a ${leagueAfter.name}! ${leagueAfter.emoji}`);
      celebrate({ count: 32 });
    }
  } catch(err) {}
});

document.getElementById('btnBackToWorkouts').addEventListener('click', () => navigate('./workouts.html'));
document.getElementById('btnViewProgress').addEventListener('click', () => navigate('./progress.html'));

function updateElapsedDisplay(){
  const t = Math.floor((Date.now() - startTime) / 1000);
  elapsedEl.textContent = String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
}

setInterval(updateElapsedDisplay, 1000);

// Navegadores throttlam/pausam setInterval com a tela apagada ou o app em
// segundo plano — o relógio parece "travar" até voltar a foco. Como o
// cálculo é sempre Date.now() - startTime (nunca incrementa um contador),
// forçar um recálculo assim que a aba volta a ficar visível corrige o
// mostrador na hora, sem esperar o próximo tick do interval.
document.addEventListener('visibilitychange', () => {
  if(document.hidden) return;
  updateElapsedDisplay();
});

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
      if(existingSessionId){
        session = { id: existingSessionId };
        isResumedSession = true;
        startTime = new Date(await getSessionStartedAt(existingSessionId)).getTime();
      } else {
        // Continua automaticamente uma sessão dessa ficha que ficou em
        // aberto (sem ter clicado em "Finalizar treino"), em vez de criar
        // uma sessão nova e duplicada.
        const incomplete = await findIncompleteSessionForWorkout(user.id, workoutId);
        if(incomplete){
          session = incomplete;
          isResumedSession = true;
          // Cronômetro e duração final contam desde o início real da sessão,
          // não desde que a aba foi reaberta — sem isso um treino de 1h+
          // finalizado numa sessão retomada aparecia como "4min" no resumo.
          startTime = new Date(incomplete.started_at).getTime();
        } else {
          session = await createWorkoutSession(user.id, workoutId);
        }
      }
      await buildWorkout();
      flushQueue();
    }
  }
}
