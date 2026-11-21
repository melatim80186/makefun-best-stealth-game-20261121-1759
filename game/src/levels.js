// The three hand-designed museum wings. Each level is built from rectangles on
// an empty floor grid so the layout stays exact and readable: walls block sight
// and movement, crates and display cases are cover that block vision cones,
// plants hide the thief, shadow tiles slow detection, intel is the objective
// and the exit only opens once every intel is taken.
//
// Tile codes: '#' wall, '.' floor, ',' shadow floor, 'C' crate, 'D' display case,
// 'P' plant (hiding spot), 'I' intel, 'E' exit, '@' thief spawn, 'G' guard spawn.
import { COLS, ROWS } from './config.js';

export const TILE_WALL = '#';
export const TILE_FLOOR = '.';
export const TILE_SHADOW = ',';
export const TILE_CRATE = 'C';
export const TILE_CASE = 'D';
export const TILE_PLANT = 'P';
export const TILE_INTEL = 'I';
export const TILE_EXIT = 'E';

export function tileBlocksSight(tile) {
  return tile === TILE_WALL || tile === TILE_CRATE || tile === TILE_CASE;
}
export function tileBlocksMovement(tile) {
  return tile === TILE_WALL || tile === TILE_CRATE || tile === TILE_CASE;
}
export function tileHides(tile) {
  return tile === TILE_PLANT || tile === TILE_SHADOW;
}

/**
 * Build a level grid from rectangles. `rects` entries are [x, y, w, h, tile].
 * Guard patrol paths are lists of [tileX, tileY] waypoints.
 */
function buildLevel(def) {
  const grid = [];
  for (let y = 0; y < ROWS; y += 1) {
    const row = [];
    for (let x = 0; x < COLS; x += 1) row.push(x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1 ? TILE_WALL : TILE_FLOOR);
    grid.push(row);
  }
  for (const [x, y, w, h, tile] of def.rects) {
    for (let yy = y; yy < y + h; yy += 1) {
      for (let xx = x; xx < x + w; xx += 1) grid[yy][xx] = tile;
    }
  }
  const intel = def.intel.map(([x, y]) => ({ x, y, taken: false }));
  for (const spot of intel) grid[spot.y][spot.x] = TILE_INTEL;
  grid[def.exit[1]][def.exit[0]] = TILE_EXIT;
  return {
    name: def.name,
    subtitle: def.subtitle,
    briefing: def.briefing,
    // Per-wing palette override (v2): Wing 1 keeps the base palette, Wing 2
    // is warmer amber, Wing 3 is a darker vault with brass wall trim.
    palette: def.palette ?? null,
    grid,
    spawn: def.spawn,
    exit: def.exit,
    intel,
    guards: def.guards.map((g) => ({ path: g.path, speed: g.speed ?? 1, pause: g.pause ?? 1.6 })),
  };
}

