import { supabase } from './supabaseClient.js';
import { renderNav } from './navigation.js';
import { initPWA } from './pwa.js';
import { requireSession } from './utils/authGuard.js';
import { listPhotos, uploadPhoto, createPhoto, deletePhoto, getSignedUrls, reorderPhotos } from './services/photosService.js';
import { checkAchievements } from './achievements.js';

const user = await requireSession('../login.html');
initPWA();

await renderNav('evolution');

const btnTakePhoto = document.getElementById('btnTakePhoto');
const btnGallery = document.getElementById('btnGallery');
const btnCompare = document.getElementById('btnCompare');
const fileInputCamera = document.getElementById('fileInputCamera');
const fileInputGallery = document.getElementById('fileInputGallery');
const reviewPanel = document.getElementById('reviewPanel');
const reviewImg = document.getElementById('reviewImg');
const photoDate = document.getElementById('photoDate');
const photoNotes = document.getElementById('photoNotes');
const btnSavePhoto = document.getElementById('btnSavePhoto');
const btnCancelPhoto = document.getElementById('btnCancelPhoto');
const mensagem = document.getElementById('mensagem');
const emptyState = document.getElementById('emptyState');
const photoGrid = document.getElementById('photoGrid');
const compareBar = document.getElementById('compareBar');
const compareCount = document.getElementById('compareCount');
const btnViewCompare = document.getElementById('btnViewCompare');
const photoViewer = document.getElementById('photoViewer');
const viewerImg = document.getElementById('viewerImg');
const viewerDate = document.getElementById('viewerDate');
const viewerNotes = document.getElementById('viewerNotes');
const btnCloseViewer = document.getElementById('btnCloseViewer');
const btnDeletePhoto = document.getElementById('btnDeletePhoto');
const btnViewerPrev = document.getElementById('btnViewerPrev');
const btnViewerNext = document.getElementById('btnViewerNext');
const compareViewer = document.getElementById('compareViewer');
const btnCloseCompare = document.getElementById('btnCloseCompare');
const compareImg1 = document.getElementById('compareImg1');
const compareImg2 = document.getElementById('compareImg2');
const compareDate1 = document.getElementById('compareDate1');
const compareDate2 = document.getElementById('compareDate2');
const compareDiff = document.getElementById('compareDiff');
const btnAnalyzeCompare = document.getElementById('btnAnalyzeCompare');
const compareAnalysis = document.getElementById('compareAnalysis');

let photos = [];
let signedUrls = {};
let pendingBlob = null;
let compareMode = false;
let selectedIds = [];
let viewingPhoto = null;

function showMessage(text, type = 'info'){
  mensagem.className = `message ${type}`;
  mensagem.innerText = text;
}

