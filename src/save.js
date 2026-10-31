// Best scores, stored in localStorage. Every access is guarded so the
// game still runs (without saving) in private windows or when storage is blocked.

const KEY = 'downhill.save.v1';

export function defaultSave() {
  return {
    version: 1,
    best: 0, // best score
    bestDistance: 0,
    runs: 0,
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    return { ...defaultSave(), ...JSON.parse(raw) };
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
