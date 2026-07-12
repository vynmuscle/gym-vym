import { supabase } from './supabaseClient.js';
import { navigate } from './router.js';
import { renderNav } from './navigation.js';
import { initPWA } from './pwa.js';
import { listExercisesWithProgress, getExerciseProgress } from './services/workoutService.js';

const { data: sd } = await supabase.auth.getSession();
if(!sd.session) navigate('../login.html');
initPWA();

renderNav('progress');

const exerciseSelect = document.getElementById('exerciseSelect');
const emptyState = document.getElementById('emptyState');
const progressContent = document.getElementById('progressContent');
const cardPR = document.getElementById('cardPR');
const cardLast = document.getElementById('cardLast');
const cardEvolution = document.getElementById('cardEvolution');
const metricMax = document.getElementById('metricMax');
const metricVolume = document.getElementById('metricVolume');
const periodSelect = document.getElementById('periodSelect');
const chartContainer = document.getElementById('chartContainer');
const chartTooltip = document.getElementById('chartTooltip');

let allSessions = [];
let currentMetric = 'maxWeight';

function showEmptyState(message){
  progressContent.style.display = 'none';
  emptyState.style.display = 'block';
  emptyState.innerHTML = `<p class="muted">${message}</p>`;
}

function formatDateShort(iso){
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function filterByPeriod(sessions, period){
  if(period === 'all') return sessions;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - Number(period));
  return sessions.filter(s => new Date(s.date) >= cutoff);
}

function computeStats(sessions){
  let pr = sessions[0];
  for(const s of sessions) if(s.maxWeight > pr.maxWeight) pr = s;

  const last = sessions[sessions.length - 1];

  const cutoff = new Date(last.date);
  cutoff.setDate(cutoff.getDate() - 28);

  let baseline = null;
  for(const s of sessions){
    if(new Date(s.date) <= cutoff) baseline = s;
  }
  if(!baseline && sessions.length > 1) baseline = sessions[0];

  let evolutionPct = null;
  if(baseline && baseline !== last && baseline.maxWeight > 0){
    evolutionPct = ((last.maxWeight - baseline.maxWeight) / baseline.maxWeight) * 100;
  }

  return { pr, last, evolutionPct };
}

function renderCards(){
  const stats = computeStats(allSessions);
  cardPR.textContent = `${stats.pr.maxWeight}kg`;
  cardLast.textContent = `${stats.last.maxWeight}kg`;
  cardEvolution.textContent = stats.evolutionPct === null
    ? '—'
    : `${stats.evolutionPct > 0 ? '+' : ''}${stats.evolutionPct.toFixed(0)}%`;
}

