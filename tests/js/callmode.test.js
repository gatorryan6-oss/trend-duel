// Call mode tests — Phase 2 kickoff M6.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { narrow, MAIN_BLOCKS } from "../../docs/js/data.js";
import { ALL_STATS } from "../../docs/js/settings.js";

import { newCallGame, startRound, makeCall, continueCall, askableStats, timeLeft,
         callScore, masteryReveal } from "../../docs/js/callmode.js";
import { makeRng } from "../../docs/js/engine.js";
import { emptyTally, recordReveal } from "../../docs/js/mastery.js";
import { resultsString, parseResults } from "../../docs/js/results.js";

const here = dirname(fileURLToPath(import.meta.url));
const allElements = JSON.parse(readFileSync(join(here, "../../docs/data/elements.json"), "utf8"));
const allStats = JSON.parse(readFileSync(join(here, "../../docs/data/stats.json"), "utf8"));
// The deck the game plays until the M11 deck setting: main-group cards, Phase 1 stats.
const { elements, stats } = narrow({ elements: allElements, stats: allStats }, MAIN_BLOCKS, ALL_STATS);
const S = Object.fromEntries(stats.map(s => [s.key, s]));
const E = Object.fromEntries(elements.map(e => [e.symbol, e]));
const HONORS = ["radius_pm", "ie1_kjmol", "en_pauling", "mass"];

// A Call game with chosen cards on top and a chosen stat in play.
function forced(a, b, stat, extra = {}) {
  const g = newCallGame(elements, stats, { statKeys: HONORS, ...extra }, 3, makeRng(1));
  const state = { ...g, hands: [[a, ...g.hands[0].slice(1)], [b, ...g.hands[1].slice(1)]] };
  return { ...state, call: { ...state.call, a, b, stat, direction: extra.direction || "high" } };
}

test("a Call game deals like Duel and opens on a call", () => {
  const g = newCallGame(elements, stats, { statKeys: HONORS }, 7, makeRng(2));
  assert.equal(g.mode, "call");
  assert.equal(g.phase, "call");
  assert.equal(g.hands[0].length + g.hands[1].length, 42);
  assert.ok(HONORS.includes(g.call.stat));
  assert.equal(g.call.deadline, null, "timer off by default");
  assert.deepEqual(callScore(g), { correct: 0, rounds: 0, won: 0, missed: 0 });
});

test("a correct call wins both cards; a wrong call loses them", () => {
  let s = makeCall(forced(E.Cl, E.Al, "ie1_kjmol"), "left", stats);
  assert.ok(s.reveal.correct);
  assert.equal(s.piles.won.length, 2);
  assert.equal(s.piles.missed.length, 0);
  assert.equal(s.hands[0][0].symbol !== "Cl" && s.hands[1][0].symbol !== "Al", true);
  s = makeCall(forced(E.Cl, E.Al, "ie1_kjmol"), "right", stats);
  assert.ok(!s.reveal.correct);
  assert.equal(s.piles.missed.length, 2);
  assert.deepEqual(callScore(s), { correct: 0, rounds: 1, won: 0, missed: 2 });
});

test("a tie called correctly counts as won; called wrong, as missed", () => {
  let s = makeCall(forced(E.Li, E.Na, "valence_e", { statKeys: ["valence_e", "mass"] }), "tie", stats);
  assert.ok(s.reveal.correct);
  assert.equal(s.reveal.winner, null);
  s = makeCall(forced(E.Li, E.Na, "valence_e", { statKeys: ["valence_e", "mass"] }), "left", stats);
  assert.ok(!s.reveal.correct);
});

test("undefined on one side: the other card wins, and the call can be made", () => {
  const s = makeCall(forced(E.He, E.Li, "radius_pm"), "right", stats);
  assert.ok(s.reveal.correct);
  assert.equal(s.reveal.undefinedLoser, 0);
});

test("lowest-wins flips the right answer", () => {
  const s = makeCall(forced(E.Cl, E.Al, "ie1_kjmol", { directionToken: true, direction: "low" }), "right", stats);
  assert.ok(s.reveal.correct);
});

