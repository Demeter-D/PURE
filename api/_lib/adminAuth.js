import { timingSafeEqual } from 'node:crypto';

export function checkAdminPassword(req) {
  const configured = process.env.ADMIN_PASSWORD;
  if (!configured) return false;

  const provided = req.headers['x-admin-password'];
  if (typeof provided !== 'string' || !provided) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(configured);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
