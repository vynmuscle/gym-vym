import { supabase } from './supabaseClient.js';
import { navigate } from './router.js';
import { renderNav } from './navigation.js';
import { initPWA } from './pwa.js';
import { showToast } from './toast.js';
import {
  getDietProfile,
  upsertDietProfile,
  getLatestWeight,
  getLatestHeight,
  listFoodLogsRange,
  createFoodLog,
  updateFoodLog,
  deleteFoodLog,
  calculateDietTargets,
  calculateIMC,
  classifyIMC,
  MEAL_TYPE_LABELS,
  MEAL_TYPE_BUDGET_PCT,
  searchTacoFoods,
  searchHomeDishes,
} from './services/dietService.js';
import { searchFood } from './services/openFoodFactsService.js';

const { data: sd } = await supabase.auth.getSession();
if (!sd.session) navigate('../login.html');
const user = sd.session.user;
initPWA();

await renderNav('evolution');

const DAY_LABELS = ['do', 'se', 'te', 'qu', 'qu', 'se', 'sá'];
const MEAL_TYPES = ['cafe', 'almoco', 'jantar', 'lanche', 'outro'];

function toDateStr(d) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

function todayStr() {
  return toDateStr(new Date());
}

// Domingo a sábado da semana em que `dateStr` cai.
function getWeekDates(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const base = new Date(y, m - 1, d);
  const sunday = new Date(base);
  sunday.setDate(base.getDate() - base.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(sunday);
    day.setDate(sunday.getDate() + i);
    return toDateStr(day);
  });
}

// Elementos
const noWeightPanel = document.getElementById('noWeightPanel');
const noWeightMessage = document.getElementById('noWeightMessage');
const profileForm = document.getElementById('profileForm');
const profileFormTitle = document.getElementById('profileFormTitle');
const dietTabs = document.getElementById('dietTabs');
const summarySection = document.getElementById('summarySection');
const foodLogSection = document.getElementById('foodLogSection');

const birthDateInput = document.getElementById('birthDate');
const sexSelect = document.getElementById('sex');
const activityLevelSelect = document.getElementById('activityLevel');
const goalSelect = document.getElementById('goal');
const goalRateGroup = document.getElementById('goalRateGroup');
const goalRateInput = document.getElementById('goalRate');
const btnSaveProfile = document.getElementById('btnSaveProfile');
const btnCancelProfile = document.getElementById('btnCancelProfile');
const profileMessage = document.getElementById('profileMessage');
const btnEditProfile = document.getElementById('btnEditProfile');

const ringProgress = document.getElementById('ringProgress');
const ringPct = document.getElementById('ringPct');
const caloriesConsumed = document.getElementById('caloriesConsumed');
const caloriesTargetValue = document.getElementById('caloriesTargetValue');
const caloriesRemaining = document.getElementById('caloriesRemaining');
const proteinValue = document.getElementById('proteinValue');
const carbsValue = document.getElementById('carbsValue');
const fatValue = document.getElementById('fatValue');
const proteinBar = document.getElementById('proteinBar');
const carbsBar = document.getElementById('carbsBar');
const fatBar = document.getElementById('fatBar');
const bmrValue = document.getElementById('bmrValue');
const tdeeValue = document.getElementById('tdeeValue');
const rateValue = document.getElementById('rateValue');
const clampWarning = document.getElementById('clampWarning');
const imcValue = document.getElementById('imcValue');
const imcBadge = document.getElementById('imcBadge');
const chartCalories = document.getElementById('chartCalories');
const chartProtein = document.getElementById('chartProtein');
const chartCarbs = document.getElementById('chartCarbs');

