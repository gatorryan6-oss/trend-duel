// opponents.js — how the computer picks a stat. Pure functions: each takes
// the game state (and a random source) and returns a stat key. The engine
// then resolves the pick like any other.
//
//   Random          any playable stat.
//   Trend-reasoner  scores each stat from the card's POSITION with the same
//                   naive rules the predictor uses, picks the best. It loses
//                   on upsets the way a student does.
//   Greedy          ranks the card's TRUE value against the whole deck and
//                   picks the stat where it ranks highest. Hard to beat.
import { playableStats, topCard } from "./engine.js";

// Every card in play — hands plus pot always add up to the whole deck.
export function deckOf(state) {
  return [...state.hands[0], ...state.hands[1], ...state.pot];
}

// 0..1 from position alone: how high the trend says this card's value is.
// Radius: low and left is high. IE / EN: high and right is high. Mass: by
// atomic number. Valence: by column. No numbers are consulted.
export function positionScore(card, stat) {
  if (stat.by_z) return (card.z - 1) / 85;              // deck runs 1..86
  if (stat.by_column) return (card.column - 1) / 7;
  const down = stat.down === "+" ? (card.period - 1) / 5 : (6 - card.period) / 5;
  const across = stat.across === "+" ? (card.column - 1) / 7 : (8 - card.column) / 7;
  return (down + across) / 2;
}

// 0..1 from the data: the fraction of the other defined cards this card beats.
export function valueRank(card, stat, deck) {
  const v = card[stat.key];
  if (v === null || v === undefined) return -1;
  const others = deck.filter(c => c !== card && c[stat.key] !== null && c[stat.key] !== undefined);
  if (others.length === 0) return 1;
  return others.filter(c => c[stat.key] < v).length / others.length;
}

// Pick the option with the best score for this round's direction. Ties go
// to the first option in the preset's stat order.
function bestBy(options, scoreOf, direction) {
  let best = null, bestScore = null;
  for (const key of options) {
    const s = scoreOf(key);
    const better = bestScore === null ||
      (direction === "low" ? s < bestScore : s > bestScore);
    if (better) { best = key; bestScore = s; }
  }
  return best;
}

export const OPPONENTS = {
  random: {
    label: "Random",
    blurb: "Picks any playable stat at random.",
    pick(state, rng) {
      const options = playableStats(state, state.active);
      return options[Math.floor(rng() * options.length)];
    },
  },
  trend: {
    label: "Trend-reasoner",
    blurb: "Reads its card's position on the table and picks the stat the trends favour. Fooled by upsets.",
    pick(state) {
      const card = topCard(state, state.active);
      const byKey = Object.fromEntries(state.stats.map(s => [s.key, s]));
      return bestBy(playableStats(state, state.active),
                    key => positionScore(card, byKey[key]), state.direction);
    },
  },
  greedy: {
    label: "Greedy",
    blurb: "Knows the real numbers and picks the stat where its card ranks highest in the deck.",
    honorsOnly: true,
    pick(state) {
      const card = topCard(state, state.active);
      const deck = deckOf(state);
      const byKey = Object.fromEntries(state.stats.map(s => [s.key, s]));
      return bestBy(playableStats(state, state.active),
                    key => valueRank(card, byKey[key], deck), state.direction);
    },
  },
};
