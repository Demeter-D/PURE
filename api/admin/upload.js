// Password-gated image upload for the admin page. The client resizes/compresses
// the photo down to a JPEG before sending it, so this just validates the type
// and size and hands the raw bytes to Vercel Blob.

import { put } from '@vercel/blob';
import { checkAdminPassword } from '../_lib/adminAuth.js';

// Raw image bytes come in as the request body, not JSON — read them ourselves.
export const config = {
  api: { bodyParser: false },
};

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 8 * 1024 * 1024;

function readRawBody(readable) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    readable.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BYTES) {
        reject(new Error('Image is too large (max 8MB)'));
        readable.destroy();
        return;
      }
      chunks.push(chunk);
    });
    readable.on('end', () => resolve(Buffer.concat(chunks)));
    readable.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (!checkAdminPassword(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const contentType = req.headers['content-type'];
  if (!ALLOWED_TYPES.has(contentType)) {
    return res.status(400).json({ error: 'Only JPEG, PNG, or WebP images are allowed' });
  }

  let buffer;
  try {
    buffer = await readRawBody(req);
  } catch (err) {
    return res.status(413).json({ error: err.message || 'Upload too large' });
  }
  if (buffer.length === 0) {
    return res.status(400).json({ error: 'Empty upload' });
  }

  const ext = contentType.split('/')[1];
  const filename = `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  try {
    const blob = await put(filename, buffer, { access: 'public', contentType });
    return res.status(200).json({ url: blob.url });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Could not upload image' });
  }
}
