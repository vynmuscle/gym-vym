import { supabase } from './supabaseClient.js';
import { navigate } from './router.js';
import { renderNav } from './navigation.js';
import { initPWA } from './pwa.js';
import { listExercisesWithProgress, getExerciseProgress } from './services/workoutService.js';
import { showToast } from './toast.js';
import { escapeHtml } from './utils/escapeHtml.js';

const { data: sd } = await supabase.auth.getSession();
if(!sd.session) navigate('../login.html');
initPWA();

await renderNav('evolution');

const exerciseSelect = document.getElementById('exerciseSelect');
const emptyState = document.getElementById('emptyState');
const progressContent = document.getElementById('progressContent');
const cardPR = document.getElementById('cardPR');
const cardLast = document.getElementById('cardLast');
const cardEvolution = document.getElementById('cardEvolution');
const progressNote = document.getElementById('progressNote');
const metricMax = document.getElementById('metricMax');
const metricVolume = document.getElementById('metricVolume');
const periodSelect = document.getElementById('periodSelect');
const chartContainer = document.getElementById('chartContainer');
const chartTooltip = document.getElementById('chartTooltip');

document.getElementById('btnAskAI').addEventListener('click', () => {
  showToast('✨ Assistente de IA conversacional — em breve');
});

let allSessions = [];
let currentMetric = 'maxWeight';
let currentIsDuration = false;

function showEmptyState(message){
  progressContent.style.display = 'none';
  emptyState.style.display = 'block';
  emptyState.innerHTML = `
    <div class="gv3-empty">
      <svg class="gv3-empty__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-6" /><path d="M22 20H2" /></svg>
      <div class="gv3-empty__desc">${message}</div>
    </div>`;
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

// Pra exercícios de duração (esteira etc.), o "recorde" que importa é a
// elevação/inclinação máxima, não peso x reps (que nem existe nesse tipo).
function prField(){
  return currentIsDuration ? 'maxInclinePct' : 'maxWeight';
}

// currentMetric é o mesmo toggle (2 botões) reaproveitado: pra exercício de
// duração o 1º vira "Elevação" (em vez de carga) e o 2º vira "Duração" (em
// vez de volume) — não existe peso/reps nesse tipo de exercício.
function valueFor(session){
  if(currentIsDuration) return currentMetric === 'volume' ? session.maxDurationMin : session.maxInclinePct;
  return currentMetric === 'volume' ? session.volume : session.maxWeight;
}

function computeStats(sessions){
  const field = prField();
  let pr = sessions[0];
  for(const s of sessions) if(s[field] > pr[field]) pr = s;

  const last = sessions[sessions.length - 1];

  const cutoff = new Date(last.date);
  cutoff.setDate(cutoff.getDate() - 28);

  let baseline = null;
  for(const s of sessions){
    if(new Date(s.date) <= cutoff) baseline = s;
  }
  if(!baseline && sessions.length > 1) baseline = sessions[0];

  let evolutionPct = null;
  if(baseline && baseline !== last && baseline[field] > 0){
    evolutionPct = ((last[field] - baseline[field]) / baseline[field]) * 100;
  }

  return { pr, last, evolutionPct };
}

// Traduz o número (evolutionPct, já calculado em computeStats) numa frase —
// mesma métrica que já existe no card "Evolução 4 sem.", só interpretada.
function evolutionNarrative(evolutionPct){
  if(evolutionPct === null) return null;
  const pct = Math.round(evolutionPct);
  if(pct >= 10) return `Você evoluiu ${pct}% nos últimos 28 dias. Continue assim!`;
  if(pct > 0) return `Progresso estável — evolução de ${pct}% nas últimas semanas.`;
  if(pct === 0) return 'Sem mudança nas últimas semanas — na mesma carga/volume de 28 dias atrás.';
  return 'Leve queda de desempenho nas últimas semanas — considere um descanso extra ou reduzir o volume.';
}

function renderCards(){
  const stats = computeStats(allSessions);
  const field = prField();
  const unit = currentIsDuration ? '%' : 'kg';
  cardPR.textContent = `${stats.pr[field]}${unit}`;
  cardLast.textContent = `${stats.last[field]}${unit}`;
  cardEvolution.textContent = stats.evolutionPct === null
    ? '—'
    : `${stats.evolutionPct > 0 ? '+' : ''}${stats.evolutionPct.toFixed(0)}%`;

  const note = evolutionNarrative(stats.evolutionPct);
  progressNote.textContent = note || '';
  progressNote.style.display = note ? 'block' : 'none';
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

  const values = sessions.map(s => valueFor(s));
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
    y: yFor(valueFor(s)),
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

  const field = prField();
  const prSession = allSessions.reduce((a, b) => b[field] > a[field] ? b : a, allSessions[0]);

  const circles = points.map((p, i) => {
    const isPR = currentMetric === 'maxWeight' && p.session === prSession;
    return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${isPR ? 6 : 4}" fill="${isPR ? 'var(--red)' : 'var(--yellow)'}" stroke="var(--bg)" stroke-width="1.5" class="chart-point" data-index="${i}" style="cursor:pointer" />`;
  }).join('');

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'chart-svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = `
    <defs>
      <linearGradient id="chartLineGradient" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" style="stop-color:var(--gv-red, var(--red))" />
        <stop offset="100%" style="stop-color:var(--gv-yellow, var(--yellow))" />
      </linearGradient>
    </defs>
    ${gridLines}<path class="chart-line" d="${pathD}" fill="none" stroke="url(#chartLineGradient)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />${circles}${xLabels}`;
  chartContainer.appendChild(svg);

  const pathEl = svg.querySelector('.chart-line');
  if(pathEl && !window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    const length = pathEl.getTotalLength();
    pathEl.style.strokeDasharray = String(length);
    pathEl.animate(
      [{ strokeDashoffset: length }, { strokeDashoffset: 0 }],
      { duration: 500, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }
    );
  }

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

  if(currentIsDuration){
    chartTooltip.innerHTML = currentMetric === 'volume'
      ? `${dateLabel}<br><span class="num">${point.session.maxDurationMin}min</span> duração`
      : `${dateLabel}<br><span class="num">${point.session.maxInclinePct}%</span> elevação`;
  } else {
    chartTooltip.innerHTML = currentMetric === 'volume'
      ? `${dateLabel}<br><span class="num">${Math.round(point.session.volume)}kg</span> volume`
      : `${dateLabel}<br><span class="num">${point.session.maxWeight}kg</span> × ${point.session.topReps}`;
  }

  chartTooltip.style.left = x + 'px';
  chartTooltip.style.top = y + 'px';
  chartTooltip.style.display = 'block';
}

function updateMetricLabels(){
  metricMax.textContent = currentIsDuration ? 'Elevação' : 'Carga máxima';
  metricVolume.textContent = currentIsDuration ? 'Duração' : 'Volume';
}

async function loadExerciseProgress(exerciseId){
  currentIsDuration = trackingTypeById.get(exerciseId) === 'duration';
  currentMetric = 'maxWeight';
  metricMax.classList.add('active');
  metricVolume.classList.remove('active');
  updateMetricLabels();

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
const trackingTypeById = new Map(exercises.map(ex => [ex.id, ex.tracking_type]));
exerciseSelect.innerHTML = '<option value="">Selecione...</option>' +
  exercises.map(ex => `<option value="${ex.id}">${escapeHtml(ex.name)}</option>`).join('');

if(exercises.length === 0){
  showEmptyState('Você ainda não registrou nenhuma série. Treine primeiro pra ver seu progresso aqui!');
}
