
# Handoff: PURE — Cabin Shop PWA

## Overview
PURE is a mobile-first shop for guests staying in a cabin: browse food, beverages,
firewood/supplies, local goods and toiletries, add to cart, and check out with a
card — delivered to the cabin. This package covers both the **front-end design**
(built as an HTML prototype) and a **recommended real backend architecture** using
Stripe for payment, so a developer can turn this into a live, installable PWA with
working checkout.

## About the Design Files
The `design/` folder contains **HTML design references** — interactive prototypes
built to show intended look, layout, and behavior. They are not production code to
copy verbatim. The task is to **recreate these designs in the target codebase's
environment** (React/Vue/vanilla, whichever the team standardizes on) using real
build tooling, routing, and state management — or, if no app exists yet, scaffold
a small static/PWA project (e.g. Vite + vanilla JS or React) and implement the
screens there, wired to a real backend.

## Fidelity
**High-fidelity.** Colors, typography, spacing, and all screen states shown in the
prototype are final — recreate them pixel-for-pixel. Two visual directions were
explored; the client selected the **brutalist "2a" direction** (`ShopPhoneBrutalist.dc.html`)
as final. The earlier warm/cool/earthy explorations (`ShopPhone.dc.html`) are
included for reference only and are NOT the direction to build.

## Screens / Views
All screens live inside a single mobile viewport (iPhone-style status bar +
home indicator — that device chrome is a design-tool convenience, not something
to build; use the real browser/PWA chrome instead).

### 1. Install / Onboarding
- **Purpose**: First-run screen prompting the user to install the PWA to their
  home screen.
- **Layout**: Full-bleed black background, centered column, ~70px top padding.
- **Components**:
  - Wordmark "PURE", Archivo Black, 46px, white, tight letter-spacing (-0.01em)
  - Tag line "ALL NATURAL", Space Mono, 11px, letter-spacing 0.15em, color = accent green
  - 3 benefit rows: 9×9px green square bullet + Space Mono 11px white text, 14px gap between rows, 46px margin above the list
  - Primary button "INSTALL APP": solid accent-green background, black text, Archivo Black 17px uppercase, 4px solid black border, 20px padding, no shadow, full width
  - Secondary button "CONTINUE IN BROWSER": transparent background, white 3px border, white text, same type treatment, no shadow
- **Behavior**: Either button navigates to Home. In production, "Install app" should
  trigger the real `beforeinstallprompt` PWA install flow (see PWA Setup below);
  "Continue in browser" just proceeds without installing.

### 2. Home / Browse
- **Layout**: Black top bar (58px top padding to clear the status bar, 18px sides/bottom)
  containing wordmark "PURE" (Archivo Black 22px white) left, and a cabin-name tag
  pill right (Space Mono 10px bold, black text on green background, "SET CABIN →"
  until a cabin name is entered).
- Below the bar: body padding 18px sides, category chip row (horizontally scrollable,
  8px gap), then a 2-column product grid (10px gap).
- **Category chip**: Space Mono 11px bold, letter-spacing 0.03em, 2px solid black
  border, 8×12px padding, transparent bg / black text when inactive, black bg /
  white text when active (selected filters the grid to that category).
- **Product card**: white bg, 2px solid black border, 8px padding. Image area 74px
  tall — striped placeholder (45°/135° diagonal repeating black/green/paper stripes)
  standing in for a real product photo. Name in Archivo Black 11px below the image.
  Price (Space Mono 12px bold) and a black 22×22px "+" quick-add square button on
  the same row.
- **Bottom nav**: sticky black bar, two items "HOME" / "CART" (Space Mono 11px bold
  white, active tab shown in green with a 2px green top border). Cart shows a
  green count badge when non-empty.

