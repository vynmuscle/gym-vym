import { renderNav } from './navigation.js';
import { initPWA } from './pwa.js';
import { requireSession } from './utils/authGuard.js';

await requireSession('../login.html');
initPWA();

await renderNav('evolution');
