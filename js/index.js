import { supabase } from './supabaseClient.js';
import { navigate } from './router.js';
import { renderNav } from './navigation.js';
import { initPWA } from './pwa.js';
import {
  getMuscleRecovery, getSuggestedWorkout, getTodaysCompletedSessions,
  getSessionDatesInRange, getRecentCompletedSessionDates, getUserXP
} from './services/workoutService.js';
import { getUserSettings } from './services/profileService.js';
import { computeStreak } from './utils.js';
import { getLeagueForXP } from './leagues.js';

const { data: sd } = await supabase.auth.getSession();
if(!sd.session) navigate('./login.html');
const user = sd.session.user;
initPWA();

await renderNav('dashboard');

const MUSCLE_GROUP_LABELS = {
  peito: 'Peito', costas: 'Costas', pernas: 'Pernas', ombros: 'Ombros',
  biceps: 'Bíceps', triceps: 'Tríceps', abdomen: 'Abdômen', gluteos: 'Glúteos'
};

const WEEKDAY_LABELS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
const RING_CIRCUMFERENCE = 245;

const greetingName = document.getElementById('greetingName');
const leagueDot = document.getElementById('leagueDot');
const greetingDate = document.getElementById('greetingDate');
const weekRow = document.getElementById('weekRow');
const heroSection = document.getElementById('heroSection');
const ringProgress = document.getElementById('ringProgress');
const ringPct = document.getElementById('ringPct');
const progressBig = document.getElementById('progressBig');
const progressSub = document.getElementById('progressSub');
const streakValue = document.getElementById('streakValue');
const recoveryStrip = document.getElementById('recoveryStrip');

function mondayOf(date){
  const d = new Date(date);
  const day = d.getDay(); // 0=dom .. 6=sáb
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function renderGreeting(displayName){
  const name = displayName || user.email.split('@')[0];
  greetingName.textContent = `Fala, ${name}! 💪`;

  const label = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  greetingDate.textContent = label.charAt(0).toUpperCase() + label.slice(1);
}

function renderWeek(weekStart, sessionDates){
  const daySet = new Set(sessionDates);
  const today = new Date();

  weekRow.innerHTML = WEEKDAY_LABELS.map((lbl, i) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    const isToday = date.toDateString() === today.toDateString();
    const done = daySet.has(date.toDateString());
    const dotContent = done ? '✓' : (isToday ? '?' : '·');
    const cls = `day${done ? ' done' : ''}${isToday ? ' today' : ''}`;
    return `<div class="${cls}"><div class="lbl">${lbl}</div><div class="dot">${dotContent}</div></div>`;
  }).join('');
}

function renderRing(weekCount, weeklyGoal){
  const pct = weeklyGoal > 0 ? Math.round((weekCount / weeklyGoal) * 100) : 0;
  const visualPct = Math.min(pct, 100);

  ringProgress.setAttribute('stroke-dashoffset', String(RING_CIRCUMFERENCE * (1 - visualPct / 100)));
  ringPct.textContent = `${pct}%`;

  progressBig.textContent = pct >= 100
    ? 'Meta da semana batida! 🎉'
    : pct >= 50
      ? 'Você está no caminho certo!'
      : 'Vamos começar a semana!';
  progressSub.textContent = `${weekCount} de ${weeklyGoal} treinos planejados esta semana`;
}

function formatMinutes(totalMin){
  if(totalMin < 60) return `${totalMin}min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${String(m).padStart(2, '0')}min`;
}