const daysStrip = document.getElementById('daysStrip');
const mealCardsContainer = document.getElementById('mealCardsContainer');
const foodFormPanel = document.getElementById('foodFormPanel');
const foodFormTitle = document.getElementById('foodFormTitle');
const btnCloseFoodForm = document.getElementById('btnCloseFoodForm');
const mealTypeSelect = document.getElementById('mealType');
const foodSearchInput = document.getElementById('foodSearch');
const foodSearchResults = document.getElementById('foodSearchResults');
const foodSearchStatus = document.getElementById('foodSearchStatus');
const foodQuantityGroup = document.getElementById('foodQuantityGroup');
const foodQuantityInput = document.getElementById('foodQuantity');
const foodNameInput = document.getElementById('foodName');
const foodCaloriesInput = document.getElementById('foodCalories');
const foodProteinInput = document.getElementById('foodProtein');
const foodCarbsInput = document.getElementById('foodCarbs');
const foodFatInput = document.getElementById('foodFat');
const btnSaveFood = document.getElementById('btnSaveFood');
const foodMessage = document.getElementById('foodMessage');

let currentProfile = null;
let currentTargets = null;
let selectedDate = todayStr();
let weekLogs = [];
let activeTab = 'log';

goalSelect.addEventListener('change', () => {
  goalRateGroup.style.display = goalSelect.value === 'maintain' ? 'none' : '';
});

// --- Abas Refeições / Estatísticas ---
function applyTabVisibility() {
  summarySection.style.display = activeTab === 'stats' ? '' : 'none';
  foodLogSection.style.display = activeTab === 'log' ? '' : 'none';
}

dietTabs.querySelectorAll('.diet-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    activeTab = btn.dataset.tab;
    dietTabs.querySelectorAll('.diet-tab').forEach(b => b.classList.toggle('active', b === btn));
    applyTabVisibility();
  });
});

// --- Busca de alimentos (Open Food Facts) — atalho opcional; cadastro manual sempre funciona ---
let selectedProduct = null;
let searchDebounceTimer = null;

function hideSearchResults() {
  foodSearchResults.style.display = 'none';
  foodSearchResults.innerHTML = '';
}

