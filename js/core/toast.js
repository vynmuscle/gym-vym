// GymVym 3.0 — Toast
// Porta 1:1 de js/design-system/toast.js pras classes gv3 (overlays.css).
// Mesma API (showToast(html, {duration})), fila garante um por vez.

const queue = [];
let showing = false;

function renderNext(){
  if(showing || queue.length === 0) return;
  showing = true;

  const { html, duration } = queue.shift();
  const el = document.createElement('div');
  el.className = 'gv3-toast';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.innerHTML = html;
  document.body.appendChild(el);

  setTimeout(() => {
    if(reduced){
      el.remove();
      showing = false;
      renderNext();
      return;
    }
    el.classList.add('gv3-toast--out');
    setTimeout(() => {
      el.remove();
      showing = false;
      renderNext();
    }, 150);
  }, duration);
}

export function showToast(html, { duration = 2500 } = {}){
  queue.push({ html, duration });
  renderNext();
}
