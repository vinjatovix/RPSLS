import { SECRET_SALT, fnv1a, xorCipher, safeBtoa, safeAtob } from "./cryptoHelpers.js";

export class LocalStorageAdapter {
  constructor(key = "game-options-v2") {
    this.defaultKey = key;
  }

  save(data, key = this.defaultKey) {
    if (typeof globalThis.localStorage === "undefined") {
      return;
    }

    const payloadStr = encodeURIComponent(JSON.stringify(data));
    const signature = fnv1a(payloadStr + SECRET_SALT);
    const envelope = {
      payload: payloadStr,
      signature: signature
    };
    const envelopeStr = JSON.stringify(envelope);
    const obfuscated = xorCipher(envelopeStr, SECRET_SALT);
    const base64 = safeBtoa(obfuscated);

    globalThis.localStorage.setItem(key, base64);
  }

  load(key = this.defaultKey) {
    if (typeof globalThis.localStorage === "undefined") {
      return null;
    }

    const data = globalThis.localStorage.getItem(key);
    if (!data) {
      return null;
    }

    const decoded = safeAtob(data);
    const envelopeStr = xorCipher(decoded, SECRET_SALT);
    const envelope = JSON.parse(envelopeStr);

    if (!envelope || typeof envelope !== "object" || !envelope.payload) {
      throw new Error(`Invalid envelope format for key: ${key}`);
    }

    const expectedSignature = fnv1a(envelope.payload + SECRET_SALT);
    if (envelope.signature !== expectedSignature) {
      throw new Error(`Signature verification failed for key: ${key}`);
    }

    return JSON.parse(decodeURIComponent(envelope.payload));
  }

  clear(key = this.defaultKey) {
    if (typeof globalThis.localStorage === "undefined") {
      return;
    }

    globalThis.localStorage.removeItem(key);
  }

  exportSave() {
    const activeGameState = this.load("active-game-state");
    const gameProgress = this.load("game-progress");

    const bundle = {
      activeGameState,
      gameProgress
    };

    const payloadStr = encodeURIComponent(JSON.stringify(bundle));
    const signature = fnv1a(payloadStr + SECRET_SALT);
    const envelope = {
      payload: payloadStr,
      signature: signature
    };

    const envelopeStr = JSON.stringify(envelope);
    const obfuscated = xorCipher(envelopeStr, SECRET_SALT);
    const base64 = safeBtoa(obfuscated);

    return base64;
  }

  importSave(fileContent) {
    if (!fileContent) {
      throw new Error("No file content provided");
    }
    const decoded = safeAtob(fileContent);
    const envelopeStr = xorCipher(decoded, SECRET_SALT);
    const envelope = JSON.parse(envelopeStr);

    if (!envelope || typeof envelope !== "object" || !envelope.payload) {
      throw new Error("Invalid save file structure");
    }

    const expectedSignature = fnv1a(envelope.payload + SECRET_SALT);
    if (envelope.signature !== expectedSignature) {
      throw new Error("Signature verification failed (file may be corrupted or tampered with)");
    }

    const bundle = JSON.parse(decodeURIComponent(envelope.payload));
    const { activeGameState, gameProgress } = bundle;

    if (activeGameState) {
      this.save(activeGameState, "active-game-state");
    } else {
      this.clear("active-game-state");
    }

    if (gameProgress) {
      this.save(gameProgress, "game-progress");
    } else {
      this.clear("game-progress");
    }

    return true;
  }
}
