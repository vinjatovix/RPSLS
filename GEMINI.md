# GEMINI.md - Idle RPS Simulation Engine

## Resumen Ejecutivo
**Idle RPS** es un motor de simulación determinista de un juego 5-way (Rock, Paper, Scissors, Lizard, Spock) con verificación automática de balance mediante tests estadísticos chi-cuadrado. El desarrollo está guiado estrictamente por **Spec-Driven Development (SDD)** apoyado en una Pirámide de Pruebas rigurosa.

## Restricciones No Negociables

1. **Source of Truth (Spec-Driven):** La especificación (`docs/specs/`) dicta la arquitectura. **NO se escribe código de producción sin una especificación aprobada.** Si surge un impedimento durante la implementación, la Spec se actualiza antes de improvisar en el código.
2. **Determinismo:** Usa PRNG seeded (`mulberry32`). **NUNCA** utilices `Math.random()`.
3. **Balance Guard:** Win rates ±5pp. Test chi-cuadrado (df=4) falla si χ² > 9.488. Obligatorio comprobar tras cambios en el core.
4. **Pedir Permiso:** Antes de ejecutar comandos destructivos o de sistema, pregunta al desarrollador.
5. **Inmutabilidad:** `gameConfig.js` está congelado. No mutar en runtime.
6. **Opciones Object:** Funciones con >3 parámetros usan un objeto destructurado.
7. **Integridad Arquitectónica:** **Cero dependencias circulares**. Obligatorio verificar con `npm run check:circular` (`skott`).
8. **Testabilidad Headless:** Todo el código core (ajeno a UI/Canvas directo) debe poder ejecutarse en Node.js puro sin DOM, o con dom-stubs controlados.

## Estructura Clave y Archivos de Barril

Usar archivos `index.js` en subdirectorios (`core`, `entities`, `ui`, `particles`, `canvas`) para exponer limpiamente la API pública. Para evitar dependencias circulares, los módulos del mismo subdirectorio deben importar directamente a sus archivos hermanos, no a través del barril local.

```
src/
  ├── index.js          → Game loop & orquestación
  ├── config/           → gameConfig.js (congelado)
  ├── core/             → Clock, EventBus
  ├── entities/         → Enemy, PowerUp, lógica de combate
  ├── canvas/           → Colisiones, rendering
  ├── ui/               → DOM panels (decoupled)
  ├── particles/        → Sistemas visuales
  ├── meta/             → Meta-progresión
  └── storage/          → Persistencia

test/
  ├── builders/         → Entity Builders (Ej: EnemyBuilder)
  ├── mothers/          → Object Mothers (Ej: EnemyMother.rockWithLowHealth())
  ├── doubles/          → Test Doubles (Ej: FakeEventBus)
  ├── *.test.mjs        → Unit/Integration tests
  └── headless-*        → Simulaciones E2E / Balance (sin DOM)
```

## Workflow de Desarrollo (Spec-Driven & Test-First)

1. **Analizar la Spec:** Leer `docs/specs/...`. Interiorizar el *Architecture & Design* y el *Verification Plan (DoD)*.
2. **Setup de Tests (TDD Recomendado):** Traducir el Verification Plan en pruebas.
    *   *Unit Tests:* Aíslan la clase. **PROHIBIDO instanciar `new Game()`**. Usa `Builders`, `Mothers` y Test Doubles (`FakeEventBus`).
    *   *Integration Tests:* Orquestan múltiples módulos sin levantar la UI.
3. **Implementación Quirúrgica:** Escribir el código en ESM puro, determinista, y completamente desacoplado.
4. **Validación de Calidad:**
    *   `npm run check` (Linting)
    *   `npm run check:circular` (Límites arquitectónicos limpios)
    *   `npm test` y `npm run coverage` (Ejecución de suite nativa en Node 22+)
5. **Validación Estocástica:** Si el cambio afecta a físicas, combates o entidades, ejecutar `npm run balance`.
6. **Revisión del DoD:** Validar que se cumple cada punto del Verification Plan de la Spec.

## Principios de Código y Testing

*   **Fundaciones de Software:** Respetar estrictamente los principios **SOLID, DRY, KISS y YAGNI**.
*   **Desacoplamiento vía EventBus:** Preferir la comunicación basada en eventos (`EventBus`) para intercomunicar el core de simulación con sistemas periféricos (UI, partículas, etc.) antes que la inyección de dependencias directa. **Excepción:** Se permite inyección de dependencias directa o referencias directas únicamente si existe una razón de peso como el **rendimiento en caminos críticos (hot-paths)** de la simulación.
*   **Testing Nativo Exclusivo:** Solo se permite `node:test` y `node:assert/strict`. Nada de Jest/Vitest.
*   **Mothers & Builders:** Los tests unitarios deben enfocarse en el *comportamiento*, no en la *construcción*. Usa Object Mothers y Builders para instanciar estados claros y semánticos (ej: `EnemyMother.paperAtCenter()`).
*   **Data-Driven Tests:** Utilizar arrays de casos o tablas para probar lógicas puramente matemáticas (ej: `EscapeSolver.js`).
*   **Comentarios:** Si hay que añadir comentarios explicativos en el código de producción, es que no es lo suficientemente autoexplicativo (los comentarios deben limitarse a lo estrictamente necesario). En los tests, la estructura AAA (Arrange, Act, Assert) sí se puede comentar para guiar la lectura.

## Comandos Clave

```bash
npm run check           # Linting via ESLint
npm run check:circular  # Detección de deps circulares via Skott
npm test                # Ejecuta Unit & Integration tests
npm run coverage        # Genera métricas de cobertura (Node experimental)
npm run balance         # Simulación E2E de balance estadístico
npm run build           # Empaquetado via ESBuild
```

## Equipos & Especialización (Simulación)
- **Rocks:** Alto HP, Turn Rate lento.
- **Papers:** Mejor Turn Rate, equilibrado.
- **Scissors:** Max Damage, bajo HP.
- **Lizards:** Alta velocidad base y máxima.
- **Spocks:** Aceleración y frenado fuertes.
