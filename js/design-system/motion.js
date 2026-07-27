// GV Motion System — camada JS (Web Animations API, sem dependência
// externa). Cobre os padrões que precisam de orquestração via JS:
// stagger de listas, transição de página (View Transition API com
// fallback), celebração (confetti leve em DOM), sucesso e erro.

function prefersReducedMotion(){
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ---------- Card Motion (stagger) ----------
// Aplica .gv-anim-card com --gv-delay crescente por item — usado em
// listas de exercícios, histórico, conquistas etc.
export function staggerIn(elements, { step = 40 } = {}){
  if(prefersReducedMotion()) return;
  [...elements].forEach((el, i) => {
    el.style.setProperty('--gv-delay', `${i * step}ms`);
    el.classList.add('gv-anim-card');
  });
}

// ---------- Navigation Motion ----------
// Envolve uma troca de conteúdo com View Transition API quando
// disponível; cai para um fade simples via classe CSS quando não.
export function navigateWithTransition(updateFn){
  if(prefersReducedMotion() || typeof document.startViewTransition !== 'function'){
    updateFn();
    return;
  }
  document.startViewTransition(updateFn);
}

// ---------- Success Motion ----------
export function playSuccess(el){
  if(prefersReducedMotion()){ return; }
  el.classList.remove('gv-anim-success');
  void el.offsetWidth; // reinicia a animação se já tiver rodado
  el.classList.add('gv-anim-success');
}

// ---------- Error Motion ----------
export function playError(el){
  if(prefersReducedMotion()) return;
  el.classList.remove('gv-anim-error');
  void el.offsetWidth;
  el.classList.add('gv-anim-error');
}

// ---------- Chart Motion ----------
// Anima um <path>/<rect> de gráfico assim que entra na viewport.
export function animateChartEl(el, className = 'gv-anim-draw'){
  if(prefersReducedMotion()){ el.classList.add(className); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if(entry.isIntersecting){
        entry.target.classList.add(className);
        io.unobserve(entry.target);
      }
    });
  }, { threshold: .3 });
  io.observe(el);
}

// ---------- Celebration Motion ----------
// Confetti leve em DOM (sem canvas/lib externa) — usado ao desbloquear
// conquista, bater PR, subir de liga.
const CONFETTI_COLORS = ['#d9333f', '#e9b93b', '#3fa958', '#f2f3f5'];

export function celebrate({ originX, originY, count = 24 } = {}){
  if(prefersReducedMotion()) return;

  const x = originX ?? window.innerWidth / 2;
  const y = originY ?? window.innerHeight / 3;

  for(let i = 0; i < count; i++){
    const piece = document.createElement('div');
    piece.className = 'gv-confetti-piece';
    piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    piece.style.left = `${x}px`;
    piece.style.top = `${y}px`;
    document.body.appendChild(piece);

    const angle = (Math.PI * 2 * i) / count + Math.random() * .5;
    const distance = 80 + Math.random() * 120;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance - 60;
    const rotate = (Math.random() - .5) * 720;

    const anim = piece.animate([
      { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) rotate(${rotate}deg)`, opacity: 1, offset: .7 },
      { transform: `translate(${dx}px, ${dy + 140}px) rotate(${rotate}deg)`, opacity: 0 }
    ], {
      duration: 900 + Math.random() * 400,
      easing: 'cubic-bezier(.2,.6,.3,1)'
    });

    anim.onfinish = () => piece.remove();
  }
}
