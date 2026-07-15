# PURE — Cabin Shop

A mobile-first PWA for guests staying in a cabin: browse food, beverages,
firewood/supplies, local goods and toiletries, add to cart, and pay by card —
delivered to the cabin. Built from the design handoff in
[`design_handoff_pure_cabin_shop/`](./design_handoff_pure_cabin_shop) (brutalist
direction, `ShopPhoneBrutalist.dc.html`).

Stack: vanilla JS + Vite (no framework needed for five screens), Stripe Checkout
for payment, deployed as a static site + serverless functions on Vercel.

## PURE × Stockley collaboration

The app currently ships a co-branded look for a collaboration with Stockley
Farm. Palette and typography are defined in `src/style.css` `:root`:

- **Ink** `#1F1A14`, **Hearth/paper** `#F5EDD9`, **Ember/accent** `#A8552A`
  (CSS variable kept as `--green` for a minimal diff, but it's Ember now, not
  green), **Moss** `#3A4A36` — all Stockley's own named brand tokens.
- Display/mono stay PURE's originals — Archivo Black and Space Mono — used
  for everything. The one exception is the literal word "Stockley" wherever
  it appears in a wordmark or signature line, which uses `--stockley-mark`
  (EB Garamond italic) — see `.lockup`/`.stockley-word` in `src/style.css`
  and the three places it's used in `src/main.js` (install screen, home top
  bar, order-confirmed screen).

To revert to the original solo-PURE black/green look, restore `--ink:
#0A0A0A`, `--paper: oklch(0.965 0.004 235)`, `--green: oklch(0.64 0.18
142)` in `src/style.css`, drop the `--stockley-mark`/`.lockup` additions,
and remove the "× Stockley" markup from the three spots in `src/main.js`
listed above — plus regenerate the icons/OG image (`npm run generate-icons`,
and re-run `favicon-template.html`/`og-template.html` with the old colors).

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
  _lib/email.js                   sends the branded order confirmation email, if configured
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

The browser-tab favicon (`public/icons/favicon-{16,32,48}.png`,
`apple-touch-icon.png`) and the social-share preview image
(`public/og-image.png`, linked via the `og:image`/`twitter:image` tags in
`index.html`) are a bold "P" monogram / "PURE × Stockley" lockup on the
Ink/Ember palette (see "PURE × Stockley collaboration" below), rendered from
`favicon-template.html`/`og-template.html` (one-off HTML files used to
generate these, not part of the shipped site).

`public/og-admin.png`, linked from `admin.html`, is a separate share preview
for the `/admin` link — a "STAFF ONLY" / "PURE — ADMIN" treatment (no
Stockley branding, since the admin panel isn't co-branded) so it's obviously
distinct from the shop link if it's ever pasted into a chat. `admin.html`
also keeps `<meta name="robots" content="noindex, nofollow">`, which stops
search engines but not link-preview bots — hence the deliberately
not-for-guests messaging on the image itself.

Separately, `scripts/generate-icons.mjs` generates the *PWA install* icons
(Ink square, centered Ember square) using nothing but Node's
built-in `zlib` — no image library needed. Run `npm run generate-icons` to
regenerate them. Before a real launch, consider replacing
`public/icons/icon-{192,512,maskable-512}.png` with matching artwork built
from the PURE wordmark.

Product photography is likewise still a striped placeholder
(`repeating-linear-gradient` in `src/style.css`, `.stripe-a` / `.stripe-b`) —
swap in real photos per product when you have them.

## Deploying to Vercel

This project is connected to Vercel via **Project Settings → Git**, with
`main` as the production branch — every push to `main` deploys automatically.
Environment variables live under **Project Settings → Environment
Variables** and don't need to be re-added on each deploy:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SITE_URL` — your Vercel URL, e.g. `https://pure-cabin-shop.vercel.app`
  (optional — the API falls back to the request's own host if unset)

For the Stripe webhook: Stripe Dashboard → **Developers → Webhooks** → add an
endpoint at `https://<your-site>/api/stripe-webhook`, subscribed to
`checkout.session.completed`. Its signing secret goes into
`STRIPE_WEBHOOK_SECRET` above.

If you ever need to deploy from a local checkout instead (e.g. before pushing
to GitHub), `npx vercel --prod` still works, but prefer pushing to `main` —
mixing the two can leave the live site out of sync with what's on GitHub.

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

### Categories

The **Categories** tab in `/admin` manages the shop's categories as their own
list, separate from products. Each category has a stable id (assigned once,
never changes) and a display name (freely editable) — so renaming a category
is just editing its name and hitting save; every product in it updates
everywhere (chips, product page, admin grouping) immediately, no need to
touch each product individually. A category can't be deleted while products
still use it — reassign those products first in the Products tab, which now
groups rows under their category.

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

1. **Storage** tab → **Create Database** → **Redis** (the official Redis
   Cloud marketplace integration) → name it (e.g. `pure-orders`) → connect it
   to this project. This adds a `REDIS_URL` environment variable
   automatically (a standard `rediss://...` connection string).
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

## Order confirmation email

Separately from Stripe's own generic receipt (a Dashboard toggle — Settings →
Emails → "Email customers for successful payments" — no code involved), the
webhook also sends a PURE-branded confirmation email (itemized order, total,
delivery window, a thank-you note) to the guest via
[Resend](https://resend.com). No VAT line is shown — PURE isn't currently
VAT-registered; if that changes later, this is the file to revisit
(`api/_lib/email.js`).

1. Sign up at resend.com (free tier is plenty for this scale) → **API Keys**
   → **Create API Key** → copy it.
2. Add it and redeploy:
   ```
   npx vercel env add RESEND_API_KEY production
   ```

That's enough to start sending — by default it sends from Resend's shared
`onboarding@resend.dev` address, which works immediately with no extra setup
but looks less trustworthy to guests and has stricter sending limits. Once
you own a domain for PURE, verify it in Resend (**Domains** → **Add Domain**,
then add the DNS records it gives you) and set:
```
npx vercel env add EMAIL_FROM production
```
with a value like `PURE <orders@yourdomain.com>`.

**Replies**: the email says "just reply to this email" — for that to actually
reach anyone, set `EMAIL_REPLY_TO` to an inbox you check (this works
independently of `EMAIL_FROM`/domain verification, so it's worth setting even
before you have a custom domain):
```
npx vercel env add EMAIL_REPLY_TO production
```

Without `RESEND_API_KEY` set, everything else still works — guests just won't
get the branded email (Stripe's own receipt toggle, if enabled, still applies
independently).
