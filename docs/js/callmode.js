// callmode.js — Call mode: both cards face up, the stat announced, numbers
// hidden, and the player calls the winner before the reveal.
//
// PURE, like engine.js: it never touches the page or browser storage. It
// builds on the Duel state from newGame and leaves engine.js untouched (an
// invariant pins the engine's hash). Every function takes a state and returns a NEW
// state. Time is passed in (`now`, milliseconds) so the timer is testable.
//
// Extra fields on a Call state:
//   mode:   "call"
//   call:   the round in play { a, b, stat, direction, deadline } or null
//   piles:  { won: [...cards], missed: [...cards] }
//   calls / correct: running counts
//   log:    one entry per resolved round { round, stat, call, correct, winner, upset }
import { newGame, topCard, resolve } from "./engine.js";
import { isUpset } from "./trend.js";

export const CALLS = ["left", "right", "tie"];   // "none" = the timer ran out

// Start a Call game: the usual shuffle and deal, then the first round.
export function newCallGame(elements, stats, config, seed, rng, now = 0) {
  const base = newGame(elements, stats, { ...config, directionToken: false }, seed);
  const state = {
    ...base,
    mode: "call",
    config: { ...base.config, directionToken: Boolean(config.directionToken),
              timerSeconds: config.timerSeconds ?? null },
    call: null,
    piles: { won: [], missed: [] },
    calls: 0,
    correct: 0,
    log: [],
  };
  return startRound(state, rng, now);
}

// Stats worth asking about: at least one of the two cards has a value.
// (Undefined on one side is a fair call — the other card wins.)
export function askableStats(a, b, statKeys) {
  const has = (c, k) => c[k] !== null && c[k] !== undefined;
  return statKeys.filter(k => has(a, k) || has(b, k));
}

export function startRound(state, rng, now = 0) {
  const a = topCard(state, 0);
  const b = topCard(state, 1);
  if (!a || !b) throw new Error("startRound called with an empty hand.");
  const options = askableStats(a, b, state.config.statKeys);
  if (options.length === 0) throw new Error(`No askable stat for ${a.symbol} vs ${b.symbol}.`);
  const stat = options[Math.floor(rng() * options.length)];
  const direction = state.config.directionToken ? (rng() < 0.5 ? "high" : "low") : "high";
  const t = state.config.timerSeconds;
  const deadline = t ? now + t * 1000 : null;
  return { ...state, phase: "call", reveal: null, call: { a, b, stat, direction, deadline } };
}

// Milliseconds left on the clock, or null when there is no timer.
export function timeLeft(state, now) {
  if (!state.call || state.call.deadline === null) return null;
  return Math.max(0, state.call.deadline - now);
}

// Score the player's call. `call` is "left", "right", "tie", or "none".
export function makeCall(state, call, stats) {
  if (state.phase !== "call") throw new Error(`Cannot call during phase "${state.phase}".`);
  if (!CALLS.includes(call) && call !== "none") throw new Error(`Unknown call "${call}".`);
  const { a, b, stat, direction } = state.call;
  const r = resolve(a, b, stat, direction);
  const correct = (call === "left" && r.winner === 0) ||
                  (call === "right" && r.winner === 1) ||
                  (call === "tie" && r.winner === null);
  const hands = [state.hands[0].slice(1), state.hands[1].slice(1)];
  const piles = {
    won: correct ? state.piles.won.concat([a, b]) : state.piles.won,
    missed: correct ? state.piles.missed : state.piles.missed.concat([a, b]),
  };
  const statRecord = stats ? stats.find(s => s.key === stat) : null;
  const upset = statRecord ? isUpset(a, b, statRecord) : false;
  const reveal = { ...r, chooser: 0, round: state.round, call, correct };
  return {
    ...state,
    hands,
    piles,
    phase: "reveal",
    reveal,
    calls: state.calls + 1,
    correct: state.correct + (correct ? 1 : 0),
    log: state.log.concat([{ round: state.round, stat, call, correct, winner: r.winner, upset }]),
  };
}

// After the reveal: next round, or the end.
export function continueCall(state, rng, now = 0) {
  if (state.phase !== "reveal") throw new Error(`Cannot continue during phase "${state.phase}".`);
  const next = { ...state, round: state.round + 1, reveal: null, call: null };
  const over = callOver(next);
  if (over) return { ...next, phase: "over", endReason: over };
  return startRound(next, rng, now);
}

export function callOver(state) {
  if (state.hands[0].length === 0 || state.hands[1].length === 0) return "out of cards";
  if (state.round > state.config.roundCap) return "round cap";
  return null;
}

export function callScore(state) {
  return { correct: state.correct, rounds: state.calls,
           won: state.piles.won.length, missed: state.piles.missed.length };
}

// The shape mastery.js and the results string expect: a "reveal" where the
// player chose the stat and won when the call was right. Keeps mastery.js
// and results.js unchanged (kickoff Phase 2 §2).
export function masteryReveal(reveal) {
  return { stat: reveal.stat, chooser: 0, winner: reveal.correct ? 0 : 1 };
}
