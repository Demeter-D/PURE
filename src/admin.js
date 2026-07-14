import './style.css';

const PW_KEY = 'pure_admin_pw_v1';
const app = document.getElementById('admin-app');

const ORDER_STATUSES = [
  { key: 'received', label: 'RECEIVED' },
  { key: 'preparing', label: 'PREPARING' },
  { key: 'on_the_way', label: 'ON THE WAY' },
  { key: 'delivered', label: 'DELIVERED' },
];

const state = {
  authed: false,
  password: sessionStorage.getItem(PW_KEY) || '',
  tab: 'products',
  products: [],
  orders: [],
  ordersLoaded: false,
  ordersLoading: false,
  checkingAuth: true,
  authError: null,
  banner: null,
  saving: false,
};

const escapeHtml = (str) =>
  String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

function slugify(name, existingIds) {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'item';
  let id = base;
  let i = 2;
  while (existingIds.has(id)) {
    id = `${base}-${i}`;
    i += 1;
  }
  return id;
}

async function adminFetch(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      ...(options.headers || {}),
      'X-Admin-Password': state.password,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/* ---------------- Gate screen ---------------- */

function renderGate() {
  app.innerHTML = `
    <div class="admin-gate">
      <div class="wordmark-big">PURE</div>
      <div class="mono-tag" style="color:var(--muted-3);">ADMIN</div>
      <form id="gateForm">
        <input id="pwInput" class="admin-field" type="password" placeholder="ADMIN PASSWORD" autofocus />
        ${state.authError ? `<div class="admin-banner admin-banner--error">${escapeHtml(state.authError)}</div>` : ''}
        <button class="btn btn--black" type="submit">ENTER</button>
      </form>
    </div>
  `;
  document.getElementById('gateForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pw = document.getElementById('pwInput').value;
    state.password = pw;
    state.authError = null;
    try {
      await adminFetch('/api/admin/login', { method: 'POST' });
      sessionStorage.setItem(PW_KEY, pw);
      await loadAndRenderApp();
    } catch (err) {
      state.authError = err.message || 'Incorrect password';
      renderGate();
    }
  });
}

/* ---------------- Product table ---------------- */

function rowTemplate(p) {
  const id = p ? p.id : '';
  const image = p && p.image ? p.image : '';
  return `
    <div class="admin-row" data-id="${escapeHtml(id)}" data-image="${escapeHtml(image)}">
      ${id ? `<div class="admin-row-id">ID: ${escapeHtml(id)}</div>` : `<div class="admin-row-id">NEW PRODUCT — ID assigned on save</div>`}
      <div class="admin-row-body">
        <div class="admin-photo-cell">
          <div class="admin-photo-preview">${image ? `<img src="${escapeHtml(image)}" alt="" />` : ''}</div>
          <input type="file" accept="image/jpeg,image/png,image/webp" class="field-photo-input" />
          <div class="admin-photo-status"></div>
        </div>
        <div class="admin-row-fields">
          <label>CATEGORY<input class="admin-field field-cat" value="${p ? escapeHtml(p.cat) : ''}" /></label>
          <label>NAME<input class="admin-field field-name" value="${p ? escapeHtml(p.name) : ''}" /></label>
          <label>PRICE (£)<input class="admin-field field-price" type="number" step="0.01" min="0" value="${p ? p.price : ''}" /></label>
          <button type="button" class="admin-btn admin-btn--danger row-delete" title="Delete">×</button>
          <label class="desc-field">DESCRIPTION<textarea class="admin-field field-desc">${p ? escapeHtml(p.desc) : ''}</textarea></label>
        </div>
      </div>
    </div>
  `;
}

async function resizeImage(file, maxDim = 1600, quality = 0.82) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read the selected file'));
    reader.readAsDataURL(file);
  });
  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Could not read that image'));
    el.src = dataUrl;
  });
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale) || 1;
  const h = Math.round(img.height * scale) || 1;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not process image'))), 'image/jpeg', quality);
  });
}