function showSearchStatus(text) {
  foodSearchStatus.textContent = text;
  foodSearchStatus.style.display = text ? '' : 'none';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderSearchResults(products) {
  if (!products.length) {
    hideSearchResults();
    showSearchStatus('Nenhum resultado. Você pode preencher manualmente abaixo.');
    return;
  }

  showSearchStatus('');
  foodSearchResults.innerHTML = products.map((p, i) => `
    <button type="button" class="diet-search-result" data-index="${i}">
      <div class="diet-search-result-name">${escapeHtml(p.name)}</div>
      <div class="diet-search-result-kcal">${Math.round(p.kcal100)} kcal / 100g</div>
    </button>
  `).join('');
  foodSearchResults.style.display = '';

  foodSearchResults.querySelectorAll('.diet-search-result').forEach(btn => {
    btn.addEventListener('click', () => selectProduct(products[Number(btn.dataset.index)]));
  });
}

function recomputeFromProduct() {
  if (!selectedProduct) return;
  const grams = parseFloat(foodQuantityInput.value) || 0;
  const factor = grams / 100;
  foodCaloriesInput.value = Math.round(selectedProduct.kcal100 * factor);
  foodProteinInput.value = Math.round(selectedProduct.protein100 * factor);
  foodCarbsInput.value = Math.round(selectedProduct.carbs100 * factor);
  foodFatInput.value = Math.round(selectedProduct.fat100 * factor);
}

function selectProduct(product) {
  selectedProduct = product;
  foodNameInput.value = product.name;
  foodQuantityInput.value = 100;
  foodQuantityGroup.style.display = '';
  recomputeFromProduct();
  hideSearchResults();
  showSearchStatus('');
  foodSearchInput.value = '';
}

function resetFoodSearch() {
  selectedProduct = null;
  foodSearchInput.value = '';
  foodQuantityGroup.style.display = 'none';
  hideSearchResults();
  showSearchStatus('');
}

foodSearchInput.addEventListener('input', () => {
  clearTimeout(searchDebounceTimer);
  const query = foodSearchInput.value.trim();

  if (query.length < 3) {
    hideSearchResults();
    showSearchStatus('');
    return;
  }

  showSearchStatus('Buscando...');
  searchDebounceTimer = setTimeout(async () => {
    const [tacoResult, homeResult, offResult] = await Promise.allSettled([
      searchTacoFoods(query),
      searchHomeDishes(query),
      searchFood(query),
    ]);
    const tacoProducts = tacoResult.status === 'fulfilled' ? tacoResult.value : [];
    const homeProducts = homeResult.status === 'fulfilled' ? homeResult.value : [];
    const offProducts = offResult.status === 'fulfilled' ? offResult.value : [];
    const products = [...tacoProducts, ...homeProducts, ...offProducts];

    const allFailed = [tacoResult, homeResult, offResult].every(r => r.status === 'rejected');
    if (!products.length && allFailed) {
      hideSearchResults();
      showSearchStatus('Busca indisponível agora — preencha manualmente abaixo.');
      return;
    }
    renderSearchResults(products);
  }, 400);
});

foodQuantityInput.addEventListener('input', recomputeFromProduct);

// --- Perfil ---
function fillProfileForm(profile) {
  birthDateInput.value = profile?.birth_date || '';
  sexSelect.value = profile?.sex || 'F';
  activityLevelSelect.value = profile?.activity_level || 'sedentary';
  goalSelect.value = profile?.goal || 'lose';
  goalRateInput.value = profile?.goal_rate_kg_per_week ?? 0.5;
  goalRateGroup.style.display = goalSelect.value === 'maintain' ? 'none' : '';
}

function showProfileForm() {
  fillProfileForm(currentProfile);
  profileFormTitle.textContent = currentProfile ? 'Editar perfil' : 'Seu perfil';
  btnCancelProfile.style.display = currentProfile ? '' : 'none';
  profileForm.style.display = '';
  dietTabs.style.display = 'none';
  summarySection.style.display = 'none';
  foodLogSection.style.display = 'none';
}

btnEditProfile.addEventListener('click', showProfileForm);

btnCancelProfile.addEventListener('click', () => {
  profileForm.style.display = 'none';
  dietTabs.style.display = '';
  applyTabVisibility();
});

btnSaveProfile.addEventListener('click', async () => {
  const birthDate = birthDateInput.value;
  const goalRate = parseFloat(goalRateInput.value) || 0;

  if (!birthDate) {
    profileMessage.className = 'message danger';
    profileMessage.textContent = 'Preencha a data de nascimento.';
    return;
  }

  try {
    currentProfile = await upsertDietProfile(user.id, {
      birth_date: birthDate,
      sex: sexSelect.value,
      activity_level: activityLevelSelect.value,
      goal: goalSelect.value,
      goal_rate_kg_per_week: goalSelect.value === 'maintain' ? 0 : goalRate,
    });
    profileMessage.className = 'message success';
    profileMessage.textContent = 'Perfil salvo.';
    showToast('Perfil atualizado! 🎯');
    profileForm.style.display = 'none';
    await refreshAll();
  } catch (err) {
    profileMessage.className = 'message danger';
    profileMessage.textContent = 'Erro ao salvar. Tente novamente.';
  }
});

// --- Resumo (gauge, macros, TMB/TDEE, IMC) ---
function renderIMC(weightKg, heightCm) {
  const imc = calculateIMC(weightKg, heightCm);
  const info = classifyIMC(imc);
  imcValue.textContent = imc.toFixed(1);
  imcBadge.textContent = info.label;
  imcBadge.className = `imc-badge ${info.cls}`;
}

function renderSummary(weightKg, heightCm) {
  currentTargets = calculateDietTargets(currentProfile, weightKg, heightCm);

  bmrValue.textContent = `${currentTargets.bmr} kcal`;
  tdeeValue.textContent = `${currentTargets.tdee} kcal`;

  if (currentProfile.goal === 'maintain') {
    rateValue.textContent = 'Manutenção';
  } else {
    const kg = Math.abs(currentTargets.estimatedWeeklyChangeKg).toFixed(2);
    const verbo = currentProfile.goal === 'lose' ? 'Perda' : 'Ganho';
    rateValue.textContent = `${verbo} de ~${kg} kg/semana`;
  }

  clampWarning.style.display = currentTargets.wasClamped ? '' : 'none';
  caloriesTargetValue.textContent = currentTargets.targetCalories;

  renderIMC(weightKg, heightCm);
}

function renderRing(consumedCalories) {
  const target = currentTargets?.targetCalories || 0;
  const pct = target > 0 ? Math.min(100, Math.round((consumedCalories / target) * 100)) : 0;
  const circumference = 245;
  ringProgress.style.strokeDashoffset = String(circumference - (circumference * pct) / 100);
  ringPct.textContent = `${pct}%`;
  caloriesConsumed.textContent = Math.round(consumedCalories);

  const remaining = Math.round(target - consumedCalories);
  caloriesRemaining.textContent = remaining >= 0 ? remaining : `+${Math.abs(remaining)}`;
  caloriesRemaining.style.color = remaining >= 0 ? '' : 'var(--red)';
}

function renderMacros(sums) {
  const macros = currentTargets?.macros || { protein_g: 0, carbs_g: 0, fat_g: 0 };

  proteinValue.textContent = `${Math.round(sums.protein)} / ${macros.protein_g}g`;
  carbsValue.textContent = `${Math.round(sums.carbs)} / ${macros.carbs_g}g`;
  fatValue.textContent = `${Math.round(sums.fat)} / ${macros.fat_g}g`;

  proteinBar.style.width = `${macros.protein_g > 0 ? Math.min(100, (sums.protein / macros.protein_g) * 100) : 0}%`;
  carbsBar.style.width = `${macros.carbs_g > 0 ? Math.min(100, (sums.carbs / macros.carbs_g) * 100) : 0}%`;
  fatBar.style.width = `${macros.fat_g > 0 ? Math.min(100, (sums.fat / macros.fat_g) * 100) : 0}%`;
}

function sumItems(items) {
  return items.reduce((acc, i) => {
    acc.calories += Number(i.calories) || 0;
    acc.protein += Number(i.protein_g) || 0;
    acc.carbs += Number(i.carbs_g) || 0;
    acc.fat += Number(i.fat_g) || 0;
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

// --- Tira de dias da semana ---
function renderDayStrip() {
  const weekDates = getWeekDates(selectedDate);
  const today = todayStr();
  const loggedDates = new Set(weekLogs.map(i => i.logged_at));

  daysStrip.innerHTML = weekDates.map((dateStr, i) => {
    const day = Number(dateStr.split('-')[2]);
    const classes = ['diet-day-pill'];
    if (dateStr === selectedDate) classes.push('selected');
    if (dateStr === today) classes.push('is-today');
    if (loggedDates.has(dateStr)) classes.push('has-log');
    return `
      <button type="button" class="${classes.join(' ')}" data-date="${dateStr}">
        <span class="lbl">${DAY_LABELS[i]}</span>
        <span class="num">${day}</span>
        <span class="dot"></span>
      </button>
    `;
  }).join('');

  daysStrip.querySelectorAll('.diet-day-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedDate = btn.dataset.date;
      renderDayStrip();
      renderDayData();
    });
  });
}

// --- Cards por refeição ---
function renderFoodItemHtml(item) {
  return `
    <div class="food-item" data-id="${item.id}">
      <div class="food-item-main">
        <div class="food-item-name">${escapeHtml(item.name)}</div>
        <div class="food-item-macros">P: ${item.protein_g ?? 0}g · C: ${item.carbs_g ?? 0}g · G: ${item.fat_g ?? 0}g</div>
      </div>
      <div class="food-item-cal">${Math.round(item.calories)} kcal</div>
      <div class="list-item-actions">
        <button type="button" class="btn-icon btn-edit-food" data-id="${item.id}" aria-label="Editar">✎</button>
        <button type="button" class="btn-icon danger btn-delete-food" data-id="${item.id}" aria-label="Remover">✕</button>
      </div>
    </div>
  `;
}

function renderMealCards(dayItems) {
  mealCardsContainer.innerHTML = MEAL_TYPES.map(mt => {
    const items = dayItems.filter(i => i.meal_type === mt);
    const consumed = items.reduce((sum, i) => sum + (Number(i.calories) || 0), 0);
    const budget = currentTargets ? Math.round(currentTargets.targetCalories * MEAL_TYPE_BUDGET_PCT[mt]) : null;
    const pct = budget ? Math.min(100, Math.round((consumed / budget) * 100)) : 0;

    return `
      <div class="diet-meal-card">
        <div class="diet-meal-card-header">
          <div class="diet-meal-card-info">
            <div class="diet-meal-card-name">${MEAL_TYPE_LABELS[mt]}</div>
            <div class="diet-meal-card-cal">${Math.round(consumed)}${budget ? ` / ${budget}` : ''} kcal</div>
          </div>
          <button type="button" class="diet-meal-card-add" data-meal="${mt}" aria-label="Adicionar em ${MEAL_TYPE_LABELS[mt]}">+</button>
        </div>
        ${budget ? `<div class="diet-meal-card-bar"><i style="width:${pct}%"></i></div>` : ''}
        ${items.length ? `<div class="diet-meal-card-items">${items.map(renderFoodItemHtml).join('')}</div>` : ''}
      </div>
    `;
  }).join('');

  mealCardsContainer.querySelectorAll('.diet-meal-card-add').forEach(btn => {
    btn.addEventListener('click', () => openFoodForm(btn.dataset.meal));
  });

  mealCardsContainer.querySelectorAll('.btn-edit-food').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = weekLogs.find(i => i.id === btn.dataset.id);
      if (item) openFoodForm(item.meal_type, item);
    });
  });

  mealCardsContainer.querySelectorAll('.btn-delete-food').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!window.confirm('Remover este item?')) return;
      await deleteFoodLog(btn.dataset.id);
      await refreshDiet();
    });
  });
}

