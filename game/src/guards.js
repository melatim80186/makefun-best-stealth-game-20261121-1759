// Guard AI: patrol, suspicion, alarm chase, search, and calm return. Guards
// navigate with a small BFS over walkable tiles, so patrol routes bend around
// walls and furniture instead of ever getting stuck on them.
import { TILE } from './config.js';
import { GUARD } from './config.js';
import { angleTo, tileAtPixel } from './vision.js';
import { tileBlocksMovement } from './levels.js';

export const GUARD_PATROL = 'patrol';
export const GUARD_SUSPICIOUS = 'suspicious';
export const GUARD_CHASE = 'chase';
export const GUARD_SEARCH = 'search';
export const GUARD_RETURN = 'return';

function tileCenter(tx, ty) {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}

function walkable(grid, tx, ty) {
  if (ty < 0 || ty >= grid.length || tx < 0 || tx >= grid[0].length) return false;
  return !tileBlocksMovement(grid[ty][tx]);
}

/** Breadth-first route of tile centres from (sx,sy) to (tx,ty); [] if unreachable. */
export function findRoute(grid, sx, sy, tx, ty) {
  const start = { x: Math.floor(sx / TILE), y: Math.floor(sy / TILE) };
  const goal = { x: tx, y: ty };
  if (!walkable(grid, goal.x, goal.y)) return [];
  if (start.x === goal.x && start.y === goal.y) return [tileCenter(goal.x, goal.y)];
  const key = (x, y) => `${x},${y}`;
  const cameFrom = new Map();
  const queue = [start];
  cameFrom.set(key(start.x, start.y), null);
  const neighbours = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (queue.length > 0) {
    const cur = queue.shift();
    for (const [dx, dy] of neighbours) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (!walkable(grid, nx, ny) || cameFrom.has(key(nx, ny))) continue;
      cameFrom.set(key(nx, ny), cur);
      if (nx === goal.x && ny === goal.y) {
        const path = [];
        let node = { x: nx, y: ny };
        while (node) {
          path.unshift(tileCenter(node.x, node.y));
          node = cameFrom.get(key(node.x, node.y));
        }
        return path;
      }
      queue.push({ x: nx, y: ny });
    }
  }
  return [];
}

export function createGuard(def, index) {
  const start = tileCenter(def.path[0][0], def.path[0][1]);
  const next = def.path[1] ?? def.path[0];
  return {
    id: index,
    x: start.x,
    y: start.y,
    facing: angleTo(start.x, start.y, next[0] * TILE + TILE / 2, next[1] * TILE + TILE / 2),
    state: GUARD_PATROL,
    waypointIndex: 1,
    pauseTimer: 0,
    scanTimer: 0,
    suspicion: 0,
    lastSeen: null,
    lastSeenTimer: 0,
    searchTimer: 0,
    route: [],
    routeTarget: null,
    stuckTimer: 0,
    speedFactor: def.speed,
    pause: def.pause,
  };
}

/** Can a guard circle of GUARD.radius stand at (x,y) without overlapping a solid tile? */
export function guardFits(grid, x, y) {
  const r = GUARD.radius;
  const checks = [
    [x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r],
    [x, y - r], [x, y + r], [x - r, y], [x + r, y],
  ];
  for (const [cx, cy] of checks) {
    if (tileBlocksMovement(tileAtPixel(grid, cx, cy))) return false;
  }
  return true;
}

/**
 * Move toward (tx,ty) at `speed` px/s, axis by axis so the guard slides along
 * furniture instead of cutting a corner into it; true when arrived within 4 px.
 */
function moveToward(grid, guard, tx, ty, speed, dt) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 4) return true;
  const step = Math.min(dist, speed * dt);
  const nx = guard.x + (dx / dist) * step;
  const ny = guard.y + (dy / dist) * step;
  if (guardFits(grid, nx, guard.y)) guard.x = nx;
  if (guardFits(grid, guard.x, ny)) guard.y = ny;
  guard.facing = angleTo(guard.x, guard.y, tx, ty);
  return Math.hypot(tx - guard.x, ty - guard.y) < 4;
}

