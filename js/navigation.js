const NAV_ITEMS = [
  { href: '/index.html', label: 'Início', key: 'dashboard' },
  { href: '/pages/exercises.html', label: 'Exercícios', key: 'exercises' },
  { href: '/pages/workouts.html', label: 'Fichas', key: 'workouts' },
  { href: '/pages/history.html', label: 'Histórico', key: 'history' },
];

export function renderNav(active) {
  const nav = document.createElement('nav');
  nav.className = 'app-nav';
  nav.innerHTML = NAV_ITEMS.map(item =>
    `<a href="${item.href}" class="app-nav-link${item.key === active ? ' active' : ''}">${item.label}</a>`
  ).join('');
  document.body.prepend(nav);
}