// --- Formulário de alimento (flutuante) — aberto pelo + de cada refeição (novo) ou pelo ✎ de um item (edição) ---
let editingFoodId = null;

function openFoodForm(mealType, editItem = null) {
  editingFoodId = editItem ? editItem.id : null;
  mealTypeSelect.value = editItem ? editItem.meal_type : mealType;

  if (editItem) {
    foodNameInput.value = editItem.name;
    foodCaloriesInput.value = editItem.calories;
    foodProteinInput.value = editItem.protein_g ?? '';
    foodCarbsInput.value = editItem.carbs_g ?? '';
    foodFatInput.value = editItem.fat_g ?? '';
    foodFormTitle.textContent = `Editar em ${MEAL_TYPE_LABELS[editItem.meal_type]}`;
    btnSaveFood.textContent = 'Salvar alteração';
  } else {
    foodFormTitle.textContent = `Adicionar a ${MEAL_TYPE_LABELS[mealType]}`;
    btnSaveFood.textContent = 'Adicionar';
  }

  foodFormPanel.style.display = '';
  foodFormPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  foodNameInput.focus();
}

function closeFoodForm() {
  editingFoodId = null;
  foodFormPanel.style.display = 'none';
  foodNameInput.value = '';
  foodCaloriesInput.value = '';
  foodProteinInput.value = '';
  foodCarbsInput.value = '';
  foodFatInput.value = '';
  foodMessage.textContent = '';
  resetFoodSearch();
}

