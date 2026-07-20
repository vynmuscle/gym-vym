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
  listFoodLogs,
  createFoodLog,
  deleteFoodLog,
  calculateDietTargets,
  MEAL_TYPE_LABELS,
} from './services/dietService.js';
import { searchFood } from './services/openFoodFactsService.js';

const { data: sd } = await supabase.auth.getSession();
if (!sd.session) navigate('../login.html');
const user = sd.session.user;
initPWA();

await renderNav('evolution');

function todayStr() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

// Elementos
const noWeightPanel = document.getElementById('noWeightPanel');
const profileForm = document.getElementById('profileForm');
const profileFormTitle = document.getElementById('profileFormTitle');
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
const caloriesTarget = document.getElementById('caloriesTarget');
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
const foodListPanel = document.getElementById('foodListPanel');

let currentProfile = null;
let currentTargets = null;

goalSelect.addEventListener('change', () => {
  goalRateGroup.style.display = goalSelect.value === 'maintain' ? 'none' : '';
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
    try {
      const products = await searchFood(query);
      renderSearchResults(products);
    } catch (err) {
      hideSearchResults();
      showSearchStatus('Busca indisponível agora — preencha manualmente abaixo.');
    }
  }, 400);
});

foodQuantityInput.addEventListener('input', recomputeFromProduct);

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
  summarySection.style.display = 'none';
}

btnEditProfile.addEventListener('click', showProfileForm);

btnCancelProfile.addEventListener('click', () => {
  profileForm.style.display = 'none';
  summarySection.style.display = '';
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

  caloriesTarget.textContent = `meta: ${currentTargets.targetCalories} kcal`;
}

function renderRing(consumedCalories) {
  const target = currentTargets?.targetCalories || 0;
  const pct = target > 0 ? Math.min(100, Math.round((consumedCalories / target) * 100)) : 0;
  const circumference = 245;
  ringProgress.style.strokeDashoffset = String(circumference - (circumference * pct) / 100);
  ringPct.textContent = `${pct}%`;
  caloriesConsumed.textContent = `${Math.round(consumedCalories)} kcal`;

  const remaining = Math.round(target - consumedCalories);
  caloriesRemaining.textContent = remaining >= 0
    ? `Faltam ${remaining} kcal`
    : `${Math.abs(remaining)} kcal acima da meta`;
  caloriesRemaining.style.color = remaining >= 0 ? 'var(--muted)' : 'var(--yellow)';
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

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderFoodList(items) {
  if (!items.length) {
    foodListPanel.innerHTML = '<div class="food-empty">Nenhum alimento registrado hoje ainda.</div>';
    return;
  }

  foodListPanel.innerHTML = items.map(item => `
    <div class="food-item" data-id="${item.id}">
      <div class="food-item-main">
        <div class="food-item-meal">${MEAL_TYPE_LABELS[item.meal_type] || item.meal_type}</div>
        <div class="food-item-name">${escapeHtml(item.name)}</div>
        <div class="food-item-macros">P: ${item.protein_g ?? 0}g · C: ${item.carbs_g ?? 0}g · G: ${item.fat_g ?? 0}g</div>
      </div>
      <div class="food-item-cal">${Math.round(item.calories)} kcal</div>
      <button type="button" class="btn-icon danger btn-delete-food" data-id="${item.id}" aria-label="Remover">✕</button>
    </div>
  `).join('');

  foodListPanel.querySelectorAll('.btn-delete-food').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!window.confirm('Remover este item?')) return;
      await deleteFoodLog(btn.dataset.id);
      await refreshFoodLog();
    });
  });
}

async function refreshFoodLog() {
  const items = await listFoodLogs(user.id, todayStr());

  const sums = items.reduce((acc, i) => {
    acc.calories += Number(i.calories) || 0;
    acc.protein += Number(i.protein_g) || 0;
    acc.carbs += Number(i.carbs_g) || 0;
    acc.fat += Number(i.fat_g) || 0;
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

  renderRing(sums.calories);
  renderMacros(sums);
  renderFoodList(items);
}

btnSaveFood.addEventListener('click', async () => {
  const name = foodNameInput.value.trim();
  const calories = parseFloat(foodCaloriesInput.value);

  if (!name || !calories) {
    foodMessage.className = 'message danger';
    foodMessage.textContent = 'Preencha o nome e as calorias.';
    return;
  }

  try {
    await createFoodLog(user.id, {
      logged_at: todayStr(),
      meal_type: mealTypeSelect.value,
      name,
      calories,
      protein_g: parseFloat(foodProteinInput.value) || null,
      carbs_g: parseFloat(foodCarbsInput.value) || null,
      fat_g: parseFloat(foodFatInput.value) || null,
    });

    foodNameInput.value = '';
    foodCaloriesInput.value = '';
    foodProteinInput.value = '';
    foodCarbsInput.value = '';
    foodFatInput.value = '';
    resetFoodSearch();
    foodMessage.className = 'message success';
    foodMessage.textContent = 'Adicionado!';
    showToast('Registrado ✓');

    await refreshFoodLog();
  } catch (err) {
    foodMessage.className = 'message danger';
    foodMessage.textContent = 'Erro ao salvar. Tente novamente.';
  }
});

async function refreshAll() {
  currentProfile = await getDietProfile(user.id);

  if (!currentProfile) {
    noWeightPanel.style.display = 'none';
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
    profileForm.style.display = 'none';
    summarySection.style.display = 'none';
    foodLogSection.style.display = '';
    noWeightPanel.style.display = '';
    await refreshFoodLog();
    return;
  }

  noWeightPanel.style.display = 'none';
  profileForm.style.display = 'none';
  summarySection.style.display = '';
  foodLogSection.style.display = '';

  renderSummary(latestWeight.weight_kg, latestHeight);
  await refreshFoodLog();
}

await refreshAll();
