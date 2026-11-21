// Every tuning number and colour in one place. The playfield is a fixed 1280x800
// logical area; the renderer scales it to the window, so no rule below depends
// on the screen size. Quiet Gallery is a top-down museum-heist stealth game.
export const FIELD = { width: 1280, height: 800 };
export const TILE = 40;
export const COLS = 32;
export const ROWS = 20;
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  walkSpeed: 175,
  sneakSpeed: 96,
  // Footstep noise radius while walking; sneaking is nearly silent.
  noiseRadius: 230,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 62,
  investigateSpeed: 105,
  chaseSpeed: 168,
  visionRange: 205,
  visionHalfAngle: 0.52, // ~60 degrees total cone
  pauseAtWaypoint: 1.6,
  // Detection rises 0..100. Suspicion starts a search; full detection raises the alarm.
  suspicionAt: 38,
  alarmAt: 100,
  catchDistance: 26,
  // A guard standing almost on top of the player spots them even in a plant.
  plantRevealDistance: 52,
};

export const DETECTION = {
  // Per-second rise at point blank, before distance / movement / cover factors.
  baseRate: 62,
  decayPerSecond: 20,
  // How long the alarm lasts with no sighting before guards give up and search.
  alarmMemorySeconds: 4,
  searchSeconds: 6,
};

export const SCORE = { intel: 150, levelClear: 400, ghostBonus: 500, timeBonusPerSecond: 8 };

export const PALETTE = {
  backdrop: '#0b0d12',
  floorLight: '#3a3f4d',
  floorDark: '#343947',
  floorShadow: '#232733',
  wall: '#191d29',
  wallTop: '#2c3247',
  crate: '#6b4f2a',
  crateTop: '#8a6a3c',
  displayCase: '#274b5e',
  displayGlass: '#7fd4e8',
  plant: '#1e4d2c',
  plantLeaf: '#2f7a44',
  exit: '#e8b64c',
  exitGlow: '#ffd97a',
  player: '#f2e6c9',
  playerCoat: '#7a2e2e',
  guard: '#c94f43',
  guardDark: '#8f2f28',
  coneCalm: 'rgba(240, 200, 90, 0.27)',
  coneSuspicious: 'rgba(240, 150, 60, 0.34)',
  coneAlarm: 'rgba(235, 70, 55, 0.42)',
  text: '#eef1f5',
  muted: '#9aa3b5',
  gold: '#e8b64c',
  panel: 'rgba(10, 12, 18, 0.82)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const BEST_KEY = 'quiet-gallery.best';
export const TITLE = 'QUIET GALLERY';
export const SUBTITLE = 'a museum-heist stealth game';
