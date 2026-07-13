// Vercel Node.js serverless function: looks up a Checkout Session by id so the
// SPA can hydrate the order-confirmation screen after Stripe redirects the
// browser back (the app reloads fresh at that point and has no local order state).

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sessionId = req.query.session_id;
  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'Missing session_id' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return res.status(200).json({
      paid: session.payment_status === 'paid',
      cabinName: session.metadata?.cabinName || '',
      deliverySlot: session.metadata?.deliverySlot || '',
      amountTotal: session.amount_total,
    });
  } catch (err) {
    console.error(err);
    return res.status(404).json({ error: 'Session not found' });
  }
}
