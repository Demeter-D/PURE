const STORAGE_KEY = 'pure_cart_state_v1';

export function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { cart: {}, cabinName: '' };
    const parsed = JSON.parse(raw);
    return {
      cart: parsed.cart && typeof parsed.cart === 'object' ? parsed.cart : {},
      cabinName: typeof parsed.cabinName === 'string' ? parsed.cabinName : '',
    };
  } catch {
    return { cart: {}, cabinName: '' };
  }
}

export function persist({ cart, cabinName }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ cart, cabinName }));
  } catch {
    /* localStorage unavailable (private mode / quota) — cart just won't survive a reload */
  }
}

export function clearPersisted() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
