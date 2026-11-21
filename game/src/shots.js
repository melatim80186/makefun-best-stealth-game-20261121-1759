// The screenshot scenes behind ?shot=play|wing2|near|win. Each one stages a
// real game state through the world's own rules — guards mid-patrol, a thief
// behind cover, a live detection meter — then the renderer paints it, so the
// frame is exactly what a short game really looks like.
//
// v2: the cover is the Vault Wing (rooms, four cones, HIDDEN badge, sound
// rings), the second shot is the amber Sculpture Hall, the title screen is
// dropped — every slot shows gameplay variety.
// v3: the cover shows the pebble lure in action — Keeper Mirek walks to the
// "?" pebble marker while the thief sneaks past in shadow behind him, the
// named toast and a NEAR MISS % on the meter; wing 2 shows a filled cone
// and a named suspicious guard.
import { TILE } from './config.js';
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_WIN } from './render.js';
import { GUARD_SUSPICIOUS, GUARD_CHASE, GUARD_INVESTIGATE } from './guards.js';

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

// Two fading footstep rings, as if the thief has just walked into cover.
function seedRings(state) {
  state.rings = [{ t: state.totalTime - 0.2 }, { t: state.totalTime - 0.55 }];
}

/**
 * Set `world` to the named scene and return the screen to draw over it and
 * the best score to show. Any other name stages the title.
 */
export function stageShot(name, world) {
  if (name === 'play') {
    // Cover: the Vault Wing at its densest — four rooms, four cones, the
    // thief hidden in a shadow with rings fading around them, one relic
    // lifted, the meter half full, the gilded exit still locked — and the
    // pebble lure in action: Keeper Mirek (guard 2) walks west to the
    // pebble marker while the thief slips past behind him in the shadow.
    // His "?" + name label, the toast, the NEAR MISS % and Pebbles ×2 all read.
    world.loadLevel(2);
    const state = world.state;
    placeThief(state, 18, 12, 180, true);
    const mirek = placeGuard(state, 2, 15, 12, 180, 45, GUARD_INVESTIGATE);
    mirek.pebbleTarget = tileCenter(12, 12);
    mirek.investigateTimer = 2.5;
    mirek.lastSeen = tileCenter(12, 12);
    state.pebble = { x: 12 * TILE + TILE / 2, y: 12 * TILE + TILE / 2, t: state.totalTime - 0.4, investigator: 2 };
    state.pebbles = 2;
    placeGuard(state, 0, 4, 8, 0, 12, GUARD_SUSPICIOUS);
    placeGuard(state, 1, 27, 8, 180, 0, 'patrol');
    placeGuard(state, 3, 20, 8, 180, 0, 'patrol');
    state.intel[0].taken = true;
    state.intelCollected = 1;
    state.score = 150;
    state.detection = 52;
    state.totalTime = 47;
    state.levelTime = 47;
    state.message = 'Keeper Mirek heard something…';
    state.messageTimer = 10;
    seedRings(state);
    return { screen: SCREEN_PLAY, best: 1240 };
  }
  if (name === 'wing2') {
    // Second shot: the amber Sculpture Hall — a different palette, the
    // thief hidden in the big shadow by the spawn, patrols crossing, and
    // Keeper Lova suspicious with a visibly filling cone (NEAR MISS — 55%).
    world.loadLevel(1);
    const state = world.state;
    placeThief(state, 4, 10, 0, true);
    placeGuard(state, 0, 6, 5, 90, 0, 'patrol');
    placeGuard(state, 1, 26, 5, 180, 0, 'patrol');
    placeGuard(state, 2, 16, 11, 0, 55, GUARD_SUSPICIOUS);
    state.intel[0].taken = true;
    state.intelCollected = 1;
    state.score = 150;
    state.detection = 30;
    state.totalTime = 63;
    state.levelTime = 63;
    state.message = 'Keeper Lova glimpsed something!';
    state.messageTimer = 10;
    seedRings(state);
    return { screen: SCREEN_PLAY, best: 1240 };
  }
  world.reset();
  const state = world.state;
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
    seedRings(state);
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
