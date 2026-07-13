// Example webhook handler that confirms payment and marks the order as paid.
// Configure this URL in the Stripe Dashboard -> Developers -> Webhooks,
// subscribed to the "checkout.session.completed" event.

const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

module.exports = async function handler(req, res) {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed.', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { cabinName, deliverySlot } = session.metadata;

    // TODO: persist the order (KV store / database) as "Received", e.g.:
    // await ORDERS_KV.put(session.id, JSON.stringify({
    //   status: 'Received', cabinName, deliverySlot, amount: session.amount_total,
    // }));

    // TODO: notify staff — email, Slack webhook, or a Google Sheets append —
    // so someone knows to prep the delivery.
    console.log(`New order ${session.id} for cabin ${cabinName}, slot ${deliverySlot}`);
  }

  return res.status(200).json({ received: true });
};