async function uploadPhoto(row, file) {
  const statusEl = row.querySelector('.admin-photo-status');
  const input = row.querySelector('.field-photo-input');
  statusEl.textContent = 'Uploading…';
  input.disabled = true;
  try {
    const resized = await resizeImage(file);
    const data = await adminFetch('/api/admin/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'image/jpeg' },
      body: resized,
    });
    row.dataset.image = data.url;
    row.querySelector('.admin-photo-preview').innerHTML = `<img src="${escapeHtml(data.url)}" alt="" />`;
    statusEl.textContent = '';
  } catch (err) {
    statusEl.textContent = err.message || 'Upload failed';
  } finally {
    input.disabled = false;
    input.value = '';
  }
}

function bindRowPhotoInputs() {
  document.querySelectorAll('.field-photo-input').forEach((input) => {
    input.onchange = () => {
      const file = input.files[0];
      if (file) uploadPhoto(input.closest('.admin-row'), file);
    };
  });
}

function renderProductsPanel() {
  return `
    <div id="rows" class="admin-table">
      ${state.products.map(rowTemplate).join('')}
    </div>
    <div class="admin-actions">
      <button id="addBtn" class="admin-btn">+ ADD PRODUCT</button>
      <button id="saveBtn" class="admin-btn admin-btn--primary" ${state.saving ? 'disabled' : ''}>${state.saving ? 'SAVING…' : 'SAVE CHANGES'}</button>
    </div>
  `;
}

function orderCardTemplate(order) {
  const items = (order.items || []).map((i) => `<div>${i.qty} × ${escapeHtml(i.name)}</div>`).join('') || '<div>(no item details)</div>';
  const statusBtns = ORDER_STATUSES.map((s) => `
    <button
      type="button"
      class="admin-status-btn ${order.status === s.key ? 'admin-status-btn--active' : ''}"
      data-order="${escapeHtml(order.orderNumber)}"
      data-status="${s.key}"
    >${s.label}</button>
  `).join('');

  return `
    <div class="admin-order-card">
      <div class="admin-order-head">
        <div class="admin-order-number">#${escapeHtml(order.orderNumber)}</div>
        <div class="admin-order-amount">£${((order.amountTotal || 0) / 100).toFixed(2)}</div>
      </div>
      <div class="admin-order-meta">CABIN ${escapeHtml(order.cabinName || '—')} · ${escapeHtml(order.deliverySlot || '—')}</div>
      <div class="admin-order-items">${items}</div>
      <div class="admin-status-buttons">${statusBtns}</div>
    </div>
  `;
}

function renderOrdersPanel() {
  if (state.ordersLoading) {
    return `<div class="admin-banner">Loading orders…</div>`;
  }
  if (state.orders.length === 0) {
    return `
      <div class="admin-banner">No orders yet.</div>
      <div class="admin-actions"><button id="refreshOrdersBtn" class="admin-btn">REFRESH</button></div>
    `;
  }
  return `
    <div class="admin-actions" style="margin-bottom:16px;"><button id="refreshOrdersBtn" class="admin-btn">REFRESH</button></div>
    <div class="admin-orders">
      ${state.orders.map(orderCardTemplate).join('')}
    </div>
  `;
}

function renderApp() {
  app.innerHTML = `
    <div class="admin-header">
      <div class="admin-title">PURE — ADMIN</div>
      <button id="logoutBtn" class="admin-btn">LOG OUT</button>
    </div>
    <div class="admin-tabs">
      <button class="admin-btn ${state.tab === 'products' ? 'admin-btn--primary' : ''}" data-tab="products">PRODUCTS</button>
      <button class="admin-btn ${state.tab === 'orders' ? 'admin-btn--primary' : ''}" data-tab="orders">ORDERS</button>
    </div>
    ${state.banner ? `<div class="admin-banner ${state.banner.type === 'error' ? 'admin-banner--error' : 'admin-banner--ok'}">${escapeHtml(state.banner.text)}</div>` : ''}
    ${state.tab === 'products' ? renderProductsPanel() : renderOrdersPanel()}
  `;

  document.getElementById('logoutBtn').addEventListener('click', () => {
    sessionStorage.removeItem(PW_KEY);
    state.authed = false;
    state.password = '';
    state.authError = null;
    renderGate();
  });

  document.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.tab = btn.dataset.tab;
      state.banner = null;
      renderApp();
      if (state.tab === 'orders' && !state.ordersLoaded) loadOrders();
    });
  });

  if (state.tab === 'products') {
    document.getElementById('addBtn').addEventListener('click', () => {
      document.getElementById('rows').insertAdjacentHTML('beforeend', rowTemplate(null));
      bindRowDeletes();
      bindRowPhotoInputs();
    });
    document.getElementById('saveBtn').addEventListener('click', saveProducts);
    bindRowDeletes();
    bindRowPhotoInputs();
  } else {
    const refreshBtn = document.getElementById('refreshOrdersBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', loadOrders);
    document.querySelectorAll('.admin-status-btn').forEach((btn) => {
      btn.addEventListener('click', () => setOrderStatus(btn.dataset.order, btn.dataset.status));
    });
  }
}

