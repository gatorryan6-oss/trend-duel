// Opponent and settings tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { narrow, MAIN_BLOCKS } from "../../docs/js/data.js";
import { ALL_STATS } from "../../docs/js/settings.js";

import { newGame, makeRng } from "../../docs/js/engine.js";
import { OPPONENTS, positionScore, valueRank, deckOf } from "../../docs/js/opponents.js";
import { PRESETS, DEFAULTS, applyPreset, presetOf, validate, toConfig, load, save, SETTINGS_KEY }
  from "../../docs/js/settings.js";

const here = dirname(fileURLToPath(import.meta.url));
const allElements = JSON.parse(readFileSync(join(here, "../../docs/data/elements.json"), "utf8"));
const allStats = JSON.parse(readFileSync(join(here, "../../docs/data/stats.json"), "utf8"));
// The deck the game plays until the M11 deck setting: main-group cards, Phase 1 stats.
const { elements, stats } = narrow({ elements: allElements, stats: allStats }, MAIN_BLOCKS, ALL_STATS);
const S = Object.fromEntries(stats.map(s => [s.key, s]));
const E = Object.fromEntries(elements.map(e => [e.symbol, e]));

// A game where the computer (player 1) has `top` on top and must pick.
function computerHolds(top, config = {}) {
  const g = newGame(elements, stats, { statKeys: ["radius_pm", "ie1_kjmol", "en_pauling", "mass"], ...config }, 5);
  return { ...g, active: 1, hands: [g.hands[0], [top, ...g.hands[1].filter(c => c !== top)]] };
}

test("position scores follow the trends, not the numbers", () => {
  assert.ok(positionScore(E.Cs, S.radius_pm) > positionScore(E.F, S.radius_pm));
  assert.ok(positionScore(E.F, S.ie1_kjmol) > positionScore(E.Cs, S.ie1_kjmol));
  assert.ok(positionScore(E.Rn, S.mass) > positionScore(E.H, S.mass));
  assert.equal(positionScore(E.Cl, S.valence_e), 6 / 7);
});

test("value rank is the fraction of the deck the card beats", () => {
  assert.equal(valueRank(E.He, S.ie1_kjmol, elements), 1);
  assert.equal(valueRank(E.Cs, S.ie1_kjmol, elements), 0);
  assert.equal(valueRank(E.He, S.radius_pm, elements), -1, "undefined ranks below everything");
});

test("Trend-reasoner picks ionization energy for fluorine and radius for cesium", () => {
  assert.equal(OPPONENTS.trend.pick(computerHolds(E.F)), "ie1_kjmol");
  assert.equal(OPPONENTS.trend.pick(computerHolds(E.Cs)), "radius_pm");
});

test("Trend-reasoner is fooled by an upset: it still trusts position", () => {
  // Argon: top-right-ish, no radius or EN, so it reasons IE or mass.
  const g = computerHolds(E.Ar);
  const pick = OPPONENTS.trend.pick(g);
  assert.ok(["ie1_kjmol", "mass"].includes(pick));
});

test("Greedy picks the stat where the true value ranks highest", () => {
  assert.equal(OPPONENTS.greedy.pick(computerHolds(E.He)), "ie1_kjmol");
  assert.equal(OPPONENTS.greedy.pick(computerHolds(E.Rn)), "mass");
  assert.equal(OPPONENTS.greedy.pick(computerHolds(E.F)), "en_pauling");
});

test("with lowest-wins, Greedy picks where its card ranks LOWEST", () => {
  const g = { ...computerHolds(E.He), direction: "low" };
  // He: IE rank 1 (worst for low), mass rank near 0 (best for low).
  assert.equal(OPPONENTS.greedy.pick(g), "mass");
});

test("opponents never pick a stat the card cannot play", () => {
  const rng = makeRng(2);
  for (const sym of ["He", "Ne", "Ar", "Kr", "Xe", "Rn"]) {
    for (const name of Object.keys(OPPONENTS)) {
      const pick = OPPONENTS[name].pick(computerHolds(E[sym]), rng);
      assert.notEqual(pick, "radius_pm", `${name} picked undefined radius for ${sym}`);
      if (sym !== "Xe") assert.notEqual(pick, "en_pauling", `${name} picked undefined EN for ${sym}`);
    }
  }
});

test("deckOf always returns the whole deck", () => {
  assert.equal(deckOf(newGame(elements, stats, {}, 1)).length, 42);
});

test("presets are toggle bundles and round-trip through presetOf", () => {
  const cp = applyPreset(DEFAULTS, "cp");
  assert.equal(presetOf(cp), "cp");
  const honors = applyPreset(cp, "honors");
  assert.equal(presetOf(honors), "honors");
  assert.deepEqual(honors.statKeys, PRESETS.honors.toggles.statKeys);
  assert.equal(honors.face, "econf");
  assert.equal(honors.directionToken, true);
  assert.equal(presetOf({ ...honors, directionToken: false }), "custom");
  assert.equal(validate(cp), null);
  assert.deepEqual(toConfig(cp), { statKeys: cp.statKeys, directionToken: false, roundCap: 20, firstPicker: 0 });
});

test("validation refuses unplayable settings in plain English", () => {
  assert.match(validate({ ...DEFAULTS, statKeys: ["mass"] }), /at least two/);
  assert.match(validate({ ...DEFAULTS, roundCap: 0 }), /Round cap/);
  assert.match(validate({ ...DEFAULTS, opponent: "greedy", allowGreedy: false }), /Greedy/);
  assert.equal(validate({ ...DEFAULTS, opponent: "greedy", allowGreedy: true }), null);
  assert.equal(validate({ ...DEFAULTS, mode: "hotseat", opponent: "greedy" }), null);
});

test("settings save and load through a storage object, and survive a broken one", () => {
  const fake = { data: {}, getItem(k) { return this.data[k] ?? null; }, setItem(k, v) { this.data[k] = v; } };
  const s = applyPreset(DEFAULTS, "honors");
  assert.equal(save(s, fake), true);
  assert.ok(fake.data[SETTINGS_KEY]);
  assert.deepEqual(load(fake), s);
  const broken = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  assert.deepEqual(load(broken), { ...DEFAULTS });
  assert.equal(save(s, broken), false);
  fake.data[SETTINGS_KEY] = JSON.stringify({ statKeys: ["mass"] });
  assert.deepEqual(load(fake), { ...DEFAULTS }, "invalid saved settings fall back to defaults");
});
