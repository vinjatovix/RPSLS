export const SECRET_SALT = String.fromCharCode(73, 100, 108, 101, 82, 80, 83, 83, 97, 108, 116, 50, 48, 50, 54);

export function fnv1a(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16);
}

export function xorCipher(str, salt) {
  const len = str.length;
  const result = new Array(len);
  for (let i = 0; i < len; i++) {
    const charCode = str.charCodeAt(i) ^ salt.charCodeAt(i % salt.length);
    result[i] = String.fromCharCode(charCode);
  }

  return result.join("");
}

export function safeBtoa(str) {
  if (typeof globalThis.btoa === "function") {
    return globalThis.btoa(str);
  }
  if (typeof Buffer === "function") {
    return Buffer.from(str, "binary").toString("base64");
  }
  throw new Error("No base64 encoding support found.");
}

export function safeAtob(str) {
  if (typeof globalThis.atob === "function") {
    return globalThis.atob(str);
  }
  if (typeof Buffer === "function") {
    return Buffer.from(str, "base64").toString("binary");
  }
  throw new Error("No base64 decoding support found.");
}
