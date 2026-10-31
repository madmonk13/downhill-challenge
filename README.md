# Just Ski

An endless downhill skiing game for the browser, built with Three.js. It's a fork of Just Sled: a penguin skis down a mountain that keeps getting steeper. One crash ends the run, so dodge the hazards and jump the chasms. There is no build step.

## Run

ES modules need a local server; opening `index.html` directly from disk won't work. Use the bundled dev server, which turns off caching so your edits show up on reload:

```bash
python3 tools/serve.py
```

Then open http://localhost:5174. (It uses 5174 so it can run alongside Just Sled on 5173.)

## Install on a phone (PWA)

`manifest.json` makes the game installable with its own icon and fullscreen launch, and `sw.js` caches it so it plays offline.

Service workers only run on `https://` or `localhost`. On your local network (`http://<your-mac-ip>:5174`) the game still plays, and iOS can still "Add to Home Screen", but it won't work offline and Android won't offer a real install. For the full PWA, serve it over HTTPS (any static host works).

If you add a file under `src/`, add it to `SHELL` in `sw.js`, and bump `CACHE` on every change so phones pick it up. Icons are drawn by `tools/make_icons.py` (needs Pillow).

## How it plays

- **Steer:** drag left and right, or use ←/→ or A/D.
- **Tuck:** keep a finger on the screen for a moment (you keep steering while tucked), or hold ↓, S or Space. You go faster but turn less sharply.
- **One crash ends the run.** Trees, igloos, polar bears, snowmen and penguins all count, and so does falling into a chasm. Now and then a giant snowball rolls across the lane from one side: touch it and you're flattened, but you can jump clear over it.
- **Chasms** cut right across the valley. Kickers sit on the near edge; hit one fast enough to clear the gap. Red posts mark the stretches with no kicker.
- **Tricks:** once you're in the air, tap ↑ for a front flip, ↓ for a back flip, ← to spin left or → to spin right. Holding a key instead does its usual job (←/→ steer, ↓ tucks), and steering still works while a trick is running. On a touchscreen, flick in that direction; only a quick flick counts, so a steering drag never sets one off. A trick is a full turn and takes about half a second, so it must be finished before you touch down or you crash. Chain tricks in one jump for a multiplier: the first scores 1x, the second 2x, the third 3x and so on. A key already held at take-off (like the tuck) doesn't start a trick, because the press has to start in the air. Presses during a trick are ignored, except in its last 0.15 s, when one is held and starts the moment the trick ends.
- **Coins:** single gold coins marked "10" sit around the lane, one hangs over each kicker's jump and one over the middle of each chasm. Each is worth 10 points. `COINS_ENABLED` in `src/terrain.js` switches them off.
- **Score:** 1 point per metre, 10 per coin, 50 per chasm cleared, plus airtime and trick bonuses. Your best score and furthest distance are saved.

## Layout

| File | What it does |
| --- | --- |
| `src/main.js` | Renderer, game states (menu → ready → run → crash → results), countdown, camera, scoring, coins |
| `src/terrain.js` | Endless procedural slope, chasms and their kickers, ice, pads, hazards, chunked meshes, coin placement |
| `src/physics.js` | Skier physics: gravity, friction, drag, tuck, carving, crashes |
| `src/tricks.js` | Trick state: durations, points, combo multiplier, finishing before touchdown |
| `src/skier.js` | Penguin skier model and its animation (lean, tuck, air, wipeout) |
| `src/input.js` | Keyboard and touch: dragging steers, a finger held down tucks, quick flicks in the air are tricks |
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
- **Tricks:** `TRICKS` in `src/tricks.js` sets each trick's duration and base points, `TAP_MS` is how long a key can be held and still count as a trick tap, `BUFFER` is how long before a trick ends a press is held for the next one, and `FORGIVE` is how far through a trick you can be at touchdown and still count it as finished (1 means it must be fully complete).
- **Touch tuck:** `TUCK_HOLD_MS` in `src/input.js` is how long a finger must stay down before it tucks.
- **Touch steering sensitivity:** the slider in Settings (saved per device). `STEER_PX` in `src/input.js` is the drag that gives full lock at 100%, and the default and range are in `src/save.js`.
- **Steering:** `TURN_RATE`, `TUCK_TURN`, `GRIP`, `CARVE_LOSS` (speed lost carving) and `MAX_YAW` in `src/physics.js`.
- **Chasms:**
  - In `src/terrain.js`, `chasmFor()` sets how often they appear and how wide they are, and `rampsFor()` sets kicker width, count and height.
  - `CHASM_DEPTH`, `CHASM_RUNUP` and `CHASM_CLEAR` in `src/terrain.js` set the depth, the kicker length and how much space other hazards leave around a chasm.
- **Hazards:** placement is in `obstaclesFor()`, `snowmenFor()`, `penguinsFor()` and `snowballsFor()` (how often, size, speed and rest time of the rolling snowballs) in `src/terrain.js`, and the hit radius is `SKIER_R` in `src/physics.js`.
- **Chasm shape:** `chasmDepth()` in `src/terrain.js` (floor depth, ledge height and the ragged ends).
- **Scoring:** `COIN_POINTS`, `CHASM_POINTS` and the airtime bonus in `onLanding()` in `src/main.js`.
- **Day/night and weather:** `src/environment.js`.
