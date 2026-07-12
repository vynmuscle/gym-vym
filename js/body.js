import { supabase } from './supabaseClient.js';
import { navigate } from './router.js';
import { renderNav } from './navigation.js';
import { initPWA } from './pwa.js';
import {
  MEASUREMENT_METRICS, listMeasurements, createMeasurement, updateMeasurement, deleteMeasurement
} from './services/bodyService.js';

const { data: sd } = await supabase.auth.getSession();
if(!sd.session) navigate('../login.html');
const user = sd.session.user;
initPWA();

renderNav('body');

const emptyState = document.getElementById('emptyState');
const highlightCard = document.getElementById('highlightCard');
const highlightWeight = document.getElementById('highlightWeight');
const highlightSub = document.getElementById('highlightSub');
const imcRow = document.getElementById('imcRow');
const imcValue = document.getElementById('imcValue');
const imcBadge = document.getElementById('imcBadge');
const weightDelta = document.getElementById('weightDelta');

const measuredAtInput = document.getElementById('measuredAt');
const weightInput = document.getElementById('weight');
const heightInput = document.getElementById('height');
const armInput = document.getElementById('arm');
const waistInput = document.getElementById('waist');
const chestInput = document.getElementById('chest');
const hipInput = document.getElementById('hip');
const thighInput = document.getElementById('thigh');
const calfInput = document.getElementById('calf');
const notesInput = document.getElementById('notes');
const btnSave = document.getElementById('btnSave');
const btnCancel = document.getElementById('btnCancel');
const formTitle = document.getElementById('formTitle');
const mensagem = document.getElementById('mensagem');

const chartPanel = document.getElementById('chartPanel');
const metricSelect = document.getElementById('metricSelect');
const periodSelect = document.getElementById('periodSelect');
const chartContainer = document.getElementById('chartContainer');
const chartTooltip = document.getElementById('chartTooltip');

const listPanel = document.getElementById('listPanel');

let measurements = [];
let editingId = null;

function todayStr(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateBR(dateStr){
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function getLatestHeight(){
  for(let i = measurements.length - 1; i >= 0; i--){
    if(measurements[i].height_cm) return measurements[i].height_cm;
  }
  return null;
}

function classifyIMC(imc){
  if(imc < 18.5) return { label: 'Abaixo do peso', cls: 'abaixo' };
  if(imc < 25) return { label: 'Peso normal', cls: 'normal' };
  if(imc < 30) return { label: 'Sobrepeso', cls: 'sobrepeso' };
  return { label: 'Obesidade', cls: 'obesidade' };
}

function showMessage(text, type = 'info'){
  mensagem.className = `message ${type}`;
  mensagem.innerText = text;
}

function resetForm(){
  editingId = null;
  measuredAtInput.value = todayStr();
  weightInput.value = '';
  heightInput.value = getLatestHeight() || '';
  armInput.value = '';
  waistInput.value = '';
  chestInput.value = '';
  hipInput.value = '';
  thighInput.value = '';
  calfInput.value = '';
  notesInput.value = '';
  formTitle.innerText = 'Nova medida';
  btnCancel.style.display = 'none';
}

function startEdit(m){
  editingId = m.id;
  measuredAtInput.value = m.measured_at;
  weightInput.value = m.weight_kg;
  heightInput.value = m.height_cm || '';
  armInput.value = m.arm_cm || '';
  waistInput.value = m.waist_cm || '';
  chestInput.value = m.chest_cm || '';
  hipInput.value = m.hip_cm || '';
  thighInput.value = m.thigh_cm || '';
  calfInput.value = m.calf_cm || '';
  notesInput.value = m.notes || '';
  formTitle.innerText = 'Editar medida';
  btnCancel.style.display = 'inline-block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function removeMeasurement(id){
  if(!confirm('Excluir este registro?')) return;
  await deleteMeasurement(id);
  await reload();
}

function renderHighlight(){
  if(measurements.length === 0){
    emptyState.style.display = 'block';
    highlightCard.style.display = 'none';
    return;
  }
  emptyState.style.display = 'none';
  highlightCard.style.display = 'block';

  const last = measurements[measurements.length - 1];
  highlightWeight.textContent = `${last.weight_kg}kg`;
  highlightSub.textContent = `Registrado em ${formatDateBR(last.measured_at)}`;

  const height = getLatestHeight();
  if(height){
    const imc = last.weight_kg / ((height / 100) ** 2);
    const info = classifyIMC(imc);
    imcRow.style.display = 'flex';
    imcValue.textContent = `IMC ${imc.toFixed(1)}`;
    imcBadge.textContent = info.label;
    imcBadge.className = `imc-badge ${info.cls}`;
  } else {
    imcRow.style.display = 'none';
  }

  if(measurements.length >= 2){
    const prev = measurements[measurements.length - 2];
    const diff = last.weight_kg - prev.weight_kg;
    const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '—';
    weightDelta.textContent = diff === 0
      ? 'Sem variação desde o registro anterior'
      : `${arrow} ${Math.abs(diff).toFixed(1)}kg desde o registro anterior`;
  } else {
    weightDelta.textContent = '';
  }
}

function availableMetrics(){
  return MEASUREMENT_METRICS.filter(metric =>
    measurements.filter(m => m[metric.key] != null).length >= 2
  );
}

function filterByPeriod(list, period){
  if(period === 'all') return list;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - Number(period));
  return list.filter(m => new Date(m.measured_at) >= cutoff);
}

function renderChart(){
  chartTooltip.style.display = 'none';

  const metricKey = metricSelect.value;
  const unit = metricKey === 'weight_kg' ? 'kg' : 'cm';

  const withValue = measurements.filter(m => m[metricKey] != null);
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

  const values = points.map(m => m[metricKey]);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const rangeV = (maxV - minV) || Math.max(maxV, 1);
  const yMin = Math.max(0, minV - rangeV * 0.15);
  const yMax = maxV + rangeV * 0.15;
  const yRange = (yMax - yMin) || 1;

  const n = points.length;
  const xFor = i => n === 1 ? padL + chartW / 2 : padL + (i / (n - 1)) * chartW;
  const yFor = v => padT + chartH - ((v - yMin) / yRange) * chartH;

  const coords = points.map((m, i) => ({ x: xFor(i), y: yFor(m[metricKey]), measurement: m }));

  const pathD = coords.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  const gridLines = [0, 0.33, 0.66, 1].map(frac => {
    const y = padT + chartH * frac;
    const val = yMax - yRange * frac;
    return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="var(--border)" stroke-width="1" />
      <text x="${padL - 6}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="var(--muted)" font-family="Inter, sans-serif">${val.toFixed(0)}</text>`;
  }).join('');

  const maxLabels = 8;
  const step = Math.max(1, Math.ceil(n / maxLabels));
  const xLabels = coords
    .filter((p, i) => i % step === 0 || i === n - 1)
    .map(p => `<text x="${p.x.toFixed(1)}" y="${H - 6}" text-anchor="middle" font-size="10" fill="var(--muted)" font-family="Inter, sans-serif">${formatDateBR(p.measurement.measured_at).slice(0, 5)}</text>`)
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
      showTooltip(circle, point, unit);
    });
  });
}

