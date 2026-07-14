// Product catalog persistence. Reads/writes a Vercel Edge Config store (small,
// read-heavy, infrequently-written key-value config — a good fit for a product
// list edited occasionally from the admin page). Falls back to the bundled
// shared/products.json when Edge Config isn't set up yet (e.g. local dev),
// so the app still works out of the box before the admin page is wired up.
//
// Categories are a first-class list (stable id + editable name) so renaming
// one is a single edit instead of touching every product — products
// reference a category by catId, never by its display name.

import { get } from '@vercel/edge-config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function slugify(name, existingIds) {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'category';
  let id = base;
  let i = 2;
  while (existingIds.has(id)) {
    id = `${base}-${i}`;
    i += 1;
  }
  return id;
}

// Accepts either the current shape ({ categories, products }) or the legacy
// shape (a bare array of products with a free-text `cat` string), and always
// returns the current shape — so old data already sitting in Edge Config
// upgrades itself in place on next read, no manual migration step needed.
function normalizeCatalog(raw) {
  if (Array.isArray(raw)) {
    const seenIds = new Set();
    const categories = [];
    const catIdByName = new Map();
    for (const p of raw) {
      const name = p.cat || 'UNCATEGORISED';
      if (!catIdByName.has(name)) {
        const id = slugify(name, seenIds);
        seenIds.add(id);
        catIdByName.set(name, id);
        categories.push({ id, name });
      }
    }
    const products = raw.map(({ cat, ...rest }) => ({ ...rest, catId: catIdByName.get(cat || 'UNCATEGORISED') }));
    return { categories, products };
  }
  return {
    categories: Array.isArray(raw?.categories) ? raw.categories : [],
    products: Array.isArray(raw?.products) ? raw.products : [],
  };
}

function loadFallback() {
  const raw = JSON.parse(
    readFileSync(join(__dirname, '..', '..', 'shared', 'products.json'), 'utf-8')
  );
  return normalizeCatalog(raw);
}

export async function getCatalog() {
  if (!process.env.EDGE_CONFIG) return loadFallback();
  try {
    const raw = await get('products');
    const normalized = normalizeCatalog(raw);
    if (normalized.products.length > 0) return normalized;
  } catch (err) {
    console.error('Edge Config read failed, falling back to shared/products.json', err);
  }
  return loadFallback();
}

// Convenience for callers (e.g. checkout) that only need product price/name
// lookups and don't care about category structure.
export async function getProducts() {
  return (await getCatalog()).products;
}

export async function saveCatalog({ categories, products }) {
  const { EDGE_CONFIG_ID, VERCEL_API_TOKEN, VERCEL_TEAM_ID } = process.env;
  if (!EDGE_CONFIG_ID || !VERCEL_API_TOKEN) {
    throw new Error(
      'Edge Config write is not configured (missing EDGE_CONFIG_ID or VERCEL_API_TOKEN env vars)'
    );
  }

  const url = new URL(`https://api.vercel.com/v1/edge-config/${EDGE_CONFIG_ID}/items`);
  if (VERCEL_TEAM_ID) url.searchParams.set('teamId', VERCEL_TEAM_ID);

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${VERCEL_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ items: [{ operation: 'upsert', key: 'products', value: { categories, products } }] }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Edge Config write failed (${res.status}): ${text}`);
  }
}

export { slugify };
