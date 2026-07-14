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
  categories: [],
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

function slugify(name, existingIds, fallback = 'item') {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || fallback;
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

function categoryOptions(selectedId) {
  return state.categories.map((c) => `
    <option value="${escapeHtml(c.id)}" ${c.id === selectedId ? 'selected' : ''}>${escapeHtml(c.name)}</option>
  `).join('');
}

function rowTemplate(p, presetCatId) {
  const id = p ? p.id : '';
  const image = p && p.image ? p.image : '';
  const catId = p ? p.catId : (presetCatId || (state.categories[0] ? state.categories[0].id : ''));
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
          <label>CATEGORY<select class="admin-field field-cat">${categoryOptions(catId)}</select></label>
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
  if (state.categories.length === 0) {
    return `<div class="admin-banner admin-banner--error">Add a category first (Categories tab) before adding products.</div>`;
  }

  const groups = state.categories.map((cat) => {
    const rows = state.products.filter((p) => p.catId === cat.id);
    return `
      <div class="admin-group">
        <div class="admin-group-title">${escapeHtml(cat.name)}</div>
        <div class="admin-table" data-cat-group="${escapeHtml(cat.id)}">
          ${rows.map(rowTemplate).join('') || '<div class="admin-group-empty">No products in this category yet.</div>'}
        </div>
      </div>
    `;
  }).join('');

  const knownCatIds = new Set(state.categories.map((c) => c.id));
  const orphaned = state.products.filter((p) => !knownCatIds.has(p.catId));
  const orphanGroup = orphaned.length ? `
    <div class="admin-group">
      <div class="admin-group-title">UNCATEGORISED</div>
      <div class="admin-table" data-cat-group="">${orphaned.map(rowTemplate).join('')}</div>
    </div>
  ` : '';

  return `
    <div id="rows">${groups}${orphanGroup}</div>
    <div class="admin-actions">
      <select id="addCatSelect" class="admin-field" style="max-width: 220px;">${categoryOptions(state.categories[0].id)}</select>
      <button id="addBtn" class="admin-btn">+ ADD PRODUCT</button>
      <button id="saveBtn" class="admin-btn admin-btn--primary" ${state.saving ? 'disabled' : ''}>${state.saving ? 'SAVING…' : 'SAVE CHANGES'}</button>
    </div>
  `;
}

/* ---------------- Categories ---------------- */

function categoryRowTemplate(cat) {
  const id = cat ? cat.id : '';
  return `
    <div class="admin-cat-row" data-id="${escapeHtml(id)}">
      <div class="admin-cat-move">
        <button type="button" class="admin-btn cat-move-up" title="Move up">▲</button>
        <button type="button" class="admin-btn cat-move-down" title="Move down">▼</button>
      </div>
      <input class="admin-field field-cat-name" value="${cat ? escapeHtml(cat.name) : ''}" placeholder="CATEGORY NAME" />
      <button type="button" class="admin-btn admin-btn--danger cat-delete" title="Delete">×</button>
    </div>
  `;
}

function renderCategoriesPanel() {
  return `
    <div id="catRows" class="admin-table">
      ${state.categories.map(categoryRowTemplate).join('')}
    </div>
    <div class="admin-actions">
      <button id="addCatBtn" class="admin-btn">+ ADD CATEGORY</button>
      <button id="saveCatBtn" class="admin-btn admin-btn--primary" ${state.saving ? 'disabled' : ''}>${state.saving ? 'SAVING…' : 'SAVE CATEGORIES'}</button>
    </div>
  `;
}

function bindCategoryDeletes() {
  document.querySelectorAll('.cat-delete').forEach((btn) => {
    btn.onclick = () => {
      const row = btn.closest('.admin-cat-row');
      const id = row.dataset.id;
      if (id) {
        const inUse = state.products.filter((p) => p.catId === id).length;
        if (inUse > 0) {
          window.alert(`${inUse} product${inUse === 1 ? '' : 's'} still use this category. Reassign them in the Products tab first.`);
          return;
        }
        if (!window.confirm('Delete this category?')) return;
      }
      row.remove();
    };
  });
}

function updateCategoryMoveButtons() {
  const rows = Array.from(document.querySelectorAll('.admin-cat-row'));
  rows.forEach((row, i) => {
    row.querySelector('.cat-move-up').disabled = i === 0;
    row.querySelector('.cat-move-down').disabled = i === rows.length - 1;
  });
}

function bindCategoryMoves() {
  document.querySelectorAll('.cat-move-up').forEach((btn) => {
    btn.onclick = () => {
      const row = btn.closest('.admin-cat-row');
      const prev = row.previousElementSibling;
      if (prev) row.parentElement.insertBefore(row, prev);
      updateCategoryMoveButtons();
    };
  });
  document.querySelectorAll('.cat-move-down').forEach((btn) => {
    btn.onclick = () => {
      const row = btn.closest('.admin-cat-row');
      const next = row.nextElementSibling;
      if (next) row.parentElement.insertBefore(next, row);
      updateCategoryMoveButtons();
    };
  });
  updateCategoryMoveButtons();
}

function collectCategoriesFromDom() {
  const rows = Array.from(document.querySelectorAll('.admin-cat-row'));
  const existingIds = new Set(rows.map((r) => r.dataset.id).filter(Boolean));
  const categories = [];
  const seenNames = new Set();

  for (const row of rows) {
    const name = row.querySelector('.field-cat-name').value.trim();
    if (!name) continue; // ignore blank/untouched new rows

    const key = name.toLowerCase();
    if (seenNames.has(key)) throw new Error(`Category "${name}" is listed twice.`);
    seenNames.add(key);

    let id = row.dataset.id;
    if (!id) {
      id = slugify(name, existingIds, 'category');
      existingIds.add(id);
      row.dataset.id = id;
    }
    categories.push({ id, name });
  }

  if (categories.length === 0) throw new Error('Add at least one category.');
  return categories;
}

async function saveCategories() {
  state.banner = null;
  let categories;
  try {
    categories = collectCategoriesFromDom();
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
      body: JSON.stringify({ categories, products: state.products }),
    });
    state.categories = categories;
    state.saving = false;
    state.banner = { type: 'ok', text: 'Saved. Categories are live on the shop now.' };
    renderApp();
  } catch (err) {
    state.saving = false;
    state.banner = { type: 'error', text: err.message || 'Could not save categories.' };
    renderApp();
  }
}

