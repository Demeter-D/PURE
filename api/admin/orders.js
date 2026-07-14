import { checkAdminPassword } from '../_lib/adminAuth.js';
import { listRecentOrders, updateOrderStatus } from '../_lib/orderStore.js';

const VALID_STATUSES = ['received', 'preparing', 'on_the_way', 'delivered'];

export default async function handler(req, res) {
  if (!checkAdminPassword(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const orders = await listRecentOrders();
      return res.status(200).json(orders);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: err.message || 'Could not load orders' });
    }
  }

  if (req.method === 'PUT') {
    const { orderNumber, status } = req.body || {};
    if (typeof orderNumber !== 'string' || !orderNumber.trim() || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid orderNumber or status' });
    }
    try {
      const updated = await updateOrderStatus(orderNumber, status);
      if (!updated) return res.status(404).json({ error: 'Order not found' });
      return res.status(200).json(updated);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: err.message || 'Could not update order' });
    }
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).json({ error: 'Method not allowed' });
}
