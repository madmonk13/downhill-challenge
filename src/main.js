import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Terrain, CHUNK_LEN, TRACK_HALF, animatePads, setIglooModel } from './terrain.js';
import { buildSkier } from './skier.js';
import { SkierBody } from './physics.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { loadSave, writeSave, clearSave, defaultSave } from './save.js';
import { Mountains, Clouds, Spray } from './scenery.js';
import { Environment } from './environment.js';
import { CoinFx, HazardFx } from './effects.js';
import { Sfx } from './audio.js';

const STEP = 1 / 120;
const UP = new THREE.Vector3(0, 1, 0);
const START_Z = -4; // the skier waits in the start gate here
const PUSH_OFF = 5; // m/s out of the gate
const COUNT_STEP = 0.6; // seconds per countdown beat
const CRASH_TIME = 2.2; // seconds to watch the wipeout before the results
const COIN_POINTS = 5;
const CHASM_POINTS = 50;
const CRASH_TEXT = {
  tree: 'Timber!', igloo: 'Wipeout!', bear: 'Wipeout!', snowman: 'Wipeout!', penguin: 'Sorry!', chasm: 'Into the chasm!',
};

// ---------- renderer & scene ----------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 2500);

const hemi = new THREE.HemisphereLight(0xe2f2ff, 0xb4c6da, 1.7);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff3dd, 2.0);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -35, right: 35, top: 35, bottom: -35, near: 1, far: 220 });
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);
const SUN_DIST = 100; // how far up the light's direction the shadow-casting light sits

const mountains = new Mountains(scene);
const clouds = new Clouds(scene);
const env = new Environment(scene, { hemi, sun, clouds });
const spray = new Spray(scene);
const coinFx = new CoinFx(scene);
const hazardFx = new HazardFx(scene, () => terrain);
const sfx = new Sfx();

// ---------- banners across the course: the start gate and your best distance ----------
function makeBanner(text, z, { bg = '#f5b81c', fg = '#5a3d00', lift = 6 } = {}) {
  const group = new THREE.Group();
  const hL = terrain.height(TRACK_HALF, z), hR = terrain.height(-TRACK_HALF, z);
  const top = Math.max(hL, hR, terrain.height(0, z)) + lift;
  const poleMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  for (const [x, h] of [[TRACK_HALF, hL], [-TRACK_HALF, hR]]) {
    const len = top - h + 0.6;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, len, 6), poleMat);
    pole.position.set(x, h + len / 2, z);
    group.add(pole);
  }
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 64);
  ctx.fillStyle = fg;
  ctx.font = 'bold 44px Fredoka, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 512, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(TRACK_HALF * 2, 3.2),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }),
  );
  banner.position.set(0, top, z);
  banner.rotation.y = Math.PI; // readable when approached from behind
  group.add(banner);
  scene.add(group);
  return group;
}

function removeBanner(group) {
  if (!group) return;
  scene.remove(group);
  const seen = new Set();
  group.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.dispose();
    if (seen.has(o.material)) return;
    seen.add(o.material);
    o.material.map?.dispose();
    o.material.dispose();
  });
}

let banners = [];
function placeBanners() {
  banners.forEach(removeBanner);
  banners = [makeBanner('DOWNHILL CHALLENGE  ·  START', 1, { bg: '#12304a', fg: '#ffffff', lift: 8 })];
  if (save.bestDistance >= 30) banners.push(makeBanner(`★  BEST ${Math.floor(save.bestDistance)} m  ★`, save.bestDistance));
}

// ---------- game state ----------
let save = loadSave();
let terrain = null;
const body = new SkierBody();
const skier = buildSkier();
scene.add(skier.group);

const input = new Input(canvas);
let mode = 'menu'; // menu | ready | run | crash | results
let run = null;
let accumulator = 0;
let steerSmooth = 0;
let fovKick = 0; // brief FOV punch when a booster pad fires
let shake = 0; // camera shake from hits, decays to 0
let time = 0;
let countdown = 0; // seconds into the start countdown
let crashTimer = 0;

const ui = new UI({
  play: () => startCourse(),
  endRun: () => (mode === 'run' || mode === 'crash') && endRun(),
  reset: () => {
    clearSave();
    save = defaultSave();
    newCourse();
    ui.showMenu(save);
  },
});

function newCourse() {
  if (terrain) terrain.dispose();
  terrain = new Terrain(scene, (Math.random() * 4294967296) >>> 0);
  terrain.update(0);
  body.reset();
  body.pos.set(0, terrain.height(0, START_Z), START_Z);
  skier.reset();
  spray.clear();
  placeBanners();
  updateSkierVisual(0, true);
  updateCamera(0, true);
}

