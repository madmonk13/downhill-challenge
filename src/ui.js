// DOM overlays: menu, HUD, the start hint and results.

import { COINS_ENABLED } from './terrain.js';
import { DEFAULT_COLORS, DEFAULT_SENSITIVITY, SENS_MIN, SENS_MAX } from './save.js';

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
  trick: 'You landed in the middle of a trick.',
  snowball: 'You were flattened by a giant snowball.',
};

const PALETTE = [
  '#e84a3a', '#ff9a2e', '#f5c518', '#2fb36b', '#1fb5b5',
  '#2f7fd4', '#8a5cd0', '#f06292', '#f7f7f2', '#23262e',
];

export class UI {
  constructor(handlers) {
    this.h = handlers; // { play, endRun, reset, colors(colors), sensitivity(k) }
    this.lastScore = -1;
    this.prefsOpen = false; // the preferences panel is up; main.js frames the penguin close-up
    this.helpOpen = false; // the how-to-play panel is up
    this.buildPrefs();
    $('btn-play').onclick = () => this.h.play();
    $('btn-again').onclick = () => this.h.play();
    $('btn-menu').onclick = () => this.showMenu(this.save);
    $('btn-end').onclick = () => this.h.endRun();
    $('btn-pause').onclick = () => this.h.pause(true);
    $('btn-resume').onclick = () => this.h.pause(false);
    $('btn-pause-end').onclick = () => {
      this.h.pause(false);
      this.h.endRun();
    };
    $('btn-reset').onclick = () => {
      if (confirm('Reset your best score and distance?')) this.h.reset();
    };
  }

  show(screen) {
    for (const id of ['menu', 'results', 'prefs', 'help', 'pause']) $(id).classList.toggle('hidden', id !== screen);
    this.prefsOpen = screen === 'prefs';
    this.helpOpen = screen === 'help';
  }

  // ---------- preferences: hat, scarf and ski colours ----------
  buildPrefs() {
    for (const row of document.querySelectorAll('.pref[data-pref]')) {
      const key = row.dataset.pref;
      const box = row.querySelector('.swatches');
      for (const color of PALETTE) {
        const b = document.createElement('button');
        b.className = 'swatch';
        b.style.background = color;
        b.dataset.color = color;
        b.setAttribute('aria-label', `${key} ${color}`);
        b.onclick = () => this.setColor(key, color);
        box.append(b);
      }
      // any other colour, via the browser's own picker
      const custom = document.createElement('label');
      custom.className = 'swatch custom';
      custom.title = 'Pick any colour';
      const input = document.createElement('input');
      input.type = 'color';
      input.setAttribute('aria-label', `${key} custom colour`);
      input.oninput = () => this.setColor(key, input.value);
      custom.append(input);
      box.append(custom);
    }
    $('btn-prefs').onclick = () => this.showPrefs();
    $('btn-help').onclick = () => this.show('help');
    $('btn-help-close').onclick = () => this.showMenu(this.save);
    $('btn-prefs-done').onclick = () => this.showMenu(this.save);
    $('btn-prefs-reset').onclick = () => {
      this.save.colors = { ...DEFAULT_COLORS };
      this.h.colors(this.save.colors);
      this.save.touchSensitivity = DEFAULT_SENSITIVITY;
      this.h.sensitivity(DEFAULT_SENSITIVITY);
      this.refreshPrefs();
    };
    const sens = $('sens');
    sens.min = SENS_MIN;
    sens.max = SENS_MAX;
    sens.step = 0.05;
    sens.oninput = () => {
      this.save.touchSensitivity = Number(sens.value);
      this.h.sensitivity(this.save.touchSensitivity);
      this.showSensitivity();
    };
  }

  showPrefs() {
    this.refreshPrefs();
    this.show('prefs');
  }

  setColor(key, color) {
    this.save.colors = { ...this.save.colors, [key]: color };
    this.h.colors(this.save.colors);
    this.refreshPrefs();
  }

  showSensitivity() {
    $('sens').value = this.save.touchSensitivity;
    $('sens-value').textContent = `${Math.round(this.save.touchSensitivity * 100)}%`;
  }

  // mark the swatch matching each current colour; a colour outside the palette lights up the custom one
  refreshPrefs() {
    this.showSensitivity();
    for (const row of document.querySelectorAll('.pref[data-pref]')) {
      const current = this.save.colors[row.dataset.pref];
      let matched = false;
      for (const s of row.querySelectorAll('.swatch:not(.custom)')) {
        const on = s.dataset.color === current;
        s.classList.toggle('selected', on);
        matched ||= on;
      }
      const custom = row.querySelector('.swatch.custom');
      custom.classList.toggle('selected', !matched);
      row.querySelector('input').value = current;
    }
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
    $('btn-pause').classList.toggle('hidden', mode !== 'run');
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

  // the Paused card covers the game; the in-run buttons step aside while it's up
  showPause(on) {
    this.show(on ? 'pause' : null);
    for (const id of ['btn-pause', 'btn-end']) $(id).classList.toggle('hidden', on);
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
    $('res-coins-row').classList.toggle('hidden', !COINS_ENABLED);
    $('res-coins').textContent = `${fmt(r.coins)} × ${fmt(r.coinValue)} = ${fmt(r.coinPoints)}`;
    $('res-tricks').textContent = fmt(r.tricks);
    $('res-chasms').textContent = `${fmt(r.chasms)} × 50 = ${fmt(r.chasmPoints)}`;
    $('res-air').textContent = fmt(r.air);
    $('res-best').textContent = fmt(save.best);
    this.setMode('results');
    this.show('results');
  }
}
