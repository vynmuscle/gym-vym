import { navigate } from './router.js';
import { getActiveSessionToday, getSuggestedWorkout } from './services/workoutService.js';

const NAV_ITEMS = [
  {
    key: 'dashboard', href: '/index.html', label: 'Início',
    icon: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>'
  },
  {
    key: 'evolution', href: '/pages/evolution.html', label: 'Evolução',
    icon: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-6"/><path d="M22 20H2"/>'
  },
  null, // slot central — botão Treinar
  {
    key: 'workouts', href: '/pages/workouts.html', label: 'Fichas',
    icon: '<path d="M6.5 6.5h11v11h-11z"/><path d="M3 9.5v5"/><path d="M21 9.5v5"/><path d="M6.5 12h11"/>'
  },
  {
    key: 'profile', href: '/pages/profile.html', label: 'Perfil',
    icon: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6"/>'
  }
];

export async function handleTrainClick(){
  try {
    const active = await getActiveSessionToday();
    if(active){
      navigate(`/pages/train.html?id=${active.workout_id}&session=${active.id}`);
      return;
    }

    const suggestion = await getSuggestedWorkout();
    if(suggestion){
      navigate('/pages/train.html?id=' + suggestion.workout.id);
      return;
    }
  } catch(err) {
    // offline ou erro de rede — cai no fallback abaixo
  }
  navigate('/pages/workouts.html');
}

export async function renderNav(active){
  document.body.classList.add('has-bottom-nav');

  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';

  nav.innerHTML = NAV_ITEMS.map(item => {
    if(item === null){
      return `
        <div>
          <button type="button" class="nav-train" id="btnNavTrain" aria-label="Iniciar treino">
            <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </button>
          <div class="nav-train-label">Treinar</div>
        </div>`;
    }
    return `
      <a href="${item.href}" class="nav-item${item.key === active ? ' active' : ''}">
        <svg viewBox="0 0 24 24">${item.icon}</svg>
        ${item.label}
        <div class="nav-dot"></div>
      </a>`;
  }).join('');

  document.body.appendChild(nav);

  document.getElementById('btnNavTrain').addEventListener('click', handleTrainClick);
}
