// Order persistence for tracking + the admin fulfillment view. Backed by
// Redis Cloud (connected via Vercel's Redis integration, which provides a
// standard connection string) — unlike the product catalog, order data is
// written on every checkout and grows over time, which doesn't fit Edge
// Config's small/rarely-written design, so this uses a separate store.

import Redis from 'ioredis';

let client = null;
function getClient() {
  if (client) return client;
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error('Redis is not configured (missing REDIS_URL env var)');
  }
  // Serverless-friendly settings: fail fast instead of ioredis's default of
  // retrying forever / queuing commands while disconnected, which could
  // otherwise hang a request until the function times out.
  client = new Redis(url, {
    connectTimeout: 5000,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: () => null,
  });
  client.on('error', (err) => console.error('Redis connection error', err.message));
  return client;
}

const RECENT_KEY = 'orders:recent';
const MAX_RECENT = 200;

export async function saveOrder(order) {
  const redis = getClient();
  await redis.set(`order:${order.orderNumber}`, JSON.stringify(order));
  await redis.lpush(RECENT_KEY, order.orderNumber);
  await redis.ltrim(RECENT_KEY, 0, MAX_RECENT - 1);
}

export async function getOrder(orderNumber) {
  const raw = await getClient().get(`order:${orderNumber}`);
  return raw ? JSON.parse(raw) : null;
}

export async function updateOrderStatus(orderNumber, status) {
  const order = await getOrder(orderNumber);
  if (!order) return null;
  const updated = { ...order, status };
  await getClient().set(`order:${orderNumber}`, JSON.stringify(updated));
  return updated;
}

export async function listRecentOrders(limit = 50) {
  const ids = await getClient().lrange(RECENT_KEY, 0, limit - 1);
  if (!ids || ids.length === 0) return [];
  const orders = await Promise.all(ids.map((id) => getOrder(id)));
  return orders.filter(Boolean);
}
