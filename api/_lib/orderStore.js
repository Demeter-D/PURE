// Order persistence for tracking + the admin fulfillment view. Backed by a
// Redis store (Vercel Marketplace "Redis" integration, powered by Upstash) —
// unlike the product catalog, order data is written on every checkout and
// grows over time, which doesn't fit Edge Config's small/rarely-written
// design, so this uses a separate store.

import { Redis } from '@upstash/redis';

let kv = null;
function getClient() {
  if (kv) return kv;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error('Redis is not configured (missing KV_REST_API_URL/KV_REST_API_TOKEN env vars)');
  }
  kv = new Redis({ url, token });
  return kv;
}

const RECENT_KEY = 'orders:recent';
const MAX_RECENT = 200;

export async function saveOrder(order) {
  const client = getClient();
  await client.set(`order:${order.orderNumber}`, order);
  await client.lpush(RECENT_KEY, order.orderNumber);
  await client.ltrim(RECENT_KEY, 0, MAX_RECENT - 1);
}

export async function getOrder(orderNumber) {
  return getClient().get(`order:${orderNumber}`);
}

export async function updateOrderStatus(orderNumber, status) {
  const order = await getOrder(orderNumber);
  if (!order) return null;
  const updated = { ...order, status };
  await getClient().set(`order:${orderNumber}`, updated);
  return updated;
}

export async function listRecentOrders(limit = 50) {
  const ids = await getClient().lrange(RECENT_KEY, 0, limit - 1);
  if (!ids || ids.length === 0) return [];
  const orders = await Promise.all(ids.map((id) => getOrder(id)));
  return orders.filter(Boolean);
}
