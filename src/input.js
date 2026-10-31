// Keyboard plus touch/mouse on the game canvas. The first finger down steers by how far it
// has been dragged sideways from where it landed; a second finger held anywhere means tuck.

const BLOCKED = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']);
const STEER_PX = 60; // drag this far sideways for full lock

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pointers = new Map(); // id -> { startX, x }
    this.steerId = null; // the pointer that steers
    this.onKeyDown = null;
    this.onPointerDown = null;

    window.addEventListener('keydown', (e) => {
      if (BLOCKED.has(e.code)) e.preventDefault();
      if (!e.repeat) this.onKeyDown?.(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.pointers.clear();
      this.steerId = null;
    });

    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { startX: e.clientX, x: e.clientX });
      if (this.steerId === null) this.steerId = e.pointerId;
      this.onPointerDown?.();
    });
    canvas.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (p) p.x = e.clientX;
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
