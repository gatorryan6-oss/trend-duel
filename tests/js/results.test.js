// Results string (frozen contract) and mastery tally tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { narrow, MAIN_BLOCKS } from "../../docs/js/data.js";
// The Phase 1 stats, which these tests were written against.
const PHASE1_STATS = ["radius_pm", "ie1_kjmol", "en_pauling", "mass", "valence_e"];

import { resultsString, parseResults, cleanName, localDate, FORMAT_VERSION } from "../../docs/js/results.js";
import { emptyTally, recordReveal, recordGameEnd, merge, load, save, reset, MASTERY_KEY }
  from "../../docs/js/mastery.js";
import { resolve } from "../../docs/js/engine.js";

const here = dirname(fileURLToPath(import.meta.url));
const allElements = JSON.parse(readFileSync(join(here, "../../docs/data/elements.json"), "utf8"));
const allStats = JSON.parse(readFileSync(join(here, "../../docs/data/stats.json"), "utf8"));
// The Phase 1 deck: main-group cards, Phase 1 stats.
const { elements, stats } = narrow({ elements: allElements, stats: allStats }, MAIN_BLOCKS, PHASE1_STATS);
const S = Object.fromEntries(stats.map(s => [s.key, s]));
const E = Object.fromEntries(elements.map(e => [e.symbol, e]));

const HONORS = ["radius_pm", "ie1_kjmol", "en_pauling", "mass"].map(k => S[k]);

test("the kickoff's example line is reproduced exactly", () => {
  const tally = { rounds: 18, won: 11, lost: 7, upsets: 3,
                  byStat: { radius_pm: { won: 5, chosen: 6 }, ie1_kjmol: { won: 3, chosen: 5 },
                            en_pauling: { won: 2, chosen: 4 }, mass: { won: 1, chosen: 3 } } };
  const line = resultsString({ name: "Ryan", date: "2026-10-14", preset: "honors", tally, stats: HONORS });
  assert.equal(line, "TD1|Ryan|2026-10-14|honors|rounds=18|won=11|lost=7|upsets=3|radius=5/6,ie1=3/5,en=2/4,mass=1/3");
  const back = parseResults(line);
  assert.equal(back.version, FORMAT_VERSION);
  assert.equal(back.name, "Ryan");
  assert.equal(back.preset, "honors");
  assert.deepEqual(back.byStat.ie1, { won: 3, chosen: 5 });
  assert.equal(back.rounds, 18);
});

test("a stat never chosen shows 0/0 and the short names come from stats.json", () => {
  const tally = { ...emptyTally(), rounds: 2 };
  const line = resultsString({ name: "A", date: "2026-01-02", preset: "cp", tally,
                               stats: ["radius_pm", "valence_e"].map(k => S[k]) });
  assert.equal(line, "TD1|A|2026-01-02|cp|rounds=2|won=0|lost=0|upsets=0|radius=0/0,valence=0/0");
});

test("names are cleaned of anything that would break the format", () => {
  assert.equal(cleanName("  Ryan | the  Great "), "Ryan the Great");
  assert.equal(cleanName(""), "Player");
  assert.equal(cleanName(null), "Player");
  assert.equal(cleanName("a=b,c"), "abc");
  assert.equal(cleanName("x".repeat(40)).length, 24);
});

test("parse refuses lines that are not TD1", () => {
  assert.throws(() => parseResults("TD2|a|2026-01-01|cp|rounds=1|won=1|lost=0|upsets=0|radius=1/1"), /version/);
  assert.throws(() => parseResults("TD1|a|cp"), /9 fields/);
  assert.throws(() => parseResults("TD1|a|2026-01-01|cp|rounds=x|won=1|lost=0|upsets=0|radius=1/1"), /rounds/);
  assert.throws(() => parseResults("TD1|a|2026-01-01|cp|rounds=1|won=1|lost=0|upsets=0|radius=1"), /per-stat/);
});

test("localDate is the local calendar day", () => {
  assert.equal(localDate(new Date(2026, 9, 14, 23, 30)), "2026-10-14");
  assert.equal(localDate(new Date(2026, 0, 5, 0, 10)), "2026-01-05");
});

test("recordReveal counts chosen/won per stat for the student's seat only", () => {
  let t = emptyTally();
  // Student (seat 0) chooses IE with N vs O and wins.
  t = recordReveal(t, { ...resolve(E.N, E.O, "ie1_kjmol"), chooser: 0 }, true, 0);
  assert.deepEqual(t.byStat.ie1_kjmol, { chosen: 1, won: 1 });
  assert.equal(t.won, 1); assert.equal(t.upsets, 1); assert.equal(t.rounds, 1);
  // Opponent chooses radius; student loses. Not counted as chosen.
  t = recordReveal(t, { ...resolve(E.F, E.Cs, "radius_pm"), chooser: 1 }, false, 0);
  assert.equal(t.byStat.radius_pm, undefined);
  assert.equal(t.lost, 1); assert.equal(t.rounds, 2);
  // Student chooses valence, tie: chosen but not won, neither won nor lost.
  t = recordReveal(t, { ...resolve(E.Li, E.Na, "valence_e"), chooser: 0 }, false, 0);
  assert.deepEqual(t.byStat.valence_e, { chosen: 1, won: 0 });
  assert.equal(t.won + t.lost, 2); assert.equal(t.rounds, 3);
  assert.equal(recordGameEnd(t).games, 1);
});

test("merge folds a game into the all-time tally", () => {
  const game = { rounds: 3, won: 2, lost: 1, upsets: 1, games: 0, byStat: { mass: { chosen: 2, won: 1 } } };
  const total = merge(merge(emptyTally(), game), game);
  assert.equal(total.games, 2);
  assert.equal(total.rounds, 6);
  assert.deepEqual(total.byStat.mass, { chosen: 4, won: 2 });
});

test("mastery saves, loads, resets, and survives broken storage", () => {
  const fake = { data: {}, getItem(k) { return this.data[k] ?? null; },
                 setItem(k, v) { this.data[k] = v; }, removeItem(k) { delete this.data[k]; } };
  const t = merge(emptyTally(), { rounds: 1, won: 1, lost: 0, upsets: 0, games: 0, byStat: {} });
  assert.equal(save(t, fake), true);
  assert.deepEqual(load(fake), t);
  assert.deepEqual(reset(fake), emptyTally());
  assert.equal(fake.data[MASTERY_KEY], undefined);
  fake.data[MASTERY_KEY] = "{not json";
  assert.deepEqual(load(fake), emptyTally());
  const broken = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } };
  assert.deepEqual(load(broken), emptyTally());
  assert.equal(save(t, broken), false);
  assert.deepEqual(reset(broken), emptyTally());
});
