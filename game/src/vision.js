// Line-of-sight and vision-cone maths. All coordinates are pixels; tiles are
// TILE-sized. Sight is blocked by walls, crates and display cases — never by
// plants or shadows, which only hide the thief.
import { TILE } from './config.js';
import { tileBlocksSight } from './levels.js';

export function tileAt(grid, tx, ty) {
  if (ty < 0 || ty >= grid.length || tx < 0 || tx >= grid[0].length) return '#';
  return grid[ty][tx];
}

export function tileAtPixel(grid, x, y) {
  return tileAt(grid, Math.floor(x / TILE), Math.floor(y / TILE));
}

export function blocksSightAt(grid, x, y) {
  return tileBlocksSight(tileAtPixel(grid, x, y));
}

/** True when no sight-blocking tile lies on the segment (sampled finely). */
export function hasLineOfSight(grid, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (blocksSightAt(grid, x0 + dx * t, y0 + dy * t)) return false;
  }
  return true;
}

/** Distance a vision ray travels before hitting a wall or the cone's range. */
export function castVisionRay(grid, x, y, angle, maxDist) {
  const step = 6;
  let dist = 0;
  while (dist < maxDist) {
    dist += step;
    const px = x + Math.cos(angle) * dist;
    const py = y + Math.sin(angle) * dist;
    if (blocksSightAt(grid, px, py)) return dist - step;
  }
  return maxDist;
}

/** Angle from (x0,y0) to (x1,y1), and the smallest difference between two angles. */
export function angleTo(x0, y0, x1, y1) {
  return Math.atan2(y1 - y0, x1 - x0);
}
export function angleDifference(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