btnCloseFoodForm.addEventListener('click', closeFoodForm);

btnSaveFood.addEventListener('click', async () => {
  const name = foodNameInput.value.trim();
  const calories = parseFloat(foodCaloriesInput.value);

  if (!name || !calories) {
    foodMessage.className = 'message danger';
    foodMessage.textContent = 'Preencha o nome e as calorias.';
    return;
  }

  const payload = {
    meal_type: mealTypeSelect.value,
    name,
    calories,
    protein_g: parseFloat(foodProteinInput.value) || null,
    carbs_g: parseFloat(foodCarbsInput.value) || null,
    fat_g: parseFloat(foodFatInput.value) || null,
  };

  try {
    if (editingFoodId) {
      await updateFoodLog(editingFoodId, payload);
      showToast('Alteração salva ✓');
    } else {
      await createFoodLog(user.id, { ...payload, logged_at: selectedDate });
      showToast('Registrado ✓');
    }

    closeFoodForm();
    await refreshDiet();
  } catch (err) {
    foodMessage.className = 'message danger';
    foodMessage.textContent = 'Erro ao salvar. Tente novamente.';
  }
});

// --- Gráficos semanais (barras simples, sem biblioteca) ---
function renderBarChart(container, weekDates, values, target) {
  const max = Math.max(target || 0, ...values, 1);
  const today = todayStr();

  container.innerHTML = weekDates.map((dateStr, i) => {
    const value = values[i];
    const heightPct = Math.min(100, Math.round((value / max) * 100));
    const classes = ['diet-bar'];
    if (dateStr === today) classes.push('today');
    if (target && value > target) classes.push('over');
    return `
      <div class="${classes.join(' ')}" title="${Math.round(value)}">
        <div class="diet-bar-fill" style="height:${heightPct}%"></div>
        <div class="diet-bar-day">${DAY_LABELS[i]}</div>
      </div>
    `;
  }).join('');
}

