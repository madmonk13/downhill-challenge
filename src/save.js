// Best scores and the penguin's colours, stored in localStorage. Every access is guarded so the
// game still runs (without saving) in private windows or when storage is blocked.

const KEY = 'downhill.save.v1';

export const DEFAULT_COLORS = { hat: '#e84a3a', scarf: '#e84a3a', ski: '#2f7fd4' };
const HEX = /^#[0-9a-f]{6}$/i;

export function defaultSave() {
  return {
    version: 1,
    best: 0, // best score
    bestDistance: 0,
    runs: 0,
    colors: { ...DEFAULT_COLORS }, // preferences: hat, scarf and ski colours
  };
}

// keep only well-formed colours, so a hand-edited or old save can't break the skier
function cleanColors(colors) {
  const out = { ...DEFAULT_COLORS };
  for (const k of Object.keys(out)) if (typeof colors?.[k] === 'string' && HEX.test(colors[k])) out[k] = colors[k].toLowerCase();
  return out;
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const save = { ...defaultSave(), ...JSON.parse(raw) };
    save.colors = cleanColors(save.colors);
    return save;
  } catch {
    return defaultSave();
  }
}

export function writeSave(save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // storage unavailable; scores last for this session only
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
