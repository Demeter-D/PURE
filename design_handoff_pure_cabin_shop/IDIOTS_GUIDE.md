# The Idiot's Guide to Getting PURE Live

No coding background needed for most of this — you're mostly clicking buttons on
websites. The one part that needs an actual developer (or a few hours with an AI
coding assistant like Claude Code) is turning the design into a real working app —
that's marked clearly below.

## Step 0 — What you'll end up with
A real website address (e.g. `pure-cabin-shop.pages.dev` or your own domain) that
guests can open on their phone, "Add to Home Screen," browse, and pay with a card.
Free to run at small scale.

## Step 1 — Get a developer to build the real app (1–2 days of work)
The files in this folder are a **design**, not the finished app. Hand this whole
`design_handoff_pure_cabin_shop` folder to a developer (or to Claude Code) and ask
them to build it as a real small web app, following the README.md instructions.
This step turns the pretty mockup into something that actually saves carts,
talks to Stripe, and remembers orders.

## Step 2 — Create a free Stripe account
1. Go to stripe.com → Sign up.
2. Verify your business details (they'll ask for bank details so you can get paid out).
3. In the Stripe Dashboard, go to **Developers → API keys**. You'll get a
   "Publishable key" and a "Secret key" — give both to your developer. Never post
   the Secret key publicly.
4. Once the app is built, go to **Developers → Webhooks**, add an endpoint
   pointing at your deployed site (your developer will give you the exact URL,
   something like `https://yoursite.com/api/stripe-webhook`), and subscribe it to
   the `checkout.session.completed` event.

## Step 3 — Pick a free host and connect it to your code
Your developer will put the finished app in a code repository (on GitHub, for
example). Then:
1. Go to **pages.cloudflare.com** (or vercel.com, or netlify.com — any works).
2. Sign up, click "Create a project," and connect your GitHub repository.
3. Click Deploy. Within a minute or two you'll get a live URL.
4. (Optional) Add your own domain under the project's "Custom Domains" settings —
   most cabin/rental businesses already own a domain; point it here.

## Step 4 — Add your Stripe keys to the host
Every host above has a place for "Environment Variables" or "Secrets" in the
project settings. Add:
- `STRIPE_SECRET_KEY` → the Secret key from Step 2
- `STRIPE_WEBHOOK_SECRET` → shown when you create the webhook in Step 2
Save, then redeploy (usually a button in the same dashboard).

## Step 5 — Test it for real
1. Open your live URL on your phone.
2. Add PURE to your home screen (Share → Add to Home Screen on iPhone, or the
   install prompt on Android).
3. Add a few things to the cart, enter a cabin name, and pay using Stripe's test
   card number `4242 4242 4242 4242`, any future expiry date, any 3-digit CVC.
4. Confirm you see the order appear in your Stripe Dashboard under Payments.

## Step 6 — Go live for real money
In the Stripe Dashboard, flip the toggle from "Test mode" to "Live mode" (top
right), grab your **live** API keys, and swap them into your host's environment
variables from Step 4. That's it — real guests can now pay with real cards.

## Ongoing: fulfilling orders
Right now, "someone" needs to see a new order and go prep the delivery. Cheapest
way to start: have new orders email or Slack-message you (your developer sets
this up as part of Step 1) and just do it manually. You can add a proper staff
dashboard later once you know the shop gets real use.

## If you get stuck
Anywhere you see "your developer" above, you can also paste this whole folder
into Claude Code (Anthropic's coding tool) and ask it to implement the README
and wire up the steps above — it can write the app, the Stripe integration, and
walk you through deployment interactively.
