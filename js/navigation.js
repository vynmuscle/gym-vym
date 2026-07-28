import { navigate } from './router.js';
import { supabase } from './supabaseClient.js';
import { getActiveSessionToday, getSuggestedWorkout } from './services/workoutService.js';
import { icon } from './icons.js';

const NAV_ITEMS = [
  { key: 'dashboard', href: '/index.html', label: 'Início', icon: 'home' },
  { key: 'evolution', href: '/pages/evolution.html', label: 'Evolução', icon: 'evolution' },
  null, // slot central — botão Treinar
  { key: 'workouts', href: '/pages/workouts.html', label: 'Fichas', icon: 'workouts' },
  { key: 'profile', href: '/pages/profile.html', label: 'Perfil', icon: 'profile' }
];

export async function handleTrainClick(){
  try {
    const active = await getActiveSessionToday();
    if(active){
      navigate(`/pages/train.html?id=${active.workout_id}&session=${active.id}`);
      return;
    }

    const { data: sd } = await supabase.auth.getSession();
    const suggestion = await getSuggestedWorkout(sd.session?.user?.id);
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
  nav.className = 'gv3-nav';

  nav.innerHTML = NAV_ITEMS.map(item => {
    if(item === null){
      return `<button type="button" class="gv3-nav__fab" id="btnNavTrain" aria-label="Iniciar treino">${icon('dumbbell')}</button>`;
    }
    return `
      <a href="${item.href}" class="gv3-nav__item${item.key === active ? ' gv3-nav__item--active' : ''}">
        ${icon(item.icon)}
        <span>${item.label}</span>
      </a>`;
  }).join('');

  document.body.appendChild(nav);

  document.getElementById('btnNavTrain').addEventListener('click', handleTrainClick);
}
