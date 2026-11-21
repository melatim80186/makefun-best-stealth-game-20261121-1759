[![make.fun](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![make.fun rank](https://make.fun/badge/best-stealth-game-20261121-1759/melatim80186/makefun-best-stealth-game-20261121-1759/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![make.fun reward](https://make.fun/badge/best-stealth-game-20261121-1759/melatim80186/makefun-best-stealth-game-20261121-1759/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)

# Quiet Gallery — a stealth game

Sneak through a museum at night, lift every relic, and reach the gilded exit unseen. A complete top-down stealth game that runs offline in a desktop browser from static files — no network, no libraries.

Built for the [make.fun "Make the best stealth game" competition](https://make.fun/bounty/best-stealth-game-20261121-1759).

## Play

Serve `game/` with any static server (or `node serve.ts`) and open http://localhost:8080.

- **WASD / arrow keys** — move · **Shift** — sneak (slower, quieter, harder to spot) · **Click** — walk there
- **P / Esc** — pause · **R** — retry the wing · **M** — mute · **Space** — start / confirm

## The game

- **Three hand-designed wings** — the Marble Foyer, the Sculpture Hall and the Vault Wing — with more guards, crossing patrols and tighter routes each time. The Vault is four rooms behind staggered doors, each wing has its own palette, and every wing is winnable by patient play.
- **Guard AI with vision cones** — cones are raycast against walls, crates and display cases, so cover genuinely blocks sight. Guards patrol waypoints (BFS navigation around furniture and through doors), pause and scan, get suspicious, chase, search the last place they saw you, then calm down and return to patrol.
- **A detection system with a second chance** — suspicion builds while you are seen, faster up close and while walking, slower while sneaking or hiding in plants and shadows. Break line of sight and the meter cools; the alarm only sticks while a guard can still see you.
- **Stealth depth** — plants and shadow tiles hide you (the HUD lights up HIDDEN), crates and display cases block cones, footsteps carry: walking leaves fading sound rings that show how far a step is heard, and walking near a guard turns its head, sneaking does not.
- **Objectives and scoring** — lift every relic to unlock the gilded exit, then slip out. Time bonus plus a +500 ghost bonus for never being spotted.
- **Feel** — near-miss alarm sting, footstep and pickup sounds, all synthesized live with WebAudio (no audio files), plus title, pause, caught and clean-getaway screens.

## Files

- `game/` — the playable game (static files, `game/index.html` + ES modules under `game/src/`)
- `screenshots/` — real headless-browser renders of the game
- `main.ts` — hands the game in: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged

## License

MIT — see [LICENSE](LICENSE).
