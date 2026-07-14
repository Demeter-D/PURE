// Vercel Node.js serverless function: verifies the Stripe webhook signature on
// checkout.session.completed, then marks the order paid and notifies staff.
// Configure this URL in the Stripe Dashboard -> Developers -> Webhooks,
// subscribed to the "checkout.session.completed" event.

import Stripe from 'stripe';
import { saveOrder } from './_lib/orderStore.js';
import { notifySlack } from './_lib/slack.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Signature verification needs the raw request body, so Vercel's JSON body
// parsing must be disabled for this route.
export const config = {
  api: { bodyParser: false },
};

function readRawBody(readable) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readable.on('data', (chunk) => chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk));
    readable.on('end', () => resolve(Buffer.concat(chunks)));
    readable.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method not allowed');
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed.', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { cabinName, deliverySlot } = session.metadata || {};
    const orderNumber = session.id.slice(-8).toUpperCase();

    let items = [];
    try {
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
      items = lineItems.data.map((li) => ({ name: li.description, qty: li.quantity }));
    } catch (err) {
      console.error('Could not fetch line items for', session.id, err);
    }

    const order = {
      orderNumber,
      sessionId: session.id,
      cabinName: cabinName || '',
      deliverySlot: deliverySlot || '',
      items,
      amountTotal: session.amount_total,
      status: 'received',
      createdAt: Date.now(),
    };

    try {
      await saveOrder(order);
    } catch (err) {
      console.error('Could not save order', order.orderNumber, err);
    }

    await notifySlack(order);
  }

  return res.status(200).json({ received: true });
}
