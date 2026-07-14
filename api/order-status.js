// Public read-only endpoint the confirmation screen polls so the tracking
// stepper reflects the order's real status instead of a static illustration.

import { getOrder } from './_lib/orderStore.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const orderNumber = req.query.order;
  if (!orderNumber || typeof orderNumber !== 'string') {
    return res.status(400).json({ error: 'Missing order' });
  }

  try {
    const order = await getOrder(orderNumber.toUpperCase());
    if (!order) return res.status(404).json({ error: 'Order not found' });

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      orderNumber: order.orderNumber,
      status: order.status,
      cabinName: order.cabinName,
      deliverySlot: order.deliverySlot,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not look up order' });
  }
}