export const LEVELS = [
  buildLevel({
    name: '1 — The Marble Foyer',
    subtitle: 'Two guards, two relics. Learn the patrols.',
    briefing: 'Lift both relics, then slip out the gilded door — unseen.',
    spawn: [2, 17],
    exit: [29, 2],
    intel: [[15, 3], [26, 16]],
    rects: [
      [10, 2, 1, 6, TILE_WALL], [10, 12, 1, 6, TILE_WALL],
      [20, 2, 1, 5, TILE_WALL], [20, 13, 1, 5, TILE_WALL],
      [4, 9, 5, 1, TILE_WALL], [23, 9, 5, 1, TILE_WALL],
      [4, 4, 2, 2, TILE_CRATE], [16, 10, 2, 2, TILE_CRATE], [26, 5, 2, 2, TILE_CRATE],
      [6, 14, 2, 2, TILE_CRATE], [24, 14, 2, 2, TILE_CRATE],
      [13, 4, 2, 1, TILE_CASE], [13, 15, 2, 1, TILE_CASE], [24, 11, 1, 2, TILE_CASE],
      [3, 13, 2, 2, TILE_PLANT], [18, 4, 2, 2, TILE_PLANT], [28, 12, 1, 2, TILE_PLANT],
      [2, 2, 4, 2, TILE_SHADOW], [22, 16, 5, 2, TILE_SHADOW], [13, 10, 3, 2, TILE_SHADOW],
    ],
    guards: [
      { path: [[6, 5], [15, 5], [15, 15], [6, 16]], speed: 1 },
      { path: [[24, 4], [24, 16], [17, 16], [17, 4]], speed: 1 },
    ],
  }),
  buildLevel({
    name: '2 — The Sculpture Hall',
    subtitle: 'Three guards, crossing patrols. Use the plants.',
    briefing: 'Three relics among the statues. The patrols cross — time your moves.',
    palette: {
      floorLight: '#4a4133', floorDark: '#423a2c', floorShadow: '#221a11',
      wall: '#231a10', wallTop: '#4d3a1e',
    },
    spawn: [3, 10],
    exit: [29, 17],
    intel: [[5, 3], [16, 10], [27, 3]],
    rects: [
      [8, 2, 1, 7, TILE_WALL], [8, 11, 1, 7, TILE_WALL],
      [16, 2, 1, 4, TILE_WALL], [16, 14, 1, 4, TILE_WALL],
      [24, 2, 1, 7, TILE_WALL], [24, 11, 1, 7, TILE_WALL],
      [12, 9, 8, 1, TILE_WALL],
      // v2 rooms: the middle band is walled across the centre (gaps at the
      // column feet and the right side) and the bottom-right corner is a
      // nook with a single door at (25,14).
      [9, 9, 3, 1, TILE_WALL], [26, 14, 5, 1, TILE_WALL],
      [3, 5, 2, 2, TILE_CRATE], [12, 4, 2, 2, TILE_CRATE], [20, 5, 2, 2, TILE_CRATE],
      [28, 5, 2, 2, TILE_CRATE], [12, 15, 2, 2, TILE_CRATE], [20, 14, 2, 2, TILE_CRATE],
      [5, 12, 1, 2, TILE_CASE], [11, 13, 2, 1, TILE_CASE], [27, 12, 1, 2, TILE_CASE],
      [3, 15, 2, 2, TILE_PLANT], [10, 2, 2, 2, TILE_PLANT], [18, 16, 2, 2, TILE_PLANT],
      [26, 15, 2, 2, TILE_PLANT], [14, 6, 2, 2, TILE_PLANT],
      [2, 10, 4, 2, TILE_SHADOW], [26, 10, 4, 2, TILE_SHADOW], [13, 16, 4, 2, TILE_SHADOW],
    ],
    guards: [
      { path: [[4, 3], [13, 3], [13, 17], [4, 17]], speed: 1.05 },
      { path: [[28, 3], [19, 3], [19, 17], [28, 17]], speed: 1.05 },
      { path: [[16, 7], [16, 12], [12, 12], [12, 7]], speed: 1.15 },
    ],
  }),
  buildLevel({
    name: '3 — The Vault Wing',
    subtitle: 'Four guards, tight patrols. Ghost it for the bonus.',
    briefing: 'Four relics, four guards, one very nervous curator. Never get seen.',
    // v2 rooms: three full-height partitions with a single staggered door
    // each (x=8 door at y=5, x=16 door at y=14, x=24 door at y=9) split the
    // wing into four rooms — one guard patrols each room, and every door
    // tile has walkable floor on both sides so BFS routes through them.
    palette: {
      floorLight: '#2e2e3a', floorDark: '#282834', floorShadow: '#11111a',
      wall: '#13151f', wallTop: '#8a6a34',
    },
    spawn: [2, 17],
    exit: [20, 2],
    intel: [[3, 3], [28, 3], [3, 16], [28, 16]],
    rects: [
      [8, 2, 1, 3, TILE_WALL], [8, 6, 1, 12, TILE_WALL],
      [16, 2, 1, 12, TILE_WALL], [16, 15, 1, 3, TILE_WALL],
      [24, 2, 1, 7, TILE_WALL], [24, 10, 1, 8, TILE_WALL],
      [3, 9, 2, 2, TILE_CRATE], [27, 9, 2, 2, TILE_CRATE], [13, 10, 2, 1, TILE_CRATE], [19, 9, 2, 1, TILE_CRATE],
      [10, 4, 2, 2, TILE_CASE], [9, 14, 2, 2, TILE_CASE], [21, 4, 2, 2, TILE_CASE], [21, 14, 2, 2, TILE_CASE],
      [4, 5, 2, 2, TILE_PLANT], [27, 5, 2, 2, TILE_PLANT], [4, 13, 2, 2, TILE_PLANT],
      [27, 13, 2, 2, TILE_PLANT], [13, 5, 2, 2, TILE_PLANT], [18, 5, 2, 2, TILE_PLANT],
      // Spawn pocket: the thief starts hidden in the entrance plants, so the
      // vault guard's patrol past (3,15) never spots a player who has just
      // stepped in and is still deciding where to go.
      [1, 16, 2, 2, TILE_PLANT],
      [2, 11, 2, 2, TILE_SHADOW], [28, 11, 2, 2, TILE_SHADOW], [13, 12, 3, 2, TILE_SHADOW],
      [17, 12, 3, 2, TILE_SHADOW], [5, 2, 2, 2, TILE_SHADOW], [25, 2, 2, 2, TILE_SHADOW],
    ],
    guards: [
      { path: [[3, 4], [3, 15], [6, 10]], speed: 1.2 },
      { path: [[28, 4], [28, 15], [26, 10]], speed: 1.2 },
      { path: [[12, 4], [11, 15], [14, 8]], speed: 1.25 },
      { path: [[19, 4], [19, 15], [21, 9]], speed: 1.1 },
    ],
  }),
];
