// GVBottomSheet — substitui as 4 implementações de overlay cheio de
// tela (.rest-sheet, .photo-viewer, .summary-overlay, .ex-info-overlay).
// Uma instância por chamada; o chamador é dono do conteúdo (innerHTML/element).

export function openBottomSheet(content, { onClose } = {}){
  const backdrop = document.createElement('div');
  backdrop.className = 'gv-sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'gv-bottom-sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');

  const handle = document.createElement('div');
  handle.className = 'gv-bottom-sheet__handle';
  sheet.appendChild(handle);

  if(typeof content === 'string'){
    const body = document.createElement('div');
    body.innerHTML = content;
    sheet.appendChild(body);
  } else if(content instanceof Node){
    sheet.appendChild(content);
  }

  backdrop.appendChild(sheet);
  document.body.appendChild(backdrop);

  function close(){
    backdrop.classList.remove('open');
    setTimeout(() => {
      backdrop.remove();
      document.removeEventListener('keydown', onKeydown);
      if(onClose) onClose();
    }, 320);
  }

  function onKeydown(e){
    if(e.key === 'Escape') close();
  }

  backdrop.addEventListener('click', (e) => {
    if(e.target === backdrop) close();
  });
  document.addEventListener('keydown', onKeydown);

  requestAnimationFrame(() => backdrop.classList.add('open'));

  return { close, sheet };
}