function startCourse() {
  newCourse();
  run = { coins: 0, air: 0, chasms: 0, maxZ: 0, still: 0, stagnant: 0, time: 0, score: 0 };
  accumulator = 0;
  steerSmooth = 0;
  countdown = 0;
  mode = 'ready';
  ui.resetHud();
  ui.setMode('ready');
  ui.updateHud(run, body, save.best);
}

function go() {
  mode = 'run';
  body.vel.set(0, 0, PUSH_OFF);
  ui.setMode('run');
  sfx.count(true);
  ui.toast('Go!');
}

function score(r) {
  return Math.floor(Math.max(0, r.maxZ)) + r.coins * COIN_POINTS + r.air + r.chasms * CHASM_POINTS;
}

function endRun() {
  mode = 'results';
  const distance = Math.max(0, Math.floor(run.maxZ));
  const total = score(run);
  const newBest = total > save.best;
  save.runs += 1;
  if (newBest) save.best = total;
  save.bestDistance = Math.max(save.bestDistance, distance);
  writeSave(save);
  sfx.runEnd(newBest);
  ui.showResults({
    distance, coins: run.coins, coinPoints: run.coins * COIN_POINTS, air: run.air,
    chasms: run.chasms, chasmPoints: run.chasms * CHASM_POINTS, total, newBest,
    crash: body.crashed?.kind ?? null,
  }, save);
}

// ---------- sound controls ----------
const muteBtn = document.getElementById('btn-mute');
function showMute() {
  muteBtn.textContent = sfx.muted ? '🔇' : '🔊';
  muteBtn.setAttribute('aria-label', sfx.muted ? 'Unmute sound' : 'Mute sound');
}
function toggleMute() {
  sfx.toggleMute();
  showMute();
}
muteBtn.onclick = toggleMute;
showMute();
// soft tick on menu buttons
document.addEventListener('click', (e) => {
  if (e.target.closest('button') && e.target.closest('.overlay')) sfx.click();
});

input.onKeyDown = (code) => {
  if (code === 'KeyM') return toggleMute();
  if ((mode === 'menu' || mode === 'results') && (code === 'Enter' || code === 'Space')) startCourse();
};

// ---------- per-mode updates ----------

// 3, 2, 1, Go! The skier waits in the gate meanwhile.
function updateReady(dt) {
  const beat = Math.floor(countdown / COUNT_STEP);
  countdown += dt;
  const next = Math.floor(countdown / COUNT_STEP);
  if (next !== beat || countdown === dt) {
    if (next >= 3) return go();
    sfx.count(false);
    ui.toast(String(3 - next));
  }
}

function updateRun(dt) {
  const target = mode === 'run' ? input.steer() : 0;
  steerSmooth += (target - steerSmooth) * Math.min(1, dt * 10);
  const ctl = { steer: steerSmooth, tuck: mode === 'run' && input.tuck() };
  accumulator += dt;
  while (accumulator >= STEP) {
    body.step(STEP, ctl, terrain);
    accumulator -= STEP;
    if (body.landing && !body.crashed) onLanding(body.landing);
  }
  if (body.padHits) {
    body.padHits = 0;
    fovKick = 10;
    ui.toast('Boost!');
    sfx.pad();
  }
  for (const hit of body.snowmanHits) {
    hazardFx.smash(hit);
    sfx.smash(hit.speed);
    shake = Math.max(shake, 0.5);
  }
  body.snowmanHits.length = 0;
  for (const hit of body.obstacleHits) {
    hazardFx.obstacle(hit);
    sfx.thud(hit.obstacle.type === 'tree' ? 'tree' : 'snow', 1);
    if (hit.obstacle.type === 'bear') sfx.growl(1);
    shake = Math.max(shake, 0.55);
  }
  body.obstacleHits.length = 0;
  for (const hit of body.penguinHits) {
    sfx.squawk(true);
    hazardFx.knock(hit);
    shake = Math.max(shake, 0.4);
  }
  body.penguinHits.length = 0;
  for (const hit of body.birdHits) {
    hazardFx.birdHit(hit);
    sfx.birdHit(true);
    shake = Math.max(shake, 0.2);
    ui.toast('Bonk!');
  }
  body.birdHits.length = 0;

  if (mode === 'run') {
    if (body.crashed) return startCrash();
    checkChasms();
    run.time += dt;
    if (body.pos.z > run.maxZ + 0.25) {
      run.maxZ = body.pos.z;
      run.stagnant = 0;
    } else {
      run.stagnant += dt;
    }
    run.still = body.speed < 0.6 && !body.airborne ? run.still + dt : 0;
    collectCoins(dt);
    run.score = score(run);
    ui.updateHud(run, body, save.best);
    // stuck: stopped dead, or shuffling about without getting anywhere
    if (run.time > 2 && (run.still > 2 || run.stagnant > 6)) endRun();
  } else {
    crashTimer += dt;
    if (crashTimer > CRASH_TIME) endRun();
  }
  terrain.update(body.pos.z);
  if (!body.crashed) spray.emit(body, dt);
}

