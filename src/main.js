import './style.css';
import { loadProducts, getProducts, findProduct, categories } from './products.js';
import { loadPersisted, persist, clearPersisted } from './cart.js';

const INTRO_SEEN_KEY = 'pure_intro_seen_v1';

const persisted = loadPersisted();

const state = {
  screen: localStorage.getItem(INTRO_SEEN_KEY) ? 'home' : 'install',
  activeCat: null,
  selectedId: null,
  cart: persisted.cart,
  qty: 1,
  cabinName: persisted.cabinName,
  deliverySlot: null,
  orderNumber: null,
  orderMeta: null,
  loading: false,
  error: null,
  cabinModalOpen: false,
};

let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
});

const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone =
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

function showToast(text, ms = 4500) {
  document.querySelectorAll('.toast').forEach((el) => el.remove());
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

const app = document.getElementById('app');

const money = (n) => `£${n.toFixed(2)}`;

const escapeHtml = (str) =>
  String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

function cartEntries() {
  return Object.entries(state.cart).filter(([, q]) => q > 0);
}

function cartCount() {
  return cartEntries().reduce((sum, [, q]) => sum + q, 0);
}

function cartSubtotal() {
  return cartEntries().reduce((sum, [id, q]) => sum + q * findProduct(id).price, 0);
}

function savePersisted() {
  persist({ cart: state.cart, cabinName: state.cabinName });
}

function setState(patch) {
  Object.assign(state, typeof patch === 'function' ? patch(state) : patch);
  render();
}

function go(screen) {
  setState({ screen });
}

const TIME_SLOTS = ['4–5 PM', '5–6 PM', '6–7 PM'];
const STATUS_STEPS = ['RECEIVED', 'PREPARING', 'ON THE WAY', 'DELIVERED'];

/* ---------------- Screens ---------------- */

function renderInstall() {
  return `
    <div class="screen screen--dark install-wrap">
      <div class="wordmark-big">PURE</div>
      <div class="mono-tag">ALL NATURAL</div>
      <div class="install-benefits">
        <div class="install-benefit"><div class="sq-bullet"></div><div class="benefit-text">ORDER SNACKS, DRINKS &amp; SUPPLIES TO YOUR CABIN</div></div>
        <div class="install-benefit"><div class="sq-bullet"></div><div class="benefit-text">TRACK YOUR ORDER IN REAL TIME</div></div>
        <div class="install-benefit"><div class="sq-bullet"></div><div class="benefit-text">SECURE CHECKOUT — STRIPE</div></div>
      </div>
      <button class="btn btn--green" data-action="install">INSTALL APP</button>
      <button class="btn btn--ghost" data-action="continue-browser">CONTINUE IN BROWSER</button>
    </div>
  `;
}

function renderHome() {
  const cats = categories();
  const products = getProducts();
  const shown = state.activeCat ? products.filter((p) => p.cat === state.activeCat) : products.slice(0, 6);
  const sectionTitle = state.activeCat || 'POPULAR PICKS';
  const count = cartCount();

  const chips = cats.map((name, i) => `
    <div class="chip ${state.activeCat === name ? 'chip--active' : ''}" data-action="filter-cat" data-cat="${escapeHtml(name)}">${escapeHtml(name)}</div>
  `).join('');

  const cards = shown.map((p, i) => `
    <div class="product-card" data-action="open-product" data-id="${p.id}">
      <div class="product-img ${p.image ? '' : (i % 2 === 0 ? 'stripe-a' : 'stripe-b')}">${p.image ? `<img src="${escapeHtml(p.image)}" alt="" loading="lazy" />` : ''}</div>
      <div class="product-name">${escapeHtml(p.name)}</div>
      <div class="product-row">
        <div class="product-price">${money(p.price)}</div>
        <button class="quick-add" data-action="quick-add" data-id="${p.id}">+</button>
      </div>
    </div>
  `).join('');

  return `
    <div class="screen screen--light">
      <div class="top-bar">
        <div class="wordmark">PURE</div>
        <button class="cabin-tag" data-action="open-cabin-modal">${state.cabinName ? 'CABIN ' + escapeHtml(state.cabinName) : 'SET CABIN →'}</button>
      </div>
      <div class="home-body">
        <div class="eyebrow">CATEGORIES</div>
        <div class="chip-row">${chips}</div>
        <div class="section-title">${escapeHtml(sectionTitle)}</div>
        <div class="product-grid">${cards}</div>
      </div>
      <div class="bottom-nav">
        <div class="nav-item nav-item--active" data-action="go-home">HOME</div>
        <div class="nav-item" data-action="go-cart">CART${count > 0 ? `<span class="cart-badge">${count}</span>` : ''}</div>
      </div>
    </div>
  `;
}

function renderProduct() {
  const p = findProduct(state.selectedId) || getProducts()[0];
  return `
    <div class="screen screen--light product-detail">
      <div class="panel">
        <button class="back-row" data-action="go-home">← BACK</button>
        <div class="product-hero ${p.image ? '' : 'stripe-b'}">${p.image ? `<img src="${escapeHtml(p.image)}" alt="" />` : ''}</div>
        <div class="cat-label">${escapeHtml(p.cat)}</div>
        <div class="product-title">${escapeHtml(p.name)}</div>
        <div class="product-detail-price">${money(p.price)}</div>
        <div class="product-desc">${escapeHtml(p.desc)}</div>
        <div class="qty-row">
          <button class="qty-btn" data-action="dec-qty">–</button>
          <div class="qty-val">${state.qty}</div>
          <button class="qty-btn" data-action="inc-qty">+</button>
        </div>
        <button class="btn btn--black" data-action="add-to-cart" data-id="${p.id}">ADD TO CART — ${money(p.price * state.qty)}</button>
      </div>
    </div>
  `;
}

function renderCart() {
  const entries = cartEntries();
  const count = cartCount();

  if (entries.length === 0) {
    return `
      <div class="screen screen--light">
        <div class="panel">
          <div class="cart-title">YOUR CART</div>
          <div class="empty-cart">YOUR CART IS EMPTY</div>
          <button class="btn btn--black empty-cart-btn" data-action="go-home">BROWSE SHOP</button>
        </div>
        <div class="bottom-nav">
          <div class="nav-item" data-action="go-home">HOME</div>
          <div class="nav-item nav-item--active" data-action="go-cart">CART</div>
        </div>
      </div>
    `;
  }

  const rows = entries.map(([id, q], i) => {
    const p = findProduct(id);
    return `
      <div class="cart-row">
        <div class="cart-thumb ${p.image ? '' : (i % 2 === 0 ? 'stripe-a' : 'stripe-b')}">${p.image ? `<img src="${escapeHtml(p.image)}" alt="" />` : ''}</div>
        <div style="flex:1;">
          <div class="cart-item-name">${escapeHtml(p.name)}</div>
          <div class="cart-item-line">${q} × ${money(p.price)}</div>
        </div>
        <button class="remove-x" data-action="remove-item" data-id="${id}">×</button>
      </div>
    `;
  }).join('');

  const slots = TIME_SLOTS.map((label, i) => `
    <div class="chip ${state.deliverySlot === i ? 'chip--active' : ''}" data-action="select-slot" data-idx="${i}">${label}</div>
  `).join('');

  const subtotal = cartSubtotal();

  return `
    <div class="screen screen--light">
      <div class="panel">
        <div class="cart-title">YOUR CART</div>
        <div class="cart-list">${rows}</div>
        <div class="subtotal-row"><div>SUBTOTAL</div><div>${money(subtotal)}</div></div>
        <div class="delivery-section">
          <div class="eyebrow">DELIVERY WINDOW</div>
          <div class="time-slots">${slots}</div>
          <input id="cabinInput" class="cabin-input" placeholder="CABIN NAME" value="${escapeHtml(state.cabinName)}" />
        </div>
        <div class="cart-actions">
          <button class="btn btn--green" data-action="checkout" ${state.loading ? 'disabled' : ''}>${state.loading ? 'REDIRECTING…' : `PAY WITH CARD — ${money(subtotal)}`}</button>
          <div class="stripe-caption">SECURE CHECKOUT — STRIPE</div>
          ${state.error ? `<div class="form-error">${escapeHtml(state.error)}</div>` : ''}
        </div>
      </div>
      <div class="bottom-nav">
        <div class="nav-item" data-action="go-home">HOME</div>
        <div class="nav-item nav-item--active" data-action="go-cart">CART${count > 0 ? `<span class="cart-badge">${count}</span>` : ''}</div>
      </div>
    </div>
  `;
}

function renderConfirm() {
  const meta = state.orderMeta || {};
  const deliverySummary = `CABIN ${escapeHtml(meta.cabinName || state.cabinName || '—')} · ${meta.deliverySlot || 'WINDOW PENDING'}`;
  const steps = STATUS_STEPS.map((label, i) => `
    <div class="status-step">
      <div class="status-dot ${i <= 1 ? 'status-dot--done' : ''}"></div>
      <div class="status-label ${i <= 1 ? 'status-label--done' : ''}">${label}</div>
    </div>
  `).join('');

  return `
    <div class="screen screen--light confirm">
      <div class="panel">
        <div class="confirm-wrap">
          <div class="check-box">
            <div class="check-bar check-bar--short"></div>
            <div class="check-bar check-bar--long"></div>
          </div>
          <div class="confirm-title">ORDER CONFIRMED</div>
          <div class="confirm-meta">ORDER #${escapeHtml(state.orderNumber || '—')} — ${deliverySummary}</div>
        </div>
        <div class="status-row">${steps}</div>
        <button class="btn btn--black" data-action="back-to-shop">BACK TO SHOP</button>
      </div>
    </div>
  `;
}

function renderCabinModal() {
  if (!state.cabinModalOpen) return '';
  return `
    <div class="modal-overlay" data-action="close-cabin-modal">
      <div class="modal-box">
        <div class="modal-title">SET CABIN NAME</div>
        <input id="cabinModalInput" class="cabin-input" placeholder="CABIN NAME" value="${escapeHtml(state.cabinName)}" />
        <div class="modal-actions">
          <button class="btn btn--black" data-action="save-cabin-modal">SAVE</button>
        </div>
      </div>
    </div>
  `;
}

function render() {
  let screenHtml;
  switch (state.screen) {
    case 'install': screenHtml = renderInstall(); break;
    case 'product': screenHtml = renderProduct(); break;
    case 'cart': screenHtml = renderCart(); break;
    case 'confirm': screenHtml = renderConfirm(); break;
    case 'home':
    default: screenHtml = renderHome(); break;
  }
  app.innerHTML = screenHtml + renderCabinModal();

  if (state.screen === 'cart') {
    const input = document.getElementById('cabinInput');
    if (input) {
      input.addEventListener('input', (e) => {
        state.cabinName = e.target.value;
        savePersisted();
      });
    }
  }

  if (state.cabinModalOpen) {
    const modalInput = document.getElementById('cabinModalInput');
    if (modalInput) {
      modalInput.focus();
      modalInput.select();
    }
  }
}

/* ---------------- Actions ---------------- */

async function startCheckout() {
  const entries = cartEntries();
  const cabinInput = document.getElementById('cabinInput');
  const cabinName = (cabinInput ? cabinInput.value : state.cabinName).trim();
  state.cabinName = cabinName;
  savePersisted();

  if (!cabinName) {
    setState({ error: 'Enter a cabin name before checking out.' });
    return;
  }
  if (state.deliverySlot === null) {
    setState({ error: 'Pick a delivery window before checking out.' });
    return;
  }

  setState({ loading: true, error: null });

  try {
    const res = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: entries.map(([id, qty]) => ({ id, qty })),
        cabinName,
        deliverySlot: TIME_SLOTS[state.deliverySlot],
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.url) {
      throw new Error(data.error || 'Could not start checkout');
    }
    window.location.href = data.url;
  } catch (err) {
    setState({ loading: false, error: err.message || 'Something went wrong. Try again.' });
  }
}

