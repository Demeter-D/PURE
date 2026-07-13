let products = [];

export async function loadProducts() {
  const res = await fetch('/api/products');
  if (!res.ok) throw new Error('Could not load products');
  products = await res.json();
  return products;
}

export function getProducts() {
  return products;
}

export function findProduct(id) {
  return products.find((p) => p.id === id);
}

export function categories() {
  return [...new Set(products.map((p) => p.cat))];
}
