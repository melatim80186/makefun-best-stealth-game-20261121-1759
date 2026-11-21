// The game state: the thief, the guards, detection, objectives and scoring.
// One fixed-step update per call; the renderer only ever reads `state`.
import { FIELD, TILE, STEP, PLAYER, GUARD, DETECTION, SCORE } from './config.js';
import { LEVELS, TILE_INTEL, TILE_EXIT, TILE_PLANT, TILE_SHADOW, tileBlocksMovement, tileHides } from './levels.js';
import { createGuard, updateGuard, GUARD_CHASE } from './guards.js';
import { tileAtPixel, hasLineOfSight, angleTo, angleDifference } from './vision.js';
import { playFootstep, playPickup, playAlert, playCaught, playWin } from './audio.js';

export const EVENT_NONE = 0;
export const EVENT_PICKUP = 1;
export const EVENT_ALARM = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_LEVEL_CLEAR = 8;
export const EVENT_WIN = 16;

function tileCenter(tx, ty) {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}

export function createWorld() {
  return {
    state: null,
    reset() {
      this.state = freshState(0);
    },
    loadLevel(index) {
      this.state = freshState(index);
    },
  };
}

function freshState(levelIndex) {
  const level = LEVELS[levelIndex];
  const spawn = tileCenter(level.spawn[0], level.spawn[1]);
  return {
    levelIndex,
    level,
    grid: level.grid.map((row) => row.slice()),
    intel: level.intel.map((spot) => ({ ...spot })),
    player: {
      x: spawn.x,
      y: spawn.y,
      facing: -Math.PI / 2,
      sneaking: false,
      moving: false,
      stepTimer: 0,
      stepAlternate: false,
    },
    guards: level.guards.map((def, i) => createGuard(def, i)),
    detection: 0,
    alarm: false,
    alarmTimer: 0,
    // Footstep sound rings: { t } stamps (totalTime) of recent loud steps.
    // Only walking leaves rings — sneaking is silent. The renderer draws
    // each as a faint expanding circle, so the player can see how far a
    // step carries. Visual only; the rules never read this list.
    rings: [],
    everAlerted: false,
    intelCollected: 0,
    score: 0,
    levelTime: 0,
    totalTime: 0,
    attempts: 0,
    message: level.briefing,
    messageTimer: 5,
    clickTarget: null,
    clickStamp: 0,
    exitOpen: false,
    won: false,
    caught: false,
  };
}

/** Can a circle of `radius` stand at (x,y) without overlapping a solid tile? */
export function circleFits(grid, x, y, radius) {
  const checks = [
    [x - radius, y - radius], [x + radius, y - radius],
    [x - radius, y + radius], [x + radius, y + radius],
    [x, y - radius], [x, y + radius], [x - radius, y], [x + radius, y],
  ];
  for (const [cx, cy] of checks) {
    if (tileBlocksMovement(tileAtPixel(grid, cx, cy))) return false;
  }
  return true;
}

/** Move the thief with axis-separated sliding so walls never trap the player. */
function movePlayer(state, dx, dy, dt) {
  const p = state.player;
  const speed = p.sneaking ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
  const nx = p.x + dx * speed * dt;
  const ny = p.y + dy * speed * dt;
  if (circleFits(state.grid, nx, p.y, PLAYER.radius)) p.x = nx;
  if (circleFits(state.grid, p.x, ny, PLAYER.radius)) p.y = ny;
  p.x = Math.max(PLAYER.radius, Math.min(FIELD.width - PLAYER.radius, p.x));
  p.y = Math.max(PLAYER.radius, Math.min(FIELD.height - PLAYER.radius, p.y));
  if (dx !== 0 || dy !== 0) {
    p.facing = Math.atan2(dy, dx);
    p.moving = true;
    p.stepTimer -= dt;
    if (p.stepTimer <= 0) {
      p.stepTimer = p.sneaking ? 0.55 : 0.34;
      p.stepAlternate = !p.stepAlternate;
      playFootstep(p.sneaking, p.stepAlternate);
      if (!p.sneaking) {
        // A loud step rings out: keep the last few, drop the faded ones.
        state.rings.push({ t: state.totalTime });
        while (state.rings.length > 0 && state.totalTime - state.rings[0].t > 1) state.rings.shift();
        if (state.rings.length > 4) state.rings.shift();
      }
    }
  } else {
    p.moving = false;
  }
}

/**
 * How strongly one guard sees the thief this step (detection points per
 * second), or 0 when the thief is out of the cone, out of range, behind cover,
 * or hidden in a plant the guard is not standing on top of.
 */
export function sightingStrength(state, guard) {
  const p = state.player;
  const dx = p.x - guard.x;
  const dy = p.y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > GUARD.visionRange) return 0;
  const angle = angleTo(guard.x, guard.y, p.x, p.y);
  if (Math.abs(angleDifference(angle, guard.facing)) > GUARD.visionHalfAngle) return 0;
  if (!hasLineOfSight(state.grid, guard.x, guard.y, p.x, p.y)) return 0;
  const tile = tileAtPixel(state.grid, p.x, p.y);
  if (tile === TILE_PLANT && dist > GUARD.plantRevealDistance) return 0;
  const distanceFactor = 1 - (dist / GUARD.visionRange) * 0.75;
  const movementFactor = p.sneaking ? 0.45 : p.moving ? 1 : 0.7;
  const coverFactor = tile === TILE_SHADOW ? 0.35 : tile === TILE_PLANT ? 0.2 : 1;
  return DETECTION.baseRate * distanceFactor * movementFactor * coverFactor;
}