function showTooltip(circleEl, point, unit){
  const containerRect = chartContainer.getBoundingClientRect();
  const circleRect = circleEl.getBoundingClientRect();
  const x = circleRect.left + circleRect.width / 2 - containerRect.left;
  const y = circleRect.top - containerRect.top;

  chartTooltip.innerHTML = `${formatDateBR(point.measurement.measured_at)}<br><span class="num">${point.measurement[metricSelect.value]}${unit}</span>`;
  chartTooltip.style.left = x + 'px';
  chartTooltip.style.top = y + 'px';
  chartTooltip.style.display = 'block';
}

function renderChartPanel(){
  const metrics = availableMetrics();
  if(metrics.length === 0){
    chartPanel.style.display = 'none';
    return;
  }
  chartPanel.style.display = 'block';

  const previousValue = metricSelect.value;
  metricSelect.innerHTML = metrics.map(m => `<option value="${m.key}">${m.label}</option>`).join('');
  metricSelect.value = metrics.some(m => m.key === previousValue) ? previousValue : metrics[0].key;

  renderChart();
}

function renderList(){
  if(measurements.length === 0){
    listPanel.innerHTML = '';
    return;
  }

  const ordered = [...measurements].reverse();

  listPanel.innerHTML = ordered.map(m => {
    const extras = MEASUREMENT_METRICS
      .filter(metric => metric.key !== 'weight_kg' && m[metric.key] != null)
      .map(metric => `${metric.label} ${m[metric.key]}cm`);
    return `
      <div class="list-item">
        <div class="list-item-info">
          <span class="list-item-title">${formatDateBR(m.measured_at)} · ${m.weight_kg}kg</span>
          <span class="list-item-sub">${extras.length ? extras.join(' · ') : 'Sem outras medidas'}</span>
        </div>
        <div class="list-item-actions">
          <button type="button" class="btn-icon" data-edit="${m.id}">✎</button>
          <button type="button" class="btn-icon danger" data-delete="${m.id}">✕</button>
        </div>
      </div>
    `;
  }).join('');

  listPanel.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => startEdit(measurements.find(m => m.id === btn.dataset.edit)));
  });
  listPanel.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => removeMeasurement(btn.dataset.delete));
  });
}

async function reload(){
  measurements = await listMeasurements();
  renderHighlight();
  renderChartPanel();
  renderList();
}

btnSave.addEventListener('click', async () => {
  const weight = parseFloat(weightInput.value);

  if(!measuredAtInput.value){
    showMessage('Informe a data.', 'warning');
    return;
  }
  if(!weight){
    showMessage('Informe o peso.', 'warning');
    return;
  }

  const payload = {
    measured_at: measuredAtInput.value,
    weight_kg: weight,
    height_cm: heightInput.value ? parseFloat(heightInput.value) : null,
    arm_cm: armInput.value ? parseFloat(armInput.value) : null,
    waist_cm: waistInput.value ? parseFloat(waistInput.value) : null,
    chest_cm: chestInput.value ? parseFloat(chestInput.value) : null,
    hip_cm: hipInput.value ? parseFloat(hipInput.value) : null,
    thigh_cm: thighInput.value ? parseFloat(thighInput.value) : null,
    calf_cm: calfInput.value ? parseFloat(calfInput.value) : null,
    notes: notesInput.value.trim() || null
  };

  if(editingId){
    await updateMeasurement(editingId, payload);
    showMessage('Medida atualizada.', 'success');
  } else {
    await createMeasurement(user.id, payload);
    showMessage('Medida registrada.', 'success');
  }

  resetForm();
  await reload();
});

btnCancel.addEventListener('click', resetForm);
metricSelect.addEventListener('change', renderChart);
periodSelect.addEventListener('change', renderChart);

await reload();
resetForm();
