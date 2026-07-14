import { checkAdminPassword } from '../_lib/adminAuth.js';
import { getCatalog, saveCatalog } from '../_lib/catalogStore.js';

function isValidCategory(c) {
  return c && typeof c.id === 'string' && c.id.trim() && typeof c.name === 'string' && c.name.trim();
}

function isValidProduct(p, catIds) {
  return (
    p &&
    typeof p.id === 'string' && p.id.trim() &&
    typeof p.catId === 'string' && catIds.has(p.catId) &&
    typeof p.name === 'string' && p.name.trim() &&
    typeof p.desc === 'string' &&
    typeof p.price === 'number' && Number.isFinite(p.price) && p.price >= 0 &&
    (p.image === undefined || typeof p.image === 'string')
  );
}

export default async function handler(req, res) {
  if (!checkAdminPassword(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    const catalog = await getCatalog();
    return res.status(200).json(catalog);
  }

  if (req.method === 'PUT') {
    const { categories, products } = req.body || {};

    if (!Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({ error: 'categories must be a non-empty array' });
    }
    if (!categories.every(isValidCategory)) {
      return res.status(400).json({ error: 'Every category needs an id and a name' });
    }
    const catIds = new Set(categories.map((c) => c.id));
    if (catIds.size !== categories.length) {
      return res.status(400).json({ error: 'Category ids must be unique' });
    }

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'products must be a non-empty array' });
    }
    if (!products.every((p) => isValidProduct(p, catIds))) {
      return res.status(400).json({
        error: 'Every product needs an id, a valid category, name, description, and a non-negative price',
      });
    }
    const ids = new Set(products.map((p) => p.id));
    if (ids.size !== products.length) {
      return res.status(400).json({ error: 'Product ids must be unique' });
    }

    try {
      await saveCatalog({ categories, products });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: err.message || 'Could not save products' });
    }
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).json({ error: 'Method not allowed' });
}