/* ---------------- Orders ---------------- */

function formatOrderTime(ts) {
  if (!ts) return '—';
  return new Date(ts)
    .toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
    .toUpperCase();
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
      <div class="admin-order-meta">${escapeHtml(formatOrderTime(order.createdAt))}</div>
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

/* ---------------- Shell ---------------- */

function renderApp() {
  app.innerHTML = `
    <div class="admin-header">
      <div class="admin-title">PURE — ADMIN</div>
      <button id="logoutBtn" class="admin-btn">LOG OUT</button>
    </div>
    <div class="admin-tabs">
      <button class="admin-btn ${state.tab === 'products' ? 'admin-btn--primary' : ''}" data-tab="products">PRODUCTS</button>
      <button class="admin-btn ${state.tab === 'categories' ? 'admin-btn--primary' : ''}" data-tab="categories">CATEGORIES</button>
      <button class="admin-btn ${state.tab === 'orders' ? 'admin-btn--primary' : ''}" data-tab="orders">ORDERS</button>
    </div>
    ${state.banner ? `<div class="admin-banner ${state.banner.type === 'error' ? 'admin-banner--error' : 'admin-banner--ok'}">${escapeHtml(state.banner.text)}</div>` : ''}
    ${state.tab === 'products' ? renderProductsPanel() : state.tab === 'categories' ? renderCategoriesPanel() : renderOrdersPanel()}
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
    const addBtn = document.getElementById('addBtn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        const catId = document.getElementById('addCatSelect').value;
        const container = document.querySelector(`#rows [data-cat-group="${CSS.escape(catId)}"]`) || document.getElementById('rows');
        const emptyNotice = container.querySelector('.admin-group-empty');
        if (emptyNotice) emptyNotice.remove();
        container.insertAdjacentHTML('beforeend', rowTemplate(null, catId));
        bindRowDeletes();
        bindRowPhotoInputs();
        const rows = container.querySelectorAll('.admin-row');
        const newRow = rows[rows.length - 1];
        newRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        newRow.querySelector('.field-name')?.focus();
      });
    }
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveProducts);
    bindRowDeletes();
    bindRowPhotoInputs();
  } else if (state.tab === 'categories') {
    document.getElementById('addCatBtn').addEventListener('click', () => {
      document.getElementById('catRows').insertAdjacentHTML('beforeend', categoryRowTemplate(null));
      bindCategoryDeletes();
      bindCategoryMoves();
    });
    document.getElementById('saveCatBtn').addEventListener('click', saveCategories);
    bindCategoryDeletes();
    bindCategoryMoves();
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
    const catId = row.querySelector('.field-cat').value;
    const name = row.querySelector('.field-name').value.trim();
    const priceRaw = row.querySelector('.field-price').value;
    const desc = row.querySelector('.field-desc').value.trim();

    if (!name && priceRaw === '' && !desc) continue; // ignore untouched blank row

    if (!catId || !name || priceRaw === '') {
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

    products.push({ id, catId, name, price, desc, image });
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
      body: JSON.stringify({ categories: state.categories, products }),
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
  const data = await adminFetch('/api/admin/products');
  state.categories = data.categories || [];
  state.products = data.products || [];
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
