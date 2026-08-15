export const CLEARANCE_SATURATE = 600;
export const THREAT_RADIUS = 60;

function clearanceAlongAxis(position, direction, size) {
  const epsilon = 1e-6;
  if (Math.abs(direction) <= epsilon) return Infinity;

  return direction > 0 ? (size - position) / direction : -position / direction;
}

export function clearanceToBoundary(x, y, directionX, directionY, width, height) {
  const distance = Math.min(
    clearanceAlongAxis(x, directionX, width),
    clearanceAlongAxis(y, directionY, height)
  );

  return isFinite(distance) ? distance : Math.max(width, height);
}

function directionAwayFrom(position, threat) {
  const deltaX = position.x - threat.x;
  const deltaY = position.y - threat.y;
  const distance = Math.hypot(deltaX, deltaY) || 1;
  const x = deltaX / distance;
  const y = deltaY / distance;

  return { x, y, angle: Math.atan2(y, x) };
}

function threatBlocks(direction, threatDelta) {
  const projection = direction.x * threatDelta.x + direction.y * threatDelta.y;
  if (projection <= 0) return false;
  const perpendicularDistance = Math.abs(direction.x * threatDelta.y - direction.y * threatDelta.x);

  return perpendicularDistance < THREAT_RADIUS;
}

function clampToArena(x, y, margin, width, height) {
  return {
    x: Math.max(margin, Math.min(width - margin, x)),
    y: Math.max(margin, Math.min(height - margin, y))
  };
}

export function pickEscapePoint(currentPosition, threat, arena, config = {}) {
  const {
    margin = 30,
    step = Math.PI / 12,
    clearanceWeight = 0.85,
    awayWeight = 0.15,
    radius = 300
  } = config;
  const { width, height } = arena;

  const away = directionAwayFrom(currentPosition, threat);
  const threatDelta = { x: threat.x - currentPosition.x, y: threat.y - currentPosition.y };

  let bestScore = -Infinity;
  let best = { x: currentPosition.x, y: currentPosition.y };
  const sweepSteps = Math.round(Math.PI / step);
  for (let i = -sweepSteps; i <= sweepSteps; i++) {
    const angle = away.angle + i * step;
    const direction = { x: Math.cos(angle), y: Math.sin(angle) };
    if (threatBlocks(direction, threatDelta)) continue;

    const awayAlignment = direction.x * away.x + direction.y * away.y;
    const clearance = clearanceToBoundary(currentPosition.x, currentPosition.y, direction.x, direction.y, width, height);
    const clearanceRatio = Math.min(1, clearance / CLEARANCE_SATURATE);
    const score = clearanceWeight * clearanceRatio + awayWeight * awayAlignment;
    if (score > bestScore) {
      bestScore = score;
      const travelDistance = Math.min(radius, clearance * 0.8);
      best = clampToArena(
        currentPosition.x + direction.x * travelDistance,
        currentPosition.y + direction.y * travelDistance,
        margin, width, height
      );
    }
  }
  
  return best;
}
