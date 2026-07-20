// Busca de alimentos na base aberta e gratuita Open Food Facts.
// Usada só como atalho pra preencher calorias/macros — cadastro manual continua
// sempre disponível caso a busca não ache o alimento ou fique indisponível.

const SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl';
const PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product';

export async function searchFood(query) {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '8',
    fields: 'product_name,brands,nutriments',
  });

  const response = await fetch(`${SEARCH_URL}?${params.toString()}`);
  if (!response.ok) throw new Error('Busca indisponível');

  const data = await response.json();

  return (data.products || [])
    .filter(p => p.product_name && p.nutriments && p.nutriments['energy-kcal_100g'] != null)
    .map(p => ({
      name: p.brands ? `${p.product_name} (${p.brands.split(',')[0].trim()})` : p.product_name,
      kcal100: Number(p.nutriments['energy-kcal_100g']) || 0,
      protein100: Number(p.nutriments['proteins_100g']) || 0,
      carbs100: Number(p.nutriments['carbohydrates_100g']) || 0,
      fat100: Number(p.nutriments['fat_100g']) || 0,
    }));
}

// Busca um produto específico pelo código de barras (mais preciso que busca por nome).
// Retorna null se o código não estiver cadastrado na base.
export async function searchFoodByBarcode(barcode) {
  const params = new URLSearchParams({ fields: 'product_name,brands,nutriments' });
  const response = await fetch(`${PRODUCT_URL}/${encodeURIComponent(barcode)}.json?${params.toString()}`);
  if (!response.ok) throw new Error('Busca indisponível');

  const data = await response.json();
  const p = data.product;
  if (data.status !== 1 || !p || !p.product_name || !p.nutriments || p.nutriments['energy-kcal_100g'] == null) {
    return null;
  }

  return {
    name: p.brands ? `${p.product_name} (${p.brands.split(',')[0].trim()})` : p.product_name,
    kcal100: Number(p.nutriments['energy-kcal_100g']) || 0,
    protein100: Number(p.nutriments['proteins_100g']) || 0,
    carbs100: Number(p.nutriments['carbohydrates_100g']) || 0,
    fat100: Number(p.nutriments['fat_100g']) || 0,
  };
}
