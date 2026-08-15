/**
 * dom-stub.js - Stub de navegador para ejecutar el Game headless (Node).
 * Solo para el harness de simulación (test/headless-campaign.mjs).
 */

const store = new Map();

const fakeStorage = {
  get length() {
    return store.size;
  },
  getItem(key) {
    return store.has(key) ? store.get(key) : null;
  },
  setItem(key, value) {
    store.set(String(key), String(value));
  },
  removeItem(key) {
    store.delete(String(key));
  },
  clear() {
    store.clear();
  },
  key(index) {
    return [...store.keys()][index] ?? null;
  }
};

const fakeCtx = new Proxy(
  {},
  {
    get(target, prop) {
      if (prop === "canvas") return fakeCanvas;
      if (typeof prop === "symbol") return undefined;
      if (!(prop in target)) target[prop] = () => undefined;
      return target[prop];
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    }
  }
);

function fakeElement() {
  return {
    style: {},
    dataset: {},
    children: [],
    parentElement: null,
    id: "",
    classList: {
      add() {},
      remove() {},
      toggle() {},
      contains() {
        return false;
      }
    },
    addEventListener() {},
    removeEventListener() {},
    appendChild() {},
    append() {},
    remove() {},
    insertBefore() {},
    querySelector() {
      return fakeElement();
    },
    querySelectorAll() {
      return [];
    },
    getContext() {
      return fakeCtx;
    },
    getBoundingClientRect() {
      return { width: 640, height: 384, left: 0, top: 0 };
    },
    focus() {},
    blur() {},
    click() {},
    set innerHTML(v) {},
    get innerHTML() {
      return "";
    },
    set textContent(v) {},
    get textContent() {
      return "";
    },
    set value(v) {},
    get value() {
      return "";
    },
    set checked(v) {},
    get checked() {
      return false;
    },
    set disabled(v) {},
    get disabled() {
      return false;
    }
  };
}

const fakeCanvas = fakeElement();

globalThis.window = globalThis;
window.__NO_AUTOSTART__ = true;
window.addEventListener = () => {};
window.removeEventListener = () => {};
window.localStorage = fakeStorage;
globalThis.localStorage = fakeStorage;

globalThis.document = {
  getElementById() {
    return fakeElement();
  },
  createElement() {
    return fakeElement();
  },
  querySelector() {
    return fakeElement();
  },
  querySelectorAll() {
    return [];
  },
  addEventListener() {},
  hidden: false,
  body: fakeElement()
};

globalThis.cancelAnimationFrame = () => {};
globalThis.requestAnimationFrame = () => 0;
