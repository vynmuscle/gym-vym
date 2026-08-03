import { supabase } from './supabaseClient.js';
import { navigate } from './router.js';
import { renderNav } from './navigation.js';
import { initPWA } from './pwa.js';
import {
  getMuscleRecovery, getSuggestedWorkout, getTodaysCompletedSessions,
  getSessionDatesInRange, getRecentCompletedSessionDates, getUserXP,
  listCompletedSessions
} from './services/workoutService.js';
import { getUserSettings } from './services/profileService.js';
import { computeStreak } from './utils.js';
import { getLeagueForXP } from './leagues.js';
import { createProgressRing } from './design-system/progressRing.js';
import { drawAscent } from './core/motion.js';
import { getLatestWeight } from './services/dietService.js';
import { getDailyHealthStats } from './services/healthService.js';
import { showToast } from './core/toast.js';
import { icon } from './icons.js';
import { escapeHtml } from './utils/escapeHtml.js';

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

const greetingName = document.getElementById('greetingName');
const leagueEmoji = document.getElementById('leagueEmoji');
const leagueLabel = document.getElementById('leagueLabel');
const greetingDate = document.getElementById('greetingDate');
const weekRow = document.getElementById('weekRow');
const heroSection = document.getElementById('heroSection');
const ringHost = document.getElementById('ringHost');
const progressBig = document.getElementById('progressBig');
const progressSub = document.getElementById('progressSub');
const streakIcon = document.getElementById('streakIcon');
const streakValue = document.getElementById('streakValue');
const recoveryStrip = document.getElementById('recoveryStrip');
const insightCard = document.getElementById('insightCard');
const insightText = document.getElementById('insightText');
const caloriesValue = document.getElementById('caloriesValue');
const bodyValue = document.getElementById('bodyValue');
const watchStat = document.getElementById('watchStat');
const watchValue = document.getElementById('watchValue');
const recentActivityCard = document.getElementById('recentActivityCard');
const btnAskAI = document.getElementById('btnAskAI');

btnAskAI.innerHTML = icon('sparkle');
streakIcon.innerHTML = icon('flame');
document.getElementById('caloriesIcon').innerHTML = icon('flame');
document.getElementById('bodyIcon').innerHTML = icon('scale');
document.getElementById('watchIcon').innerHTML = icon('footprints');

const ring = createProgressRing({ size: 92, strokeWidth: 9, percent: 0 });
const ringPct = document.createElement('div');
ringPct.className = 'pct';
ringPct.id = 'ringPct';
ringPct.textContent = '0%';
ringHost.appendChild(ring.svg);
ringHost.appendChild(ringPct);

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
  greetingName.textContent = `Fala, ${name}!`;

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
    const cls = `gv3-day${done ? ' gv3-day--done' : ''}${isToday ? ' gv3-day--today' : ''}`;
    return `<div class="${cls}"><div class="gv3-day__lbl">${lbl}</div><div class="gv3-day__dot">${dotContent}</div></div>`;
  }).join('');
}

function renderRing(weekCount, weeklyGoal){
  const pct = weeklyGoal > 0 ? Math.round((weekCount / weeklyGoal) * 100) : 0;
  const visualPct = Math.min(pct, 100);

  ring.setPercent(visualPct);
  ringPct.textContent = `${pct}%`;

  progressBig.textContent = pct >= 100
    ? 'Meta da semana batida!'
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
    const names = [...new Set(todaysSessions.map(s => escapeHtml(s.workouts ? s.workouts.name : 'Treino avulso')))].join(', ');

    heroSection.innerHTML = `
      <div class="gv3-hero gv3-hero--done gv3-anim-in">
        <div class="gv3-ascent" id="heroAscent"><svg viewBox="0 0 200 80" preserveAspectRatio="none"><path d="M0 70 L60 55 L110 40 L150 20 L200 5" /></svg></div>
        <div style="position:relative">
          <div class="gv3-hero__tag">${icon('check', { size: 13 })}Treino de hoje concluído</div>
          <h2>${names}</h2>
          <div class="gv3-hero__stats">
            <div class="gv3-hero__stat"><div class="v gv3-mono">${formatMinutes(totalMinutes)}</div><div class="k">Duração</div></div>
            <div class="gv3-hero__stat"><div class="v gv3-mono">${totalSets}</div><div class="k">Séries</div></div>
            <div class="gv3-hero__stat"><div class="v gv3-mono">${Math.round(totalVolume).toLocaleString('pt-BR')}</div><div class="k">Volume kg</div></div>
          </div>
          <a href="./pages/history.html" class="gv3-btn gv3-btn--secondary gv3-btn--full">Ver histórico</a>
          <a href="./pages/ai-workout.html" class="gv3-hero__ai-link">Renovar treinos com IA</a>
        </div>
      </div>`;
    drawAscent(document.getElementById('heroAscent'));
    return;
  }

  const suggestion = await getSuggestedWorkout(user.id);
  if(!suggestion){
    heroSection.innerHTML = '';
    return;
  }

  const groupNames = suggestion.groups.map(g => MUSCLE_GROUP_LABELS[g]).join(' e ');
  const why = suggestion.warn
    ? 'Todos os grupos ainda em recuperação — sugestão baseada na ficha treinada há mais tempo.'
    : `${groupNames} <b>100% recuperados</b>`;

  heroSection.innerHTML = `
    <div class="gv3-hero gv3-anim-in">
      <div class="gv3-hero__tag">Treino de hoje</div>
      <h2>${escapeHtml(suggestion.workout.name)}</h2>
      <div class="gv3-hero__why${suggestion.warn ? ' gv3-hero__why--warn' : ''}">${why}</div>
      <button type="button" class="gv3-btn gv3-btn--primary gv3-btn--full" id="btnStartHero">Iniciar treino</button>
      <a href="./pages/ai-workout.html" class="gv3-hero__ai-link">Renovar treinos com IA</a>
    </div>`;

  document.getElementById('btnStartHero').addEventListener('click', () => {
    navigate('./pages/train.html?id=' + suggestion.workout.id);
  });
}

