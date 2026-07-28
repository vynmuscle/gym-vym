// GymVym 3.0 — Motion (JS)
// Sucessor de js/design-system/motion.js. `staggerIn` (custom-property por
// item + innerHTML) foi aposentado — reproduzia o bug conhecido de elementos
// travados invisíveis. Listas dinâmicas agora usam Web Animations API
// diretamente (staggerListWAAPI), aplicado depois do innerHTML já estar no DOM.

function prefersReducedMotion(){
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ---------- Stagger de listas dinâmicas (WAAPI, não CSS custom-property) ----------
// Chamar DEPOIS do innerHTML já ter inserido os elementos no DOM (querySelectorAll
// sobre o container, nunca durante a montagem da string).
export function staggerListWAAPI(elements, { step = 40, distance = 10 } = {}){
  const list = [...elements];
  if(prefersReducedMotion()){
    list.forEach(el => { el.style.opacity = '1'; el.style.transform = 'none'; });
    return;
  }
  list.forEach((el, i) => {
    el.animate([
      { opacity: 0, transform: `translateY(${distance}px)` },
      { opacity: 1, transform: 'translateY(0)' }
    ], {
      duration: 320,
      delay: i * step,
      easing: 'cubic-bezier(.34,1.56,.64,1)',
      fill: 'both'
    });
  });
}

// ---------- Transição de tela ----------
export function navigateWithTransition(updateFn){
  if(prefersReducedMotion() || typeof document.startViewTransition !== 'function'){
    updateFn();
    return;
  }
  document.startViewTransition(updateFn);
}

// ---------- Sucesso / erro ----------
export function playSuccess(el){
  if(prefersReducedMotion()) return;
  el.classList.remove('gv3-anim-success');
  void el.offsetWidth;
  el.classList.add('gv3-anim-success');
}

export function playError(el){
  if(prefersReducedMotion()) return;
  el.classList.remove('gv3-anim-error');
  void el.offsetWidth;
  el.classList.add('gv3-anim-error');
}

// ---------- Gráfico ----------
export function animateChartEl(el, className = 'gv3-anim-draw'){
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

// ---------- Linha de Ascensão (elemento de assinatura) ----------
// Dispara a animação de "desenho" do traço ascendente atrás de uma métrica
// no momento de um recorde pessoal / subida de nível.
export function drawAscent(el){
  if(!el) return;
  el.classList.remove('gv3-ascent--draw');
  void el.offsetWidth;
  el.classList.add('gv3-ascent--draw');
}

// ---------- Celebração (confetti em DOM, sem lib) ----------
const CONFETTI_COLORS = ['#FF5A36', '#3ED9C4', '#3FA958', '#F5F4F2'];

export function celebrate({ originX, originY, count = 24 } = {}){
  if(prefersReducedMotion()) return;

  const x = originX ?? window.innerWidth / 2;
  const y = originY ?? window.innerHeight / 3;

  for(let i = 0; i < count; i++){
    const piece = document.createElement('div');
    piece.className = 'gv3-confetti-piece';
    piece.style.cssText = 'position:fixed;width:6px;height:6px;border-radius:2px;pointer-events:none;z-index:1000;';
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

export function playAchievementChime(){
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if(!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + .15);
    gain.gain.setValueAtTime(.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .4);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + .4);
  } catch(e) {}
}

// ---------- Motion One (CDN, opcional) ----------
// Carregada sob demanda para spring/easing avançado (ex: anel de progresso,
// linha de ascensão em telas de destaque). Versão pinada para o service
// worker conseguir cachear de forma previsível (ver CACHE_FIRST_HOSTS em sw.js).
// Nunca é dependência obrigatória: se a rede falhar (offline no primeiro
// acesso a essa tela), a função resolve null e quem chamou usa o fallback WAAPI acima.
let motionOnePromise = null;
export function loadMotionOne(){
  if(!motionOnePromise){
    motionOnePromise = import('https://cdn.jsdelivr.net/npm/motion@11.11.13/+esm')
      .catch(() => null);
  }
  return motionOnePromise;
}