### 3. Product Detail
- Back row "← BACK" (Space Mono 12px bold black), striped placeholder image (190px,
  2px black border), category label (Space Mono 11px, green, uppercase, bold),
  product name (Archivo Black 22px), price (Space Mono 16px bold), description
  (Space Mono 12px, 1.6 line-height, #444).
- Quantity stepper: two 32×32px bordered square buttons (–/+) flanking the number.
- "ADD TO CART — £{total}" button: solid black bg, white text, full width, same
  button treatment as Install screen buttons (no shadow, 4px border, uppercase
  Archivo Black 17/900).

### 4. Cart & Checkout
- Title "YOUR CART" (Archivo Black 24px).
- Line items: 42×42px striped thumbnail, name (Archivo Black 12px), qty×price
  (Space Mono 11px, #555), "×" remove control, 2px black bottom border per row.
- Subtotal row: bold, space-between, Archivo Black 14px.
- Delivery section: "DELIVERY WINDOW" eyebrow label (Space Mono 11px, letter-spacing
  0.1em), 3 time-slot chips (same chip styling as category chips), then a
  "CABIN NAME" text input (2px black border, Space Mono 12px, 13px padding).
- "PAY WITH CARD — £{total}" button: solid green bg, black text, same bold button
  treatment. Caption below: "SECURE CHECKOUT — STRIPE" (Space Mono 10px, #777).
- Empty state: "YOUR CART IS EMPTY" message + black "BROWSE SHOP" button back to Home.

### 5. Order Confirmation
- Centered: a 54×54px green square with a 2px black border containing a simple
  two-bar checkmark (two short black bars rotated ±45°), "ORDER CONFIRMED"
  (Archivo Black 21px), "ORDER #{number} — CABIN {name} · {time window}" (Space
  Mono 11px, #555).
- 4-step status row (RECEIVED / PREPARING / ON THE WAY / DELIVERED): each a 14px
  dot (filled black + black border for completed/current steps, white fill + grey
  border for pending) with a Space Mono 9px label underneath.
- "BACK TO SHOP" button (black, full width) returns to Home and clears the cart.

## Interactions & Behavior
- Navigation is a simple single-active-screen state machine: `install → home →
  product → cart → confirm`, plus `cart → home` (Browse Shop / empty state) and
  `confirm → home` (Back to Shop, which also clears cart state).
- Quick-add (+) on a product card and the Add to Cart button both increment a
  cart quantity map keyed by product id.
- Selecting a delivery time slot and typing a cabin name are local form state,
  attached to the order at checkout.
- No hover states are used (mobile-first, touch target sizes ≥44px on all
  tappable controls — chips, +/- steppers, nav items, buttons all meet this).

## State Management
Minimal client state needed:
- `screen`: current view enum
- `activeCategory`: string | null
- `selectedProductId`: string | null
- `cart`: `{ [productId]: quantity }`
- `qty`: pending quantity on the product detail screen
- `cabinName`: string
- `deliverySlot`: index | null
- `orderNumber`: generated on checkout (real implementation: returned by backend)

For a real app, cart contents should persist to `localStorage` (guests may close
the browser/tab mid-session) and be cleared only after a confirmed order.

## Design Tokens
- **Ink (primary)**: `#0A0A0A`
- **Paper (background)**: `oklch(0.965 0.004 235)` (cool-toned near-white)
- **Accent (green, "natural" signal color)**: `oklch(0.64 0.18 142)`
- **Muted text**: `#444` / `#555` / `#777` / `#999` depending on context
- **Display font**: Archivo Black (headlines, product names, buttons) — Google Fonts
- **Mono font**: Space Mono, weights 400/700 (labels, prices, meta, body copy) — Google Fonts
- **Corners**: none anywhere (0 border-radius) — hard edges throughout
- **Borders**: 2px solid black (cards, chips, inputs), 3–4px solid black (buttons)
- **Buttons**: no drop shadow (removed per client feedback), `appearance: none`
  reset is required — native button chrome will override custom background/border
  in some browsers unless explicitly reset.
- **Currency**: GBP, formatted `£0.00`

## Assets
No real photography is used yet — all product/category imagery is a diagonal
striped placeholder (CSS `repeating-linear-gradient`, black/green/paper). Before
launch, replace these with real product photos (square or 4:3, consistent
lighting/background recommended for a cohesive grid).

## PWA Setup (for the developer)
1. **manifest.json** and **service-worker.js** stubs are included in this folder
   (`manifest.json`, `service-worker.js`). Wire up:
   - `<link rel="manifest" href="/manifest.json">` in the document head
   - `navigator.serviceWorker.register('/service-worker.js')` on load
   - Generate real icon PNGs (192×192, 512×512, maskable variant) from the PURE
     wordmark/lockup — placeholders are not included.
2. Must be served over HTTPS (all of the free hosts below provide this by default).
3. Free static hosting options: Cloudflare Pages, Vercel, Netlify — any of these
   also provide free serverless functions, needed for step 2 below.

## Backend / Stripe Setup (for the developer)
The cart + delivery-details flow (multiple line items, cabin name, delivery
window) needs a **Stripe Checkout Session created server-side** — Payment Links
alone can't carry a dynamic multi-item cart or custom fields. Recommended
architecture (all free-tier friendly):

1. **`server/create-checkout-session.js`** (included, stub) — a serverless
   function (Cloudflare Worker / Vercel or Netlify function) that:
   - Receives `{ items: [{id, qty}], cabinName, deliverySlot }` from the client
   - Looks up real prices server-side (never trust client-sent prices)
   - Creates a Stripe Checkout Session with `line_items`, and passes cabin name /
     delivery slot as `metadata`
   - Returns the session URL; client redirects the browser to it
2. **`server/stripe-webhook.js`** (included, stub) — verifies the Stripe webhook
   signature on `checkout.session.completed`, then marks the order paid and
   triggers a notification (email/Slack/Sheets webhook) so someone preps the
   delivery.
3. **Order status / tracking** (the 4-step stepper on the confirmation screen)
   needs simple persistence — a free key-value store (Cloudflare KV, or a
   Supabase/Firebase free tier) keyed by order id, updated manually or via a
   small admin view as the order moves through Received → Preparing → On the
   way → Delivered.
4. Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` as environment
   secrets on the hosting platform — never in client code.

## Files
- `design/PURE Cabin Shop.dc.html` — top-level canvas showing both explored
  directions (open in a browser to interact with the live prototypes)
- `design/ShopPhoneBrutalist.dc.html` — **final direction**, all 5 screens
- `design/ShopPhone.dc.html` — earlier warm/cool/earthy exploration (reference only)
- `design/ios-frame.jsx` — device-bezel helper used only inside the design tool;
  do not carry this into production
- `manifest.json` — PWA manifest stub
- `service-worker.js` — offline-shell service worker stub
- `server/create-checkout-session.js` — Stripe Checkout session creation stub
- `server/stripe-webhook.js` — Stripe webhook handler stub
