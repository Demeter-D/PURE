// Public read-only endpoint the shop frontend fetches on load. Reads whatever
// is currently in the catalog store (Edge Config, or the bundled fallback).

import { getProducts } from './_lib/catalogStore.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const products = await getProducts();
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(products);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not load products' });
  }
}
