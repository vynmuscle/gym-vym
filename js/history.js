import { supabase } from './supabaseClient.js';
import { navigate } from './router.js';
import { renderNav } from './navigation.js';
import {
  listCompletedSessions, listIncompleteSessions,
  getSessionSetsSummary, getSessionDetails, deleteSession
} from './services/workoutService.js';

const { data: sd } = await supabase.auth.getSession();
if(!sd.session) navigate('../login.html');

renderNav('history');

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

  const summary = await getSessionSetsSummary(sessions.map(s => s.id));

  sessionsList.innerHTML = sessions.map(s => {
    const stats = summary[s.id] || { sets: 0, volume: 0 };
    return `
    <div class="panel session-card" style="margin-bottom:12px;overflow:hidden">
      <div class="list-item session-toggle" data-session="${s.id}" style="cursor:pointer">
        <div class="list-item-info">
          <span class="list-item-title">${s.workouts ? s.workouts.name : 'Treino avulso'}</span>
          <span class="list-item-sub">${formatDate(s.started_at)} · ${formatDuration(s.started_at, s.finished_at)}</span>
        </div>
        <div class="list-item-info" style="align-items:flex-end">
          <span class="list-item-title">${stats.sets} séries</span>
          <span class="list-item-sub">${stats.volume.toLocaleString('pt-BR')}kg</span>
        </div>
      </div>
      <div class="session-details" id="details-${s.id}" style="display:none;padding:0 14px 14px"></div>
    </div>`;
  }).join('');

  sessionsList.querySelectorAll('.session-toggle').forEach(el => {
    el.addEventListener('click', () => toggleDetails(el.dataset.session));
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
      grouped.set(r.exercise_id, { name: r.exercises.name, equipment: r.exercises.equipment, sets: [] });
    }
    grouped.get(r.exercise_id).sets.push(r);
  });

  grouped.forEach(ex => ex.sets.sort((a, b) => a.set_number - b.set_number));

  el.innerHTML = [...grouped.values()].map(ex => `
    <div class="exercise" style="margin-top:10px;padding-bottom:8px">
      <div class="ex-head" style="padding-bottom:8px">
        <div class="ex-thumb">🏋️</div>
        <div class="ex-name">${ex.name}${ex.equipment ? ' (' + ex.equipment + ')' : ''}</div>
      </div>
      <div class="history-sets">
        ${ex.sets.map((s, i) => `
          <div class="history-set-row">
            <span class="num">${i + 1}</span>
            <span>${s.weight ?? 0}kg × ${s.reps ?? 0}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

await loadIncomplete();
await loadSessions();