app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;

  switch (action) {
    case 'install': {
      localStorage.setItem(INTRO_SEEN_KEY, '1');
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        deferredInstallPrompt.userChoice.finally(() => { deferredInstallPrompt = null; });
      } else if (!isStandalone) {
        showToast(
          isIOS
            ? 'Tap the Share icon, then "Add to Home Screen".'
            : 'Use your browser’s menu to add this app to your home screen.'
        );
      }
      go('home');
      break;
    }
    case 'continue-browser':
      localStorage.setItem(INTRO_SEEN_KEY, '1');
      go('home');
      break;
    case 'go-home': go('home'); break;
    case 'go-cart': go('cart'); break;
    case 'open-cabin-modal':
      setState({ cabinModalOpen: true });
      break;
    case 'close-cabin-modal':
      if (e.target === el) setState({ cabinModalOpen: false });
      break;
    case 'save-cabin-modal': {
      const modalInput = document.getElementById('cabinModalInput');
      state.cabinName = modalInput ? modalInput.value.trim() : state.cabinName;
      savePersisted();
      setState({ cabinModalOpen: false });
      break;
    }
    case 'filter-cat':
      setState({ activeCat: state.activeCat === el.dataset.cat ? null : el.dataset.cat });
      break;
    case 'open-product':
      setState({ selectedId: el.dataset.id, screen: 'product', qty: 1 });
      break;
    case 'quick-add':
      e.stopPropagation();
      state.cart[el.dataset.id] = (state.cart[el.dataset.id] || 0) + 1;
      savePersisted();
      render();
      break;
    case 'dec-qty':
      setState({ qty: Math.max(1, state.qty - 1) });
      break;
    case 'inc-qty':
      setState({ qty: state.qty + 1 });
      break;
    case 'add-to-cart': {
      const id = el.dataset.id;
      state.cart[id] = (state.cart[id] || 0) + state.qty;
      savePersisted();
      setState({ screen: 'home' });
      break;
    }
    case 'remove-item': {
      const c = { ...state.cart };
      delete c[el.dataset.id];
      state.cart = c;
      savePersisted();
      render();
      break;
    }
    case 'select-slot':
      setState({ deliverySlot: Number(el.dataset.idx), error: null });
      break;
    case 'checkout':
      startCheckout();
      break;
    case 'back-to-shop':
      state.cart = {};
      state.deliverySlot = null;
      state.orderNumber = null;
      state.orderMeta = null;
      clearPersisted();
      setState({ screen: 'home', activeCat: null });
      break;
  }
});

