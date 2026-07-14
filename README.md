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
index.html                        shop entry HTML
admin.html                        admin entry HTML (product catalog editor)
src/
  main.js                         shop state machine + rendering (all 5 screens)
  admin.js                        admin page: password gate + editable product table
  style.css                       design tokens + component styles (shared by both)
  products.js, cart.js            product fetch/lookup, cart localStorage persistence
shared/products.json              bundled fallback catalog (used until Edge Config
                                   is set up, and by local dev without it)
api/
  products.js                    GET  — public product list (shop reads this)
  create-checkout-session.js      POST — creates a Stripe Checkout Session
  stripe-webhook.js               POST — verifies + handles checkout.session.completed
  session.js                      GET  — looks up a session for the confirmation screen
  admin/login.js                  POST — validates the admin password
  admin/products.js               GET/PUT — password-gated catalog read/write
  admin/upload.js                 POST — password-gated product photo upload (Blob)
  admin/orders.js                  GET/PUT — password-gated order list + status update
  order-status.js                 GET  — public order status lookup (confirmation screen polls this)
  _lib/catalogStore.js            reads/writes the catalog (Edge Config, with the
                                   bundled JSON as fallback)
  _lib/orderStore.js              reads/writes orders (Redis)
  _lib/slack.js                   posts new-order notifications to Slack, if configured
  _lib/adminAuth.js                shared password check for the admin/* routes
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
2. The function looks up real prices from the catalog store server-side
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

## Editing the product catalog

There's a password-protected admin page at `/admin` for adding, editing, and
deleting products without touching code — changes go live immediately, no
redeploy needed. It reads/writes the catalog through a **Vercel Edge Config**
store (a small key-value store built for exactly this: read constantly,
written rarely). Until Edge Config is set up, the app just runs on the
bundled `shared/products.json` and the admin page's save button will show a
clear error explaining it's not configured yet.

**One-time setup, all in the Vercel dashboard:**

1. **Create the store**: your project → **Storage** tab → **Create Database**
   → **Edge Config** → give it a name (e.g. `pure-products`) → connect it to
   this project. This automatically adds an `EDGE_CONFIG` environment
   variable to the project (used for *reads*).
2. **Get an API token for writes**: Edge Config reads use that connection
   string, but writes need a Vercel API token. Go to **Account Settings →
   Tokens → Create Token** (any name, e.g. "pure-admin"), copy it.
3. **Get the Edge Config ID**: on the Edge Config store's page in the
   dashboard, copy its **ID** (starts with `ecfg_`).
4. **If your project is under a Team** (not your personal account — check the
   dashboard URL/scope), also grab the **Team ID** from **Team Settings →
   General**.
5. Add these env vars (`vercel env add <NAME> production`, or via the
   dashboard), then redeploy:
   - `ADMIN_PASSWORD` — a password you choose for `/admin`
   - `VERCEL_API_TOKEN` — the token from step 2
   - `EDGE_CONFIG_ID` — the ID from step 3
   - `VERCEL_TEAM_ID` — only if step 4 applied to you

Then open `https://<your-site>/admin`, enter the password, and edit away.
New products get an id auto-generated from their name; existing ids never
change once created (that id is what's used in the cart and in Stripe line
items, so don't hand-edit it).

### Product photos

Each row in `/admin` has a photo upload — pick a file and it replaces the
striped placeholder everywhere (home grid, product detail, cart) once saved.
Photos are stored in **Vercel Blob** (a separate one-time setup from Edge
Config above, also just a few clicks):

1. **Storage** tab → **Create Database** → **Blob** → name it (e.g.
   `pure-photos`) → connect it to this project. This adds a
   `BLOB_READ_WRITE_TOKEN` environment variable automatically — no extra
   token or ID to copy this time.
2. Redeploy.

The browser resizes/compresses photos to a reasonable size before uploading
(so a multi-MB phone photo doesn't hit upload limits or slow the shop down),
and only JPEG/PNG/WebP are accepted, up to 8MB.

## Order tracking and fulfilling orders

When a payment completes, the webhook saves the order (cabin, delivery
window, items, status) and — if configured — posts it to Slack. The
confirmation screen the guest sees polls for real status updates every 10
seconds, and `/admin`'s **Orders** tab is where you mark each order Received →
Preparing → On the way → Delivered as you fulfill it; the guest's screen
updates automatically.

**One-time setup for order storage** (a third small database, alongside the
Edge Config and Blob stores above — orders are written on every checkout and
keep growing, which doesn't fit Edge Config's small/rarely-written design, so
this needs its own store):

1. **Storage** tab → **Create Database** → look for **Redis** (via the
   Upstash marketplace integration) → name it (e.g. `pure-orders`) → connect
   it to this project. This adds `KV_REST_API_URL` / `KV_REST_API_TOKEN`
   environment variables automatically.
2. Redeploy.

**Slack notifications** (optional, but you asked — here's how):

1. Go to a Slack app config page (Slack → your workspace → search "Incoming
   Webhooks" in the App Directory, or api.slack.com/apps → **Create New App**
   → **From scratch** → pick your workspace).
2. Under **Incoming Webhooks**, toggle it on → **Add New Webhook to
   Workspace** → choose the channel new orders should post to → **Allow**.
3. Copy the webhook URL it gives you (looks like
   `https://hooks.slack.com/services/…`).
4. Add it as an env var and redeploy:
   ```
   npx vercel env add SLACK_WEBHOOK_URL production
   ```

Without `SLACK_WEBHOOK_URL` set, everything else still works — you just won't
get a Slack ping, and would need to check `/admin`'s Orders tab or the Stripe
Dashboard's Payments list manually.
