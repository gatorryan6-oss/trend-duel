// results.js — the one-line results string (kickoff §5, FROZEN).
//
//   TD1|Ryan|2026-10-14|honors|rounds=18|won=11|lost=7|upsets=3|radius=5/6,ie1=3/5,en=2/4,mass=1/3
//
// TD1 is the format version. Per-stat fields are rounds WON over rounds
// CHOSEN, in the game's stat order, using each stat's `short` name from
// stats.json. Phase 2's teacher page parses exactly this, so parse() lives
// here too and the tests round-trip through both. Pure: no page access.

export const FORMAT_VERSION = "TD1";

// A self-entered first name; the string's one piece of personal data.
// Pipes and whitespace runs would break the format, so they go.
export function cleanName(name) {
  const cleaned = String(name ?? "").replace(/[|,=]/g, "").replace(/\s+/g, " ").trim().slice(0, 24);
  return cleaned || "Player";
}

// Local calendar date as YYYY-MM-DD (not UTC: a class at 8 pm is still today).
export function localDate(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// tally: { rounds, won, lost, upsets, byStat: { [key]: { chosen, won } } }
// stats: the stats.json records for the game's stat keys, in order.
export function resultsString({ name, date, preset, tally, stats }) {
  const perStat = stats.map(s => {
    const t = tally.byStat[s.key] || { chosen: 0, won: 0 };
    return `${s.short}=${t.won}/${t.chosen}`;
  }).join(",");
  return [FORMAT_VERSION, cleanName(name), date, preset,
          `rounds=${tally.rounds}`, `won=${tally.won}`, `lost=${tally.lost}`,
          `upsets=${tally.upsets}`, perStat].join("|");
}

// Inverse of resultsString. Throws a plain-English error on anything that
// is not a TD1 line, so a teacher page never silently mis-tallies.
export function parseResults(line) {
  const parts = String(line).trim().split("|");
  if (parts.length !== 9) throw new Error(`Expected 9 fields separated by |, got ${parts.length}.`);
  const [version, name, date, preset, rounds, won, lost, upsets, perStat] = parts;
  if (version !== FORMAT_VERSION) throw new Error(`Unknown format version "${version}".`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Bad date "${date}".`);
  const num = (field, label) => {
    const m = /^([a-z]+)=(\d+)$/.exec(field);
    if (!m || m[1] !== label) throw new Error(`Expected ${label}=<number>, got "${field}".`);
    return Number(m[2]);
  };
  const byStat = {};
  for (const item of perStat.split(",")) {
    const m = /^([a-z0-9]+)=(\d+)\/(\d+)$/.exec(item);
    if (!m) throw new Error(`Bad per-stat field "${item}".`);
    byStat[m[1]] = { won: Number(m[2]), chosen: Number(m[3]) };
  }
  return {
    version, name, date, preset,
    rounds: num(rounds, "rounds"), won: num(won, "won"), lost: num(lost, "lost"),
    upsets: num(upsets, "upsets"), byStat,
  };
}
