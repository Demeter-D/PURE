// Order persistence for tracking + the admin fulfillment view. Backed by
// Redis Cloud (connected via Vercel's Redis integration, which provides a
// standard connection string) — unlike the product catalog, order data is
// written on every checkout and grows over time, which doesn't fit Edge
// Config's small/rarely-written design, so this uses a separate store.
//
// Opens a fresh connection per call instead of reusing one across
// invocations: serverless functions can go "warm" between requests, and a
// long-idle Redis connection kept from a previous invocation may have
// already been closed server-side, which is only discoverable by trying to
// use it (and ioredis won't reconnect a connection that was told not to retry).

import Redis from 'ioredis';

const RECENT_KEY = 'orders:recent';
const MAX_RECENT = 200;

async function withRedis(fn) {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error('Redis is not configured (missing REDIS_URL env var)');
  }

  const redis = new Redis(url, {
    connectTimeout: 5000,
    maxRetriesPerRequest: 1,
  });
  redis.on('error', (err) => console.error('Redis connection error', err.message));

  try {
    return await fn(redis);
  } finally {
    redis.disconnect();
  }
}

async function readOrder(redis, orderNumber) {
  const raw = await redis.get(`order:${orderNumber}`);
  return raw ? JSON.parse(raw) : null;
}

export async function saveOrder(order) {
  await withRedis(async (redis) => {
    await redis.set(`order:${order.orderNumber}`, JSON.stringify(order));
    await redis.lpush(RECENT_KEY, order.orderNumber);
    await redis.ltrim(RECENT_KEY, 0, MAX_RECENT - 1);
  });
}

export async function getOrder(orderNumber) {
  return withRedis((redis) => readOrder(redis, orderNumber));
}

export async function updateOrderStatus(orderNumber, status) {
  return withRedis(async (redis) => {
    const order = await readOrder(redis, orderNumber);
    if (!order) return null;
    const updated = { ...order, status };
    await redis.set(`order:${orderNumber}`, JSON.stringify(updated));
    return updated;
  });
}

export async function listRecentOrders(limit = 50) {
  return withRedis(async (redis) => {
    const ids = await redis.lrange(RECENT_KEY, 0, limit - 1);
    if (!ids || ids.length === 0) return [];
    const orders = await Promise.all(ids.map((id) => readOrder(redis, id)));
    return orders.filter(Boolean);
  });
}
