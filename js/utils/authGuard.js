import { supabase } from '../supabaseClient.js';
import { navigate } from '../router.js';

const SESSION_TIMEOUT_MS = 8000;

function timeoutAfter(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

function showOfflineScreen() {
  if (document.getElementById('gvOfflineScreen')) return;

  const el = document.createElement('div');
  el.id = 'gvOfflineScreen';
  el.style.cssText = 'position:fixed;inset:0;z-index:9999;background:var(--gv3-bg-root,#0A0A0C);' +
    'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;' +
    'padding:24px;text-align:center;color:var(--gv3-text-primary,#F5F4F2);font-family:inherit';
  el.innerHTML =
    '<div style="font-size:40px">📡</div>' +
    '<div style="font-size:17px;font-weight:600">Sem conexão com a internet</div>' +
    '<div style="font-size:14px;opacity:.7;max-width:280px">Não foi possível carregar seus dados. Verifique sua internet e tente novamente.</div>' +
    '<button type="button" id="gvOfflineRetry" style="margin-top:8px;min-height:52px;padding:0 24px;' +
    'border-radius:var(--gv3-radius-md,14px);border:0;background:var(--gv3-accent-ember,#FF5A36);' +
    'color:#fff;font-weight:700;font-size:15px;cursor:pointer">Tentar novamente</button>';

  document.body.appendChild(el);
  document.getElementById('gvOfflineRetry').addEventListener('click', () => location.reload());
}

// Busca a sessão com timeout; sem internet, mostra aviso claro em vez de
// deixar a página travada nos esqueletos de carregamento.
export async function requireSession(loginPath) {
  let sd;
  try {
    const result = await Promise.race([supabase.auth.getSession(), timeoutAfter(SESSION_TIMEOUT_MS)]);
    sd = result.data;
  } catch (err) {
    showOfflineScreen();
    throw err;
  }

  if (!sd.session) {
    navigate(loginPath);
    throw new Error('no-session');
  }

  return sd.session.user;
}
