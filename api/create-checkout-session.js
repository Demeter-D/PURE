// Vercel Node.js serverless function: creates a Stripe Checkout Session server-side.
// Receives { items: [{id, qty}], cabinName, deliverySlot } from the client, looks up
// real prices from shared/products.json (never trusts client-sent prices), and
// returns the session URL for the browser to redirect to.

import Stripe from 'stripe';
import { findProduct } from './_lib/products.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { items, cabinName, deliverySlot } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }
    if (typeof cabinName !== 'string' || !cabinName.trim()) {
      return res.status(400).json({ error: 'Cabin name is required' });
    }
    if (typeof deliverySlot !== 'string' || !deliverySlot.trim()) {
      return res.status(400).json({ error: 'Delivery window is required' });
    }
    if (items.length > 50) {
      return res.status(400).json({ error: 'Too many line items' });
    }

    const line_items = items.map(({ id, qty }) => {
      const product = findProduct(id);
      const quantity = Number(qty);
      if (!product) throw new Error(`Unknown product id: ${id}`);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
        throw new Error(`Invalid quantity for ${id}`);
      }
      return {
        price_data: {
          currency: 'gbp',
          product_data: { name: product.name },
          unit_amount: Math.round(product.price * 100),
        },
        quantity,
      };
    });

    const siteUrl = process.env.SITE_URL || `https://${req.headers.host}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items,
      metadata: {
        cabinName: cabinName.trim().slice(0, 120),
        deliverySlot: deliverySlot.trim().slice(0, 40),
      },
      success_url: `${siteUrl}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/?checkout=cancelled`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message || 'Could not create checkout session' });
  }
}
