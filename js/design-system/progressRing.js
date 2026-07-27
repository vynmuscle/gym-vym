// GVProgressRing — gera o SVG do anel circular de progresso.
// Hoje esse padrão só existia hardcoded no dashboard (css/dashboard.css
// .ring); este helper centraliza o cálculo de stroke-dasharray/offset
// para reuso em qualquer tela (treino, dieta, evolução).

export function createProgressRing({ size = 64, strokeWidth = 6, percent = 0 } = {}){
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circumference - (clamped / 100) * circumference;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'gv-progress-ring');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.style.setProperty('--gv-ring-size', `${size}px`);

  const track = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  track.setAttribute('class', 'gv-progress-ring__track');
  track.setAttribute('cx', size / 2);
  track.setAttribute('cy', size / 2);
  track.setAttribute('r', radius);

  const fill = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  fill.setAttribute('class', 'gv-progress-ring__fill');
  fill.setAttribute('cx', size / 2);
  fill.setAttribute('cy', size / 2);
  fill.setAttribute('r', radius);
  fill.setAttribute('stroke-dasharray', circumference);
  fill.setAttribute('stroke-dashoffset', offset);

  svg.appendChild(track);
  svg.appendChild(fill);

  function setPercent(next){
    const c = Math.max(0, Math.min(100, next));
    fill.setAttribute('stroke-dashoffset', circumference - (c / 100) * circumference);
  }

  return { svg, setPercent };
}
