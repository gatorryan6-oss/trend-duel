// data.js — loads the generated JSON and refuses to hand back anything
// that is not the deck the kickoff locked. A page that quietly played with
// 30 cards, or with a stat nobody defined, is the failure this guards.

// 42 main-group cards + the ten 3d cards (Phase 3 kickoff §2).
export const DECK_SIZE = 52;

// The blocks of the main-group deck, which CP plays.
export const MAIN_BLOCKS = ["s", "p"];

async function fetchJson(path) {
  const resp = await fetch(path);
  if (!resp.ok) throw new Error(`${path} answered HTTP ${resp.status}.`);
  return resp.json();
}

// The part of the data a page plays with: only cards from `blocks`, only the
// stats in `statKeys`. Pure, so the Node tests can use the same view a page
// does. The gallery's CP filter uses it; the game deals by settings.deck.
export function narrow(data, blocks, statKeys) {
  return {
    ...data,
    elements: data.elements.filter(e => blocks.includes(e.block)),
    stats: data.stats.filter(s => statKeys.includes(s.key)),
  };
}

export async function loadData() {
  const [elements, stats, exceptions] = await Promise.all([
    fetchJson("data/elements.json"),
    fetchJson("data/stats.json"),
    fetchJson("data/exceptions.json"),
  ]);
  if (!Array.isArray(exceptions)) throw new Error("exceptions.json is not a list.");
  if (!Array.isArray(elements) || elements.length !== DECK_SIZE) {
    throw new Error(`elements.json should hold ${DECK_SIZE} cards; got ${elements?.length}.`);
  }
  if (!Array.isArray(stats) || stats.length === 0) {
    throw new Error("stats.json is empty.");
  }
  const keys = new Set(stats.map(s => s.key));
  for (const e of elements) {
    if (!e.block) throw new Error(`${e.symbol} has no block.`);
    for (const key of keys) {
      if (!(key in e)) throw new Error(`${e.symbol} is missing the stat "${key}".`);
    }
  }
  // Deal order is by atomic number so the gallery reads like the table.
  elements.sort((a, b) => a.z - b.z);
  return { elements, stats, exceptions };
}
