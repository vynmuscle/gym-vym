// GVToast — fila garante um por vez, nunca sobrepostos.
// Substitui js/toast.js (app-toast) e o toast paralelo do exercisePicker
// (ex-toast). Migração dos call-sites acontece fase a fase.

const queue = [];
let showing = false;

function renderNext(){
  if(showing || queue.length === 0) return;
  showing = true;

  const { html, duration } = queue.shift();
  const el = document.createElement('div');
  el.className = 'gv-toast';
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) el.classList.add('no-motion');
  el.innerHTML = html;
  document.body.appendChild(el);

  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => {
      el.remove();
      showing = false;
      renderNext();
    }, el.classList.contains('no-motion') ? 0 : 250);
  }, duration);
}

export function showToast(html, { duration = 2500 } = {}){
  queue.push({ html, duration });
  renderNext();
}
