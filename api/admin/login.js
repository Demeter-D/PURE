// Validates the admin password so the admin page can show a clear
// "wrong password" message immediately, instead of only failing on save.

import { checkAdminPassword } from '../_lib/adminAuth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'ADMIN_PASSWORD is not configured on the server' });
  }

  if (!checkAdminPassword(req)) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  return res.status(200).json({ ok: true });
}
