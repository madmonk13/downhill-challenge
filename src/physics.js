// Point-mass skier physics. Every step is ballistic (gravity, drag); if that puts the skier
// below the snow they are pushed back to the surface and the into-ground velocity is removed,
// so slopes, moguls and jumps all fall out naturally. Hitting anything solid, or dropping into
// a chasm, is a crash: the skier keeps tumbling under physics but no longer steers.

import * as THREE from 'three';
import { SNOWMAN_H, PENGUIN_R } from './terrain.js';

export const GRAVITY = 12;
const MU = 0.03; // ski friction on snow
const ICE_MU = 0.01;
const CRASH_MU = 0.9; // sliding along on your side after a wipeout
export const DRAG = 0.0024; // air drag standing up...
export const TUCK_DRAG = 0.0012; // ...and folded into a tuck
const TURN_RATE = 1.8; // rad/s at full steer
const TUCK_TURN = 0.55; // share of the turn rate left while tucked
const AIR_TURN = 0.25; // share of the turn rate left in the air
const GRIP = 6; // how fast the edges pull your velocity round to where the skis point
const ICE_GRIP = 0.8;
const CARVE_LOSS = 0.35; // share of scrubbed sideways energy lost when carving a turn
const MAX_YAW = 1.35; // furthest the skis can point from straight down the hill
const MAX_X = 62;
const PAD_KICK = 3; // instant m/s from a booster pad...
const PAD_SURGE = 0.5; // ...then this many seconds of extra push
const PAD_ACCEL = 9;
const BIRD_KEEP = 0.8; // share of speed kept after flying into a bird
const SKIER_R = 0.45;
const WALL = 0.8; // ending a step this far inside the snow means you hit a wall, i.e. a chasm's far side
const FALL_DEPTH = 2; // this far below a chasm's rim there's no getting out

const tmpN = new THREE.Vector3();

export class SkierBody {
  constructor() {
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.reset();
  }

  reset() {
    this.pos.set(0, 0, 0);
    this.vel.set(0, 0, 0);
    this.facing = 0; // yaw; forward = (sin, 0, cos)
    this.contact = true;
    this.airTime = 0; // seconds since the skis last touched snow
    this.tucked = false;
    this.onIce = false;
    this.surge = 0; // booster pad push remaining, seconds
    this.lastPad = null;
    this.padHits = 0; // pads hit since the game last read it
    this.snowmanHits = []; // { snowman, speed, vel } since the game last read it
    this.penguinHits = []; // { penguin, speed, vel } since last read
    this.birdHits = []; // { bird, speed, vel } since last read
    this.obstacleHits = []; // { obstacle, severity, speed, x, z } since last read
    this.snowballHits = []; // { ball, x, y, z, r, vel } since last read
    this.crashed = null; // { kind: 'tree' | 'igloo' | 'bear' | 'snowman' | 'penguin' | 'snowball' | 'chasm' | 'trick', speed } once you wipe out
    this.landing = null; // { impact, airTime } set on the step the skier lands
    this.touchdown = false; // true on the step the skier touches snow after being airborne
  }

  get speed() {
    return this.vel.length();
  }

  get airborne() {
    return this.airTime > 0.15;
  }

  crash(kind) {
    if (this.crashed) return;
    this.crashed = { kind, speed: this.vel.length() };
    this.surge = 0;
    this.tucked = false;
  }

