// DOM overlays: menu, HUD, the start hint and results.

const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.floor(n).toLocaleString();
export const MPH = 2.23694; // m/s -> mph

const CRASH_LINES = {
  tree: 'You met a tree.',
  igloo: 'You skied into an igloo.',
  bear: 'You bumped into a polar bear.',
  snowman: 'You took out a snowman.',
  penguin: 'You bowled over a penguin.',
  chasm: 'You fell into a chasm.',
};

export class UI {
  constructor(handlers) {
    this.h = handlers; // { play, endRun, reset }
    this.lastScore = -1;
    $('btn-play').onclick = () => this.h.play();
    $('btn-again').onclick = () => this.h.play();
    $('btn-menu').onclick = () => this.showMenu(this.save);
    $('btn-end').onclick = () => this.h.endRun();
    $('btn-reset').onclick = () => {
      if (confirm('Reset your best score and distance?')) this.h.reset();
    };
  }

  show(screen) {
    for (const id of ['menu', 'results']) $(id).classList.toggle('hidden', id !== screen);
  }

  showMenu(save) {
    this.save = save;
    $('menu-best').textContent = fmt(save.best);
    $('menu-dist').textContent = `${fmt(save.bestDistance)} m`;
    this.show('menu');
    this.setMode('menu');
  }

  // which in-world UI is visible for a game mode
  setMode(mode) {
    const playing = mode === 'ready' || mode === 'run' || mode === 'crash';
    $('hud').classList.toggle('hidden', !playing);
    $('btn-end').classList.toggle('hidden', mode !== 'run');
    $('hint').classList.toggle('hidden', mode !== 'ready');
    if (mode !== 'menu') this.show(null);
  }

  updateHud(run, body, best) {
    $('hud-dist').textContent = `${fmt(Math.max(0, run.maxZ))} m`;
    $('hud-speed').textContent = `${fmt(body.speed * MPH)} mph`;
    if (run.score !== this.lastScore) {
      const el = $('hud-score');
      el.textContent = fmt(run.score);
      // pop on bonuses, not on every metre
      if (this.lastScore >= 0 && run.score - this.lastScore > 2) {
        el.classList.remove('pop');
        void el.offsetWidth;
        el.classList.add('pop');
      }
      this.lastScore = run.score;
    }
    const toBest = best - run.score;
    $('hud-best').textContent = best > 0 ? (toBest > 0 ? `Best ${fmt(best)} · ${fmt(toBest)} to beat` : '🏁 New best!') : '';
    $('hud-tuck').classList.toggle('on', body.tucked);
  }

  resetHud() {
    this.lastScore = -1;
  }

  toast(text) {
    const el = $('toast');
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  showResults(r, save) {
    this.save = save;
    $('res-title').textContent = r.newBest ? 'New high score!' : r.crash ? 'Wipeout!' : 'Run over';
    $('res-why').textContent = CRASH_LINES[r.crash] || '';
    $('res-best-badge').classList.toggle('hidden', !r.newBest);
    $('res-score').textContent = fmt(r.total);
    $('res-dist').textContent = `${fmt(r.distance)} m`;
    $('res-coins').textContent = `${fmt(r.coins)} × 5 = ${fmt(r.coinPoints)}`;
    $('res-chasms').textContent = `${fmt(r.chasms)} × 50 = ${fmt(r.chasmPoints)}`;
    $('res-air').textContent = fmt(r.air);
    $('res-best').textContent = fmt(save.best);
    this.setMode('results');
    this.show('results');
  }
}