/* ---------------- Return from Stripe ---------------- */

async function hydrateFromStripeRedirect() {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('session_id');

  if (params.has('checkout')) {
    window.history.replaceState({}, '', window.location.pathname);
    setState({ screen: 'cart', error: 'Checkout cancelled — your cart is still here.' });
    return true;
  }

  if (!sessionId) return false;

  window.history.replaceState({}, '', window.location.pathname);
  setState({ loading: true });

  try {
    const res = await fetch(`/api/session?session_id=${encodeURIComponent(sessionId)}`);
    const data = await res.json();
    if (!res.ok || !data.paid) throw new Error(data.error || 'Could not verify payment');

    clearPersisted();
    setState({
      loading: false,
      screen: 'confirm',
      cart: {},
      orderNumber: sessionId.slice(-8).toUpperCase(),
      orderMeta: { cabinName: data.cabinName, deliverySlot: data.deliverySlot },
    });
  } catch (err) {
    setState({ loading: false, screen: 'cart', error: err.message || 'Could not verify your payment.' });
  }
  return true;
}

/* ---------------- Boot ---------------- */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {
      /* offline shell is a nice-to-have, not fatal if registration fails */
    });
  });
}

async function boot() {
  try {
    await loadProducts();
  } catch {
    app.innerHTML = `
      <div class="screen screen--light" style="align-items:center;justify-content:center;text-align:center;padding:40px;">
        <div class="empty-cart">COULD NOT LOAD THE SHOP.<br />CHECK YOUR CONNECTION AND RELOAD.</div>
      </div>
    `;
    return;
  }
  const handled = await hydrateFromStripeRedirect();
  if (!handled) render();
}

boot();