  // ctl: { steer: -1..1 (positive = right), tuck: bool }
  step(dt, ctl, terrain) {
    const p = this.pos;
    const v = this.vel;
    this.landing = null;
    this.touchdown = false;
    this.tucked = !this.crashed && ctl.tuck;

    v.y -= GRAVITY * dt;
    if (this.surge > 0) {
      this.surge = Math.max(0, this.surge - dt);
      v.x += Math.sin(this.facing) * PAD_ACCEL * dt;
      v.z += Math.cos(this.facing) * PAD_ACCEL * dt;
    }

    const speed = v.length();
    if (speed > 0) {
      const drag = Math.min(speed, (this.tucked ? TUCK_DRAG : DRAG) * speed * speed * dt);
      v.multiplyScalar(1 - drag / speed);
    }

    if (!this.contact && !this.crashed) {
      // a little twist in the air, but the direction of travel barely changes
      this.turn(ctl.steer * TURN_RATE * AIR_TURN * dt);
    }

    const prevX = p.x, prevZ = p.z;
    p.addScaledVector(v, dt);
    if (Math.abs(p.x) > MAX_X) {
      p.x = Math.sign(p.x) * MAX_X;
      v.x = 0;
    }

    let ground = terrain.height(p.x, p.z);
    if (!this.crashed) {
      if (ground - p.y > WALL) {
        // slammed into the far wall of a chasm: bounce back off it and drop
        p.x = prevX;
        p.z = prevZ;
        v.x *= -0.1;
        v.z *= -0.1;
        ground = terrain.height(p.x, p.z);
        this.crash('chasm');
      } else if (terrain.chasmAt(p.x, p.z) && p.y < terrain.surface(p.x, p.z) - FALL_DEPTH) {
        this.crash('chasm');
      } else {
        this.checkSnowman(terrain, ground);
        this.checkPenguin(terrain, ground);
        this.checkObstacle(terrain, ground);
        this.checkSnowball(terrain);
        this.checkBird(terrain);
      }
    }

    const wasAirTime = this.airTime;
    if (p.y <= ground) {
      if (this.airborne) this.touchdown = true;
      p.y = ground;
      const n = terrain.normal(p.x, p.z, tmpN);
      const vn = v.dot(n);
      if (vn < 0) {
        v.addScaledVector(n, -vn);
        if (wasAirTime > 0.3) {
          const impact = -vn;
          if (impact > 10) v.multiplyScalar(Math.max(0.8, 1 - (impact - 10) * 0.015));
          this.landing = { impact, airTime: wasAirTime };
        }
      }
      this.contact = true;
      this.airTime = 0;
      this.onIce = terrain.isIce(p.x, p.z);
      this.groundStep(dt, ctl, n);
      if (!this.crashed) {
        // booster pad: fires once per pad, on entry
        const pad = terrain.padAt(p.x, p.z);
        if (pad && pad !== this.lastPad) {
          v.x += Math.sin(this.facing) * PAD_KICK;
          v.z += Math.cos(this.facing) * PAD_KICK;
          this.surge = PAD_SURGE;
          this.padHits++;
        }
        this.lastPad = pad;
      }
    } else {
      this.contact = false;
      this.airTime += dt;
    }
  }

  // Positive dyaw turns right. The skis never point back up the hill.
  turn(dyaw) {
    this.facing = THREE.MathUtils.clamp(this.facing - dyaw, -MAX_YAW, MAX_YAW);
  }

  // Snowmen burst when you ski into one, but so do you, unless you jump clean over.
  checkSnowman(terrain, ground) {
    const p = this.pos, v = this.vel;
    if (p.y - ground >= SNOWMAN_H) return;
    const sm = terrain.snowmanAt(p.x, p.z, SKIER_R);
    if (!sm) return;
    sm.broken = true;
    this.snowmanHits.push({ snowman: sm, speed: v.length(), vel: v.clone() });
    this.crash('snowman');
    v.multiplyScalar(0.35);
  }

  // Penguins: you bowl them over, and you go down too.
  checkPenguin(terrain, ground) {
    const p = this.pos, v = this.vel;
    const pg = terrain.penguinAt(p.x, p.z, SKIER_R, p.y - ground);
    if (!pg) return;
    pg.down = true;
    this.penguinHits.push({ penguin: pg, speed: v.length(), vel: v.clone() });
    this.crash('penguin');
    v.multiplyScalar(0.5);
    this.pushOut(pg.x, pg.z, PENGUIN_R * pg.scale + SKIER_R);
  }

  pushOut(cx, cz, reach) {
    const p = this.pos, v = this.vel;
    const dx = p.x - cx, dz = p.z - cz;
    const d = Math.hypot(dx, dz) || 1;
    const nx = dx / d, nz = dz / d;
    p.x = cx + nx * reach;
    p.z = cz + nz * reach;
    const vin = v.x * nx + v.z * nz;
    if (vin < 0) {
      v.x -= vin * nx;
      v.z -= vin * nz;
    }
  }