function renderWeeklyCharts(weekDates) {
  const perDay = weekDates.map(dateStr => sumItems(weekLogs.filter(i => i.logged_at === dateStr)));

  renderBarChart(chartCalories, weekDates, perDay.map(d => d.calories), currentTargets?.targetCalories);
  renderBarChart(chartProtein, weekDates, perDay.map(d => d.protein), currentTargets?.macros?.protein_g);
  renderBarChart(chartCarbs, weekDates, perDay.map(d => d.carbs), currentTargets?.macros?.carbs_g);
}

// --- Orquestração do dia/semana ---
function renderDayData() {
  const dayItems = weekLogs.filter(i => i.logged_at === selectedDate);
  const sums = sumItems(dayItems);
  renderRing(sums.calories);
  renderMacros(sums);
  renderMealCards(dayItems);
}

async function refreshDiet() {
  const weekDates = getWeekDates(selectedDate);
  weekLogs = await listFoodLogsRange(user.id, weekDates[0], weekDates[6]);
  renderDayStrip();
  renderWeeklyCharts(weekDates);
  renderDayData();
}

async function refreshAll() {
  currentProfile = await getDietProfile(user.id);

  if (!currentProfile) {
    noWeightPanel.style.display = 'none';
    dietTabs.style.display = 'none';
    foodLogSection.style.display = 'none';
    summarySection.style.display = 'none';
    showProfileForm();
    return;
  }

  const [latestWeight, latestHeight] = await Promise.all([
    getLatestWeight(user.id),
    getLatestHeight(user.id),
  ]);

  if (!latestWeight || !latestHeight) {
    const missing = !latestWeight && !latestHeight ? 'peso e altura' : !latestWeight ? 'peso' : 'altura';
    noWeightMessage.textContent = `Pra calcular sua meta calórica, falta registrar seu(a) ${missing} em Medidas.`;

    profileForm.style.display = 'none';
    dietTabs.style.display = 'none';
    summarySection.style.display = 'none';
    foodLogSection.style.display = '';
    noWeightPanel.style.display = '';
    await refreshDiet();
    return;
  }

  noWeightPanel.style.display = 'none';
  profileForm.style.display = 'none';
  dietTabs.style.display = '';
  applyTabVisibility();

  renderSummary(latestWeight.weight_kg, latestHeight);
  await refreshDiet();
}

await refreshAll();
