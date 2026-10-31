// Keyboard plus touch/mouse on the game canvas. The first finger down steers by how far it
// has been dragged sideways from where it landed; a second finger held anywhere means tuck.

const BLOCKED = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']);
const STEER_PX = 60; // drag this far sideways for full lock
const SWIPE_PX = 40; // in the air, a flick counts as a trick swipe if the finger moves this far...
const SWIPE_MS = 100; // ...within this long. A steering drag is much slower, so it never qualifies.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pointers = new Map(); // id -> { startX, x, y, trail } (trail: recent { t, x, y } samples for swipe speed)
    this.steerId = null; // the pointer that steers
    this.onKeyDown = null;
    this.onKeyUp = null; // (code, heldMs)
    this.onPointerDown = null;
    this.pressedAt = new Map(); // code -> when it went down
    this.onSwipe = null; // (dir: 'up' | 'down' | 'left' | 'right') while swipes are armed
    this.swipeArmed = false;

    window.addEventListener('keydown', (e) => {
      if (BLOCKED.has(e.code)) e.preventDefault();
      if (!e.repeat) {
        this.pressedAt.set(e.code, e.timeStamp);
        this.onKeyDown?.(e.code);
      }
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      const down = this.pressedAt.get(e.code);
      this.pressedAt.delete(e.code);
      if (down !== undefined) this.onKeyUp?.(e.code, e.timeStamp - down);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.pressedAt.clear();
      this.pointers.clear();
      this.steerId = null;
    });

    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { startX: e.clientX, x: e.clientX, y: e.clientY, trail: [] });
      if (this.steerId === null) this.steerId = e.pointerId;
      this.onPointerDown?.();
    });
    canvas.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX;
      p.y = e.clientY;
      if (!this.swipeArmed) return;
      // a swipe is a quick flick: how far the finger has moved in the last SWIPE_MS
      p.trail.push({ t: e.timeStamp, x: p.x, y: p.y });
      while (p.trail.length > 1 && e.timeStamp - p.trail[0].t > SWIPE_MS) p.trail.shift();
      const dx = p.x - p.trail[0].x, dy = p.y - p.trail[0].y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return;
      p.trail.length = 0; // one flick, one trick
      this.onSwipe?.(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down');
    });
    const end = (e) => {
      this.pointers.delete(e.pointerId);
      if (e.pointerId !== this.steerId) return;
      // hand steering to a finger that's still down, starting from where it is now
      this.steerId = null;
      for (const [id, p] of this.pointers) {
        p.startX = p.x;
        this.steerId = id;
        break;
      }
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }

  // Swipes only count while armed (in the air). Arming forgets each finger's earlier movement, so
  // a steering drag held through the take-off doesn't count towards a swipe.
  armSwipes(on) {
    if (on && !this.swipeArmed) for (const p of this.pointers.values()) p.trail.length = 0;
    this.swipeArmed = on;
  }

  down(...codes) {
    return codes.some((c) => this.keys.has(c));
  }

  // -1..1, positive = right
  steer() {
    let s = 0;
    if (this.down('ArrowLeft', 'KeyA')) s -= 1;
    if (this.down('ArrowRight', 'KeyD')) s += 1;
    const p = this.pointers.get(this.steerId);
    if (p) s += (p.x - p.startX) / STEER_PX;
    return Math.max(-1, Math.min(1, s));
  }

  tuck() {
    return this.pointers.size >= 2 || this.down('ArrowDown', 'KeyS', 'Space');
  }
}