async function renderHero(){
  const todaysSessions = await getTodaysCompletedSessions();

  if(todaysSessions.length > 0){
    const totalSets = todaysSessions.reduce((sum, s) => sum + s.sets, 0);
    const totalVolume = todaysSessions.reduce((sum, s) => sum + s.volume, 0);
    const totalMinutes = todaysSessions.reduce((sum, s) =>
      sum + Math.round((new Date(s.finished_at) - new Date(s.started_at)) / 60000), 0);
    const names = [...new Set(todaysSessions.map(s => s.workouts ? s.workouts.name : 'Treino avulso'))].join(', ');
    const lastSession = todaysSessions[0];
    const continueLink = lastSession.workout_id
      ? `<a href="./pages/train.html?id=${lastSession.workout_id}&session=${lastSession.id}" class="btn btn-primary full" style="text-decoration:none;display:flex;align-items:center;justify-content:center;margin-bottom:8px">↺ Continuar treino</a>`
      : '';

    heroSection.innerHTML = `
      <div class="hero hero-done">
        <div class="tag">Treino de hoje concluído ✓</div>
        <h2>${names}</h2>
        <div class="stats">
          <div class="stat"><div class="v num">${formatMinutes(totalMinutes)}</div><div class="k">Duração</div></div>
          <div class="stat"><div class="v num">${totalSets}</div><div class="k">Séries</div></div>
          <div class="stat"><div class="v num">${Math.round(totalVolume).toLocaleString('pt-BR')}</div><div class="k">Volume kg</div></div>
        </div>
        ${continueLink}
        <a href="./pages/history.html" class="btn btn-secondary full" style="text-decoration:none;display:flex;align-items:center;justify-content:center">Ver histórico</a>
        <a href="./pages/ai-workout.html" class="hero-ai-link">Renovar treinos com IA</a>
      </div>`;
    return;
  }

  const suggestion = await getSuggestedWorkout();
  if(!suggestion){
    heroSection.innerHTML = '';
    return;
  }

  const groupNames = suggestion.groups.map(g => MUSCLE_GROUP_LABELS[g]).join(' e ');
  const why = suggestion.warn
    ? 'Todos os grupos ainda em recuperação — sugestão baseada na ficha treinada há mais tempo.'
    : `${groupNames} <b>100% recuperados</b>`;

  heroSection.innerHTML = `
    <div class="hero">
      <div class="tag">Treino de hoje</div>
      <h2>${suggestion.workout.name}</h2>
      <div class="why${suggestion.warn ? ' warn' : ''}">${why}</div>
      <button type="button" class="hero-btn" id="btnStartHero">▶ &nbsp;Iniciar treino</button>
      <a href="./pages/ai-workout.html" class="hero-ai-link">Renovar treinos com IA</a>
    </div>`;

  document.getElementById('btnStartHero').addEventListener('click', () => {
    navigate('./pages/train.html?id=' + suggestion.workout.id);
  });
}

function renderRecovery(recovery){
  recoveryStrip.innerHTML = recovery.map(r => {
    const ready = r.status !== 'em_recuperacao';
    const label = ready ? 'Pronto' : `${r.hoursRemaining}h rest.`;
    const barStyle = ready ? '' : `style="width:${r.pct}%"`;
    return `
      <div class="muscle-chip ${ready ? 'ok' : 'rec'}">
        <div class="m">${MUSCLE_GROUP_LABELS[r.group]}</div>
        <div class="bar"><i ${barStyle}></i></div>
        <div class="st">${label}</div>
      </div>`;
  }).join('');
}

const settings = await getUserSettings(user.id);
renderGreeting(settings?.display_name);

const weeklyGoal = settings?.weekly_goal || 4;
const weekStart = mondayOf(new Date());
const weekEnd = new Date(weekStart);
weekEnd.setDate(weekEnd.getDate() + 7);

const [sessionDates, recovery, recentDates, xp] = await Promise.all([
  getSessionDatesInRange(weekStart.toISOString(), weekEnd.toISOString()),
  getMuscleRecovery(),
  getRecentCompletedSessionDates(60),
  getUserXP()
]);

renderWeek(weekStart, sessionDates);
renderRing(sessionDates.length, weeklyGoal);
streakValue.textContent = computeStreak(recentDates);
leagueDot.style.background = getLeagueForXP(xp).color;
renderRecovery(recovery);
await renderHero();
