// GymVym 3.0 — Sistema de ícones
// Substitui os SVGs duplicados por arquivo e o uso de emoji como ícone.
// Sem lib externa/CDN (offline-first) — paths próprios, stroke 24x24 consistente.

const ICONS = {
  home: '<path d="M4 11.5 12 4l8 7.5" /><path d="M6 10v9h12v-9" /><path d="M10 19v-5h4v5" />',
  dumbbell: '<path d="M6 8v8" /><path d="M4 9v6" /><path d="M18 8v8" /><path d="M20 9v6" /><path d="M6 12h12" />',
  evolution: '<path d="M4 18V9" /><path d="M10 18V5" /><path d="M16 18v-7" /><path d="M20 18V3" />',
  workouts: '<path d="M5 6h14" /><path d="M5 12h14" /><path d="M5 18h14" />',
  profile: '<circle cx="12" cy="8" r="3.4" /><path d="M5 20c1.6-4 4.2-6 7-6s5.4 2 7 6" />',
  plus: '<path d="M12 5v14" /><path d="M5 12h14" />',
  close: '<path d="M6 6l12 12" /><path d="M18 6L6 18" />',
  check: '<path d="M5 12.5l4.5 4.5L19 7" />',
  chevronRight: '<path d="M9 6l6 6-6 6" />',
  chevronLeft: '<path d="M15 6l-6 6 6 6" />',
  chevronDown: '<path d="M6 9l6 6 6-6" />',
  edit: '<path d="M4 20h4L18.5 9.5a2 2 0 0 0-4-4L4 15z" />',
  trash: '<path d="M5 7h14" /><path d="M9 7V5h6v2" /><path d="M7 7l1 13h8l1-13" />',
  camera: '<path d="M4 8h3l1.5-2h7L17 8h3v11H4z" /><circle cx="12" cy="13.5" r="3.2" />',
  calendar: '<rect x="4" y="6" width="16" height="14" rx="2" /><path d="M4 10h16" /><path d="M8 4v4" /><path d="M16 4v4" />',
  flame: '<path d="M12 3s5 4.2 5 9a5 5 0 0 1-10 0c0-1.6.8-2.6 1.6-3.6.3 1.2 1 1.6 1.6 1.2C9.4 7.8 9.8 5 12 3z" />',
  trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0V4z" /><path d="M5 5H3v2a4 4 0 0 0 4 4" /><path d="M19 5h2v2a4 4 0 0 1-4 4" /><path d="M10 18h4" /><path d="M12 14v4" /><path d="M8 20h8" />',
  search: '<circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.3-4.3" />',
  clock: '<circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" />',
  photo: '<rect x="3.5" y="4.5" width="17" height="15" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="M4 17l5-5 3.5 3.5L16 12l4 5" />',
  scale: '<circle cx="12" cy="13" r="7" /><path d="M12 13l3-3" /><path d="M9.5 6.5h5" />',
  food: '<path d="M6 3v8a3 3 0 0 0 6 0V3" /><path d="M9 11v10" /><path d="M17 3c-2 0-3 2-3 5s1 4 3 4" /><path d="M17 12v9" />',
  sparkle: '<path d="M12 3l1.6 4.8L18 9.4l-4.4 1.6L12 16l-1.6-5L6 9.4l4.4-1.6z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />',
  footprints: '<path d="M8.5 4.5c1.6 0 2.6 1.3 2.6 3.1 0 1.6-.6 2.4-1.3 3.1-.9.9-1.3 1.8-1.3 3.5v4.3" /><path d="M15.5 9c1.6 0 2.6 1.3 2.6 3.1 0 1.6-.6 2.4-1.3 3.1-.9.9-1.3 1.8-1.3 3.5v.3" />',
};

export function icon(name, opts = {}) {
  const { size = 24, strokeWidth = 1.8, className = '' } = opts;
  const paths = ICONS[name];
  if (!paths) return '';
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" class="${className}">${paths}</svg>`;
}

export default icon;
