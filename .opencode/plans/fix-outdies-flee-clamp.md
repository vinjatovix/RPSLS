# Fix: outDies no mata a las presas que huyen (campo de fuerza en el borde)

## Contexto
`outDies` funciona para los cazadores pero no para las presas que huyen. Causa: `move()` aplica
`#safeClamp()` (clamp a `[2, W-w-2]`) siempre que `fleeing || fleeClampFrames > 0`, y la gracia se
auto-renueva mientras el emoji esté cerca o apuntando a un borde. La presa jamás cruza la frontera
→ nunca muere por `outDies`.

La IA de huida ya es correcta (la reflexión en `#flee` apunta al interior con margen 30px); el
único problema es el clamp de posición.

Decisión del usuario: eliminación simple. Cualquier emoji que cruce el borde por velocidad muere,
sin campo de fuerza.

## Cambios en `src/entities/Enemy.js`

1. **`move()`**: eliminar la rama de clamp por huida/gracia:
   - Quitar el bloque `if (this.fleeing || (this.fleeClampFrames > 0 && ...)) { fleeClampFrames = 60; }`
   - Quitar el `else if (this.fleeing || this.fleeClampFrames > 0) { this.#safeClamp(); }`
   - Quitar el decremento `if (this.fleeClampFrames > 0) this.fleeClampFrames -= 1;`
   - Dejar solo `if (limitCanvas) { #limitPosition(); }` (comportamiento `limitCanvas` intacto).

2. **Eliminar código muerto** (todos los usos están confinados a `Enemy.js`, verificado con grep):
   - Campo `this.fleeClampFrames = 0;` (constructor)
   - `if (this.fleeing) this.fleeClampFrames = 60;` en `#setTarget`
   - Métodos `#safeClamp`, `#nearEdge`, `#headingTowardEdge`

3. **Conservar**:
   - Reflexión del aim en `#flee` (margen 30) → la presa siempre apunta hacia dentro, no se suicida por IA.
   - Flag `fleeing` (comportamiento de huida) y `#checkPosition`/`offScreen`/`outDies` (mecanismo de muerte).

## Resultado esperado
- Simetría cazador/presa: quien cruce el borde por velocidad muere por `outDies`.
- La presa pegada al muro que consigue girar a tiempo sobrevive.
- `limitCanvas: true` sin cambios (clamp duro).

## Verificación headless (Node, tras implementar)
1. Repro del escenario del usuario: presa huyendo en el borde dirigiéndose fuera → ahora muere
   (`offScreen`, `killedBy` null). Medir ratio muertes off-screen vs por daño.
2. Campaña 10×100: winrates se mantienen cerca de la calibración actual
   (rocks ~28, spocks ~24, scissors ~18, papers ~14, lizards ~11); muertes off-screen =
   fracción pequeña del total (no una plaga).
3. Matchup 1v1: sigue 100% capturas (no afectado: el fake game usa `limitCanvas: true`).

## Siguiente paso (barrido de balance, con progreso visible)
- Lanzar en background y mostrar progreso del log cada ~60s:
  `nohup node test/headless-campaign.mjs sweep 2 100 15 > /tmp/sweep.log 2>&1 &`
  (el motivo del "se te ha quedado colgado" es que la tool devuelve la salida solo al terminar).
- Aplicar la combinación ganadora y validar con 20×100 final + matchup guardrail.

## Archivos afectados
- `src/entities/Enemy.js` (único archivo de código)