function startCrash() {
  mode = 'crash';
  crashTimer = 0;
  crashCam.copy(camPos);
  const kind = body.crashed.kind;
  if (kind === 'chasm') sfx.fall();
  else sfx.crash();
  ui.toast(CRASH_TEXT[kind] || 'Wipeout!');
  ui.setMode('crash');
}

// A chasm counts as cleared once you're back on the snow beyond it, still on your skis.
function checkChasms() {
  if (!body.contact) return;
  const ci = Math.floor(body.pos.z / CHUNK_LEN);
  for (const c of [terrain.chasmFor(ci), terrain.chasmFor(ci - 1)]) {
    if (!c || c.cleared || body.pos.z < c.z1) continue;
    c.cleared = true;
    run.chasms++;
    sfx.chime();
    ui.toast(`Cleared! +${CHASM_POINTS}`);
  }
}

function onLanding({ impact, airTime }) {
  sfx.landing(impact);
  if (airTime > 1.2) {
    const bonus = Math.floor((airTime - 0.8) * 10);
    run.air += bonus;
    sfx.chime();
    ui.toast(impact > 12 ? `Hangtime! +${bonus}` : `Airtime +${bonus}`);
  } else if (impact > 12) {
    ui.toast('Oof!');
  } else if (airTime > 0.8) {
    ui.toast('Nice Landing!');
  }
}

function collectCoins(dt) {
  const ci = Math.floor(body.pos.z / CHUNK_LEN);
  const sx = body.pos.x, sy = body.pos.y + 0.8, sz = body.pos.z;
  const pickR2 = 1.8 * 1.8;
  for (const chunk of terrain.chunks.values()) {
    const near = Math.abs(chunk.ci - ci) <= 1;
    for (const c of chunk.coins) {
      if (c.collected) continue;
      const m = c.mesh.position;
      c.mesh.rotation.y += dt * 3;
      if (!near) continue;
      const dx = sx - m.x, dy = sy - m.y, dz = sz - m.z;
      if (dx * dx + dy * dy + dz * dz < pickR2) {
        c.collected = true;
        c.mesh.visible = false;
        coinFx.collect(m, body);
        sfx.coin();
        run.coins++;
      }
    }
  }
}

// ---------- visuals ----------
const qTarget = new THREE.Quaternion();
const basis = new THREE.Matrix4();
const F = new THREE.Vector3(), U = new THREE.Vector3(), X = new THREE.Vector3(), Y = new THREE.Vector3();

function updateSkierVisual(dt, snap = false) {
  const p = body.pos;
  const g = terrain.height(p.x, p.z);
  skier.group.position.set(p.x, Math.max(p.y, g), p.z);
  F.set(Math.sin(body.facing), 0, Math.cos(body.facing));
  if (body.airborne) {
    const vh = Math.hypot(body.vel.x, body.vel.z) || 1;
    const along = body.vel.x * F.x + body.vel.z * F.z >= 0 ? 1 : -1;
    F.y = THREE.MathUtils.clamp((body.vel.y / vh) * along, -0.7, 0.5) * 0.6; // skis stay flatter than the flight path
    F.normalize();
    X.crossVectors(UP, F).normalize();
    Y.crossVectors(F, X);
    basis.makeBasis(X, Y, F);
  } else {
    terrain.normal(p.x, p.z, U);
    X.crossVectors(U, F).normalize();
    F.crossVectors(X, U);
    basis.makeBasis(X, U, F);
  }
  qTarget.setFromRotationMatrix(basis);
  if (snap) skier.group.quaternion.copy(qTarget);
  else skier.group.quaternion.slerp(qTarget, 1 - Math.exp(-dt * 12));

  const active = mode === 'run' || mode === 'crash';
  skier.animate(dt, {
    steer: mode === 'run' ? steerSmooth : 0,
    airborne: active && body.airborne,
    tucked: mode === 'run' && body.tucked,
    crashed: !!body.crashed,
    speed: body.speed,
  });
}

