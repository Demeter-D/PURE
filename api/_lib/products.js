// Server-side source of truth for product names/prices — never trust prices sent
// by the client. Reads the same shared/products.json the frontend uses for display,
// so the two can't drift out of sync.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const products = JSON.parse(
  readFileSync(join(__dirname, '..', '..', 'shared', 'products.json'), 'utf-8')
);

export default products;

export function findProduct(id) {
  return products.find((p) => p.id === id);
}
