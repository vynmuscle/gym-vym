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
import { escapeHtml } from './utils/escapeHtml.js';

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
        <span class="list-item-title">${escapeHtml(s.workouts ? s.workouts.name : 'Treino avulso')}</span>
        <span class="list-item-sub">Iniciado ${formatDate(s.started_at)} · nunca finalizado</span>
      </div>
      <div class="list-item-actions">
        ${s.workout_id ? `<button type="button" class="btn-icon" data-continue="${s.id}" data-workout="${s.workout_id}" aria-label="Continuar">↺</button>` : ''}
        <button type="button" class="btn-icon danger" data-delete="${s.id}" aria-label="Excluir sessão">✕</button>
      </div>
    </div>
  `).join('');

  incompleteList.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => removeIncomplete(btn.dataset.delete));
  });

  incompleteList.querySelectorAll('[data-continue]').forEach(btn => {
    btn.addEventListener('click', () => {
      navigate(`./train.html?id=${btn.dataset.workout}&session=${btn.dataset.continue}`);
    });
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
    const kcal = s.watch_calories ?? estimateWorkoutKcal({ weightKg, totalSets: stats.sets, durationMinutes });
    const kcalLabel = kcal !== null ? `${s.watch_calories ? '' : '~ '}${kcal} kcal` : '—';
    const hrLabel = s.avg_heart_rate ? ` · ${s.avg_heart_rate} bpm méd.` : '';

    return `
    <div class="swipe-item" data-swipe-item="${s.id}" style="margin-bottom:12px">
      <div class="swipe-delete-action">
        <button type="button" class="swipe-delete-btn" data-delete-session="${s.id}" aria-label="Excluir treino">🗑<span>Excluir</span></button>
      </div>
      <div class="panel session-card swipe-content" style="overflow:hidden">
        <div class="list-item session-toggle" data-session="${s.id}" style="cursor:pointer">
          <div class="list-item-info">
            <span class="list-item-title">${escapeHtml(s.workouts ? s.workouts.name : 'Treino avulso')}</span>
            <span class="list-item-sub">${formatDate(s.started_at)} · ${formatDuration(s.started_at, s.finished_at)}</span>
          </div>
          <div class="list-item-info" style="align-items:flex-end">
            <span class="list-item-title">${stats.sets} séries</span>
            <span class="list-item-sub">${stats.volume.toLocaleString('pt-BR')}kg · ${kcalLabel}${hrLabel}</span>
          </div>
        </div>
        <div class="session-details" id="details-${s.id}" style="display:none;padding:0 14px 14px"></div>
      </div>
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
    el.addEventListener('click', () => {
      if(el.closest('.swipe-item').classList.contains('swiped')) return;
      toggleDetails(el.dataset.session);
    });
  });

  sessionsList.querySelectorAll('[data-delete-session]').forEach(btn => {
    btn.addEventListener('click', () => removeSession(btn.dataset.deleteSession));
  });

  sessionsList.querySelectorAll('.swipe-item').forEach(wireSwipe);
}

async function removeSession(id){
  if(!confirm('Excluir este treino do histórico?')) return;
  await deleteSession(id);
  await loadSessions();
}

const SWIPE_REVEAL = 84;

function wireSwipe(item){
  const content = item.querySelector('.swipe-content');
  let startX = 0, startY = 0, currentX = 0, dragging = false, axisLocked = null;

  function setX(x, animate){
    content.style.transition = animate ? 'transform .2s ease' : 'none';
    content.style.transform = `translateX(${x}px)`;
  }

  function closeOthers(){
    sessionsList.querySelectorAll('.swipe-item.swiped').forEach(other => {
      if(other !== item){
        other.classList.remove('swiped');
        other.querySelector('.swipe-content').style.transform = 'translateX(0)';
      }
    });
  }

  content.addEventListener('touchstart', (e) => {
    closeOthers();
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    currentX = item.classList.contains('swiped') ? -SWIPE_REVEAL : 0;
    dragging = true;
    axisLocked = null;
  }, { passive: true });

  content.addEventListener('touchmove', (e) => {
    if(!dragging) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if(axisLocked === null) axisLocked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    if(axisLocked === 'y') return;
    e.preventDefault();
    const x = Math.min(0, Math.max(-SWIPE_REVEAL - 20, currentX + dx));
    setX(x, false);
  }, { passive: false });

  content.addEventListener('touchend', (e) => {
    if(!dragging) return;
    dragging = false;
    if(axisLocked !== 'x'){ axisLocked = null; return; }
    const dx = e.changedTouches[0].clientX - startX;
    const finalX = currentX + dx;
    if(finalX < -SWIPE_REVEAL / 2){
      setX(-SWIPE_REVEAL, true);
      item.classList.add('swiped');
    } else {
      setX(0, true);
      item.classList.remove('swiped');
    }
    axisLocked = null;
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
        <div class="ex-thumb">${ex.imageUrl ? `<img src="${escapeHtml(ex.imageUrl)}" alt="${escapeHtml(ex.name)}" loading="lazy">` : '🏋️'}</div>
        <div class="ex-name">${escapeHtml(ex.name)}${ex.equipment ? ' (' + escapeHtml(ex.equipment) + ')' : ''}</div>
      </div>
      <div class="history-sets">
        ${ex.sets.map((s, i) => `
          <div class="history-set-row">
            <span class="num">${i + 1}</span>
            <span>${s.duration_seconds ? Math.round(s.duration_seconds / 60) + 'min' + (s.distance_km ? ' · ' + s.distance_km + 'km' : '') : (s.weight ?? 0) + 'kg × ' + (s.reps ?? 0)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

await loadIncomplete();
await loadSessions();
