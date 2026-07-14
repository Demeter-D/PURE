let products = [];
let categories = [];

export async function loadProducts() {
  const res = await fetch('/api/products');
  if (!res.ok) throw new Error('Could not load products');
  const data = await res.json();
  products = Array.isArray(data.products) ? data.products : [];
  categories = Array.isArray(data.categories) ? data.categories : [];
  return products;
}

export function getProducts() {
  return products;
}

export function getCategories() {
  return categories;
}

export function getCategoryName(catId) {
  const cat = categories.find((c) => c.id === catId);
  return cat ? cat.name : '';
}

export function findProduct(id) {
  return products.find((p) => p.id === id);
}