/** Step the whole world one fixed step. `input` is {dir, sneaking, click}. */
export function stepWorld(world, input, dt) {
  const state = world.state;
  if (!state || state.won || state.caught) return EVENT_NONE;
  let events = EVENT_NONE;
  state.levelTime += dt;
  state.totalTime += dt;
  if (state.messageTimer > 0) state.messageTimer -= dt;

  // --- thief movement: keyboard wins over click-to-move. ---
  const p = state.player;
  p.sneaking = input.sneaking;
  if (input.click && input.click.stamp !== state.clickStamp) {
    state.clickTarget = input.click.target;
    state.clickStamp = input.click.stamp;
  }
  if (input.dir) {
    state.clickTarget = null;
    movePlayer(state, input.dir.x, input.dir.y, dt);
  } else if (state.clickTarget) {
    const dx = state.clickTarget.x - p.x;
    const dy = state.clickTarget.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 8) {
      state.clickTarget = null;
      p.moving = false;
    } else {
      movePlayer(state, dx / dist, dy / dist, dt);
    }
  } else {
    p.moving = false;
  }

  // --- footsteps give the thief away: nearby guards turn toward the noise. ---
  if (p.moving && !p.sneaking) {
    for (const guard of state.guards) {
      if (guard.state !== GUARD_CHASE && Math.hypot(p.x - guard.x, p.y - guard.y) < PLAYER.noiseRadius) {
        guard.suspicion = Math.max(guard.suspicion, 12);
        guard.lastSeen = { x: p.x, y: p.y };
        guard.lastSeenTimer = 0;
      }
    }
  }

  // --- vision: each guard's sighting feeds the shared detection meter. ---
  let strongest = 0;
  let anySeen = false;
  for (const guard of state.guards) {
    const strength = sightingStrength(state, guard);
    if (strength > 0) {
      anySeen = true;
      strongest = Math.max(strongest, strength);
    }
    const raised = updateGuard(state.grid, guard, state.level.guards[guard.id], strength > 0 ? { x: p.x, y: p.y, strength } : null, dt);
    if (raised === 'alarm' && !state.alarm) {
      state.alarm = true;
      state.alarmTimer = 0;
      state.everAlerted = true;
      playAlert();
      events |= EVENT_ALARM;
    }
  }
  if (anySeen) state.detection = Math.min(100, state.detection + strongest * dt);
  else state.detection = Math.max(0, state.detection - DETECTION.decayPerSecond * dt);

  // --- alarm fades when the thief stays unseen; guards then search. ---
  if (state.alarm) {
    state.alarmTimer += dt;
    const anyChasing = state.guards.some((g) => g.state === GUARD_CHASE);
    if (!anyChasing && state.alarmTimer > DETECTION.alarmMemorySeconds) state.alarm = false;
  }

  // --- caught: an alerted guard that reaches the thief ends the run, and so
  // does walking straight into any guard, seen or not. ---
  for (const guard of state.guards) {
    const touch = Math.hypot(p.x - guard.x, p.y - guard.y);
    if (touch < 20 || (touch < GUARD.catchDistance && (guard.state === GUARD_CHASE || state.detection >= 100))) {
      state.caught = true;
      state.attempts += 1;
      playCaught();
      return events | EVENT_CAUGHT;
    }
  }

  // --- intel: walk over a relic to lift it. ---
  for (const spot of state.intel) {
    if (!spot.taken && Math.hypot(p.x - (spot.x * TILE + TILE / 2), p.y - (spot.y * TILE + TILE / 2)) < 26) {
      spot.taken = true;
      state.intelCollected += 1;
      state.score += SCORE.intel;
      state.message = `Relic lifted — ${state.intelCollected} of ${state.intel.length}.`;
      state.messageTimer = 3;
      playPickup();
      events |= EVENT_PICKUP;
    }
  }
  if (state.intelCollected === state.intel.length && !state.exitOpen) {
    state.exitOpen = true;
    state.message = 'All relics lifted — the gilded door is open. Go!';
    state.messageTimer = 4;
  }

  // --- exit: step onto it with every relic to clear the wing. ---
  const exit = tileCenter(state.level.exit[0], state.level.exit[1]);
  if (state.exitOpen && Math.hypot(p.x - exit.x, p.y - exit.y) < 26) {
    const timeBonus = Math.max(0, Math.round((240 - state.levelTime) * SCORE.timeBonusPerSecond));
    const ghost = state.everAlerted ? 0 : SCORE.ghostBonus;
    state.score += SCORE.levelClear + timeBonus + ghost;
    playWin();
    if (state.levelIndex + 1 >= LEVELS.length) {
      state.won = true;
      return events | EVENT_WIN;
    }
    world.loadLevel(state.levelIndex + 1);
    world.state.score = state.score;
    world.state.totalTime = state.totalTime;
    world.state.attempts = state.attempts;
    world.state.message = `${LEVELS[state.levelIndex + 1].name} — ${LEVELS[state.levelIndex + 1].briefing}`;
    world.state.messageTimer = 5;
    return events | EVENT_LEVEL_CLEAR;
  }
  return events;
}

/** Restart the current wing after being caught, keeping the run's score. */
export function retryLevel(world) {
  const state = world.state;
  const score = state.score;
  const totalTime = state.totalTime;
  const attempts = state.attempts;
  world.loadLevel(state.levelIndex);
  world.state.score = score;
  world.state.totalTime = totalTime;
  world.state.attempts = attempts;
}
