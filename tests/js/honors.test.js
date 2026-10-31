// Honors deck in play (Phase 3 M11): the deck setting, the six-stat preset,
// whole games on 52 cards, and the teacher page's new columns.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { PRESETS, DEFAULTS, ALL_STATS, deckCards, applyPreset, presetOf, validate,
         toConfig, load, SETTINGS_KEY } from "../../docs/js/settings.js";
import { newGame, chooseStat, continueGame, playableStats, makeRng, score } from "../../docs/js/engine.js";
import { newCallGame, makeCall, continueCall, callScore } from "../../docs/js/callmode.js";
import { OPPONENTS } from "../../docs/js/opponents.js";
import { buildTable, tableColumns } from "../../docs/js/teacher.js";
import { resultsString, parseResults } from "../../docs/js/results.js";

const here = dirname(fileURLToPath(import.meta.url));
const elements = JSON.parse(readFileSync(join(here, "../../docs/data/elements.json"), "utf8"));
const stats = JSON.parse(readFileSync(join(here, "../../docs/data/stats.json"), "utf8"));
const statByKey = (k) => stats.find(s => s.key === k);

function fakeStorage(saved) {
  return { getItem: (k) => (k === SETTINGS_KEY && saved ? JSON.stringify(saved) : null), setItem() {} };
}

test("the decks deal 42 and 52 cards, and an unknown deck is refused", () => {
  assert.equal(deckCards(elements, "main").length, 42);
  assert.equal(deckCards(elements, "main+3d").length, 52);
  assert.ok(deckCards(elements, "main").every(e => e.block !== "d"));
  assert.throws(() => deckCards(elements, "4d"), /Unknown deck/);
  assert.match(validate({ ...DEFAULTS, deck: "4d" }), /Unknown deck/);
});

test("presets: CP is unchanged, Honors is 52 cards and six stats in canonical order", () => {
  assert.deepEqual(PRESETS.cp.toggles.statKeys, ["radius_pm", "ie1_kjmol", "en_pauling", "valence_e"]);
  assert.equal(PRESETS.cp.toggles.deck, "main");
  assert.equal(PRESETS.honors.toggles.deck, "main+3d");
  assert.deepEqual(PRESETS.honors.toggles.statKeys,
    ["radius_pm", "ie1_kjmol", "en_pauling", "ea_kjmol", "ionic_radius_pm", "mass"]);
  for (const key of ["cp", "honors"]) {
    const s = applyPreset(DEFAULTS, key);
    assert.equal(presetOf(s), key);
    // The settings form rebuilds statKeys in ALL_STATS order; the preset must survive it.
    const roundTrip = { ...s, statKeys: ALL_STATS.filter(k => s.statKeys.includes(k)) };
    assert.equal(presetOf(roundTrip), key);
    assert.equal(validate(s), null);
  }
});

test("an old saved settings blob (no deck key) loads as the main deck", () => {
  const old = { base: "honors", mode: "computer", opponent: "trend", allowGreedy: true,
                statKeys: ["radius_pm", "ie1_kjmol", "en_pauling", "mass"], face: "econf",
                directionToken: true, roundCap: 20, timerSeconds: null, projector: false };
  const s = load(fakeStorage(old));
  assert.equal(s.deck, "main");
  assert.deepEqual(s.statKeys, old.statKeys);
  assert.equal(presetOf(s), "custom", "the old Honors toggles are no longer the Honors preset");
});

test("a whole Honors Duel plays on 52 cards against the Trend-reasoner", () => {
  const s = applyPreset(DEFAULTS, "honors");
  let g = newGame(deckCards(elements, s.deck), stats, toConfig(s), 11);
  assert.deepEqual(score(g), [26, 26]);
  const rng = makeRng(5);
  let dBlockRounds = 0;
  while (g.phase !== "over") {
    const options = playableStats(g);
    assert.ok(options.length > 0, "a card always has a playable stat");
    const key = g.active === 1 ? OPPONENTS.trend.pick(g, rng) : options[0];
    g = chooseStat(g, key);
    if (g.reveal.a.block === "d" || g.reveal.b.block === "d") dBlockRounds++;
    g = continueGame(g);
  }
  assert.ok(g.round > 1);
  assert.ok(dBlockRounds > 0, "3d cards came up in play");
});

test("a whole Honors Call game plays on 52 cards", () => {
  const s = applyPreset(DEFAULTS, "honors");
  const rng = makeRng(9);
  let g = newCallGame(deckCards(elements, s.deck), stats, toConfig(s), 4, rng);
  while (g.phase !== "over") {
    g = makeCall(g, "left", stats);
    g = continueCall(g, rng);
  }
  assert.ok(callScore(g).rounds > 0);
});

test("results lines carry ea and ionic, and the teacher table orders them", () => {
  const honors = PRESETS.honors.toggles.statKeys.map(statByKey);
  const tally = { byStat: { ea_kjmol: { won: 3, chosen: 4 }, ionic_radius_pm: { won: 1, chosen: 2 },
                            radius_pm: { won: 2, chosen: 2 } },
                  rounds: 8, won: 6, lost: 2, upsets: 1 };
  const line = resultsString({ name: "Ana", date: "2026-10-31", preset: "honors", tally, stats: honors });
  assert.match(line, /^TD1\|Ana\|2026-10-31\|honors\|rounds=8\|won=6\|lost=2\|upsets=1\|/);
  assert.match(line, /ea=3\/4/);
  assert.match(line, /ionic=1\/2/);
  const parsed = parseResults(line);
  assert.deepEqual(parsed.byStat.ionic, { won: 1, chosen: 2 });
  const cpLine = "TD1|Bo|2026-10-31|cp|rounds=5|won=3|lost=2|upsets=0|radius=1/2,ie1=1/1,en=1/1,valence=0/1";
  const t = buildTable(line + "\n" + cpLine);
  assert.deepEqual(t.statColumns, ["radius", "ie1", "en", "ea", "ionic", "mass", "valence"]);
  const cols = tableColumns(t.statColumns);
  assert.ok(cols.includes("Electron aff.") && cols.includes("Ionic radius"));
});
