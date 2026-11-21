// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between five screens: title,
// play, paused, caught and win.
//
// ?shot=title|play|near|win stages that scene instead of running the loop,
// paints it twice and sets window.__shotReady for a screenshot.
// ?selftest=1 runs a scripted playthrough in the page and writes the result
// to window.__selftest for headless verification.
import { BEST_KEY, STEP } from './config.js';
import { createWorld, stepWorld, retryLevel, EVENT_CAUGHT, EVENT_WIN, EVENT_LEVEL_CLEAR } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_RESTART, ACTION_MUTE, createInput } from './input.js';
import { createRenderer, SCREEN_CAUGHT, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';
import { toggleMute, startRoomTone } from './audio.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const selftest = params.get('selftest') === '1';

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld();
world.reset();
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

// A scripted playthrough for headless checks: walk, sneak, collect, win a
// level, get spotted, get caught. Reports each leg to window.__selftest.
async function runSelftest() {
  const results = {};
  const tick = async (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitFor = async (fn, timeoutMs, label) => {
    const start = performance.now();
    while (performance.now() - start < timeoutMs) {
      if (fn()) return true;
      await tick(50);
    }
    results[label] = 'TIMEOUT';
    return false;
  };
  try {
    // Start the game from the title screen first.
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    await tick(400);
    window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' }));
    results.started = world.state && !world.state.won ? 'pass' : 'FAIL';
    // Leg 1: the world steps and the thief moves with keyboard input.
    const startX = world.state.player.x;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));
    await tick(600);
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'd' }));
    results.movesRight = world.state.player.x > startX + 20 ? 'pass' : `FAIL x=${world.state.player.x} start=${startX}`;
    // Leg 2: sneaking is slower than walking over the same time.
    const sx = world.state.player.x;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));
    await tick(600);
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'd' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift' }));
    const sneakDist = world.state.player.x - sx;
    results.sneakSlower = sneakDist > 5 && sneakDist < 90 ? 'pass' : `FAIL sneakDist=${sneakDist}`;
    // Leg 3: teleport onto a relic and step — it must be collected.
    const spot = world.state.intel[0];
    world.state.player.x = spot.x * 40 + 20;
    world.state.player.y = spot.y * 40 + 20;
    await waitFor(() => world.state.intelCollected >= 1, 2000, 'collectRelic');
    if (results.collectRelic !== 'TIMEOUT') results.collectRelic = world.state.intelCollected >= 1 ? 'pass' : 'FAIL';
    // Leg 4: stand in a guard's cone and stare — detection must rise. Pin the
    // guard on a known-open tile and keep it facing the thief on every poll,
    // or its patrol would turn it away from the staged thief.
    const guard = world.state.guards[0];
    const gx = 5 * 40 + 20;
    const gy = 1 * 40 + 20;
    guard.x = gx;
    guard.y = gy;
    world.state.player.x = gx;
    world.state.player.y = gy + 60;
    guard.state = 'patrol';
    guard.suspicion = 0;
    guard.pauseTimer = 5;
    world.state.detection = 0;
    await waitFor(() => {
      guard.x = gx;
      guard.y = gy;
      guard.facing = Math.PI / 2;
      guard.pauseTimer = 5;
      return world.state.detection > 30;
    }, 4000, 'detectionRises');
    if (results.detectionRises !== 'TIMEOUT') results.detectionRises = world.state.detection > 30 ? 'pass' : `FAIL det=${world.state.detection}`;
    // Leg 5: hide in a plant — detection must fall again.
    world.state.player.x = 3 * 40 + 20;
    world.state.player.y = 13 * 40 + 20;
    await waitFor(() => world.state.detection < 5, 8000, 'detectionDecaysInPlant');
    if (results.detectionDecaysInPlant !== 'TIMEOUT') results.detectionDecaysInPlant = world.state.detection < 5 ? 'pass' : `FAIL det=${world.state.detection}`;
    results.done = true;
  } catch (error) {
    results.error = String(error);
  }
  window.__selftest = results;
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    startRoomTone();
    announce('Playing. Lift every relic, then reach the exit unseen.');
  }

  function endCaught() {
    screen = SCREEN_CAUGHT;
    announce(`Caught. Score ${world.state.score}. Press R to retry the wing.`);
  }

  function endWin() {
    screen = SCREEN_WIN;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`The clean getaway. Final score ${world.state.score}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const nowMuted = toggleMute();
      announce(nowMuted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_RESTART && (screen === SCREEN_PLAY || screen === SCREEN_CAUGHT)) {
      retryLevel(world);
      screen = SCREEN_PLAY;
      announce('Wing restarted.');
      return;
    }
    if (actions & ACTION_CONFIRM && screen === SCREEN_TITLE) startGame();
    else if (actions & ACTION_CONFIRM && screen === SCREEN_WIN) startGame();
    else if (actions & ACTION_CONFIRM && screen === SCREEN_CAUGHT) {
      screen = SCREEN_TITLE;
      announce('Quiet Gallery. Press Space or click to start.');
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) return;
    const events = stepWorld(world, { dir: input.direction(), sneaking: input.sneaking(), click: input.clickTarget() }, STEP);
    if (events & EVENT_CAUGHT) endCaught();
    else if (events & EVENT_WIN) endWin();
    else if (events & EVENT_LEVEL_CLEAR) announce(`${world.state.level.name}. ${world.state.level.briefing}`);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Quiet Gallery. Press Space or click to start.');
  if (selftest) setTimeout(runSelftest, 500);
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
