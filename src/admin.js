import './style.css';

const PW_KEY = 'pure_admin_pw_v1';
const app = document.getElementById('admin-app');

const state = {
  authed: false,
  password: sessionStorage.getItem(PW_KEY) || '',
  products: [],
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
  return `
    <div class="admin-row" data-id="${escapeHtml(id)}">
      ${id ? `<div class="admin-row-id">ID: ${escapeHtml(id)}</div>` : `<div class="admin-row-id">NEW PRODUCT — ID assigned on save</div>`}
      <label>CATEGORY<input class="admin-field field-cat" value="${p ? escapeHtml(p.cat) : ''}" /></label>
      <label>NAME<input class="admin-field field-name" value="${p ? escapeHtml(p.name) : ''}" /></label>
      <label>PRICE (£)<input class="admin-field field-price" type="number" step="0.01" min="0" value="${p ? p.price : ''}" /></label>
      <button type="button" class="admin-btn admin-btn--danger row-delete" title="Delete">×</button>
      <label class="desc-field">DESCRIPTION<textarea class="admin-field field-desc">${p ? escapeHtml(p.desc) : ''}</textarea></label>
    </div>
  `;
}

function renderApp() {
  app.innerHTML = `
    <div class="admin-header">
      <div class="admin-title">PURE — PRODUCT ADMIN</div>
      <button id="logoutBtn" class="admin-btn">LOG OUT</button>
    </div>
    ${state.banner ? `<div class="admin-banner ${state.banner.type === 'error' ? 'admin-banner--error' : 'admin-banner--ok'}">${escapeHtml(state.banner.text)}</div>` : ''}
    <div id="rows" class="admin-table">
      ${state.products.map(rowTemplate).join('')}
    </div>
    <div class="admin-actions">
      <button id="addBtn" class="admin-btn">+ ADD PRODUCT</button>
      <button id="saveBtn" class="admin-btn admin-btn--primary" ${state.saving ? 'disabled' : ''}>${state.saving ? 'SAVING…' : 'SAVE CHANGES'}</button>
    </div>
  `;

  document.getElementById('logoutBtn').addEventListener('click', () => {
    sessionStorage.removeItem(PW_KEY);
    state.authed = false;
    state.password = '';
    state.authError = null;
    renderGate();
  });

  document.getElementById('addBtn').addEventListener('click', () => {
    document.getElementById('rows').insertAdjacentHTML('beforeend', rowTemplate(null));
    bindRowDeletes();
  });

  document.getElementById('saveBtn').addEventListener('click', saveProducts);

  bindRowDeletes();
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

    products.push({ id, cat, name, price, desc });
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
