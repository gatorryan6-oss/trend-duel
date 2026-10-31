// gallery.js — every card in the deck, click to flip. A CP/Honors filter
// (Phase 3 M9) switches between the 42-card main-group deck with the Phase 1
// stats and the 52-card Honors deck with every stat. CP is the default, so
// the page a CP student opens is the one they have always seen; the teacher
// can link straight to the Honors view with gallery.html#honors.
import { renderCard } from "./cards.js";
import { loadData, narrow, MAIN_BLOCKS } from "./data.js";
import { ALL_STATS, EXTENSION_STATS, PRESETS } from "./settings.js";

function showError(message) {
  const banner = document.createElement("div");
  banner.className = "banner error";
  banner.textContent = message;
  document.querySelector("main").prepend(banner);
}

// What each filter shows. Honors is simply everything in the data files;
// CP is the main-group deck without the Phase 3 stats, as it always was.
function viewOf(data, deck) {
  if (deck === "honors") return data;
  return narrow(data, MAIN_BLOCKS, ALL_STATS.filter(k => !EXTENSION_STATS.includes(k)));
}

function draw(data, deck) {
  const { elements, stats } = viewOf(data, deck);
  const grid = document.getElementById("gallery");
  grid.replaceChildren();
  for (const element of elements) {
    const card = renderCard(element, stats, { face: "both" });
    const flip = () => card.classList.toggle("revealed");
    card.addEventListener("click", flip);
    card.addEventListener("keydown", (e) => {
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); }
    });
    grid.appendChild(card);
  }
  grid.setAttribute("aria-label", `All ${elements.length} cards`);
  document.getElementById("count").textContent =
    `${PRESETS[deck].label} deck · ${elements.length} cards`;
  document.documentElement.style.setProperty("--accent", PRESETS[deck].accent);
  for (const btn of document.querySelectorAll("[data-deck]")) {
    btn.setAttribute("aria-pressed", String(btn.dataset.deck === deck));
  }
}

async function main() {
  let data;
  try {
    data = await loadData();
  } catch (err) {
    showError("Trend Duel could not load its data.\n" + err.message);
    return;
  }
  const deckFromHash = () => (location.hash === "#honors" ? "honors" : "cp");
  for (const btn of document.querySelectorAll("[data-deck]")) {
    btn.addEventListener("click", () => {
      history.replaceState(null, "", btn.dataset.deck === "honors" ? "#honors" : "#");
      draw(data, btn.dataset.deck);
    });
  }
  window.addEventListener("hashchange", () => draw(data, deckFromHash()));
  draw(data, deckFromHash());
}

main();
