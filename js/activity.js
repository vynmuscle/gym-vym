import { supabase } from './supabaseClient.js';
import { navigate } from './router.js';
import { renderNav } from './navigation.js';
import { initPWA } from './pwa.js';
import { listDailyHealthStats } from './services/healthService.js';

const { data: sd } = await supabase.auth.getSession();
if(!sd.session) navigate('../login.html');
const user = sd.session.user;
initPWA();

await renderNav('evolution');

const emptyState = document.getElementById('emptyState');
const chartPanel = document.getElementById('chartPanel');
const metricSteps = document.getElementById('metricSteps');
const metricCalories = document.getElementById('metricCalories');
const periodSelect = document.getElementById('periodSelect');
const chartContainer = document.getElementById('chartContainer');
const chartTooltip = document.getElementById('chartTooltip');

let allStats = [];
let currentMetric = 'steps';

function formatDateShort(dateStr){
  const [, m, d] = dateStr.split('-');
  return `${d}/${m}`;
}

function formatDateBR(dateStr){
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function filterByPeriod(list, period){
  if(period === 'all') return list;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - Number(period));
  return list.filter(s => new Date(s.date) >= cutoff);
}

function renderChart(){
  chartTooltip.style.display = 'none';

  const withValue = allStats.filter(s => s[currentMetric] != null);
  const points = filterByPeriod(withValue, periodSelect.value);

  const svgHolder = chartContainer.querySelector('svg');
  if(svgHolder) svgHolder.remove();
  const oldMsg = chartContainer.querySelector('.chart-empty-msg');
  if(oldMsg) oldMsg.remove();

  if(points.length < 2){
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

  const values = points.map(p => p[currentMetric]);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const rangeV = (maxV - minV) || Math.max(maxV, 1);
  const yMin = Math.max(0, minV - rangeV * 0.15);
  const yMax = maxV + rangeV * 0.15;
  const yRange = (yMax - yMin) || 1;

  const n = points.length;
  const xFor = i => n === 1 ? padL + chartW / 2 : padL + (i / (n - 1)) * chartW;
  const yFor = v => padT + chartH - ((v - yMin) / yRange) * chartH;

  const coords = points.map((p, i) => ({ x: xFor(i), y: yFor(p[currentMetric]), stat: p }));

  const pathD = coords.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  const gridLines = [0, 0.33, 0.66, 1].map(frac => {
    const y = padT + chartH * frac;
    const val = yMax - yRange * frac;
    return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="var(--border)" stroke-width="1" />
      <text x="${padL - 6}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="var(--muted)" font-family="Inter, sans-serif">${Math.round(val)}</text>`;
  }).join('');

  const maxLabels = 8;
  const step = Math.max(1, Math.ceil(n / maxLabels));
  const xLabels = coords
    .filter((p, i) => i % step === 0 || i === n - 1)
    .map(p => `<text x="${p.x.toFixed(1)}" y="${H - 6}" text-anchor="middle" font-size="10" fill="var(--muted)" font-family="Inter, sans-serif">${formatDateShort(p.stat.date)}</text>`)
    .join('');

  const circles = coords.map((p, i) =>
    `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="var(--yellow)" stroke="var(--bg)" stroke-width="1.5" class="chart-point" data-index="${i}" style="cursor:pointer" />`
  ).join('');

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'chart-svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = `${gridLines}<path d="${pathD}" fill="none" stroke="var(--yellow)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />${circles}${xLabels}`;
  chartContainer.appendChild(svg);

  svg.querySelectorAll('.chart-point').forEach(circle => {
    circle.addEventListener('click', () => {
      const point = coords[Number(circle.dataset.index)];
      showTooltip(circle, point);
    });
  });
}

function showTooltip(circleEl, point){
  const containerRect = chartContainer.getBoundingClientRect();
  const circleRect = circleEl.getBoundingClientRect();
  const x = circleRect.left + circleRect.width / 2 - containerRect.left;
  const y = circleRect.top - containerRect.top;

  const unit = currentMetric === 'steps' ? 'passos' : 'kcal';
  chartTooltip.innerHTML = `${formatDateBR(point.stat.date)}<br><span class="num">${point.stat[currentMetric].toLocaleString('pt-BR')}</span> ${unit}`;
  chartTooltip.style.left = x + 'px';
  chartTooltip.style.top = y + 'px';
  chartTooltip.style.display = 'block';
}

metricSteps.addEventListener('click', () => {
  currentMetric = 'steps';
  metricSteps.classList.add('active');
  metricCalories.classList.remove('active');
  renderChart();
});

metricCalories.addEventListener('click', () => {
  currentMetric = 'calories_total';
  metricCalories.classList.add('active');
  metricSteps.classList.remove('active');
  renderChart();
});

periodSelect.addEventListener('change', renderChart);

allStats = await listDailyHealthStats(user.id);

if(allStats.length < 2){
  chartPanel.style.display = 'none';
  emptyState.style.display = 'block';
} else {
  chartPanel.style.display = 'block';
  emptyState.style.display = 'none';
  renderChart();
}
