import { supabase } from './supabaseClient.js';
import { navigate } from './router.js';
import { renderNav } from './navigation.js';
import { initPWA } from './pwa.js';
import { getSessionsByMonth, getRecentCompletedSessionDates } from './services/workoutService.js';
import { computeStreak, formatDuration } from './utils.js';

const { data: sd } = await supabase.auth.getSession();
if(!sd.session) navigate('../login.html');
initPWA();

await renderNav('evolution');

const monthLabel = document.getElementById('monthLabel');
const calGrid = document.getElementById('calGrid');
const btnPrevMonth = document.getElementById('btnPrevMonth');
const btnNextMonth = document.getElementById('btnNextMonth');
const footerTotal = document.getElementById('footerTotal');
const footerStreak = document.getElementById('footerStreak');
const daySheet = document.getElementById('daySheet');
const daySheetDate = document.getElementById('daySheetDate');
const daySheetList = document.getElementById('daySheetList');
const btnCloseDaySheet = document.getElementById('btnCloseDaySheet');

const today = new Date();
let viewYear = today.getFullYear();
let viewMonth = today.getMonth() + 1; // 1-indexed

function isCurrentMonth(){
  return viewYear === today.getFullYear() && viewMonth === today.getMonth() + 1;
}

function workoutInitial(name){
  if(!name) return '?';
  const match = name.match(/treino\s+([a-z])\b/i);
  if(match) return match[1].toUpperCase();
  return name.trim().charAt(0).toUpperCase();
}

function buildCalendarDays(year, month){
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const days = [];
  for(let i = 0; i < firstWeekday; i++) days.push(null);
  for(let d = 1; d <= daysInMonth; d++) days.push(d);
  return days;
}

function groupSessionsByDay(sessions){
  const map = new Map();
  for(const s of sessions){
    const day = new Date(s.started_at).getDate();
    if(!map.has(day)) map.set(day, []);
    map.get(day).push(s);
  }
  return map;
}

function openDaySheet(day, sessions){
  daySheetDate.textContent = `${String(day).padStart(2, '0')}/${String(viewMonth).padStart(2, '0')}/${viewYear}`;

  daySheetList.innerHTML = sessions.map(s => `
    <div class="list-item">
      <div class="list-item-info">
        <span class="list-item-title">${s.workouts ? s.workouts.name : 'Treino avulso'}${s.finished_at ? '' : ' (incompleta)'}</span>
        <span class="list-item-sub">${s.finished_at ? formatDuration(s.started_at, s.finished_at) : 'sem duração'} · ${s.sets} séries · ${Math.round(s.volume).toLocaleString('pt-BR')}kg</span>
      </div>
    </div>
  `).join('');

  daySheet.classList.add('open');
}

btnCloseDaySheet.addEventListener('click', () => daySheet.classList.remove('open'));

async function loadMonth(){
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(viewYear, viewMonth - 1, 1));
  monthLabel.textContent = label.charAt(0).toUpperCase() + label.slice(1);
  btnNextMonth.disabled = isCurrentMonth();

  const sessions = await getSessionsByMonth(viewYear, viewMonth);
  const byDay = groupSessionsByDay(sessions);
  const days = buildCalendarDays(viewYear, viewMonth);

  calGrid.innerHTML = days.map(d => {
    if(d === null) return '<div class="cal-day empty"></div>';

    const daySessions = byDay.get(d) || [];
    const isToday = isCurrentMonth() && d === today.getDate();

    let markersHtml = '';
    if(daySessions.length > 0){
      const shown = daySessions.slice(0, 2);
      const extra = daySessions.length - shown.length;
      markersHtml = shown.map(s => {
        const cls = s.finished_at ? 'completed' : 'incomplete';
        const label = s.finished_at ? workoutInitial(s.workouts ? s.workouts.name : 'Treino avulso') : '!';
        return `<span class="cal-marker ${cls}">${label}</span>`;
      }).join('') + (extra > 0 ? `<span class="cal-marker-more">+${extra}</span>` : '');
    }

    return `
      <div class="cal-day${isToday ? ' today' : ''}" data-day="${d}">
        <span class="cal-day-num">${d}</span>
        <div class="cal-markers">${markersHtml}</div>
      </div>
    `;
  }).join('');

  calGrid.querySelectorAll('.cal-day[data-day]').forEach(el => {
    const day = Number(el.dataset.day);
    const daySessions = byDay.get(day) || [];
    if(daySessions.length === 0) return;
    el.addEventListener('click', () => openDaySheet(day, daySessions));
  });

  footerTotal.textContent = sessions.filter(s => s.finished_at).length;
}

btnPrevMonth.addEventListener('click', () => {
  viewMonth--;
  if(viewMonth < 1){ viewMonth = 12; viewYear--; }
  loadMonth();
});

btnNextMonth.addEventListener('click', () => {
  if(isCurrentMonth()) return;
  viewMonth++;
  if(viewMonth > 12){ viewMonth = 1; viewYear++; }
  loadMonth();
});

const recentDates = await getRecentCompletedSessionDates(60);
footerStreak.textContent = computeStreak(recentDates);

await loadMonth();
