import { supabase } from './supabaseClient.js';
import { navigate } from './router.js';
import { renderNav } from './navigation.js';
import { initPWA } from './pwa.js';
import { listPhotos, uploadPhoto, createPhoto, deletePhoto, getSignedUrls } from './services/photosService.js';

const { data: sd } = await supabase.auth.getSession();
if(!sd.session) navigate('../login.html');
const user = sd.session.user;
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
const compareViewer = document.getElementById('compareViewer');
const btnCloseCompare = document.getElementById('btnCloseCompare');
const compareImg1 = document.getElementById('compareImg1');
const compareImg2 = document.getElementById('compareImg2');
const compareDate1 = document.getElementById('compareDate1');
const compareDate2 = document.getElementById('compareDate2');
const compareDiff = document.getElementById('compareDiff');

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
  viewerImg.src = signedUrls[photo.storage_path] || '';
  viewerDate.textContent = formatDateBR(photo.taken_at);
  viewerNotes.textContent = photo.notes || '';
  photoViewer.classList.add('open');
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
      <img src="${signedUrls[p.storage_path] || ''}" alt="Foto de ${formatDateBR(p.taken_at)}">
      <div class="date">${formatDateBR(p.taken_at)}</div>
    </div>
  `).join('');

  photoGrid.querySelectorAll('.photo-thumb').forEach(el => {
    el.addEventListener('click', () => {
      const photo = photos.find(p => p.id === el.dataset.id);
      if(compareMode) toggleSelect(photo);
      else openViewer(photo);
    });
  });
}

btnCloseViewer.addEventListener('click', () => photoViewer.classList.remove('open'));

btnDeletePhoto.addEventListener('click', async () => {
  if(!viewingPhoto) return;
  if(!confirm('Excluir esta foto?')) return;
  await deletePhoto(viewingPhoto.id, viewingPhoto.storage_path);
  photoViewer.classList.remove('open');
  await reload();
});

btnViewCompare.addEventListener('click', () => {
  if(selectedIds.length !== 2) return;
  const [a, b] = selectedIds.map(id => photos.find(p => p.id === id));
  const [older, newer] = new Date(a.taken_at) <= new Date(b.taken_at) ? [a, b] : [b, a];

  compareImg1.src = signedUrls[older.storage_path] || '';
  compareImg2.src = signedUrls[newer.storage_path] || '';
  compareDate1.textContent = formatDateBR(older.taken_at);
  compareDate2.textContent = formatDateBR(newer.taken_at);

  const days = Math.round((new Date(newer.taken_at) - new Date(older.taken_at)) / 86400000);
  compareDiff.textContent = `${days} ${days === 1 ? 'dia' : 'dias'} de diferença`;

  compareViewer.classList.add('open');
});

btnCloseCompare.addEventListener('click', () => compareViewer.classList.remove('open'));

async function reload(){
  photos = await listPhotos(user.id);
  signedUrls = await getSignedUrls(photos.map(p => p.storage_path));
  renderGrid();
}

await reload();