function todayStr(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateBR(dateStr){
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

async function compressImage(file){
  const bitmap = await createImageBitmap(file);
  const maxSide = 1280;
  let { width, height } = bitmap;

  if(width > height && width > maxSide){
    height = Math.round(height * maxSide / width);
    width = maxSide;
  } else if(height >= width && height > maxSide){
    width = Math.round(width * maxSide / height);
    height = maxSide;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);

  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
}

async function handleFileSelected(file){
  if(!file) return;

  let blob;
  try {
    blob = await compressImage(file);
  } catch(err) {
    showMessage('Esse formato de foto (ex: HEIC do iPhone) não é suportado aqui. Tire a foto no formato "Mais compatível" nas configurações da câmera do iPhone, ou escolha um JPEG/PNG já existente.', 'warning');
    return;
  }

  pendingBlob = blob;
  reviewImg.src = URL.createObjectURL(pendingBlob);
  photoDate.value = todayStr();
  photoNotes.value = '';
  showMessage('');
  reviewPanel.style.display = 'block';
  reviewPanel.scrollIntoView({ behavior: 'smooth' });
}

btnTakePhoto.addEventListener('click', () => fileInputCamera.click());
btnGallery.addEventListener('click', () => fileInputGallery.click());

fileInputCamera.addEventListener('change', async () => {
  const file = fileInputCamera.files[0];
  fileInputCamera.value = '';
  await handleFileSelected(file);
});

fileInputGallery.addEventListener('change', async () => {
  const file = fileInputGallery.files[0];
  fileInputGallery.value = '';
  await handleFileSelected(file);
});

btnCancelPhoto.addEventListener('click', () => {
  reviewPanel.style.display = 'none';
  pendingBlob = null;
});

btnSavePhoto.addEventListener('click', async () => {
  if(!pendingBlob) return;
  if(!photoDate.value){
    showMessage('Informe a data.', 'warning');
    return;
  }

  showMessage('Enviando...');
  const path = await uploadPhoto(user.id, pendingBlob);
  await createPhoto(user.id, {
    taken_at: photoDate.value,
    storage_path: path,
    notes: photoNotes.value.trim() || null
  });

  reviewPanel.style.display = 'none';
  pendingBlob = null;
  await reload();
  showMessage('Foto salva.', 'success');

  checkAchievements(user.id, {}).catch(err => console.error('checkAchievements falhou:', err));
});

function updateCompareBar(){
  compareCount.textContent = `${selectedIds.length}/2 selecionadas`;
  btnViewCompare.disabled = selectedIds.length !== 2;
}

btnCompare.addEventListener('click', () => {
  compareMode = !compareMode;
  selectedIds = [];
  btnCompare.textContent = compareMode ? 'Cancelar comparação' : 'Comparar';
  compareBar.style.display = compareMode ? 'flex' : 'none';
  updateCompareBar();
  renderGrid();
});

function toggleSelect(photo){
  if(selectedIds.includes(photo.id)){
    selectedIds = selectedIds.filter(id => id !== photo.id);
  } else {
    if(selectedIds.length >= 2) selectedIds.shift();
    selectedIds.push(photo.id);
  }
  updateCompareBar();
  renderGrid();
}

function openViewer(photo){
  viewingPhoto = photo;
  const idx = photos.findIndex(p => p.id === photo.id);
  viewerImg.src = signedUrls[photo.storage_path] || '';
  viewerDate.textContent = formatDateBR(photo.taken_at);
  viewerNotes.textContent = photo.notes || '';
  btnViewerPrev.disabled = idx <= 0;
  btnViewerNext.disabled = idx === -1 || idx >= photos.length - 1;
  photoViewer.classList.add('open');
}

function stepViewer(delta){
  if(!viewingPhoto) return;
  const idx = photos.findIndex(p => p.id === viewingPhoto.id);
  const next = photos[idx + delta];
  if(next) openViewer(next);
}

// Reordena (drag) só entre fotos do MESMO dia — grupo é sempre contíguo em
// `photos` porque a ordenação é (taken_at desc, sort_order asc).
async function reorderWithinDate(draggedPhoto, targetPhoto){
  const group = photos.filter(p => p.taken_at === draggedPhoto.taken_at);
  const fromIdx = group.findIndex(p => p.id === draggedPhoto.id);
  const toIdx = group.findIndex(p => p.id === targetPhoto.id);
  if(fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;

  group.splice(toIdx, 0, group.splice(fromIdx, 1)[0]);
  const updates = group.map((p, i) => ({ id: p.id, sortOrder: i }));
  updates.forEach(u => { group.find(p => p.id === u.id).sort_order = u.sortOrder; });

  photos.sort((a, b) => {
    if(a.taken_at !== b.taken_at) return a.taken_at < b.taken_at ? 1 : -1;
    return a.sort_order - b.sort_order;
  });

  renderGrid();
  await reorderPhotos(updates).catch(err => console.error('reorderPhotos falhou:', err));
}

function attachDrag(el, photo){
  el.addEventListener('contextmenu', (e) => e.preventDefault());

  el.addEventListener('pointerdown', (e) => {
    if(compareMode || e.button === 2) return;

    let dragging = false;
    const startX = e.clientX, startY = e.clientY;
    const longPressTimer = setTimeout(() => {
      dragging = true;
      el.classList.add('dragging');
      el.setPointerCapture(e.pointerId);
    }, 300);

    function clearDropTargets(){
      photoGrid.querySelectorAll('.drop-target').forEach(t => t.classList.remove('drop-target'));
    }

    function onMove(ev){
      if(!dragging){
        if(Math.abs(ev.clientX - startX) > 10 || Math.abs(ev.clientY - startY) > 10) clearTimeout(longPressTimer);
        return;
      }
      if(ev.cancelable) ev.preventDefault();
      const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.photo-thumb');
      clearDropTargets();
      if(target && target !== el){
        const targetPhoto = photos.find(p => p.id === target.dataset.id);
        if(targetPhoto && targetPhoto.taken_at === photo.taken_at) target.classList.add('drop-target');
      }
    }

    function onUp(ev){
      clearTimeout(longPressTimer);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      // Libera a captura ANTES de reorderWithinDate() disparar renderGrid()
      // (que reescreve o innerHTML) — sem isso, no iOS Safari o ponteiro
      // fica "preso" a um elemento removido e o scroll para de responder.
      if(el.hasPointerCapture?.(ev.pointerId)) el.releasePointerCapture(ev.pointerId);
      if(!dragging) return;
      el.classList.remove('dragging');
      clearDropTargets();
      const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.photo-thumb');
      if(target && target !== el){
        const targetPhoto = photos.find(p => p.id === target.dataset.id);
        if(targetPhoto && targetPhoto.taken_at === photo.taken_at) reorderWithinDate(photo, targetPhoto);
      }
    }

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
  });
}

function renderGrid(){
  if(photos.length === 0){
    emptyState.style.display = 'block';
    photoGrid.innerHTML = '';
    return;
  }
  emptyState.style.display = 'none';

  photoGrid.innerHTML = photos.map(p => `
    <div class="photo-thumb${selectedIds.includes(p.id) ? ' selected' : ''}" data-id="${p.id}">
      <img src="${signedUrls[p.storage_path] || ''}" alt="Foto de ${formatDateBR(p.taken_at)}" loading="lazy" draggable="false">
      <div class="date">${formatDateBR(p.taken_at)}</div>
    </div>
  `).join('');

  photoGrid.querySelectorAll('.photo-thumb').forEach(el => {
    const photo = photos.find(p => p.id === el.dataset.id);
    el.addEventListener('click', () => {
      if(compareMode) toggleSelect(photo);
      else openViewer(photo);
    });
    attachDrag(el, photo);
  });
}

btnCloseViewer.addEventListener('click', () => photoViewer.classList.remove('open'));
btnViewerPrev.addEventListener('click', () => stepViewer(-1));
btnViewerNext.addEventListener('click', () => stepViewer(1));

let viewerSwipeStart = null;
viewerImg.addEventListener('pointerdown', (e) => { viewerSwipeStart = { x: e.clientX, y: e.clientY }; });
viewerImg.addEventListener('pointerup', (e) => {
  if(!viewerSwipeStart) return;
  const dx = e.clientX - viewerSwipeStart.x;
  const dy = e.clientY - viewerSwipeStart.y;
  viewerSwipeStart = null;
  if(Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) stepViewer(dx < 0 ? 1 : -1);
});

btnDeletePhoto.addEventListener('click', async () => {
  if(!viewingPhoto) return;
  if(!confirm('Excluir esta foto?')) return;
  await deletePhoto(viewingPhoto.id, viewingPhoto.storage_path);
  photoViewer.classList.remove('open');
  await reload();
});

let comparePair = null; // { older, newer } — fotos em comparação, pra análise por IA

btnViewCompare.addEventListener('click', () => {
  if(selectedIds.length !== 2) return;
  const [a, b] = selectedIds.map(id => photos.find(p => p.id === id));
  const [older, newer] = new Date(a.taken_at) <= new Date(b.taken_at) ? [a, b] : [b, a];
  comparePair = { older, newer };

  compareImg1.src = signedUrls[older.storage_path] || '';
  compareImg2.src = signedUrls[newer.storage_path] || '';
  compareDate1.textContent = formatDateBR(older.taken_at);
  compareDate2.textContent = formatDateBR(newer.taken_at);

  const days = Math.round((new Date(newer.taken_at) - new Date(older.taken_at)) / 86400000);
  compareDiff.textContent = `${days} ${days === 1 ? 'dia' : 'dias'} de diferença`;

  compareAnalysis.style.display = 'none';
  compareAnalysis.textContent = '';
  btnAnalyzeCompare.disabled = false;
  btnAnalyzeCompare.textContent = '✨ Análise por IA';

  compareViewer.classList.add('open');
});

btnCloseCompare.addEventListener('click', () => compareViewer.classList.remove('open'));

async function urlToBase64(url){
  const blob = await (await fetch(url)).blob();
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  return dataUrl.split(',')[1];
}

btnAnalyzeCompare.addEventListener('click', async () => {
  if(!comparePair) return;

  btnAnalyzeCompare.disabled = true;
  btnAnalyzeCompare.textContent = 'Analisando...';
  compareAnalysis.style.display = 'block';
  compareAnalysis.textContent = 'Analisando as fotos, isso pode levar alguns segundos...';

  try {
    const [image1_base64, image2_base64] = await Promise.all([
      urlToBase64(compareImg1.src),
      urlToBase64(compareImg2.src)
    ]);

    const { data: sd } = await supabase.auth.getSession();
    const token = sd.session?.access_token;

    const res = await fetch('/api/ai-body-comparison', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        image1_base64, image2_base64,
        date1: formatDateBR(comparePair.older.taken_at),
        date2: formatDateBR(comparePair.newer.taken_at)
      })
    });

    const data = await res.json();

    if(!res.ok){
      compareAnalysis.textContent = data.error || 'Não consegui analisar as fotos agora.';
      return;
    }

    compareAnalysis.textContent = data.analysis;
  } catch(err){
    compareAnalysis.textContent = 'Erro de conexão. Tente de novo.';
  } finally {
    btnAnalyzeCompare.disabled = false;
    btnAnalyzeCompare.textContent = '✨ Análise por IA';
  }
});

async function reload(){
  photos = await listPhotos(user.id);
  signedUrls = await getSignedUrls(photos.map(p => p.storage_path));
  renderGrid();
}

await reload();
