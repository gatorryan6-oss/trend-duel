// gallery.js — the M1 page: every card in the deck, click to flip.
import { renderCard } from "./cards.js";
import { loadData } from "./data.js";

function showError(message) {
  const banner = document.createElement("div");
  banner.className = "banner error";
  banner.textContent = message;
  document.querySelector("main").prepend(banner);
}

async function main() {
  let data;
  try {
    data = await loadData();
  } catch (err) {
    showError("Trend Duel could not load its data.\n" + err.message);
    return;
  }
  const { elements, stats } = data;
  const grid = document.getElementById("gallery");
  for (const element of elements) {
    const card = renderCard(element, stats, { face: "both" });
    const flip = () => card.classList.toggle("revealed");
    card.addEventListener("click", flip);
    card.addEventListener("keydown", (e) => {
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); }
    });
    grid.appendChild(card);
  }
  document.getElementById("count").textContent = `${elements.length} cards`;
}

main();
