// mastery.js — the running tally a student can show the teacher.
//
// For each stat: how many rounds the player CHOSE it and how many of those
// they WON, plus rounds/won/lost overall and the upsets encountered. The
// same shape serves two jobs: the per-game tally that becomes the results
// string, and the all-time tally saved in localStorage for the mastery
// panel. Pure except load/save/reset, which take the storage object as an
// argument (tests hand in a fake).

export const MASTERY_KEY = "td1.mastery.v1";   // versioned: bump on shape change

export function emptyTally() {
  return { rounds: 0, won: 0, lost: 0, upsets: 0, games: 0, byStat: {} };
}

// Fold one resolved round into a tally for `player` (seat 0 = the student).
// `upset` is the explainer's verdict for that reveal.
export function recordReveal(tally, reveal, upset, player = 0) {
  const next = { ...tally, byStat: { ...tally.byStat } };
  next.rounds += 1;
  if (reveal.winner === player) next.won += 1;
  else if (reveal.winner !== null) next.lost += 1;
  if (upset) next.upsets += 1;
  if (reveal.chooser === player) {
    const t = next.byStat[reveal.stat] || { chosen: 0, won: 0 };
    next.byStat[reveal.stat] = {
      chosen: t.chosen + 1,
      won: t.won + (reveal.winner === player ? 1 : 0),
    };
  }
  return next;
}

export function recordGameEnd(tally) {
  return { ...tally, games: tally.games + 1 };
}

// Add a finished game's tally into the all-time tally.
export function merge(total, game) {
  const out = { ...total, byStat: { ...total.byStat } };
  for (const k of ["rounds", "won", "lost", "upsets"]) out[k] += game[k];
  out.games += 1;
  for (const [key, t] of Object.entries(game.byStat)) {
    const prev = out.byStat[key] || { chosen: 0, won: 0 };
    out.byStat[key] = { chosen: prev.chosen + t.chosen, won: prev.won + t.won };
  }
  return out;
}

export function load(storage) {
  try {
    const raw = storage && storage.getItem(MASTERY_KEY);
    if (!raw) return emptyTally();
    const saved = JSON.parse(raw);
    const ok = saved && typeof saved === "object" && typeof saved.byStat === "object" &&
      ["rounds", "won", "lost", "upsets", "games"].every(k => Number.isInteger(saved[k]));
    return ok ? { ...emptyTally(), ...saved } : emptyTally();
  } catch {
    return emptyTally();
  }
}

export function save(tally, storage) {
  try {
    storage && storage.setItem(MASTERY_KEY, JSON.stringify(tally));
    return true;
  } catch {
    return false;
  }
}

export function reset(storage) {
  try { storage && storage.removeItem(MASTERY_KEY); } catch { /* nothing to clear */ }
  return emptyTally();
}
