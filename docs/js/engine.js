// engine.js — the rules of Trend Duel, and nothing else.
//
// This file is PURE: it never touches the page. Every function takes a
// state object and returns a NEW state object (the old one is not changed),
// the same way a Python function that returns a new dict instead of mutating
// its argument is easier to test. That is what lets Node run these rules
// without a browser, and what lets Phase 2's Call mode reuse them unchanged.
//
// A game state looks like this:
//   {
//     config:  { statKeys, roundCap, directionToken, firstPicker },
//     stats:   the records from stats.json (for labels and undefined notes),
//     hands:   [cardsOfPlayer0, cardsOfPlayer1]   (top card = index 0),
//     pot:     cards waiting for the next round's winner (after ties),
//     active:  0 or 1 — who picks this round,
//     round:   1-based round number,
//     direction: "high" or "low" — which value wins this round,
//     phase:   "pick" | "reveal" | "over",
//     reveal:  null, or the resolved round (see resolve()),
//     log:     one entry per resolved round,
//     winner:  null until the game is over, then 0, 1, or "draw",
//     rng:     a seeded random state, so a game can be replayed in tests,
//   }

// ---------- a small seeded random number generator ----------
// mulberry32: deterministic from a seed, so tests can replay a shuffle.
// Returns a function that yields floats in [0, 1).
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fisher–Yates shuffle into a new array.
export function shuffle(items, rng) {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const DEFAULT_CONFIG = {
  statKeys: ["radius_pm", "ie1_kjmol", "en_pauling", "valence_e"],
  roundCap: 20,
  directionToken: false,
  firstPicker: 0,
};

// ---------- starting a game ----------
export function newGame(elements, stats, config = {}, seed = 1) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  if (!Array.isArray(elements) || elements.length < 2) {
    throw new Error("newGame needs a deck of at least two cards.");
  }
  const known = new Set(stats.map(s => s.key));
  for (const key of cfg.statKeys) {
    if (!known.has(key)) throw new Error(`Unknown stat "${key}" in config.statKeys.`);
  }
  const rng = makeRng(seed);
  const deck = shuffle(elements, rng);
  const half = Math.ceil(deck.length / 2);
  const state = {
    config: cfg,
    stats,
    hands: [deck.slice(0, half), deck.slice(half)],
    pot: [],
    active: cfg.firstPicker,
    round: 1,
    direction: "high",
    phase: "pick",
    reveal: null,
    log: [],
    winner: null,
    seed,
    rngCalls: 0,
  };
  return withDirection(state, rng);
}

// The direction token: when on, each round is "highest wins" or "lowest
// wins", decided before the pick. We keep a count of rng calls so the game
// can be replayed from its seed.
function withDirection(state, rng) {
  if (!state.config.directionToken) return { ...state, direction: "high" };
  const roll = rng();
  return { ...state, direction: roll < 0.5 ? "high" : "low", rngCalls: state.rngCalls + 1 };
}

// Rebuild the rng at the right position for this state.
function rngFor(state) {
  const rng = makeRng(state.seed);
  // newGame's shuffle consumed (deck.length - 1) calls.
  const consumed = (state.hands[0].length + state.hands[1].length + state.pot.length - 1)
                   + state.rngCalls;
  for (let i = 0; i < consumed; i++) rng();
  return rng;
}

// ---------- what the active player may choose ----------
export function topCard(state, player) {
  return state.hands[player][0] || null;
}

// A stat with no value on the holder's card cannot be chosen (kickoff §2).
export function playableStats(state, player = state.active) {
  const card = topCard(state, player);
  if (!card) return [];
  return state.config.statKeys.filter(key => card[key] !== null && card[key] !== undefined);
}

// ---------- resolving a round ----------
// Returns the reveal record without touching state, so the UI and the
// predictor (M3) can both read it.
export function resolve(cardA, cardB, statKey, direction = "high") {
  const a = cardA[statKey];
  const b = cardB[statKey];
  const aUndef = a === null || a === undefined;
  const bUndef = b === null || b === undefined;
  let winner;            // 0, 1, or null for a tie
  let undefinedLoser = null;
  if (aUndef && bUndef) {
    winner = null;       // cannot happen through chooseStat, but be safe
  } else if (aUndef) {
    winner = 1; undefinedLoser = 0;
  } else if (bUndef) {
    winner = 0; undefinedLoser = 1;
  } else if (a === b) {
    winner = null;
  } else if (direction === "high") {
    winner = a > b ? 0 : 1;
  } else {
    winner = a < b ? 0 : 1;
  }
  return { a: cardA, b: cardB, stat: statKey, direction, winner, undefinedLoser };
}

export function chooseStat(state, statKey) {
  if (state.phase !== "pick") throw new Error(`Cannot choose a stat during phase "${state.phase}".`);
  if (!playableStats(state).includes(statKey)) {
    throw new Error(`Stat "${statKey}" is not playable for player ${state.active} this round.`);
  }
  const cardA = topCard(state, 0);
  const cardB = topCard(state, 1);
  const reveal = { ...resolve(cardA, cardB, statKey, state.direction),
                   chooser: state.active, round: state.round };

  const hands = [state.hands[0].slice(1), state.hands[1].slice(1)];
  let pot = state.pot.slice();
  if (reveal.winner === null) {
    pot = pot.concat([cardA, cardB]);                 // both cards wait in the pot
  } else {
    // Winner takes both cards and any pot, to the bottom of their hand.
    hands[reveal.winner] = hands[reveal.winner].concat([cardA, cardB], pot);
    pot = [];
  }
  return {
    ...state,
    hands,
    pot,
    phase: "reveal",
    reveal,
    log: state.log.concat([{ round: state.round, chooser: state.active, stat: statKey,
                             winner: reveal.winner, direction: state.direction }]),
  };
}

// ---------- after the reveal ----------
export function continueGame(state) {
  if (state.phase !== "reveal") throw new Error(`Cannot continue during phase "${state.phase}".`);
  const winner = state.reveal.winner;
  const next = {
    ...state,
    phase: "pick",
    reveal: null,
    round: state.round + 1,
    active: winner === null ? state.active : winner,   // winner picks next; ties keep the picker
  };
  const over = isOver(next);
  if (over) return { ...next, phase: "over", winner: over.winner, endReason: over.reason };
  return withDirection(next, rngFor(next));
}

// Game ends when a player is out of cards or the round cap is passed;
// more cards wins (pot cards belong to nobody).
export function isOver(state) {
  const [n0, n1] = [state.hands[0].length, state.hands[1].length];
  const outOfCards = n0 === 0 || n1 === 0;
  const capped = state.round > state.config.roundCap;
  if (!outOfCards && !capped) return null;
  const winner = n0 === n1 ? "draw" : (n0 > n1 ? 0 : 1);
  return { winner, reason: outOfCards ? "out of cards" : "round cap" };
}

// Score strip: cards in hand per player.
export function score(state) {
  return [state.hands[0].length, state.hands[1].length];
}
