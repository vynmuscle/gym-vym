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
const comparePairs = document.getElementById('comparePairs');
const btnAnalyzeCompare = document.getElementById('btnAnalyzeCompare');
const compareConclusion = document.getElementById('compareConclusion');
const compareConclusionText = document.getElementById('compareConclusionText');
const btnExportPdf = document.getElementById('btnExportPdf');

// Comparação sempre em pares por data (ex: 3 fotos de hoje x as mesmas 3
// poses de uma sessão anterior) -- 6 = o uso real (3+3), mas aceita
// qualquer par de grupos com a mesma quantidade (2, 4, 6...).
const MAX_COMPARE_SELECTION = 6;

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
  compareCount.textContent = `${selectedIds.length}/${MAX_COMPARE_SELECTION} selecionadas`;
  btnViewCompare.disabled = selectedIds.length < 2 || selectedIds.length % 2 !== 0;
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
    if(selectedIds.length >= MAX_COMPARE_SELECTION) selectedIds.shift();
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

let comparisonPairs = []; // [{ older, newer }] — pares em comparação, pra análise por IA
let lastConclusion = null; // texto da conclusão geral (null até gerar/se falhar) — usado na exportação em PDF

// Agrupa a seleção em pares "mais antiga x mais recente" por data, casando
// pela ordem dentro do dia (sort_order — a mesma ordem de sempre: frente,
// lado, costas etc.). Só funciona com exatamente 2 datas selecionadas e a
// mesma quantidade de fotos em cada uma; senão não dá pra parear sozinho.
function buildComparisonPairs(selected){
  const dates = [...new Set(selected.map(p => p.taken_at))].sort();
  if(dates.length !== 2) return null;

  const [olderDate, newerDate] = dates;
  const byOrder = (a, b) => a.sort_order - b.sort_order;
  const olderGroup = selected.filter(p => p.taken_at === olderDate).sort(byOrder);
  const newerGroup = selected.filter(p => p.taken_at === newerDate).sort(byOrder);
  if(olderGroup.length !== newerGroup.length) return null;

  return olderGroup.map((older, i) => ({ older, newer: newerGroup[i] }));
}

function analyzeLabel(n){
  return n > 1 ? `✨ Analisar ${n} comparações` : '✨ Análise por IA';
}

btnViewCompare.addEventListener('click', () => {
  const selected = selectedIds.map(id => photos.find(p => p.id === id));
  const pairs = buildComparisonPairs(selected);

  if(!pairs){
    showMessage('Selecione a mesma quantidade de fotos em exatamente 2 datas pra comparar (ex: 3 fotos de hoje + as mesmas 3 poses de uma sessão anterior).', 'warning');
    return;
  }

  comparisonPairs = pairs;

  comparePairs.innerHTML = pairs.map((pair, i) => {
    const days = Math.round((new Date(pair.newer.taken_at) - new Date(pair.older.taken_at)) / 86400000);
    return `
      <div class="compare-pair" data-pair-index="${i}">
        <div class="compare-row">
          <div>
            <img src="${signedUrls[pair.older.storage_path] || ''}" alt="Foto mais antiga">
            <div class="meta"><div class="date">${formatDateBR(pair.older.taken_at)}</div></div>
          </div>
          <div>
            <img src="${signedUrls[pair.newer.storage_path] || ''}" alt="Foto mais recente">
            <div class="meta"><div class="date">${formatDateBR(pair.newer.taken_at)}</div></div>
          </div>
        </div>
        <div class="compare-diff">${days} ${days === 1 ? 'dia' : 'dias'} de diferença</div>
        <div class="compare-analysis" style="display:none"></div>
      </div>`;
  }).join('');

  btnAnalyzeCompare.disabled = false;
  btnAnalyzeCompare.textContent = analyzeLabel(pairs.length);
  compareConclusion.style.display = 'none';
  compareConclusionText.textContent = '';
  lastConclusion = null;
  btnExportPdf.style.display = 'none';

  compareBar.style.display = 'none';
  compareViewer.classList.add('open');
});

btnCloseCompare.addEventListener('click', () => {
  compareViewer.classList.remove('open');
  if(compareMode) compareBar.style.display = 'flex';
});

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

