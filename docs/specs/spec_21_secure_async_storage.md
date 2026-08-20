# Spec: Secure Asynchronous Storage with Web Crypto

## Context
**Problem/Opportunity:**
The current implementation of `LocalStorageAdapter` uses a synchronous XOR cipher and a hardcoded `SECRET_SALT` string to obfuscate the user's save data. Because client-side JavaScript is fully exposed, this static salt can be trivially read via Browser Developer Tools, rendering the obfuscation ineffective against intentional tampering. Moving to true client-side security requires utilizing the native Web Cryptography API with non-extractable keys stored in IndexedDB. However, this API is inherently asynchronous, requiring a significant architectural shift from our currently synchronous `load` and `save` operations. 

**Impact:**
If we do not implement this, save files remain vulnerable to easy manipulation by users who understand basic DevTools usage. Refactoring to Web Crypto provides the highest level of native client-side security, preventing even advanced users from extracting the encryption key. Deferring this to a dedicated spec allows us to handle the necessary asynchronous refactoring safely without blocking current tasks.

## Objectives
- [ ] Replace the synchronous XOR cipher with the Web Cryptography API (AES-GCM).
- [ ] Generate and store a non-extractable encryption key securely within IndexedDB.
- [ ] Refactor `LocalStorageAdapter.js` and all dependent modules (`ProgressManager`, `GameSettings`, `MatchManager`, bootstrap in `index.js`) to support asynchronous `async/await` loading and saving.
- [ ] Implement a password-based derivation mechanism (PBKDF2) to facilitate secure cross-device save export and import.

## Architecture & Design

### Affected Modules
- `src/storage/LocalStorageAdapter.js`
- `src/meta/ProgressManager.js`
- `src/options/GameSettings.js`
- `src/index.js` (Bootstrapping phase)
- `src/ui/MenuController.js` (Export/Import flows)
- `test/unit/local-storage-adapter.test.mjs`

### Structural Changes
1. **Web Crypto Integration:** `LocalStorageAdapter` will use `window.crypto.subtle.generateKey` and `window.crypto.subtle.encrypt`/`decrypt`.
2. **IndexedDB Key Vault:** Implement a minimal wrapper (or use a lightweight library) to store the generated `CryptoKey` in IndexedDB. The key must be created with `extractable: false`.
3. **Async Storage API:** The methods `adapter.save()`, `adapter.load()`, `adapter.exportSave()`, and `adapter.importSave()` will become asynchronous and return Promises.
4. **Bootstrapping Phase:** `index.js` must be refactored so that the `Game` initialization pauses (`await`) while the initial configuration and progress data are fetched from the async adapter.
5. **Export/Import Flow:** 
   - `exportSave` will require a user-provided password. The system will derive a temporary key, encrypt the bundle, and trigger the download.
   - `importSave` will prompt the user for the password used during export, decrypt the file, and then re-encrypt it using the device's local non-extractable IndexedDB key.

### Interface/API Contract
- `async LocalStorageAdapter.prototype.initialize()`: Ensures the encryption key exists in IndexedDB.
- `async LocalStorageAdapter.prototype.load(key)`: Returns decrypted parsed JSON.
- `async LocalStorageAdapter.prototype.save(data, key)`: Encrypts and stores data.
- `async LocalStorageAdapter.prototype.exportSave(password)`: Generates the export bundle.
- `async LocalStorageAdapter.prototype.importSave(fileContent, password)`: Imports and validates the bundle.

### Data Flow
1. **Startup:** `index.js` awaits `adapter.initialize()`.
2. **Load Data:** `ProgressManager` awaits `adapter.load('game-progress')`.
3. **Save Data:** When a milestone is reached, `ProgressManager` triggers `adapter.save(data)` (fire-and-forget or awaited depending on critical state).
4. **Cross-Device:** User clicks Export -> Prompt for password -> PBKDF2 key derivation -> AES-GCM encryption -> Download.

## Verification Plan (Definition of Done)
### Automated Tests
- [ ] Update `local-storage-adapter.test.mjs` to handle async operations.
- [ ] Mock `window.crypto` and `IndexedDB` in tests to verify encryption/decryption flow.
- [ ] Test the password-based export/import logic thoroughly (including incorrect passwords).
- [ ] Ensure all mock adapters in `FakeAdapters.js` are updated to match the new async signature.

### Manual Verification
- [ ] Verify the game starts up correctly and loads previous state asynchronously.
- [ ] Verify that attempting to read LocalStorage via DevTools only shows encrypted binary data.
- [ ] Verify that the encryption key cannot be extracted from IndexedDB via DevTools.
- [ ] Perform an end-to-end export from Device A, import to Device B using a password.

## Risks & Mitigations
- **Risk:** The asynchronous nature of saving/loading might introduce race conditions during rapid state changes.
- **Mitigation:** Implement an internal lock or queue system within `LocalStorageAdapter` to ensure sequential disk writes if rapid consecutive saves occur.
- **Risk:** Loss of IndexedDB data (e.g., user clears browser data completely) means the LocalStorage data is permanently unreadable.
- **Mitigation:** Warn the user when clearing data and encourage regular password-protected exports.
