// Example: Vercel/Netlify-style serverless function (Node runtime) that creates
// a Stripe Checkout Session server-side. Adapt the export shape to your host
// (Vercel: `export default async function handler(req, res)`, Netlify: `exports.handler`,
// Cloudflare Workers: `export default { fetch(request, env) {...} }`).
//
// NEVER trust prices sent from the client — always look them up server-side.

const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Server-side source of truth for prices (in pence, GBP).
const PRICES = {
  p1: 600, p2: 500, p3: 1400,
  p4: 1500, p5: 600, p6: 400,
  p7: 1800, p8: 900, p9: 1200,
  p10: 1100, p11: 900, p12: 1600,
  p13: 500, p14: 800, p15: 700,
};

const PRODUCT_NAMES = {
  p1: 'Trail Mix', p2: 'Instant Oatmeal', p3: 'Breakfast Kit',
  p4: 'Local IPA 6-Pack', p5: 'Cold Brew Coffee', p6: 'Sparkling Water',
  p7: 'Firewood Bundle', p8: 'Fire Starter Kit', p9: 'Propane Canister',
  p10: 'Maple Syrup', p11: 'Honey Jar', p12: 'Wool Socks',
  p13: 'Travel Soap', p14: 'Sunscreen', p15: 'Bug Spray',
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { items, cabinName, deliverySlot } = JSON.parse(req.body);

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }
    if (!cabinName) {
      return res.status(400).json({ error: 'Cabin name is required' });
    }

    const line_items = items.map(({ id, qty }) => {
      const unit_amount = PRICES[id];
      const name = PRODUCT_NAMES[id];
      if (!unit_amount || !name) throw new Error(`Unknown product id: ${id}`);
      return {
        price_data: {
          currency: 'gbp',
          product_data: { name },
          unit_amount,
        },
        quantity: qty,
      };
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items,
      metadata: { cabinName, deliverySlot: deliverySlot ?? '' },
      success_url: `${process.env.SITE_URL}/order-confirmed?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.SITE_URL}/cart`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not create checkout session' });
  }
};