// Processa os pares um de cada vez (não em paralelo) -- mais fácil de
// acompanhar na tela qual comparação está rodando, e evita estourar o
// limite diário de golpe só porque o usuário selecionou 6 fotos de uma vez.
btnAnalyzeCompare.addEventListener('click', async () => {
  if(comparisonPairs.length === 0) return;

  btnAnalyzeCompare.disabled = true;
  compareConclusion.style.display = 'none';
  compareConclusionText.textContent = '';
  lastConclusion = null;
  btnExportPdf.style.display = 'none';

  const succeededTexts = [];

  for(let i = 0; i < comparisonPairs.length; i++){
    const pair = comparisonPairs[i];
    const block = comparePairs.querySelector(`.compare-pair[data-pair-index="${i}"] .compare-analysis`);
    block.style.display = 'block';
    block.textContent = 'Analisando as fotos, isso pode levar alguns segundos...';
    btnAnalyzeCompare.textContent = comparisonPairs.length > 1
      ? `Analisando ${i + 1}/${comparisonPairs.length}...`
      : 'Analisando...';

    try {
      const [image1_base64, image2_base64] = await Promise.all([
        urlToBase64(signedUrls[pair.older.storage_path]),
        urlToBase64(signedUrls[pair.newer.storage_path])
      ]);

      const { data: sd } = await supabase.auth.getSession();
      const token = sd.session?.access_token;

      const res = await fetch('/api/ai-body-comparison', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ image1_base64, image2_base64 })
      });

      const data = await res.json();
      block.textContent = res.ok ? data.analysis : (data.error || 'Não consegui analisar essa comparação.');
      if(res.ok) succeededTexts.push(data.analysis);

      // Limite diário bateu no meio do lote -- para aqui, o resto fica sem
      // análise em vez de martelar o endpoint só pra repetir o mesmo erro.
      if(!res.ok && res.status === 429){
        break;
      }
    } catch(err){
      block.textContent = 'Erro de conexão. Tente de novo.';
    }
  }

  btnAnalyzeCompare.disabled = false;
  btnAnalyzeCompare.textContent = analyzeLabel(comparisonPairs.length);

  // Conclusão geral só faz sentido com pelo menos 1 análise de verdade --
  // com 1 só ela vira basicamente a mesma análise reformulada, mas ainda
  // assim cruza o texto em vez de simplesmente copiar.
  if(succeededTexts.length > 0){
    compareConclusion.style.display = 'block';
    compareConclusionText.textContent = 'Gerando conclusão geral...';

    try {
      const { data: sd } = await supabase.auth.getSession();
      const token = sd.session?.access_token;

      const res = await fetch('/api/ai-body-comparison', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ mode: 'summary', analyses: succeededTexts })
      });

      const data = await res.json();
      if(res.ok){
        lastConclusion = data.conclusion;
        compareConclusionText.textContent = data.conclusion;
      } else {
        compareConclusionText.textContent = data.error || 'Não consegui gerar a conclusão geral.';
      }
    } catch(err){
      compareConclusionText.textContent = 'Erro de conexão. Tente de novo.';
    }

    btnExportPdf.style.display = 'block';
  }
});

// Exporta em PDF o que já está na tela (fotos + análises + conclusão) --
// não depende de ter chamado a IA de novo, só lê o que os blocos mostram
// no momento do clique.
btnExportPdf.addEventListener('click', async () => {
  if(comparisonPairs.length === 0) return;

  btnExportPdf.disabled = true;
  btnExportPdf.textContent = 'Gerando PDF...';

  try {
    const { exportComparisonPdf } = await import('./utils/exportComparisonPdf.js');

    const pairsData = await Promise.all(comparisonPairs.map(async (pair, i) => {
      const block = comparePairs.querySelector(`.compare-pair[data-pair-index="${i}"]`);
      const analysisText = block.querySelector('.compare-analysis')?.textContent || '';
      const [olderImg, newerImg] = block.querySelectorAll('img');

      const [olderBase64, newerBase64] = await Promise.all([
        urlToBase64(signedUrls[pair.older.storage_path]),
        urlToBase64(signedUrls[pair.newer.storage_path])
      ]);

      return {
        olderBase64, newerBase64,
        olderRatio: olderImg.naturalHeight / olderImg.naturalWidth,
        newerRatio: newerImg.naturalHeight / newerImg.naturalWidth,
        olderLabel: formatDateBR(pair.older.taken_at),
        newerLabel: formatDateBR(pair.newer.taken_at),
        analysisText
      };
    }));

    await exportComparisonPdf({ pairs: pairsData, conclusion: lastConclusion });
  } catch(err){
    console.error('exportComparisonPdf falhou:', err);
    showMessage('Não consegui gerar o PDF. Tente de novo.', 'warning');
  } finally {
    btnExportPdf.disabled = false;
    btnExportPdf.textContent = '⬇️ Exportar PDF';
  }
});

async function reload(){
  photos = await listPhotos(user.id);
  signedUrls = await getSignedUrls(photos.map(p => p.storage_path));
  renderGrid();
}

await reload();
