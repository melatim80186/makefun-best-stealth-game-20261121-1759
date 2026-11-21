// The screenshot scenes behind ?shot=title|play|near|win. Each one stages a
// real game state through the world's own rules — guards mid-patrol, a thief
// behind cover, a live detection meter — then the renderer paints it, so the
// frame is exactly what a short game really looks like.
import { TILE } from './config.js';
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_WIN } from './render.js';
import { GUARD_SUSPICIOUS, GUARD_CHASE } from './guards.js';

function tileCenter(tx, ty) {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}

function placeGuard(state, index, tx, ty, facingDeg, suspicion, guardState) {
  const guard = state.guards[index];
  const at = tileCenter(tx, ty);
  guard.x = at.x;
  guard.y = at.y;
  guard.facing = (facingDeg * Math.PI) / 180;
  guard.suspicion = suspicion;
  guard.state = guardState;
  guard.pauseTimer = 0.6;
  return guard;
}

function placeThief(state, tx, ty, facingDeg, sneaking) {
  const at = tileCenter(tx, ty);
  state.player.x = at.x;
  state.player.y = at.y;
  state.player.facing = (facingDeg * Math.PI) / 180;
  state.player.sneaking = sneaking;
  state.player.moving = true;
}

/**
 * Set `world` to the named scene and return the screen to draw over it and
 * the best score to show. Any other name stages the title.
 */
export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  if (name === 'play') {
    // Mid-level tension: the thief crouches behind a crate in the foyer while
    // a guard's cone sweeps past; one relic already lifted, meter half full.
    placeThief(state, 7, 6, 90, true);
    placeGuard(state, 0, 6, 4, 90, 12, GUARD_SUSPICIOUS);
    placeGuard(state, 1, 22, 8, 180, 0, 'patrol');
    state.intel[0].taken = true;
    state.intelCollected = 1;
    state.score = 150;
    state.detection = 52;
    state.totalTime = 47;
    state.levelTime = 47;
    state.message = 'Relic lifted — 1 of 2. The guard heard something…';
    state.messageTimer = 10;
    return { screen: SCREEN_PLAY, best: 1240 };
  }
  if (name === 'near') {
    // A near-miss: the thief freezes in the shadow at the edge of a cone while
    // an alerted guard closes in, meter nearly full.
    placeThief(state, 13, 11, 0, true);
    placeGuard(state, 0, 12, 9, 45, 96, GUARD_CHASE);
    placeGuard(state, 1, 26, 14, 270, 70, GUARD_SUSPICIOUS);
    state.intel[0].taken = true;
    state.intelCollected = 1;
    state.score = 150;
    state.detection = 91;
    state.alarm = true;
    state.everAlerted = true;
    state.totalTime = 96;
    state.levelTime = 96;
    state.message = 'ALARM — break line of sight!';
    state.messageTimer = 10;
    return { screen: SCREEN_PLAY, best: 1240 };
  }
  if (name === 'win') {
    // The clean getaway: every wing cleared, ghost run intact. Stage the
    // background as a finished level so nothing behind the panel contradicts it.
    for (const spot of state.intel) spot.taken = true;
    state.intelCollected = state.intel.length;
    state.exitOpen = true;
    state.messageTimer = 0;
    state.won = true;
    state.score = 3420;
    state.totalTime = 318;
    state.attempts = 1;
    state.everAlerted = false;
    return { screen: SCREEN_WIN, best: 3420 };
  }
  // Title: guards patrolling the foyer behind the title card.
  placeGuard(state, 0, 8, 5, 90, 0, 'patrol');
  placeGuard(state, 1, 22, 12, 0, 0, 'patrol');
  return { screen: SCREEN_TITLE, best: 1240 };
}
