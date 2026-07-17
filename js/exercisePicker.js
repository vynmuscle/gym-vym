import {
  listExercises, searchLibraryExercises, addExerciseFromLibrary, getLibraryGroupCounts
} from './services/workoutService.js';

const GROUPS = [
  { key: 'peito', label: 'Peito' },
  { key: 'costas', label: 'Costas' },
  { key: 'pernas', label: 'Pernas' },
  { key: 'gluteos', label: 'Glúteos' },
  { key: 'ombros', label: 'Ombros' },
  { key: 'biceps', label: 'Bíceps' },
  { key: 'triceps', label: 'Tríceps' },
  { key: 'abdomen', label: 'Abdômen' },
  { key: 'cardio', label: 'Cardio' }
];

const EQUIP_CHIPS = [
  { value: '', label: 'Todos' },
  { value: 'barra', label: 'Barra' },
  { value: 'halter', label: 'Halter' },
  { value: 'maquina', label: 'Máquina' },
  { value: 'polia', label: 'Polia' },
  { value: 'peso corporal', label: 'Peso corporal' }
];

const LIB_PAGE_SIZE = 24;

export function openExercisePicker({ userId, onPick, initialGroup }){
  const overlay = document.createElement('div');
  overlay.className = 'ex-picker';
  overlay.innerHTML = `
    <div class="ex-picker-header">
      <button type="button" class="btn-icon" id="epBack" style="display:none">‹</button>
      <span class="ex-picker-title" id="epTitle">Exercícios</span>
      <button type="button" class="btn-icon" id="epClose">✕</button>
    </div>
    <div class="ex-picker-search">
      <input type="text" id="epSearchInput" placeholder="Buscar exercício...">
    </div>
    <div class="ex-picker-body" id="epBody"></div>
    <div class="ex-picker-footer">
      <button type="button" class="btn btn-primary full" id="epDone">Concluído</button>
    </div>
  `;
  document.body.appendChild(overlay);

  const epBack = overlay.querySelector('#epBack');
  const epTitle = overlay.querySelector('#epTitle');
  const epClose = overlay.querySelector('#epClose');
  const epSearchInput = overlay.querySelector('#epSearchInput');
  const epBody = overlay.querySelector('#epBody');
  const epDone = overlay.querySelector('#epDone');

  let myExercises = [];
  let groupData = { counts: {}, images: {} };
  let currentGroup = null;
  let currentEquipment = '';
  let libOffset = 0;
  let libAccum = [];
  let searchDebounce = null;

  function close(){
    overlay.remove();
  }

  function showToast(text){
    const toast = document.createElement('div');
    toast.className = 'ex-toast';
    toast.textContent = text;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('visible'), 10);
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 250);
    }, 1600);
  }

  async function pick(libEx){
    try {
      let ex;
      if(libEx.__mine){
        ex = libEx;
      } else {
        ex = await addExerciseFromLibrary(userId, libEx);
        if(!myExercises.some(e => e.id === ex.id)) myExercises.push(ex);
      }
      showToast(`${ex.name} adicionado`);
      await onPick(ex);
    } catch(err) {
      showToast('Não foi possível adicionar. Tente de novo.');
    }
  }

  function renderGroupsView(){
    currentGroup = null;
    epBack.style.display = 'none';
    epTitle.textContent = 'Exercícios';

    epBody.innerHTML = `<div class="group-grid">${GROUPS.map(g => {
      const count = groupData.counts[g.key] || 0;
      const img = groupData.images[g.key];
      const bg = img
        ? `background-image:linear-gradient(to top, rgba(11,13,16,.88), rgba(11,13,16,.35)), url('${img}')`
        : '';
      return `
        <div class="group-card" data-group="${g.key}" style="${bg}">
          <div class="group-card-name">${g.label}</div>
          <div class="group-card-count">${count} exercício${count === 1 ? '' : 's'}</div>
        </div>`;
    }).join('')}</div>`;

    epBody.querySelectorAll('[data-group]').forEach(el => {
      el.addEventListener('click', () => openGroup(el.dataset.group));
    });
  }

  function renderEquipChips(){
    return `<div class="equip-chips">${EQUIP_CHIPS.map(c => `
      <button type="button" class="chip${c.value === currentEquipment ? ' active' : ''}" data-equip="${c.value}">${c.label}</button>
    `).join('')}</div>`;
  }

  function itemRowHtml(ex, isMine){
    const img = isMine ? ex.image_url : ex.image_urls?.[0];
    const name = isMine ? ex.name : (ex.name_pt || ex.name);
    return `
      <div class="picker-item" data-id="${ex.id}" data-mine="${isMine ? '1' : '0'}">
        <div class="picker-item-thumb">${img ? `<img src="${img}" alt="">` : '🏋️'}</div>
        <div class="picker-item-info">
          <span class="picker-item-name">${name}</span>
          <span class="picker-item-meta">${ex.equipment || ''}</span>
        </div>
      </div>`;
  }

  function bindItemClicks(root, mineList, libList){
    root.querySelectorAll('.picker-item').forEach(el => {
      el.addEventListener('click', async () => {
        const isMine = el.dataset.mine === '1';
        const source = isMine
          ? mineList.find(e => e.id === el.dataset.id)
          : libList.find(e => e.id === el.dataset.id);
        if(!source) return;
        await pick(isMine ? { ...source, __mine: true } : source);
      });
    });
  }

  async function openGroup(groupKey){
    currentGroup = groupKey;
    currentEquipment = '';
    libOffset = 0;
    libAccum = [];
    epBack.style.display = 'inline-flex';
    const label = GROUPS.find(g => g.key === groupKey)?.label || groupKey;
    epTitle.textContent = label;
    await renderGroupDetail();
  }

  async function renderGroupDetail(){
    const mine = myExercises.filter(e => e.muscle_group === currentGroup);
    const libPage = await searchLibraryExercises({
      muscleGroup: currentGroup,
      equipment: currentEquipment || undefined,
      offset: libOffset,
      limit: LIB_PAGE_SIZE
    });
    libAccum = libOffset === 0 ? libPage : libAccum.concat(libPage);

    epBody.innerHTML = `
      ${renderEquipChips()}
      ${mine.length ? `<div class="picker-section-title">Meus exercícios</div>${mine.map(e => itemRowHtml(e, true)).join('')}` : ''}
      <div class="picker-section-title">Biblioteca</div>
      ${libAccum.length === 0 ? '<p class="muted" style="padding:12px 0">Nenhum exercício encontrado.</p>' : libAccum.map(e => itemRowHtml(e, false)).join('')}
      ${libPage.length === LIB_PAGE_SIZE ? '<button type="button" class="btn btn-secondary full" id="epLoadMore">Carregar mais</button>' : ''}
    `;

    bindItemClicks(epBody, mine, libAccum);

    epBody.querySelectorAll('[data-equip]').forEach(btn => {
      btn.addEventListener('click', () => {
        currentEquipment = btn.dataset.equip;
        libOffset = 0;
        renderGroupDetail();
      });
    });

    const loadMoreBtn = epBody.querySelector('#epLoadMore');
    if(loadMoreBtn){
      loadMoreBtn.addEventListener('click', () => {
        libOffset += LIB_PAGE_SIZE;
        renderGroupDetail();
      });
    }
  }

  async function runGlobalSearch(query){
    epBack.style.display = 'inline-flex';
    epTitle.textContent = 'Resultados';

    const q = query.trim().toLowerCase();
    const mine = myExercises.filter(e => e.name.toLowerCase().includes(q));
    const lib = await searchLibraryExercises({ query, limit: 30 });

    epBody.innerHTML = `
      ${mine.length ? `<div class="picker-section-title">Meus exercícios</div>${mine.map(e => itemRowHtml(e, true)).join('')}` : ''}
      <div class="picker-section-title">Biblioteca</div>
      ${lib.length === 0 ? '<p class="muted" style="padding:12px 0">Nenhum exercício encontrado.</p>' : lib.map(e => itemRowHtml(e, false)).join('')}
    `;

    bindItemClicks(epBody, mine, lib);
  }

  epSearchInput.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    const value = epSearchInput.value;
    searchDebounce = setTimeout(() => {
      if(value.trim()){
        runGlobalSearch(value);
      } else {
        renderGroupsView();
      }
    }, 300);
  });

  epBack.addEventListener('click', () => {
    epSearchInput.value = '';
    renderGroupsView();
  });

  epClose.addEventListener('click', close);
  epDone.addEventListener('click', close);

  (async () => {
    [myExercises, groupData] = await Promise.all([listExercises(), getLibraryGroupCounts()]);
    if(initialGroup){
      await openGroup(initialGroup);
    } else {
      renderGroupsView();
    }
  })();
}
