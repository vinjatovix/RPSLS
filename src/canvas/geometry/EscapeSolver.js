/**
 * EscapeSolver - Elección de dirección de huida con conciencia del espacio.
 * Matemática pura (sin Game ni canvas): dado posición, amenaza y arena,
 * elige el punto de escape que maximiza el espacio libre sin dejar de
 * alejarse de la amenaza.
 */

/** Más allá de esta distancia al borde, el espacio ya se considera "suficiente". */
export const CLEARANCE_SATURATE = 600;

/** Radio alrededor del predador: si el rayo de huida pasa por aquí por delante,
 *  la dirección se descarta (evita cargar contra el predador en vez de escapar). */
export const THREAT_RADIUS = 60;

/**
 * Distancia desde (x, y) hasta el primer borde del rectángulo [0,0,w,h]
 * recorriendo el rayo con dirección (dirX, dirY). Infinito si no corta.
 */
export function clearanceToBoundary(x, y, dirX, dirY, width, height) {
  const eps = 1e-6;
  let t = Infinity;
  if (Math.abs(dirX) > eps) {
    if (dirX > 0) t = Math.min(t, (width - x) / dirX);
    else t = Math.min(t, -x / dirX);
  }
  if (Math.abs(dirY) > eps) {
    if (dirY > 0) t = Math.min(t, (height - y) / dirY);
    else t = Math.min(t, -y / dirY);
  }
  return isFinite(t) ? t : Math.max(width, height);
}

/**
 * Elige el punto al que debe dirigirse la presa para huir de `threat`.
 *
 * Barre el círculo completo en pasos de `step` y puntúa cada dirección
 * combinando el espacio libre disponible (clearance al borde) con cuánto
 * aleja del predador (alineación). Se descartan solo las direcciones cuyo
 * rayo pasa cerca del predador por delante. Devuelve un punto siempre dentro
 * del arena con margen.
 *
 * @param {Object} pos - { x, y } de la presa.
 * @param {Object} threat - { x, y } del predador.
 * @param {Object} arena - { width, height } del arena.
 * @param {Object} [cfg] - margin, step (rad), clearanceWeight, awayWeight, radius.
 * @returns {Object} { x, y } objetivo de huida (in-bounds).
 */
export function pickEscapePoint(pos, threat, arena, cfg = {}) {
  const {
    margin = 30,
    step = Math.PI / 12,
    clearanceWeight = 0.85,
    awayWeight = 0.15,
    radius = 300
  } = cfg;
  const { width, height } = arena;
  const dx = pos.x - threat.x;
  const dy = pos.y - threat.y;
  const dist = Math.hypot(dx, dy) || 1;
  const awayX = dx / dist;
  const awayY = dy / dist;
  const awayAngle = Math.atan2(awayY, awayX);

  const threatDx = threat.x - pos.x;
  const threatDy = threat.y - pos.y;

  let bestScore = -Infinity;
  let best = { x: pos.x, y: pos.y };
  for (let i = -12; i <= 12; i++) {
    const a = awayAngle + i * step;
    const dirX = Math.cos(a);
    const dirY = Math.sin(a);

    const proj = dirX * threatDx + dirY * threatDy;
    if (proj > 0) {
      const perp = Math.abs(dirX * threatDy - dirY * threatDx);
      if (perp < THREAT_RADIUS) continue;
    }

    const awayAlign = dirX * awayX + dirY * awayY;
    const clearance = clearanceToBoundary(pos.x, pos.y, dirX, dirY, width, height);
    const room = Math.min(1, clearance / CLEARANCE_SATURATE);
    const score = clearanceWeight * room + awayWeight * awayAlign;
    if (score > bestScore) {
      bestScore = score;
      const len = Math.min(radius, clearance * 0.8);
      best = {
        x: Math.max(margin, Math.min(width - margin, pos.x + dirX * len)),
        y: Math.max(margin, Math.min(height - margin, pos.y + dirY * len))
      };
    }
  }
  return best;
}
