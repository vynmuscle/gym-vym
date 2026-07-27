// GVModal — dialog genérico central, com variante compacta GVDialog
// para confirmações destrutivas.

export function openModal(content, { compact = false, onClose } = {}){
  const backdrop = document.createElement('div');
  backdrop.className = 'gv-modal-backdrop';

  const modal = document.createElement('div');
  modal.className = compact ? 'gv-modal gv-dialog' : 'gv-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  if(typeof content === 'string'){
    modal.innerHTML = content;
  } else if(content instanceof Node){
    modal.appendChild(content);
  }

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  function close(){
    backdrop.classList.remove('open');
    setTimeout(() => {
      backdrop.remove();
      document.removeEventListener('keydown', onKeydown);
      if(onClose) onClose();
    }, 200);
  }

  function onKeydown(e){
    if(e.key === 'Escape') close();
  }

  backdrop.addEventListener('click', (e) => {
    if(e.target === backdrop) close();
  });
  document.addEventListener('keydown', onKeydown);

  requestAnimationFrame(() => backdrop.classList.add('open'));

  return { close, modal };
}

export function confirmDialog({ title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', danger = false } = {}){
  return new Promise((resolve) => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <h3>${title ?? ''}</h3>
      <p class="gv-empty-state__desc">${message ?? ''}</p>
      <div class="gv-dialog__actions">
        <button type="button" class="gv-button gv-button--secondary" data-role="cancel">${cancelLabel}</button>
        <button type="button" class="gv-button ${danger ? 'gv-button--primary' : 'gv-button--primary'}" data-role="confirm">${confirmLabel}</button>
      </div>
    `;

    const { close } = openModal(wrapper, { compact: true, onClose: () => resolve(false) });

    wrapper.querySelector('[data-role="cancel"]').addEventListener('click', () => {
      resolve(false);
      close();
    });
    wrapper.querySelector('[data-role="confirm"]').addEventListener('click', () => {
      resolve(true);
      close();
    });
  });
}
