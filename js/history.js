import { supabase } from './supabaseClient.js';
import { navigate } from './router.js';
import { renderNav } from './navigation.js';
import { initPWA } from './pwa.js';
import {
  listCompletedSessions, listIncompleteSessions,
  getSessionSetsSummary, getSessionDetails, deleteSession
} from './services/workoutService.js';
import { listMeasurements } from './services/bodyService.js';
import { estimateWorkoutKcal, findWeightAtDate } from './utils.js';

const { data: sd } = await supabase.auth.getSession();
if(!sd.session) navigate('../login.html');
initPWA();

await renderNav('evolution');

const incompletePanel = document.getElementById('incompletePanel');
const incompleteList = document.getElementById('incompleteList');
const sessionsList = document.getElementById('sessionsList');
const emptyState = document.getElementById('emptyState');

function formatDate(iso){
  const label = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso));
  return label.replace(/\./g, '');
}

function formatDuration(startIso, endIso){
  const totalMin = Math.round((new Date(endIso) - new Date(startIso)) / 60000);
  if(totalMin < 60) return `${totalMin}min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${String(m).padStart(2, '0')}min`;
}

async function loadIncomplete(){
  const incomplete = await listIncompleteSessions();

  if(incomplete.length === 0){
    incompletePanel.style.display = 'none';
    return;
  }

  incompletePanel.style.display = 'block';
  incompleteList.innerHTML = incomplete.map(s => `
    <div class="list-item">
      <div class="list-item-info">
        <span class="list-item-title">${s.workouts ? s.workouts.name : 'Treino avulso'}</span>
        <span class="list-item-sub">Iniciado ${formatDate(s.started_at)} · nunca finalizado</span>
      </div>
      <div class="list-item-actions">
        <button type="button" class="btn-icon danger" data-delete="${s.id}">✕</button>
      </div>
    </div>
  `).join('');

  incompleteList.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => removeIncomplete(btn.dataset.delete));
  });
}

async function removeIncomplete(id){
  if(!confirm('Excluir esta sessão incompleta?')) return;
  await deleteSession(id);
  await loadIncomplete();
}

async function loadSessions(){
  const sessions = await listCompletedSessions();

  if(sessions.length === 0){
    sessionsList.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  const [summary, measurements] = await Promise.all([
    getSessionSetsSummary(sessions.map(s => s.id)),
    listMeasurements()
  ]);

  sessionsList.innerHTML = sessions.map(s => {
    const stats = summary[s.id] || { sets: 0, volume: 0 };
    const durationMinutes = (new Date(s.finished_at) - new Date(s.started_at)) / 60000;
    const weightKg = findWeightAtDate(measurements, s.started_at);
    const kcal = estimateWorkoutKcal({ weightKg, totalSets: stats.sets, durationMinutes });
    const kcalLabel = kcal !== null ? `~ ${kcal} kcal` : '—';

    const continueBtn = s.workout_id
      ? `<button type="button" class="btn btn-secondary" data-continue="${s.id}" data-workout="${s.workout_id}" style="margin:0 14px 14px">↺ Continuar</button>`
      : '';

    return `
    <div class="panel session-card" style="margin-bottom:12px;overflow:hidden">
      <div class="list-item session-toggle" data-session="${s.id}" style="cursor:pointer">
        <div class="list-item-info">
          <span class="list-item-title">${s.workouts ? s.workouts.name : 'Treino avulso'}</span>
          <span class="list-item-sub">${formatDate(s.started_at)} · ${formatDuration(s.started_at, s.finished_at)}</span>
        </div>
        <div class="list-item-info" style="align-items:flex-end">
          <span class="list-item-title">${stats.sets} séries</span>
          <span class="list-item-sub">${stats.volume.toLocaleString('pt-BR')}kg · ${kcalLabel}</span>
        </div>
      </div>
      <div class="session-details" id="details-${s.id}" style="display:none;padding:0 14px 14px"></div>
      ${continueBtn}
    </div>`;
  }).join('');

  if(measurements.length === 0){
    sessionsList.insertAdjacentHTML('beforeend', `
      <div class="panel" style="padding:16px;text-align:center;margin-top:12px">
        <p class="muted" style="margin-bottom:8px">Cadastre seu peso em Medidas pra ver a estimativa de calorias dos treinos.</p>
        <a href="./body.html" class="kcal-link">Ir para Medidas</a>
      </div>`);
  } else {
    sessionsList.insertAdjacentHTML('beforeend', `
      <div class="kcal-note" style="margin-top:8px">Calorias estimadas pelo método METs. O gasto real varia por pessoa e intensidade.</div>`);
  }

  sessionsList.querySelectorAll('.session-toggle').forEach(el => {
    el.addEventListener('click', () => toggleDetails(el.dataset.session));
  });

  sessionsList.querySelectorAll('[data-continue]').forEach(btn => {
    btn.addEventListener('click', () => {
      navigate(`./train.html?id=${btn.dataset.workout}&session=${btn.dataset.continue}`);
    });
  });
}

async function toggleDetails(sessionId){
  const el = document.getElementById('details-' + sessionId);
  const isOpen = el.style.display !== 'none';

  if(isOpen){
    el.style.display = 'none';
    return;
  }

  el.style.display = 'block';
  if(el.dataset.loaded) return;
  el.dataset.loaded = '1';
  el.innerHTML = '<p class="muted">Carregando...</p>';

  const rows = await getSessionDetails(sessionId);

  if(rows.length === 0){
    el.innerHTML = '<p class="muted">Nenhuma série registrada.</p>';
    return;
  }

  const grouped = new Map();
  rows.forEach(r => {
    if(!grouped.has(r.exercise_id)){
      grouped.set(r.exercise_id, { name: r.exercises.name, equipment: r.exercises.equipment, imageUrl: r.exercises.image_url, sets: [] });
    }
    grouped.get(r.exercise_id).sets.push(r);
  });

  grouped.forEach(ex => ex.sets.sort((a, b) => a.set_number - b.set_number));

  el.innerHTML = [...grouped.values()].map(ex => `
    <div class="exercise" style="margin-top:10px;padding-bottom:8px">
      <div class="ex-head" style="padding-bottom:8px">
        <div class="ex-thumb">${ex.imageUrl ? `<img src="${ex.imageUrl}" alt="">` : '🏋️'}</div>
        <div class="ex-name">${ex.name}${ex.equipment ? ' (' + ex.equipment + ')' : ''}</div>
      </div>
      <div class="history-sets">
        ${ex.sets.map((s, i) => `
          <div class="history-set-row">
            <span class="num">${i + 1}</span>
            <span>${s.duration_seconds ? Math.round(s.duration_seconds / 60) + 'min' : (s.weight ?? 0) + 'kg × ' + (s.reps ?? 0)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

await loadIncomplete();
await loadSessions();
