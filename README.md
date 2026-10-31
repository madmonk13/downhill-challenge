# Downhill Challenge

An endless downhill skiing game for the browser, built with Three.js. It's a fork of SledMaster: a penguin skis down a mountain that keeps getting steeper. One crash ends the run, so dodge the hazards and jump the chasms. There is no build step.

## Run

ES modules need a local server; opening `index.html` directly from disk won't work. Use the bundled dev server, which turns off caching so your edits show up on reload:

```bash
python3 tools/serve.py
```

Then open http://localhost:5174. (It uses 5174 so it can run alongside SledMaster on 5173.)

## Install on a phone (PWA)

`manifest.json` makes the game installable with its own icon and fullscreen launch, and `sw.js` caches it so it plays offline.

Service workers only run on `https://` or `localhost`. On your local network (`http://<your-mac-ip>:5174`) the game still plays, and iOS can still "Add to Home Screen", but it won't work offline and Android won't offer a real install. For the full PWA, serve it over HTTPS (any static host works).

If you add a file under `src/`, add it to `SHELL` in `sw.js`, and bump `CACHE` on every change so phones pick it up. Icons are drawn by `tools/make_icons.py` (needs Pillow). They still show SledMaster's sled.

## How it plays

- **Steer:** drag left and right, or use ←/→ or A/D.
- **Tuck:** hold a second finger on the screen, or ↓, S or Space. You go faster but turn less sharply.
- **One crash ends the run.** Trees, igloos, polar bears, snowmen and penguins all count, and so does falling into a chasm.
- **Chasms** cut right across the valley. Kickers sit on the near edge; hit one fast enough to clear the gap. Red posts mark the stretches with no kicker.
- **Score:** 1 point per metre, 5 per coin, 50 per chasm cleared, plus airtime bonuses. Your best score and furthest distance are saved.

## Layout

| File | What it does |
| --- | --- |
| `src/main.js` | Renderer, game states (menu → ready → run → crash → results), countdown, camera, scoring, coins |
| `src/terrain.js` | Endless procedural slope, chasms and their kickers, ice, pads, hazards, chunked meshes, coin patterns |
| `src/physics.js` | Skier physics: gravity, friction, drag, tuck, carving, crashes |
| `src/skier.js` | Penguin skier model and its animation (lean, tuck, air, wipeout) |
| `src/input.js` | Keyboard and multi-touch: first finger steers, a second one tucks |
| `src/ui.js` | HUD, start hint and results |
| `src/scenery.js` | Clouds, distant mountains, snow spray |
| `src/effects.js` | Coin pickup animation, hazard hit effects |
| `src/environment.js` | Day/night cycle and falling snow |
| `src/audio.js` | Synthesized sound effects (Web Audio), mute setting |
| `src/save.js` | `localStorage` best scores |

## Tuning knobs

- **Slope and speed:**
  - `SLOPE_START`, `SLOPE_END` and `SLOPE_RAMP` in `src/terrain.js` set how steep the hill is and how quickly it steepens.
  - `DRAG`, `TUCK_DRAG` and `MU` in `src/physics.js` set top speed, standing and tucked.
- **Steering:** `TURN_RATE`, `TUCK_TURN`, `GRIP`, `CARVE_LOSS` (speed lost carving) and `MAX_YAW` in `src/physics.js`.
- **Chasms:**
  - In `src/terrain.js`, `chasmFor()` sets how often they appear and how wide they are, and `rampsFor()` sets kicker width, count and height.
  - `CHASM_DEPTH`, `CHASM_RUNUP` and `CHASM_CLEAR` in `src/terrain.js` set the depth, the kicker length and how much space other hazards leave around a chasm.
- **Hazards:** placement is in `obstaclesFor()`, `snowmenFor()` and `penguinsFor()` in `src/terrain.js`, and the hit radius is `SKIER_R` in `src/physics.js`.
- **Scoring:** `COIN_POINTS`, `CHASM_POINTS` and the airtime bonus in `onLanding()` in `src/main.js`.
- **Day/night and weather:** `src/environment.js`.

## Credits

- “Igloo” by Poly by Google, [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/), via Poly Pizza (`models/igloo.glb`, unmodified).
