// about.js — fills the About page's ion table from elements.json, so the
// table can never disagree with the cards. Page code: it touches document.
import { loadData } from "./data.js";
import { formatValue, formatIon } from "./format.js";

async function main() {
  const holder = document.getElementById("ion-table");
  let data;
  try {
    data = await loadData();
  } catch (err) {
    holder.textContent = "The ion table could not load: " + err.message;
    holder.classList.add("problem");
    return;
  }
  const stat = data.stats.find(s => s.key === "ionic_radius_pm");
  // One line per card, in atomic-number order; CSS flows them into columns.
  const list = document.createElement("ul");
  list.className = "ion-list";
  for (const e of data.elements) {
    const li = document.createElement("li");
    li.innerHTML = e.ion
      ? `<b>${e.symbol}</b> ${formatIon(e.ion)} ${formatValue(stat, e.ionic_radius_pm)}`
      : `<b>${e.symbol}</b> <span class="undefined">undefined</span>`;
    list.appendChild(li);
  }
  holder.replaceChildren(list);
}

main();