function renderChart(){
  chartTooltip.style.display = 'none';

  const sessions = filterByPeriod(allSessions, periodSelect.value);
  const svgHolder = chartContainer.querySelector('svg');
  if(svgHolder) svgHolder.remove();
  const oldMsg = chartContainer.querySelector('.chart-empty-msg');
  if(oldMsg) oldMsg.remove();

  if(sessions.length < 2){
    const msg = document.createElement('p');
    msg.className = 'muted chart-empty-msg';
    msg.style.padding = '40px 0';
    msg.style.textAlign = 'center';
    msg.textContent = 'Sem dados suficientes nesse período.';
    chartContainer.appendChild(msg);
    return;
  }

  const W = 340, H = 200;
  const padL = 40, padR = 12, padT = 12, padB = 28;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const values = sessions.map(s => currentMetric === 'volume' ? s.volume : s.maxWeight);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const rangeV = (maxV - minV) || Math.max(maxV, 1);
  const yMin = Math.max(0, minV - rangeV * 0.15);
  const yMax = maxV + rangeV * 0.15;
  const yRange = (yMax - yMin) || 1;

  const n = sessions.length;
  const xFor = i => n === 1 ? padL + chartW / 2 : padL + (i / (n - 1)) * chartW;
  const yFor = v => padT + chartH - ((v - yMin) / yRange) * chartH;

  const points = sessions.map((s, i) => ({
    x: xFor(i),
    y: yFor(currentMetric === 'volume' ? s.volume : s.maxWeight),
    session: s
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  const gridLines = [0, 0.33, 0.66, 1].map(frac => {
    const y = padT + chartH * frac;
    const val = yMax - yRange * frac;
    return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="var(--border)" stroke-width="1" />
      <text x="${padL - 6}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="var(--muted)" font-family="Inter, sans-serif">${Math.round(val)}</text>`;
  }).join('');

  const maxLabels = 8;
  const step = Math.max(1, Math.ceil(n / maxLabels));
  const xLabels = points
    .filter((p, i) => i % step === 0 || i === n - 1)
    .map(p => `<text x="${p.x.toFixed(1)}" y="${H - 6}" text-anchor="middle" font-size="10" fill="var(--muted)" font-family="Inter, sans-serif">${formatDateShort(p.session.date)}</text>`)
    .join('');

  const prSession = allSessions.reduce((a, b) => b.maxWeight > a.maxWeight ? b : a, allSessions[0]);

  const circles = points.map((p, i) => {
    const isPR = currentMetric === 'maxWeight' && p.session === prSession;
    return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${isPR ? 6 : 4}" fill="${isPR ? 'var(--red)' : 'var(--yellow)'}" stroke="var(--bg)" stroke-width="1.5" class="chart-point" data-index="${i}" style="cursor:pointer" />`;
  }).join('');

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'chart-svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = `${gridLines}<path d="${pathD}" fill="none" stroke="var(--yellow)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />${circles}${xLabels}`;
  chartContainer.appendChild(svg);

  svg.querySelectorAll('.chart-point').forEach(circle => {
    circle.addEventListener('click', () => {
      const point = points[Number(circle.dataset.index)];
      showTooltip(circle, point);
    });
  });
}

function showTooltip(circleEl, point){
  const containerRect = chartContainer.getBoundingClientRect();
  const circleRect = circleEl.getBoundingClientRect();
  const x = circleRect.left + circleRect.width / 2 - containerRect.left;
  const y = circleRect.top - containerRect.top;

  const dateLabel = new Date(point.session.date).toLocaleDateString('pt-BR');

  chartTooltip.innerHTML = currentMetric === 'volume'
    ? `${dateLabel}<br><span class="num">${Math.round(point.session.volume)}kg</span> volume`
    : `${dateLabel}<br><span class="num">${point.session.maxWeight}kg</span> × ${point.session.topReps}`;

  chartTooltip.style.left = x + 'px';
  chartTooltip.style.top = y + 'px';
  chartTooltip.style.display = 'block';
}

async function loadExerciseProgress(exerciseId){
  allSessions = await getExerciseProgress(exerciseId);

  if(allSessions.length < 2){
    showEmptyState(
      allSessions.length === 0
        ? 'Nenhuma série registrada ainda pra esse exercício.'
        : 'Você só tem 1 sessão registrada desse exercício. Continue treinando pra ver sua evolução aqui!'
    );
    return;
  }

  emptyState.style.display = 'none';
  progressContent.style.display = 'block';
  renderCards();
  renderChart();
}

exerciseSelect.addEventListener('change', () => {
  if(exerciseSelect.value) loadExerciseProgress(exerciseSelect.value);
  else {
    progressContent.style.display = 'none';
    emptyState.style.display = 'none';
  }
});

metricMax.addEventListener('click', () => {
  currentMetric = 'maxWeight';
  metricMax.classList.add('active');
  metricVolume.classList.remove('active');
  renderChart();
});

metricVolume.addEventListener('click', () => {
  currentMetric = 'volume';
  metricVolume.classList.add('active');
  metricMax.classList.remove('active');
  renderChart();
});

periodSelect.addEventListener('change', renderChart);

const exercises = await listExercisesWithProgress();
exerciseSelect.innerHTML = '<option value="">Selecione...</option>' +
  exercises.map(ex => `<option value="${ex.id}">${ex.name}</option>`).join('');

if(exercises.length === 0){
  showEmptyState('Você ainda não registrou nenhuma série. Treine primeiro pra ver seu progresso aqui!');
}