  // Birds only matter in the air. Flying into one costs a fifth of your speed but you keep going.
  checkBird(terrain) {
    if (this.contact) return;
    const p = this.pos, v = this.vel;
    const bird = terrain.birdAt(p.x, p.y + 0.8, p.z, SKIER_R);
    if (!bird) return;
    bird.down = true;
    this.birdHits.push({ bird, kind: 'knock', speed: v.length(), vel: v.clone() });
    v.multiplyScalar(BIRD_KEEP);
    if (v.y > 0) v.y *= BIRD_KEEP;
    this.surge = 0;
  }

  // A rolling snowball flattens you, and carries you along the way it's going. Jump clear over it and you're fine.
  checkSnowball(terrain) {
    const p = this.pos, v = this.vel;
    const hit = terrain.snowballAt(p.x, p.y + 0.6, p.z, SKIER_R);
    if (!hit) return;
    this.snowballHits.push({ ball: hit.ball, x: hit.x, y: hit.y, z: hit.z, r: hit.r, vel: v.clone() });
    this.crash('snowball');
    v.multiplyScalar(0.5);
    v.x += hit.ball.dir * hit.ball.speed * 0.9;
    v.y = Math.max(v.y, 0) + 3;
  }

  // Trees, igloos and polar bears never move: hit one and you bounce off it and go down.
  checkObstacle(terrain, ground) {
    const p = this.pos, v = this.vel;
    const hit = terrain.obstacleAt(p.x, p.z, SKIER_R, p.y - ground);
    if (!hit) return;
    const c = hit.circle;
    const dx = p.x - c.x, dz = p.z - c.z;
    const d = Math.hypot(dx, dz) || 1;
    const nx = dx / d, nz = dz / d;
    p.x = c.x + nx * (c.r + SKIER_R);
    p.z = c.z + nz * (c.r + SKIER_R);
    const hSpeed = Math.hypot(v.x, v.z);
    const vin = v.x * nx + v.z * nz;
    const severity = Math.min(1, Math.max(0, -vin) / Math.max(hSpeed, 1e-6));
    this.obstacleHits.push({ obstacle: hit.obstacle, severity, speed: hSpeed, x: p.x - nx * SKIER_R, z: p.z - nz * SKIER_R });
    this.crash(hit.obstacle.type);
    // rebound: reverse the into-obstacle part and kill most of the rest
    if (vin < 0) {
      v.x -= 1.15 * vin * nx;
      v.z -= 1.15 * vin * nz;
    }
    v.x *= 0.3;
    v.z *= 0.3;
  }

  groundStep(dt, ctl, n) {
    const v = this.vel;
    const speed = v.length();

    const mu = this.crashed ? CRASH_MU : this.onIce ? ICE_MU : MU;
    const decel = mu * GRAVITY * n.y;
    if (speed > 0) v.multiplyScalar(1 - Math.min(speed, decel * dt) / speed);
    if (this.crashed) return;

    // steering turns the skis; the edges then pull the velocity round to match.
    // You can still pivot when slow, so you never get stuck facing across the hill.
    const steerScale = Math.min(1, 0.35 + speed / 6) * (this.onIce ? 0.6 : 1) * (this.tucked ? TUCK_TURN : 1);
    this.turn(ctl.steer * TURN_RATE * steerScale * dt);
    const fx = Math.sin(this.facing), fz = Math.cos(this.facing);
    const rx = -fz, rz = fx; // right-hand side of the skier
    const vf = v.x * fx + v.z * fz;
    const vl = v.x * rx + v.z * rz;
    const vlNew = vl * Math.exp(-(this.onIce ? ICE_GRIP : GRIP) * dt);
    // Redirect the scrubbed sideways speed forward without ever creating energy:
    // the horizontal speed² can only shrink, by CARVE_LOSS of what was scrubbed.
    const h2 = vf * vf + vl * vl;
    const h2New = h2 - CARVE_LOSS * (vl * vl - vlNew * vlNew);
    const vfNew = Math.sign(vf || 1) * Math.sqrt(Math.max(0, h2New - vlNew * vlNew));
    v.x = fx * vfNew + rx * vlNew;
    v.z = fz * vfNew + rz * vlNew;
  }
}
