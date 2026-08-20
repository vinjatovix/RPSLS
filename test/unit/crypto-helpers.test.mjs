import assert from "node:assert/strict";
import { test } from "node:test";

import { fnv1a, xorCipher, safeAtob, safeBtoa } from "../../src/storage/cryptoHelpers.js";

test("cryptoHelpers: fnv1a produces deterministic 32-bit hashes", () => {
  const input = "Hello, world!";

  const hash1 = fnv1a(input);
  const hash2 = fnv1a(input);

  assert.equal(hash1, hash2);
  assert.equal(typeof hash1, "string");
});

test("cryptoHelpers: fnv1a produces different hashes for different inputs", () => {
  const hash1 = fnv1a("Hello, world!");
  const hash2 = fnv1a("Hello, World!");

  assert.notEqual(hash1, hash2);
});

test("cryptoHelpers: fnv1a matches known empty string FNV-1a hash", () => {
  const hash = fnv1a("");

  assert.equal(hash, "811c9dc5");
});

test("cryptoHelpers: xorCipher is fully reversible", () => {
  const input = "SecretMessage123!";
  const salt = "MyCustomSaltKey";

  const encrypted = xorCipher(input, salt);
  const decrypted = xorCipher(encrypted, salt);

  assert.notEqual(encrypted, input);
  assert.equal(decrypted, input);
});

test("cryptoHelpers: safeBtoa and safeAtob perform correct base64 operations", () => {
  const original = "RPSLZ-Progress-2026";
  
  const encoded = safeBtoa(original);
  const decoded = safeAtob(encoded);

  assert.equal(encoded, "UlBTTFotUHJvZ3Jlc3MtMjAyNg==");
  assert.equal(decoded, original);
});
