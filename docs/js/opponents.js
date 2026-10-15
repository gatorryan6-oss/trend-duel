// opponents.js — how the computer picks a stat. Pure functions: each takes
// the game state (and a random source) and returns a stat key. The engine
// then resolves the pick like any other. Trend-reasoner and Greedy arrive at
// M4; Random is enough to play a full game at M2.
import { playableStats } from "./engine.js";

export const OPPONENTS = {
  random: {
    label: "Random",
    blurb: "Picks any playable stat at random.",
    pick(state, rng) {
      const options = playableStats(state, 1);
      return options[Math.floor(rng() * options.length)];
    },
  },
};
