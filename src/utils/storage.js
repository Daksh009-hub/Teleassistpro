// Safe storage helper for browser, PWA, and test runners
const memoryStore = new Map();

export function safeGetItem(key, fallback = null) {
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
      const val = localStorage.getItem(key);
      if (val !== null) return val;
    }
  } catch (e) {}
  return memoryStore.has(key) ? memoryStore.get(key) : fallback;
}

export function safeSetItem(key, val) {
  const strVal = String(val);
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
      localStorage.setItem(key, strVal);
    }
  } catch (e) {}
  memoryStore.set(key, strVal);
}

export function safeRemoveItem(key) {
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.removeItem === 'function') {
      localStorage.removeItem(key);
    }
  } catch (e) {}
  memoryStore.delete(key);
}

export function safeClear() {
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.clear === 'function') {
      localStorage.clear();
    }
  } catch (e) {}
  memoryStore.clear();
}