/** Follow a BFS route; recompute it when the destination tile changes. */
function followRoute(grid, guard, tx, ty, speed, dt) {
  const tileX = Math.floor(tx / TILE);
  const tileY = Math.floor(ty / TILE);
  const targetKey = `${tileX},${tileY}`;
  if (guard.routeTarget !== targetKey || guard.route.length === 0) {
    guard.route = findRoute(grid, guard.x, guard.y, tileX, tileY);
    guard.routeTarget = targetKey;
  }
  if (guard.route.length === 0) return true;
  const next = guard.route[0];
  const beforeX = guard.x;
  const beforeY = guard.y;
  if (moveToward(grid, guard, next.x, next.y, speed, dt)) guard.route.shift();
  // Stuck against a corner: if the guard barely moved, drop the route so the
  // next step plans a fresh one from where it actually stands.
  if (Math.hypot(guard.x - beforeX, guard.y - beforeY) < 0.2) {
    guard.stuckTimer += dt;
    if (guard.stuckTimer > 1.5) {
      guard.route = [];
      guard.routeTarget = null;
      guard.stuckTimer = 0;
    }
  } else {
    guard.stuckTimer = 0;
  }
  return guard.route.length === 0;
}

function lookAround(guard, dt) {
  guard.scanTimer += dt;
  guard.facing += Math.sin(guard.scanTimer * 1.4) * dt * 1.1;
}

/**
 * Advance one guard. `seen` is this guard's current sighting of the thief
 * ({x, y, strength} or null). Returns 'alarm' the moment this guard raises it.
 */
export function updateGuard(grid, guard, def, seen, dt) {
  let raisedAlarm = false;
  if (seen) {
    guard.suspicion = Math.min(100, guard.suspicion + seen.strength * dt);
    guard.lastSeen = { x: seen.x, y: seen.y };
    guard.lastSeenTimer = 0;
  } else {
    guard.suspicion = Math.max(0, guard.suspicion - 14 * dt);
    guard.lastSeenTimer += dt;
  }

  if (guard.suspicion >= 100 && guard.state !== GUARD_CHASE) {
    guard.state = GUARD_CHASE;
    guard.routeTarget = null;
    raisedAlarm = true;
  } else if (guard.state === GUARD_CHASE && guard.lastSeenTimer > 4) {
    guard.state = GUARD_SEARCH;
    guard.searchTimer = 6;
    guard.routeTarget = null;
  } else if (guard.state !== GUARD_CHASE && guard.suspicion >= 38 && guard.state === GUARD_PATROL) {
    guard.state = GUARD_SUSPICIOUS;
    guard.routeTarget = null;
  }

  const patrolSpeed = GUARD.patrolSpeed * guard.speedFactor;
  if (guard.state === GUARD_PATROL) {
    if (guard.pauseTimer > 0) {
      guard.pauseTimer -= dt;
      lookAround(guard, dt);
    } else {
      const wp = def.path[guard.waypointIndex];
      const target = tileCenter(wp[0], wp[1]);
      if (moveToward(grid, guard, target.x, target.y, patrolSpeed, dt)) {
        guard.waypointIndex = (guard.waypointIndex + 1) % def.path.length;
        guard.pauseTimer = guard.pause;
        guard.scanTimer = 0;
      }
    }
  } else if (guard.state === GUARD_SUSPICIOUS) {
    if (guard.lastSeen) {
      const arrived = followRoute(grid, guard, guard.lastSeen.x, guard.lastSeen.y, GUARD.investigateSpeed, dt);
      if (arrived) {
        lookAround(guard, dt);
        if (guard.suspicion < 10) {
          guard.state = GUARD_RETURN;
          guard.routeTarget = null;
        }
      }
    }
    if (guard.suspicion < 10) {
      guard.state = GUARD_RETURN;
      guard.routeTarget = null;
    }
  } else if (guard.state === GUARD_CHASE) {
    const target = guard.lastSeen ?? { x: guard.x, y: guard.y };
    followRoute(grid, guard, target.x, target.y, GUARD.chaseSpeed, dt);
  } else if (guard.state === GUARD_SEARCH) {
    guard.searchTimer -= dt;
    if (guard.lastSeen) {
      const arrived = followRoute(grid, guard, guard.lastSeen.x, guard.lastSeen.y, GUARD.investigateSpeed, dt);
      if (arrived) lookAround(guard, dt);
    }
    if (guard.searchTimer <= 0 || guard.suspicion <= 0) {
      guard.state = GUARD_RETURN;
      guard.routeTarget = null;
    }
  } else if (guard.state === GUARD_RETURN) {
    const wp = def.path[guard.waypointIndex];
    const target = tileCenter(wp[0], wp[1]);
    const arrived = followRoute(grid, guard, target.x, target.y, patrolSpeed, dt);
    if (arrived) {
      guard.state = GUARD_PATROL;
      guard.waypointIndex = (guard.waypointIndex + 1) % def.path.length;
    }
  }
  return raisedAlarm ? 'alarm' : null;
}
