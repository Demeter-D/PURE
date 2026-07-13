// Product catalog persistence. Reads/writes a Vercel Edge Config store (small,
// read-heavy, infrequently-written key-value config — a good fit for a product
// list edited occasionally from the admin page). Falls back to the bundled
// shared/products.json when Edge Config isn't set up yet (e.g. local dev),
// so the app still works out of the box before the admin page is wired up.

import { get } from '@vercel/edge-config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadFallback() {
  return JSON.parse(
    readFileSync(join(__dirname, '..', '..', 'shared', 'products.json'), 'utf-8')
  );
}

export async function getProducts() {
  if (!process.env.EDGE_CONFIG) return loadFallback();
  try {
    const products = await get('products');
    if (Array.isArray(products) && products.length > 0) return products;
  } catch (err) {
    console.error('Edge Config read failed, falling back to shared/products.json', err);
  }
  return loadFallback();
}

export async function saveProducts(products) {
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
    body: JSON.stringify({ items: [{ operation: 'upsert', key: 'products', value: products }] }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Edge Config write failed (${res.status}): ${text}`);
  }
}
