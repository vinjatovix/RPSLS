# Tarea: Corregir Observaciones Críticas del Code Review (Fase de Validación Rigurosa)

Has realizado un trabajo formidable implementando las correcciones anteriores. El desacoplamiento y la eliminación de polución global han mejorado sustancialmente. Sin embargo, tras una revisión técnica exhaustiva de los cambios introducidos frente a `develop`, he identificado varios riesgos de diseño, asimetrías de API y fugas de abstracción que impiden la aprobación inmediata de la Pull Request. 

Debes solventar los siguientes puntos para asegurar que la separación de módulos sea 100% robusta y segura.

---

## 🛠️ Requisitos de Corrección (Definición de Listo)

### 1. Fuga de Abstracción en `FakeLocalStorageAdapter` (Riesgo Crítico de Crash en Producción)
`FakeLocalStorageAdapter` expone actualmente los métodos públicos `getItem`, `setItem` y `removeItem`. Sin embargo, la clase de producción `LocalStorageAdapter` **no implementa** estos métodos (solo expone `save`, `load` y `clear`).
*   **Riesgo:** Un desarrollador podría utilizar `storageAdapter.getItem(...)` en sus tests unitarios (que pasarán exitosamente al usar el Fake), pero la aplicación fallará con un `TypeError: storageAdapter.getItem is not a function` en producción.
*   **Acción:** Elimina por completo los métodos `getItem`, `setItem` y `removeItem` de `FakeLocalStorageAdapter` para evitar fugas de abstracción y garantizar la simetría absoluta de la interfaz.

---

### 2. Discrepancia de Comportamiento en `FakeInputHandler` (`onToggle` callback)
En producción, `InputHandler` invoca la función callback `onToggle(key, value)` cuando una tecla de alternancia cambia su estado. Sin embargo, en el entorno de pruebas, `FakeInputHandler.setKeyState(key, value)` muta el estado interno de la tecla pero **no invoca** `onToggle`.
*   **Riesgo:** Configuraciones del juego (como debug, blood effects, etc.) gestionadas por `GameSettings` que dependen de la llamada a `onToggle` para persistirse a almacenamiento (`saveToStorage()`) nunca se guardarán en los entornos de simulación y tests headless si se cambia su estado mediante el fake.
*   **Acción:** 
    *   Permite opcionalmente pasar una función `onToggle` en el constructor de `FakeInputHandler` (al igual que en el original) y almacénala en `this.onToggle`.
    *   Actualiza `setKeyState(key, value)` en `FakeInputHandler` para que, si el estado de la tecla cambia y `this.onToggle` está definido, se invoque el callback correspondiente.

---

### 3. Falta de Pruebas de Comportamiento para los Fakes (`test/unit/fake-adapters.test.mjs`)
Hemos añadido pruebas de contrato de API (`adapter-contracts.test.mjs`) para verificar que las firmas de métodos coinciden estructuralmente. No obstante, no existe ninguna prueba de unidad que verifique la *lógica de comportamiento* de estos adaptadores fakes.
*   **Riesgo:** Si hay un error matemático en `FakeCanvasAdapter.resize`, `clampPosition`, `getRandomSpawnPoint`, o en la persistencia de `FakeLocalStorageAdapter`, los tests que los utilizan podrían reportar falsos positivos o negativos difíciles de diagnosticar.
*   **Acción:** Crea un nuevo archivo de pruebas unitarias en `test/unit/fake-adapters.test.mjs` que verifique:
    *   `FakeCanvasAdapter`: que `resize` calcula las dimensiones límites correctamente, que `clampPosition` restringe adecuadamente las coordenadas según el ancho/alto, y que `getRandomSpawnPoint` devuelve coordenadas respetando los márgenes.
    *   `FakeLocalStorageAdapter`: que `save` y `load` serializan/deserializan correctamente los datos, y que `clear` elimina el registro correspondiente.
    *   `FakeInputHandler`: que `getKeys` y `isKeyPressed` reflejan con exactitud los cambios de estado, y que al invocar `setKeyState` se dispare el callback `onToggle` asignado.

---

### 4. Violación del Orden Alfabético en Importaciones y Exportaciones Destructuradas
Se han detectado infracciones de la regla #9 de `GEMINI.md` ("En cada nivel por orden alfabético") en las declaraciones de importación/exportación con desestructuración:
1.  **En `src/index.js` (Línea 4):**
    `import { MatchManager, EntityManager } from "./entities/index.js";`
    *   *Corrección:* Debe ser `import { EntityManager, MatchManager } from "./entities/index.js";` (`EntityManager` antes que `MatchManager`).
2.  **En `test/unit/adapter-contracts.test.mjs` (Línea 6):**
    `import { FakeCanvasAdapter, FakeLocalStorageAdapter, FakeInputHandler } from "../../src/testing/FakeAdapters.js";`
    *   *Corrección:* Debe ser `import { FakeCanvasAdapter, FakeInputHandler, FakeLocalStorageAdapter } from "../../src/testing/FakeAdapters.js";` (`FakeInputHandler` antes que `FakeLocalStorageAdapter`).
3.  **En `test/doubles/FakeAdapters.mjs` (Líneas 2-4):**
    *   *Corrección:* Ordena el bloque de exportación alfabéticamente:
        ```javascript
        export {
          createFakeAdapters,
          FakeCanvasAdapter,
          FakeInputHandler,
          FakeLocalStorageAdapter
        } from "../../src/testing/FakeAdapters.js";
        ```

---

## 🚀 Criterios de Aceptación para la Aprobación
1.  Se ha eliminado la polución de métodos adicionales (`getItem`, `setItem`, `removeItem`) de `FakeLocalStorageAdapter`.
2.  `FakeInputHandler` propaga eventos `onToggle` idénticos a los de producción.
3.  La nueva suite de tests `test/unit/fake-adapters.test.mjs` pasa al 100% y cubre exhaustivamente la lógica interna de los tres fakes.
4.  Todas las importaciones y exportaciones destructuradas están rigurosamente ordenadas de forma alfabética.
5.  `npm run check` y `npm test` se ejecutan perfectamente sin errores.
