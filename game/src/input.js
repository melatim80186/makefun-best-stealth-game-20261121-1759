// Keyboard + mouse input. WASD or arrows move, Shift sneaks, click sets a
// click-to-move target, Q or right-click tosses a pebble, Space/Enter
// confirms, P or Esc pauses, M mutes, R restarts.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_MUTE = 8;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let clickTarget = null;
  let clickStamp = 0;
  // A pebble throw request: { target } — target is a canvas point for a
  // right-click throw, null for a Q throw (facing direction). Read once per
  // frame via takePebble(); right-click never starts the game or moves.
  let pebbleRequest = null;

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function keyOf(event) {
    return event.key.length === 1 ? event.key.toLowerCase() : event.key;
  }

  window.addEventListener('keydown', (event) => {
    const key = keyOf(event);
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) event.preventDefault();
    if (event.repeat) return;
    keys.add(key);
    if (key === ' ' || key === 'Enter') actions |= ACTION_CONFIRM;
    if (key === 'p' || key === 'Escape') actions |= ACTION_PAUSE;
    if (key === 'r') actions |= ACTION_RESTART;
    if (key === 'm') actions |= ACTION_MUTE;
    if (key === 'q') pebbleRequest = { target: null };
  });
  window.addEventListener('keyup', (event) => keys.delete(keyOf(event)));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('pointerdown', (event) => {
    if (event.button === 2) {
      pebbleRequest = { target: canvasPoint(event) };
      return;
    }
    clickTarget = canvasPoint(event);
    clickStamp += 1;
    actions |= ACTION_CONFIRM;
  });
  // Right-click is a game action, not a browser menu.
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** Normalised movement direction from held keys, or null when none are held. */
    direction() {
      let x = 0;
      let y = 0;
      if (keys.has('a') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('d') || keys.has('ArrowRight')) x += 1;
      if (keys.has('w') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('s') || keys.has('ArrowDown')) y += 1;
      if (x === 0 && y === 0) return null;
      const len = Math.hypot(x, y);
      return { x: x / len, y: y / len };
    },
    sneaking() {
      return keys.has('Shift');
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The latest click-to-move target and a stamp that changes on every click. */
    clickTarget() {
      return { target: clickTarget, stamp: clickStamp };
    },
    /** A pending pebble throw ({ target } or null), consumed once per frame. */
    takePebble() {
      const request = pebbleRequest;
      pebbleRequest = null;
      return request;
    },
    clearClickTarget() {
      clickTarget = null;
    },
  };
}
