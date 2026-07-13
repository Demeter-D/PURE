import products from '../shared/products.json';

export default products;

export function findProduct(id) {
  return products.find((p) => p.id === id);
}

export function categories() {
  return [...new Set(products.map((p) => p.cat))];
}
