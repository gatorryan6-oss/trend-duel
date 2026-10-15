// cards.js — draws one element card as HTML. Shared by the gallery (M1) and
// the game board (M2+). This file is PAGE code: it may touch document.
// The rules of the game live in engine.js, which never imports this.
import { formatValue } from "./format.js";

// Which cells of the mini periodic table exist, by period. Main-group
// columns are IUPAC groups 1, 2, 13–18; the d-block is groups 3–12 in
// periods 4–6. Period 1 holds only H (group 1) and He (group 18).
const MAIN_GROUPS = [1, 2, 13, 14, 15, 16, 17, 18];
const PERIODS = [1, 2, 3, 4, 5, 6];

function cellKind(period, group) {
  if (period === 1) return (group === 1 || group === 18) ? "main" : "empty";
  if (period <= 3) return MAIN_GROUPS.includes(group) ? "main" : "empty";
  return MAIN_GROUPS.includes(group) ? "main" : "d";
}

// Build the 18x6 grid with this element's cell lit.
export function miniTable(element) {
  const grid = document.createElement("div");
  grid.className = "mini";
  grid.setAttribute("aria-label",
    `Period ${element.period}, group ${element.group} on the periodic table`);
  for (const period of PERIODS) {
    for (let group = 1; group <= 18; group++) {
      const cell = document.createElement("div");
      let kind = cellKind(period, group);
      if (period === element.period && group === element.group) kind = "lit";
      cell.className = `cell ${kind}`;
      grid.appendChild(cell);
    }
  }
  return grid;
}

// formatValue lives in format.js (pure) so the trend explainer can share it.
export { formatValue };

// The face-down card: the opponent's unflipped top card on the board.
export function renderCardBack() {
  const card = document.createElement("article");
  card.className = "card back";
  card.setAttribute("aria-label", "Face-down card");
  card.innerHTML = `<div class="back-mark">Trend<br>Duel</div>`;
  return card;
}

// Render a card. `stats` is the list from stats.json; `statKeys` picks which
// rows to show (a preset's stats) and in what order. `revealed` shows values.
// `face` is "valence" (CP) or "econf" (Honors) — the one extra line under the
// name. The gallery shows both so the teacher can check them.
export function renderCard(element, stats, { statKeys, revealed = false, face = "both" } = {}) {
  const keys = statKeys || stats.map(s => s.key);
  const byKey = Object.fromEntries(stats.map(s => [s.key, s]));

  const card = document.createElement("article");
  card.className = "card" + (revealed ? " revealed" : "");
  card.dataset.symbol = element.symbol;
  card.tabIndex = 0;

  const top = document.createElement("div");
  top.className = "card-top";
  top.innerHTML = `<span class="z">${element.z}</span>` +
                  `<span class="pos">P${element.period} · col ${element.column}</span>`;
  card.appendChild(top);

  const symbol = document.createElement("div");
  symbol.className = "symbol";
  symbol.textContent = element.symbol;
  card.appendChild(symbol);

  const name = document.createElement("div");
  name.className = "name";
  name.textContent = element.name;
  card.appendChild(name);

  if (face === "econf" || face === "both") {
    const econf = document.createElement("div");
    econf.className = "econf";
    econf.textContent = element.econf;
    card.appendChild(econf);
  }

  card.appendChild(miniTable(element));

  const list = document.createElement("ul");
  list.className = "stats";
  for (const key of keys) {
    const stat = byKey[key];
    if (!stat) throw new Error(`Card asked for stat "${key}" but stats.json does not define it.`);
    const li = document.createElement("li");
    li.dataset.stat = key;
    const value = element[key];
    const isUndefined = value === null || value === undefined;
    li.innerHTML = `<span class="label">${stat.label}</span>` +
                   `<span class="value${isUndefined ? " undefined" : ""}">${formatValue(stat, value)}</span>`;
    list.appendChild(li);
  }
  card.appendChild(list);
  return card;
}