test("the stat is never one both cards lack", () => {
  assert.deepEqual(askableStats(E.He, E.Ne, HONORS), ["ie1_kjmol", "mass"]);
  assert.deepEqual(askableStats(E.He, E.Li, HONORS), HONORS);
  const rng = makeRng(9);
  let g = newCallGame(elements, stats, { statKeys: HONORS }, 11, rng);
  const bothUndefined = (c) => c.a[c.stat] == null && c.b[c.stat] == null;
  for (let i = 0; i < 25 && g.phase !== "over"; i++) {
    assert.ok(!bothUndefined(g.call));
    g = continueCall(makeCall(g, "left", stats), rng);
  }
});

test("the timer: deadline, time left, and a timed-out round scores as wrong", () => {
  const rng = makeRng(4);
  const g = newCallGame(elements, stats, { statKeys: HONORS, timerSeconds: 10 }, 5, rng, 1000);
  assert.equal(g.call.deadline, 11000);
  assert.equal(timeLeft(g, 4000), 7000);
  assert.equal(timeLeft(g, 20000), 0);
  const s = makeCall(g, "none", stats);
  assert.ok(!s.reveal.correct);
  assert.equal(s.reveal.call, "none");
  assert.equal(s.piles.missed.length, 2);
  const next = continueCall(s, rng, 50000);
  assert.equal(next.call.deadline, 60000, "the next round's clock starts from now");
});

test("the game ends at the round cap or when a hand runs out", () => {
  const rng = makeRng(6);
  let g = newCallGame(elements, stats, { statKeys: HONORS, roundCap: 3 }, 8, rng);
  for (let i = 0; i < 3; i++) g = continueCall(makeCall(g, "tie", stats), rng);
  assert.equal(g.phase, "over");
  assert.equal(g.endReason, "round cap");
  assert.equal(g.calls, 3);
  let h = newCallGame(elements, stats, { statKeys: HONORS, roundCap: 40 }, 8, rng);
  h = { ...h, hands: [[h.hands[0][0]], h.hands[1]] };
  h = continueCall(makeCall(h, "left", stats), rng);
  assert.equal(h.phase, "over");
  assert.equal(h.endReason, "out of cards");
});

test("the log records upsets and calls", () => {
  const s = makeCall(forced(E.N, E.O, "ie1_kjmol"), "left", stats);
  assert.deepEqual(s.log[0], { round: 1, stat: "ie1_kjmol", call: "left", correct: true, winner: 0, upset: true });
});

test("mastery and the results string treat a Call round as chosen + won/lost, preset gets -call", () => {
  let tally = emptyTally();
  const right = makeCall(forced(E.Cl, E.Al, "ie1_kjmol"), "left", stats);
  const wrong = makeCall(forced(E.Cl, E.Al, "ie1_kjmol"), "right", stats);
  tally = recordReveal(tally, masteryReveal(right.reveal), false, 0);
  tally = recordReveal(tally, masteryReveal(wrong.reveal), false, 0);
  assert.deepEqual(tally.byStat.ie1_kjmol, { chosen: 2, won: 1 });
  assert.equal(tally.won, 1); assert.equal(tally.lost, 1); assert.equal(tally.rounds, 2);
  const line = resultsString({ name: "Ryan", date: "2026-10-28", preset: "honors-call", tally, stats: HONORS.map(k => S[k]) });
  assert.equal(line, "TD1|Ryan|2026-10-28|honors-call|rounds=2|won=1|lost=1|upsets=0|radius=0/0,ie1=1/2,en=0/0,mass=0/0");
  assert.equal(parseResults(line).preset, "honors-call");
});

test("state is never mutated in place", () => {
  const g = newCallGame(elements, stats, { statKeys: HONORS }, 12, makeRng(3));
  const snap = JSON.stringify(g);
  continueCall(makeCall(g, "left", stats), makeRng(3));
  assert.equal(JSON.stringify(g), snap);
  assert.throws(() => makeCall(g, "up", stats), /Unknown call/);
  assert.throws(() => startRound({ ...g, hands: [[], g.hands[1]] }, makeRng(1)), /empty hand/);
});
