import { flushQueue } from './services/offlineQueue.js';

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  let hadController = !!navigator.serviceWorker.controller;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) showUpdateToast();
    hadController = true;
  });

  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

function showUpdateToast() {
  if (document.getElementById('updateToast')) return;

  const toast = document.createElement('div');
  toast.id = 'updateToast';
  toast.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);' +
    'background:var(--surface-2);border:1px solid var(--yellow);border-radius:10px;' +
    'padding:12px 16px;display:flex;gap:12px;align-items:center;z-index:1000;font-size:13px;' +
    'color:var(--text);box-shadow:0 4px 16px rgba(0,0,0,.4)';
  toast.innerHTML =
    '<span>Nova versão disponível</span>' +
    '<button type="button" id="btnUpdateReload" style="background:var(--yellow);color:var(--bg);' +
    'border:0;border-radius:6px;padding:8px 12px;font-weight:700;cursor:pointer;min-height:36px">Atualizar</button>';

  document.body.appendChild(toast);
  document.getElementById('btnUpdateReload').addEventListener('click', () => location.reload());
}

function createConnectionIndicator() {
  const dot = document.createElement('div');
  dot.id = 'connDot';
  dot.title = 'Sem conexão — séries serão sincronizadas';
  dot.style.cssText = 'position:fixed;top:10px;right:10px;width:10px;height:10px;border-radius:50%;' +
    'background:var(--yellow);z-index:999;box-shadow:0 0 0 3px rgba(0,0,0,.35);display:none';
  document.body.appendChild(dot);

  function update() {
    dot.style.display = navigator.onLine ? 'none' : 'block';
  }
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}

export function initPWA() {
  registerServiceWorker();
  createConnectionIndicator();
  flushQueue().catch(() => {});
  window.addEventListener('online', () => flushQueue().catch(() => {}));
}
