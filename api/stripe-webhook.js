// Vercel Node.js serverless function: verifies the Stripe webhook signature on
// checkout.session.completed, then marks the order paid and notifies staff.
// Configure this URL in the Stripe Dashboard -> Developers -> Webhooks,
// subscribed to the "checkout.session.completed" event.

import Stripe from 'stripe';

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

    // TODO: persist the order (KV store / database) as "Received", e.g.:
    // await ORDERS_KV.put(session.id, JSON.stringify({
    //   status: 'Received', cabinName, deliverySlot, amount: session.amount_total,
    // }));

    // TODO: notify staff — email, Slack webhook, or a Google Sheets append —
    // so someone knows to prep the delivery.
    console.log(`New order ${session.id} for cabin ${cabinName}, slot ${deliverySlot}, amount ${session.amount_total}`);
  }

  return res.status(200).json({ received: true });
}
