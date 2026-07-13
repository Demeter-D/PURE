# PURE — Cabin Shop

A mobile-first PWA for guests staying in a cabin: browse food, beverages,
firewood/supplies, local goods and toiletries, add to cart, and pay by card —
delivered to the cabin. Built from the design handoff in
[`design_handoff_pure_cabin_shop/`](./design_handoff_pure_cabin_shop) (brutalist
direction, `ShopPhoneBrutalist.dc.html`).

Stack: vanilla JS + Vite (no framework needed for five screens), Stripe Checkout
for payment, deployed as a static site + serverless functions on Vercel.

## Project layout

```
index.html                        entry HTML
src/
  main.js                         app state machine + rendering (all 5 screens)
  style.css                       design tokens + component styles
  products.js, cart.js            product lookup, cart localStorage persistence
shared/products.json              single source of truth for product data —
                                   imported by both the client and the API
api/
  create-checkout-session.js      POST — creates a Stripe Checkout Session
  stripe-webhook.js               POST — verifies + handles checkout.session.completed
  session.js                      GET  — looks up a session for the confirmation screen
  _lib/products.js                server-side price lookup (never trusts the client)
public/
  manifest.json, service-worker.js, icons/   PWA shell (icons are placeholders — see below)
design_handoff_pure_cabin_shop/   original design spec, kept for reference
```

## Running locally

```
npm install
npm run dev
```

Opens the app at `http://localhost:5173`. This gets you all 5 screens (install,
home, product, cart, confirm) with working cart state — but the `/api/*`
functions won't respond under plain `vite dev`, since those are Vercel
serverless functions. To exercise the real Stripe flow locally:

```
npm install -g vercel   # one-time
vercel dev
```

`vercel dev` serves both the built frontend and the `/api` functions together,
reading `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` from a local `.env` file
(copy `.env.example` → `.env` and fill in your **test-mode** keys).

To test the webhook locally too, forward Stripe events with the
[Stripe CLI](https://docs.stripe.com/stripe-cli): `stripe listen --forward-to
localhost:3000/api/stripe-webhook` (use whatever port `vercel dev` prints).

## How checkout works

1. Cart screen posts `{ items, cabinName, deliverySlot }` to
   `/api/create-checkout-session`.
2. The function looks up real prices from `shared/products.json` server-side
   (never trusts client-sent prices), creates a Stripe Checkout Session with
   `cabinName`/`deliverySlot` as `metadata`, and returns the session URL.
3. The browser redirects to Stripe's hosted checkout page.
4. On success, Stripe redirects back to `/?session_id={CHECKOUT_SESSION_ID}`.
   Since that's a fresh page load with no in-memory app state, `main.js` calls
   `/api/session` to retrieve the session (confirming `payment_status ===
   'paid'`) and hydrates the confirmation screen from it, then clears the cart.
5. Separately, `/api/stripe-webhook` verifies the `checkout.session.completed`
   event server-side (the source of truth for "this order is actually paid")
   and is where you'd persist the order and notify staff — see the two `TODO`s
   in that file.

## Icons

`scripts/generate-icons.mjs` generates placeholder PWA icons (black square,
centered accent-green square) using nothing but Node's built-in `zlib` — no
image library needed. Run `npm run generate-icons` to regenerate them. Before
a real launch, replace `public/icons/*.png` with real artwork built from the
PURE wordmark (192×192, 512×512, and a maskable 512×512 with ~20% safe-zone
padding).

Product photography is likewise still a striped placeholder
(`repeating-linear-gradient` in `src/style.css`, `.stripe-a` / `.stripe-b`) —
swap in real photos per product when you have them.

## Deploying to Vercel

1. Push this repo to GitHub (already done if you're reading this from the
   deployed branch).
2. Go to [vercel.com](https://vercel.com) → **Add New... → Project** → import
   the repo. Vercel auto-detects the Vite framework preset — no config needed.
3. Before the first deploy (or any time after, then redeploy), add environment
   variables under **Project Settings → Environment Variables**:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `SITE_URL` — your Vercel URL, e.g. `https://pure-cabin-shop.vercel.app`
     (optional — the API falls back to the request's own host if unset)
4. Deploy. You'll get a live HTTPS URL.
5. In the Stripe Dashboard → **Developers → Webhooks**, add an endpoint at
   `https://<your-site>/api/stripe-webhook`, subscribed to
   `checkout.session.completed`. Copy the signing secret it gives you into
   `STRIPE_WEBHOOK_SECRET` (step 3), then redeploy.

## Testing before going live

1. Open the deployed URL on your phone; confirm "Add to Home Screen" works
   (Safari: Share → Add to Home Screen; Android: the install banner or the
   in-app "Install App" button).
2. Add a few items, pick a delivery window, enter a cabin name, pay with
   Stripe's test card `4242 4242 4242 4242`, any future expiry, any 3-digit CVC.
3. Confirm the order shows up in the Stripe Dashboard (test mode) under
   **Payments**, and that the confirmation screen loaded with the right cabin
   name / delivery window.
4. Check the webhook fired: **Developers → Webhooks → your endpoint** should
   show a successful `checkout.session.completed` delivery.

## Going live

Flip Stripe from **Test mode** to **Live mode** (top right of the dashboard),
grab the live `STRIPE_SECRET_KEY`, and update it (and re-create the webhook
endpoint in live mode, updating `STRIPE_WEBHOOK_SECRET`) in Vercel's
environment variables, then redeploy.

## Fulfilling orders

Right now, `api/stripe-webhook.js` just logs new orders — there's no
persistence or staff notification wired up yet (two `TODO`s in that file mark
where to add a KV/database write and an email/Slack notification). Until
that's built, keep an eye on the Stripe Dashboard's Payments list for new
orders, or wire up one of the TODOs.