const camPos = new THREE.Vector3();
const camLook = new THREE.Vector3();
const camTarget = new THREE.Vector3();
const lookTarget = new THREE.Vector3();
const crashCam = new THREE.Vector3();

function updateCamera(dt, snap = false) {
  const p = body.pos;
  const fx = Math.sin(body.facing), fz = Math.cos(body.facing);
  if (mode === 'crash') {
    // stop where we were and watch the wipeout
    camTarget.copy(crashCam);
    lookTarget.set(p.x, p.y + 0.6, p.z);
  } else {
    let back, up, ahead, lookDrop;
    let yaw = 0;
    if (mode === 'run') {
      const sp = body.speed;
      back = 6.5 + Math.min(4, sp * 0.06);
      up = 2.6 + Math.min(2, sp * 0.03);
      ahead = 8;
      lookDrop = 0.5;
    } else if (mode === 'ready') {
      back = 6;
      up = 2.6;
      ahead = 16;
      lookDrop = -1;
    } else {
      back = 7.5;
      up = 3.2;
      ahead = 12;
      lookDrop = 0;
      yaw = Math.sin(time * 0.25) * 0.5;
    }
    // on the run the camera follows the direction of travel, not the skis, so carving doesn't swing it about
    const heading = mode === 'run' && Math.hypot(body.vel.x, body.vel.z) > 3 ? Math.atan2(body.vel.x, body.vel.z) : body.facing;
    const ox = Math.sin(heading + yaw), oz = Math.cos(heading + yaw);
    camTarget.set(p.x - ox * back, p.y + up, p.z - oz * back);
    const gh = terrain.height(camTarget.x, camTarget.z) + 1.5;
    if (camTarget.y < gh) camTarget.y = gh;
    lookTarget.set(p.x + ox * ahead, p.y + lookDrop, p.z + oz * ahead);
    if (mode !== 'run') lookTarget.set(p.x + fx * ahead, p.y + lookDrop, p.z + fz * ahead);
  }

  if (snap) {
    camPos.copy(camTarget);
    camLook.copy(lookTarget);
  } else {
    camPos.lerp(camTarget, 1 - Math.exp(-dt * 6));
    camLook.lerp(lookTarget, 1 - Math.exp(-dt * 8));
  }
  camera.position.copy(camPos);
  camera.lookAt(camLook);
  if (shake > 0) {
    shake = Math.max(0, shake - dt * 1.2);
    const a = shake * shake;
    camera.position.x += (Math.random() - 0.5) * a;
    camera.position.y += (Math.random() - 0.5) * a;
    camera.rotation.z += (Math.random() - 0.5) * a * 0.15;
  }

  fovKick = Math.max(0, fovKick - dt * 8);
  const fov = mode === 'run' ? 62 + Math.min(18, body.speed * 0.3) + fovKick : 62;
  if (Math.abs(camera.fov - fov) > 0.05) {
    camera.fov += (fov - camera.fov) * Math.min(1, dt * (fovKick > 0 ? 9 : 3));
    camera.updateProjectionMatrix();
  }

  sun.position.copy(p).addScaledVector(env.lightDir, SUN_DIST);
  sun.target.position.copy(p);
  mountains.follow(camera);
  clouds.update(dt, camera);
  env.update(dt, camera, renderer);
}

// ---------- loop ----------
function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;

  if (mode === 'ready') updateReady(dt);
  if (mode === 'run' || mode === 'crash') updateRun(dt);

  spray.update(dt);
  sfx.update({
    running: mode === 'run' && !body.crashed, speed: body.speed, contact: body.contact,
    onIce: body.onIce, airborne: body.airborne, boosting: false,
  });
  animatePads(dt);
  terrain.animate(dt);
  coinFx.update(dt, body);
  hazardFx.update(dt);
  updateSkierVisual(dt);
  updateCamera(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// load the igloo model before building the first course; without it a plain dome stands in
try {
  const gltf = await new GLTFLoader().loadAsync('models/igloo.glb');
  setIglooModel(gltf.scene);
} catch (e) {
  console.warn('Igloo model failed to load; using a plain dome', e);
}

newCourse();
ui.showMenu(save);
requestAnimationFrame(frame);

// handy for debugging from the console
window.__downhill = { body, get mode() { return mode; }, get terrain() { return terrain; }, get save() { return save; }, get run() { return run; }, sfx, env };