function renderRecovery(recovery){
  recoveryStrip.innerHTML = recovery.map((r) => {
    const ready = r.status !== 'em_recuperacao';
    const label = ready ? 'Pronto' : `${r.hoursRemaining}h rest.`;
    const barStyle = ready ? 'width:100%' : `width:${r.pct}%`;
    const color = ready ? 'var(--gv3-status-good)' : 'var(--gv3-status-warning)';
    return `
      <div class="gv3-muscle-chip">
        <div class="m">${MUSCLE_GROUP_LABELS[r.group]}</div>
        <div class="gv3-progress"><div class="gv3-progress__fill" style="${barStyle};background:${color}"></div></div>
        <div class="st">${label}</div>
      </div>`;
  }).join('');
}

function renderInsight({ weekCount, weeklyGoal, streak, recovery }){
  const readyGroups = recovery.filter(r => r.status !== 'em_recuperacao').map(r => MUSCLE_GROUP_LABELS[r.group]);
  let text = null;

  if(weekCount === 0){
    text = 'Nenhum treino essa semana ainda — comece hoje pra manter o ritmo.';
  } else if(weekCount >= weeklyGoal){
    text = `Meta da semana batida com ${weekCount} treino${weekCount > 1 ? 's' : ''}! Mantenha o streak de ${streak} dia${streak !== 1 ? 's' : ''}.`;
  } else if(streak >= 3){
    text = `${streak} dias de sequência — não quebre o streak, faltam ${weeklyGoal - weekCount} treino${weeklyGoal - weekCount > 1 ? 's' : ''} pra bater a meta da semana.`;
  } else if(readyGroups.length > 0){
    text = `${readyGroups.slice(0, 3).join(', ')} 100% recuperados — bom momento pra treinar.`;
  }

  if(!text){
    insightCard.style.display = 'none';
    return;
  }
  insightText.textContent = text;
  insightCard.style.display = 'block';
}

function todayStr(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function renderBody(){
  const weightRow = await getLatestWeight(user.id);
  if(!weightRow) return;
  bodyValue.textContent = `${weightRow.weight_kg} kg`;
}

async function renderWatch(){
  const stats = await getDailyHealthStats(user.id, todayStr());
  if(!stats) return;

  if(stats.calories_total) caloriesValue.textContent = `${stats.calories_total.toLocaleString('pt-BR')} kcal`;

  if(!stats.steps) return;
  watchStat.style.display = '';
  watchValue.textContent = stats.steps.toLocaleString('pt-BR');
}

async function renderRecentActivity(){
  const sessions = (await listCompletedSessions()).slice(0, 3);
  if(sessions.length === 0){
    recentActivityCard.innerHTML = '<div class="gv3-activity-item"><div class="gv3-activity-item__sub">Nenhum treino concluído ainda.</div></div>';
    return;
  }
  recentActivityCard.innerHTML = sessions.map(s => {
    const label = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(s.started_at));
    return `
      <div class="gv3-activity-item">
        <div>
          <div class="gv3-activity-item__title">${escapeHtml(s.workouts ? s.workouts.name : 'Treino avulso')}</div>
          <div class="gv3-activity-item__sub">${label}</div>
        </div>
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
const streak = computeStreak(recentDates);
streakValue.textContent = streak;

const league = getLeagueForXP(xp);
leagueEmoji.textContent = league.emoji;
leagueLabel.textContent = `${league.name} · ${xp} XP`;

renderRecovery(recovery);
renderInsight({ weekCount: sessionDates.length, weeklyGoal, streak, recovery });
await renderHero();

renderBody().catch(() => {});
renderWatch().catch(() => {});
renderRecentActivity();

btnAskAI.addEventListener('click', () => {
  showToast('✨ Assistente de IA conversacional — em breve');
});