async function loadOrders() {
  state.ordersLoading = true;
  state.banner = null;
  renderApp();
  try {
    state.orders = await adminFetch('/api/admin/orders');
    state.ordersLoaded = true;
  } catch (err) {
    state.banner = { type: 'error', text: err.message || 'Could not load orders.' };
  }
  state.ordersLoading = false;
  renderApp();
}

async function setOrderStatus(orderNumber, status) {
  try {
    const updated = await adminFetch('/api/admin/orders', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderNumber, status }),
    });
    state.orders = state.orders.map((o) => (o.orderNumber === updated.orderNumber ? updated : o));
    renderApp();
  } catch (err) {
    state.banner = { type: 'error', text: err.message || 'Could not update order status.' };
    renderApp();
  }
}

function bindRowDeletes() {
  document.querySelectorAll('.row-delete').forEach((btn) => {
    btn.onclick = () => {
      const row = btn.closest('.admin-row');
      const id = row.dataset.id;
      if (id && !window.confirm(`Delete "${id}"? This can't be undone once you save.`)) return;
      row.remove();
    };
  });
}

function collectProductsFromDom() {
  const rows = Array.from(document.querySelectorAll('.admin-row'));
  const existingIds = new Set(rows.map((r) => r.dataset.id).filter(Boolean));
  const products = [];

  for (const row of rows) {
    const cat = row.querySelector('.field-cat').value.trim();
    const name = row.querySelector('.field-name').value.trim();
    const priceRaw = row.querySelector('.field-price').value;
    const desc = row.querySelector('.field-desc').value.trim();

    if (!cat && !name && !priceRaw && !desc) continue; // ignore untouched blank row

    if (!cat || !name || priceRaw === '') {
      throw new Error('Every product needs a category, name, and price.');
    }
    const price = Number(priceRaw);
    if (!Number.isFinite(price) || price < 0) {
      throw new Error(`Invalid price for "${name}".`);
    }

    let id = row.dataset.id;
    if (!id) {
      id = slugify(name, existingIds);
      existingIds.add(id);
      row.dataset.id = id;
    }
    const image = row.dataset.image || '';

    products.push({ id, cat, name, price, desc, image });
  }

  if (products.length === 0) throw new Error('Add at least one product.');
  return products;
}

async function saveProducts() {
  state.banner = null;
  let products;
  try {
    products = collectProductsFromDom();
  } catch (err) {
    state.banner = { type: 'error', text: err.message };
    renderApp();
    return;
  }

  state.saving = true;
  renderApp();

  try {
    await adminFetch('/api/admin/products', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products }),
    });
    state.products = products;
    state.saving = false;
    state.banner = { type: 'ok', text: 'Saved. Changes are live on the shop now.' };
    renderApp();
  } catch (err) {
    state.saving = false;
    state.banner = { type: 'error', text: err.message || 'Could not save changes.' };
    renderApp();
  }
}

/* ---------------- Boot ---------------- */

async function loadAndRenderApp() {
  state.authed = true;
  state.products = await adminFetch('/api/admin/products');
  renderApp();
}

async function boot() {
  if (!state.password) {
    renderGate();
    return;
  }
  try {
    await loadAndRenderApp();
  } catch {
    sessionStorage.removeItem(PW_KEY);
    state.password = '';
    state.authError = 'Session expired — enter the password again.';
    renderGate();
  }
}

boot();
