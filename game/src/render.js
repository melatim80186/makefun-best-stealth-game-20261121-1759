// Everything on screen: the museum floor, raycast vision cones, guards, the
// thief, the HUD and the title / pause / caught / win screens. The canvas is
// a fixed 1280x800 logical area scaled to the window.
import { FIELD, TILE, PALETTE, FONT, TITLE, SUBTITLE, GUARD, PLAYER } from './config.js';
import { TILE_WALL, TILE_CRATE, TILE_CASE, TILE_PLANT, TILE_SHADOW, TILE_INTEL, TILE_EXIT, tileHides } from './levels.js';
import { GUARD_PATROL, GUARD_SUSPICIOUS, GUARD_CHASE, GUARD_SEARCH } from './guards.js';
import { castVisionRay, tileAtPixel } from './vision.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_WIN = 'win';

const CONE_RAYS = 26;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function fitCanvas() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = FIELD.width * dpr;
    canvas.height = FIELD.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  fitCanvas();
  window.addEventListener('resize', fitCanvas);

  function drawCone(state, guard) {
    const range = GUARD.visionRange;
    const colour = guard.state === GUARD_CHASE
      ? PALETTE.coneAlarm
      : guard.state === GUARD_SUSPICIOUS || guard.state === GUARD_SEARCH
        ? PALETTE.coneSuspicious
        : PALETTE.coneCalm;
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    for (let i = 0; i <= CONE_RAYS; i += 1) {
      const angle = guard.facing - GUARD.visionHalfAngle + (2 * GUARD.visionHalfAngle * i) / CONE_RAYS;
      const dist = castVisionRay(state.grid, guard.x, guard.y, angle, range);
      ctx.lineTo(guard.x + Math.cos(angle) * dist, guard.y + Math.sin(angle) * dist);
    }
    ctx.closePath();
    ctx.fillStyle = colour;
    ctx.fill();
  }

  function drawFloor(state) {
    for (let y = 0; y < state.grid.length; y += 1) {
      for (let x = 0; x < state.grid[y].length; x += 1) {
        const tile = state.grid[y][x];
        const px = x * TILE;
        const py = y * TILE;
        if (tile === TILE_WALL) {
          ctx.fillStyle = PALETTE.wall;
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = PALETTE.wallTop;
          ctx.fillRect(px, py, TILE, 5);
          continue;
        }
        ctx.fillStyle = (x + y) % 2 === 0 ? PALETTE.floorLight : PALETTE.floorDark;
        ctx.fillRect(px, py, TILE, TILE);
        if (tile === TILE_SHADOW) {
          ctx.fillStyle = PALETTE.floorShadow;
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = 'rgba(255,255,255,0.04)';
          ctx.fillRect(px, py, TILE, 2);
        }
        // Faint marble veining so the floor is not a flat slab.
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.beginPath();
        ctx.moveTo(px + 6, py + TILE - 8);
        ctx.lineTo(px + TILE - 10, py + 10);
        ctx.stroke();
      }
    }
  }

  function drawCover(state) {
    for (let y = 0; y < state.grid.length; y += 1) {
      for (let x = 0; x < state.grid[y].length; x += 1) {
        const tile = state.grid[y][x];
        const px = x * TILE;
        const py = y * TILE;
        if (tile === TILE_CRATE) {
          ctx.fillStyle = PALETTE.crate;
          ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
          ctx.fillStyle = PALETTE.crateTop;
          ctx.fillRect(px + 3, py + 3, TILE - 6, 7);
          ctx.strokeStyle = '#4a3517';
          ctx.strokeRect(px + 3.5, py + 3.5, TILE - 7, TILE - 7);
          ctx.beginPath();
          ctx.moveTo(px + 3, py + 3);
          ctx.lineTo(px + TILE - 3, py + TILE - 3);
          ctx.stroke();
        } else if (tile === TILE_CASE) {
          ctx.fillStyle = PALETTE.displayCase;
          ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
          ctx.fillStyle = PALETTE.displayGlass;
          ctx.globalAlpha = 0.5;
          ctx.fillRect(px + 8, py + 8, TILE - 16, TILE - 16);
          ctx.globalAlpha = 1;
          ctx.fillStyle = '#d8c98a';
          ctx.beginPath();
          ctx.arc(px + TILE / 2, py + TILE / 2, 5, 0, Math.PI * 2);
          ctx.fill();
        } else if (tile === TILE_PLANT) {
          ctx.fillStyle = PALETTE.plant;
          ctx.beginPath();
          ctx.arc(px + TILE / 2, py + TILE / 2, 17, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = PALETTE.plantLeaf;
          for (const [ox, oy, r] of [[-8, -6, 8], [8, -7, 7], [0, 7, 8], [-6, 6, 6], [7, 6, 6]]) {
            ctx.beginPath();
            ctx.arc(px + TILE / 2 + ox, py + TILE / 2 + oy, r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
  }

  function drawIntelAndExit(state) {
    for (const spot of state.intel) {
      if (spot.taken) continue;
      const cx = spot.x * TILE + TILE / 2;
      const cy = spot.y * TILE + TILE / 2;
      const pulse = 1 + Math.sin(performance.now() / 280) * 0.12;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = '#ffd97a';
      ctx.shadowColor = '#ffbf3d';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.lineTo(8, 0);
      ctx.lineTo(0, 11);
      ctx.lineTo(-8, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#7a5b12';
      ctx.font = 'bold 9px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('RELIC', cx, cy + 24);
    }
    const ex = state.level.exit[0] * TILE + TILE / 2;
    const ey = state.level.exit[1] * TILE + TILE / 2;
    ctx.save();
    ctx.fillStyle = state.exitOpen ? PALETTE.exitGlow : '#6b5a2e';
    ctx.shadowColor = state.exitOpen ? '#ffd97a' : 'transparent';
    ctx.shadowBlur = state.exitOpen ? 22 : 0;
    ctx.fillRect(ex - 17, ey - 17, 34, 34);
    ctx.restore();
    ctx.fillStyle = state.exitOpen ? '#3a2c05' : '#c9b478';
    ctx.font = 'bold 10px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText(state.exitOpen ? 'EXIT' : 'LOCKED', ex, ey + 3);
    if (!state.exitOpen) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = '9px ' + FONT;
      ctx.fillText('needs all relics', ex, ey + 28);
    }
  }

  function drawGuard(state, guard) {
    drawCone(state, guard);
    ctx.save();
    ctx.translate(guard.x, guard.y);
    // Body: a red-uniformed guard with a dark cap and a facing nose.
    ctx.fillStyle = guard.state === GUARD_CHASE ? '#e5483d' : PALETTE.guard;
    ctx.beginPath();
    ctx.arc(0, 0, GUARD.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.guardDark;
    ctx.beginPath();
    ctx.arc(0, 0, GUARD.radius - 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(guard.facing);
    ctx.fillStyle = '#f2e6c9';
    ctx.beginPath();
    ctx.arc(GUARD.radius - 3, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.guardDark;
    ctx.fillRect(GUARD.radius - 12, -7, 10, 14);
    ctx.restore();
    // State mark: ? when suspicious, ! when chasing, Z when searching.
    const mark = guard.state === GUARD_CHASE ? '!' : guard.state === GUARD_SUSPICIOUS ? '?' : guard.state === GUARD_SEARCH ? '…' : null;
    if (mark) {
      ctx.fillStyle = guard.state === GUARD_CHASE ? '#ff5a4a' : '#ffcf5e';
      ctx.font = 'bold 20px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText(mark, guard.x, guard.y - GUARD.radius - 6);
    }
    // Personal suspicion arc over the guard.
    if (guard.suspicion > 2) {
      ctx.strokeStyle = guard.suspicion > 60 ? '#ff5a4a' : '#ffcf5e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, GUARD.radius + 6, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * guard.suspicion) / 100);
      ctx.stroke();
    }
  }

  function drawPlayer(state) {
    const p = state.player;
    const tile = tileAtPixel(state.grid, p.x, p.y);
    const hidden = tileHides(tile);
    ctx.save();
    ctx.globalAlpha = hidden ? 0.55 : 1;
    ctx.translate(p.x, p.y);
    // Soft shadow under the thief.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 9, 13, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Cloak, hood and the direction they face.
    ctx.fillStyle = PALETTE.playerCoat;
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER.radius - 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(p.facing);
    ctx.fillStyle = '#2b2b33';
    ctx.beginPath();
    ctx.arc(PLAYER.radius - 4, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (p.sneaking) {
      ctx.fillStyle = '#9fd8ff';
      ctx.font = 'bold 11px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('SNEAKING', p.x, p.y - 20);
    }
    // Detection ring: the shared meter, drawn around the thief while seen.
    if (state.detection > 2) {
      ctx.strokeStyle = state.detection > 60 ? '#ff5a4a' : '#ffcf5e';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, PLAYER.radius + 9, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * state.detection) / 100);
      ctx.stroke();
    }
  }

  function drawHud(state, best) {
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(0, 0, FIELD.width, 46);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 15px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillText(state.level.name, 14, 29);
    ctx.font = '13px ' + FONT;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`Relics ${state.intelCollected}/${state.intel.length}`, 300, 29);
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`Score ${state.score}`, 430, 29);
    ctx.fillStyle = PALETTE.muted;
    const t = Math.floor(state.totalTime);
    ctx.fillText(`Time ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`, 560, 29);
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`Best ${best}`, 660, 29);
    // Detection meter on the right.
    const meterX = 860;
    const meterW = 300;
    ctx.fillStyle = '#22262f';
    ctx.fillRect(meterX, 15, meterW, 16);
    const colour = state.alarm ? '#ff5a4a' : state.detection > 38 ? '#ff9a3d' : '#ffcf5e';
    ctx.fillStyle = colour;
    ctx.fillRect(meterX, 15, (meterW * state.detection) / 100, 16);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 12px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillText(state.alarm ? 'ALARM — BREAK LINE OF SIGHT!' : state.detection > 38 ? 'SUSPICIOUS — hide!' : 'UNSEEN', meterX, 45);
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '11px ' + FONT;
    ctx.fillText('M mute · P pause · R retry wing', FIELD.width - 14, FIELD.height - 10);
    ctx.textAlign = 'left';
    if (state.messageTimer > 0 && state.message) {
      ctx.fillStyle = PALETTE.panel;
      const w = ctx.measureText(state.message).width + 28;
      ctx.fillRect((FIELD.width - w) / 2, 58, w, 30);
      ctx.fillStyle = PALETTE.gold;
      ctx.font = '13px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText(state.message, FIELD.width / 2, 78);
      ctx.textAlign = 'left';
    }
  }

  function panel(title, lines, accent) {
    ctx.fillStyle = 'rgba(5, 6, 10, 0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.fillStyle = '#141824';
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    const w = 640;
    const h = 120 + lines.length * 30;
    const x = (FIELD.width - w) / 2;
    const y = (FIELD.height - h) / 2;
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.font = 'bold 34px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText(title, FIELD.width / 2, y + 58);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '16px ' + FONT;
    lines.forEach((line, i) => ctx.fillText(line, FIELD.width / 2, y + 100 + i * 30));
    ctx.textAlign = 'left';
  }

  function drawTitle(state, best) {
    drawFloor(state);
    drawCover(state);
    for (const guard of state.guards) drawGuard(state, guard);
    drawPlayer(state);
    ctx.fillStyle = 'rgba(5, 6, 10, 0.66)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 64px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText(TITLE, FIELD.width / 2, 190);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'italic 22px ' + FONT;
    ctx.fillText(SUBTITLE, FIELD.width / 2, 228);
    ctx.font = '16px ' + FONT;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('Three wings. Nine relics. One very nervous curator.', FIELD.width / 2, 262);
    const lines = [
      'WASD / arrows — move      Shift — sneak      Click — walk there',
      'Stay out of the yellow cones. Plants and shadows hide you.',
      'Lift every relic, then reach the gilded EXIT unseen.',
      'Guards get suspicious, then chase, then search — break sight to cool down.',
      '',
      'Press SPACE or click to begin',
    ];
    lines.forEach((line, i) => {
      ctx.fillStyle = i === 5 ? PALETTE.gold : PALETTE.text;
      ctx.font = i === 5 ? 'bold 18px ' + FONT : '16px ' + FONT;
      ctx.fillText(line, FIELD.width / 2, 330 + i * 30);
    });
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '13px ' + FONT;
    ctx.fillText(`Best score ${best} · M mute · P pause · R retry wing`, FIELD.width / 2, 560);
    ctx.textAlign = 'left';
  }

  return {
    draw(state, screen, best) {
      ctx.clearRect(0, 0, FIELD.width, FIELD.height);
      ctx.fillStyle = PALETTE.backdrop;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      if (screen === SCREEN_TITLE) {
        drawTitle(state, best);
        return;
      }
      drawFloor(state);
      drawIntelAndExit(state);
      drawCover(state);
      for (const guard of state.guards) drawGuard(state, guard);
      drawPlayer(state);
      drawHud(state, best);
      if (screen === SCREEN_PAUSED) {
        panel('PAUSED', ['The guards wait. So does the curator.', 'P or Space — resume · R — restart this wing'], PALETTE.gold);
      } else if (screen === SCREEN_CAUGHT) {
        panel('CAUGHT!', [
          `The guards found you in ${state.level.name}.`,
          `Score ${state.score} · Relics ${state.intelCollected}/${state.intel.length} · Attempt ${state.attempts}`,
          'R — try the wing again · Space — back to title',
        ], '#ff5a4a');
      } else if (screen === SCREEN_WIN) {
        panel('THE CLEAN GETAWAY', [
          'Every wing cleared. Every relic lifted.',
          `Final score ${state.score} · Time ${Math.floor(state.totalTime / 60)}:${String(Math.floor(state.totalTime) % 60).padStart(2, '0')} · Attempts ${state.attempts}`,
          state.everAlerted ? 'You were spotted along the way — ghost it next time for +500.' : 'GHOST RUN — never once spotted. The curator never knew.',
          'Space — play again',
        ], PALETTE.gold);
      }
    },
  };
}
