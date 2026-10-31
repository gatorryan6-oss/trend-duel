// Engine unit tests. Run:  node --test tests/js
// Uses only Node's built-in test runner — nothing to install.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { narrow, MAIN_BLOCKS } from "../../docs/js/data.js";
// The Phase 1 stats, which these tests were written against.
const PHASE1_STATS = ["radius_pm", "ie1_kjmol", "en_pauling", "mass", "valence_e"];

import { newGame, chooseStat, continueGame, playableStats, resolve,
         score, makeRng, shuffle, topCard } from "../../docs/js/engine.js";

const here = dirname(fileURLToPath(import.meta.url));
const allElements = JSON.parse(readFileSync(join(here, "../../docs/data/elements.json"), "utf8"));
const allStats = JSON.parse(readFileSync(join(here, "../../docs/data/stats.json"), "utf8"));
// The Phase 1 deck: main-group cards, Phase 1 stats.
const { elements, stats } = narrow({ elements: allElements, stats: allStats }, MAIN_BLOCKS, PHASE1_STATS);
const bySymbol = Object.fromEntries(elements.map(e => [e.symbol, e]));

test("the deck is dealt evenly and nothing is lost", () => {
  const g = newGame(elements, stats, {}, 7);
  assert.deepEqual(score(g), [21, 21]);
  const all = new Set([...g.hands[0], ...g.hands[1]].map(c => c.z));
  assert.equal(all.size, 42);
  assert.equal(g.phase, "pick");
  assert.equal(g.round, 1);
});

test("the same seed deals the same hands", () => {
  const a = newGame(elements, stats, {}, 42);
  const b = newGame(elements, stats, {}, 42);
  assert.deepEqual(a.hands[0].map(c => c.z), b.hands[0].map(c => c.z));
});

test("shuffle is a permutation", () => {
  const out = shuffle([1, 2, 3, 4, 5], makeRng(3));
  assert.deepEqual(out.slice().sort(), [1, 2, 3, 4, 5]);
});

test("higher value wins both cards", () => {
  const r = resolve(bySymbol.Cl, bySymbol.Al, "ie1_kjmol");
  assert.equal(r.winner, 0);
  const r2 = resolve(bySymbol.Al, bySymbol.Cl, "ie1_kjmol");
  assert.equal(r2.winner, 1);
});

test("lowest wins when the direction token says low", () => {
  const r = resolve(bySymbol.Cl, bySymbol.Al, "ie1_kjmol", "low");
  assert.equal(r.winner, 1);
});

test("an undefined value loses the round and is named", () => {
  const r = resolve(bySymbol.He, bySymbol.Li, "radius_pm");
  assert.equal(r.winner, 1);
  assert.equal(r.undefinedLoser, 0);
});

test("a stat with no value cannot be chosen by its holder", () => {
  const g = newGame(elements, stats, { statKeys: ["radius_pm", "ie1_kjmol"] }, 1);
  // Force helium onto player 0's top.
  const forced = { ...g, hands: [[bySymbol.He, ...g.hands[0]], g.hands[1]] };
  assert.deepEqual(playableStats(forced, 0), ["ie1_kjmol"]);
  assert.throws(() => chooseStat(forced, "radius_pm"), /not playable/);
});

test("a tie sends both cards to the pot and the next winner takes it", () => {
  const g = newGame(elements, stats, { statKeys: ["valence_e", "ie1_kjmol"] }, 1);
  // Two column-1 cards tie on valence electrons.
  const forced = { ...g, hands: [[bySymbol.Li, bySymbol.He, ...g.hands[0]],
                                  [bySymbol.Na, bySymbol.Cs, ...g.hands[1]]] };
  const tied = chooseStat(forced, "valence_e");
  assert.equal(tied.reveal.winner, null);
  assert.equal(tied.pot.length, 2);
  const next = continueGame(tied);
  assert.equal(next.active, 0, "ties keep the picker");
  const won = chooseStat(next, "ie1_kjmol");         // He beats Cs on IE
  assert.equal(won.reveal.winner, 0);
  assert.equal(won.pot.length, 0);
  assert.equal(won.hands[0].length, forced.hands[0].length + 2 + 2 - 2 + 0);
});

test("the winner picks next and the cards move to the bottom of their hand", () => {
  const g = newGame(elements, stats, { statKeys: ["ie1_kjmol"] }, 1);
  const forced = { ...g, hands: [[bySymbol.Cs, ...g.hands[0].slice(0, 3)],
                                  [bySymbol.He, ...g.hands[1].slice(0, 3)]] };
  const after = chooseStat(forced, "ie1_kjmol");
  assert.equal(after.reveal.winner, 1);
  // 4 cards, minus the top one played, plus the two won = 5
  assert.equal(after.hands[1].length, 5);
  assert.equal(after.hands[1][3].symbol, "Cs");   // both cards went to the bottom
  assert.equal(after.hands[1][4].symbol, "He");
  const next = continueGame(after);
  assert.equal(next.active, 1);
  assert.equal(next.round, 2);
});

test("the game ends when a player runs out of cards, more cards wins", () => {
  const g = newGame(elements, stats, { statKeys: ["ie1_kjmol"] }, 1);
  const forced = { ...g, hands: [[bySymbol.Cs], [bySymbol.He, bySymbol.Li]] };
  const after = continueGame(chooseStat(forced, "ie1_kjmol"));
  assert.equal(after.phase, "over");
  assert.equal(after.winner, 1);
  assert.equal(after.endReason, "out of cards");
});

test("the round cap ends the game and a level count is a draw", () => {
  const g = newGame(elements, stats, { statKeys: ["valence_e"], roundCap: 1 }, 1);
  const forced = { ...g, hands: [[bySymbol.Li, bySymbol.O], [bySymbol.Na, bySymbol.S]] };
  const after = continueGame(chooseStat(forced, "valence_e"));   // tie -> pot
  assert.equal(after.phase, "over");
  assert.equal(after.winner, "draw");
  assert.equal(after.endReason, "round cap");
});

test("a whole game against random picks finishes with a declared result", () => {
  let g = newGame(elements, stats, {}, 99);
  const rng = makeRng(5);
  let guard = 0;
  while (g.phase !== "over" && guard++ < 200) {
    const options = playableStats(g);
    assert.ok(options.length > 0, "the active player always has a playable stat");
    g = continueGame(chooseStat(g, options[Math.floor(rng() * options.length)]));
  }
  assert.equal(g.phase, "over");
  assert.ok([0, 1, "draw"].includes(g.winner));
  assert.ok(g.round <= 21);
  assert.equal(g.hands[0].length + g.hands[1].length + g.pot.length, 42);
});

test("direction token rolls high or low per round, reproducibly", () => {
  const a = newGame(elements, stats, { directionToken: true }, 11);
  const b = newGame(elements, stats, { directionToken: true }, 11);
  assert.ok(["high", "low"].includes(a.direction));
  assert.equal(a.direction, b.direction);
  const seen = new Set();
  let g = a;
  for (let i = 0; i < 12 && g.phase !== "over"; i++) {
    seen.add(g.direction);
    g = continueGame(chooseStat(g, playableStats(g)[0]));
  }
  assert.ok(seen.has("high") && seen.has("low"), "both directions appear over a dozen rounds");
});

test("state is never mutated in place", () => {
  const g = newGame(elements, stats, {}, 3);
  const snapshot = JSON.stringify(g);
  const after = chooseStat(g, playableStats(g)[0]);
  continueGame(after);
  assert.equal(JSON.stringify(g), snapshot);
  assert.ok(topCard(g, 0));
});
