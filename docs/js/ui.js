// ui.js — draws the game onto the page. The rules live in engine.js; this
// file only asks the engine for the next state and redraws from it, the way
// a view function in a web app reads a model and never changes it directly.
import { newGame, chooseStat, continueGame, playableStats, score, topCard, makeRng }
  from "./engine.js";
import { renderCard, renderCardBack } from "./cards.js";
import { loadData } from "./data.js";
import { OPPONENTS } from "./opponents.js";
import { explain } from "./trend.js";

// Presets are saved combinations of toggles (kickoff §2). The settings
// panel with every toggle exposed lands at M4.
export const PRESETS = {
  cp: {
    label: "CP",
    accent: "#1f6feb",
    statKeys: ["radius_pm", "ie1_kjmol", "en_pauling", "valence_e"],
    face: "valence",
    directionToken: false,
    opponent: "random",
  },
  honors: {
    label: "Honors",
    accent: "#b4420e",
    statKeys: ["radius_pm", "ie1_kjmol", "en_pauling", "mass"],
    face: "econf",
    directionToken: true,
    opponent: "random",
  },
};

const HUMAN = 0;
const COMPUTER = 1;
const OPPONENT_DELAY_MS = 650;

let data = null;          // { elements, stats }
let game = null;          // the engine state
let preset = null;        // the active preset record
let opponentRng = makeRng(Date.now() >>> 0);
let busy = false;         // true while the computer is "thinking"

const $ = (id) => document.getElementById(id);

function show(screen) {
  for (const s of document.querySelectorAll("[data-screen]")) {
    s.hidden = s.dataset.screen !== screen;
  }
}

function statByKey(key) {
  return data.stats.find(s => s.key === key);
}

function showError(message) {
  const banner = document.createElement("div");
  banner.className = "banner error";
  banner.textContent = message;
  document.querySelector("main").prepend(banner);
}

// ---------- starting ----------
function startGame(presetKey) {
  preset = PRESETS[presetKey];
  document.documentElement.style.setProperty("--accent", preset.accent);
  game = newGame(data.elements, data.stats, {
    statKeys: preset.statKeys,
    directionToken: preset.directionToken,
    firstPicker: HUMAN,
  }, Date.now() >>> 0);
  show("board");
  renderBoard();
}

// ---------- the board ----------
function renderBoard() {
  const [mine, theirs] = score(game);
  $("score-me").textContent = mine;
  $("score-them").textContent = theirs;
  $("round").textContent = `Round ${game.round} of ${game.config.roundCap}`;
  $("pot").textContent = game.pot.length ? `Pot: ${game.pot.length} cards` : "";

  const banner = $("direction");
  if (game.config.directionToken) {
    banner.hidden = false;
    banner.textContent = game.direction === "high" ? "Highest wins" : "Lowest wins";
    banner.dataset.direction = game.direction;
  } else {
    banner.hidden = true;
  }

  const my = $("my-card");
  my.replaceChildren(renderCard(topCard(game, HUMAN), data.stats,
    { statKeys: game.config.statKeys, revealed: false, face: preset.face }));
  const their = $("their-card");
  their.replaceChildren(renderCardBack());

  const whose = $("whose-turn");
  const buttons = $("stat-buttons");
  buttons.replaceChildren();
  const playable = new Set(playableStats(game, game.active));
  const isMine = game.active === HUMAN;
  whose.textContent = isMine ? "Your pick. Choose a stat:" : "Opponent is choosing…";
  game.config.statKeys.forEach((key, i) => {
    const stat = statByKey(key);
    const btn = document.createElement("button");
    btn.className = "stat-btn";
    btn.type = "button";
    btn.dataset.stat = key;
    btn.innerHTML = `<kbd>${i + 1}</kbd> ${stat.label}`;
    const allowed = isMine && playable.has(key);
    btn.disabled = !allowed;
    if (isMine && !playable.has(key)) {
      btn.title = stat.undefined_note || "Your card has no value for this stat.";
      btn.classList.add("undefined");
    }
    btn.addEventListener("click", () => humanPicks(key));
    buttons.appendChild(btn);
  });

  if (!isMine) computerPicks();
}

function humanPicks(key) {
  if (busy || game.phase !== "pick" || game.active !== HUMAN) return;
  if (!playableStats(game, HUMAN).includes(key)) return;
  game = chooseStat(game, key);
  renderReveal();
}

function computerPicks() {
  busy = true;
  setTimeout(() => {
    const key = OPPONENTS[preset.opponent].pick(game, opponentRng);
    game = chooseStat(game, key);
    busy = false;
    renderReveal();
  }, OPPONENT_DELAY_MS);
}

// ---------- the reveal ----------
function renderReveal() {
  const r = game.reveal;
  const stat = statByKey(r.stat);
  const mine = renderCard(r.a, data.stats,
    { statKeys: game.config.statKeys, revealed: true, face: preset.face });
  const theirs = renderCard(r.b, data.stats,
    { statKeys: game.config.statKeys, revealed: true, face: preset.face });
  for (const card of [mine, theirs]) {
    card.querySelector(`li[data-stat="${r.stat}"]`)?.classList.add("winning");
  }
  $("reveal-me").replaceChildren(mine);
  $("reveal-them").replaceChildren(theirs);

  const chooser = r.chooser === HUMAN ? "You" : "Opponent";
  $("reveal-stat").textContent = `${chooser} chose ${stat.label}` +
    (game.config.directionToken ? ` — ${r.direction === "high" ? "highest" : "lowest"} wins` : "");

  let outcome;
  if (r.winner === null) outcome = "Tie — both cards go to the pot.";
  else outcome = r.winner === HUMAN ? "You take the round." : "Opponent takes the round.";
  $("reveal-outcome").textContent = outcome;

  // The one explanation line (kickoff §2): trend right, trends conflict,
  // or an upset. Only reviewed exception reasons ever reach the screen.
  const why = explain(r, stat, data.exceptions);
  $("reveal-line").textContent = why.line;
  $("reveal-line").dataset.case = why.case;
  $("upset-badge").hidden = !why.upset;
  for (const card of [mine, theirs]) card.classList.toggle("upset", why.upset);
  show("reveal");
  $("continue").focus();
}

function onContinue() {
  if (game.phase !== "reveal") return;
  game = continueGame(game);
  if (game.phase === "over") return renderEnd();
  show("board");
  renderBoard();
}

// ---------- the end ----------
function renderEnd() {
  const [mine, theirs] = score(game);
  let headline;
  if (game.winner === "draw") headline = "It's a draw.";
  else if (game.winner === HUMAN) headline = "You win!";
  else headline = "Opponent wins.";
  $("end-headline").textContent = headline;
  $("end-detail").textContent =
    `${mine} cards to ${theirs} after ${game.round - 1} rounds (${game.endReason}).`;
  show("end");
  $("rematch").focus();
}

// ---------- keyboard ----------
function onKey(e) {
  if (e.target.tagName === "INPUT") return;
  const screen = document.querySelector("[data-screen]:not([hidden])")?.dataset.screen;
  if (screen === "board" && /^[1-9]$/.test(e.key)) {
    const key = game.config.statKeys[Number(e.key) - 1];
    if (key) humanPicks(key);
  } else if (screen === "reveal" && (e.key === " " || e.key === "Enter")) {
    e.preventDefault();
    onContinue();
  } else if (screen === "end" && (e.key === " " || e.key === "Enter")) {
    e.preventDefault();
    startGame(preset === PRESETS.honors ? "honors" : "cp");
  }
}

// ---------- wiring ----------
async function main() {
  try {
    data = await loadData();
  } catch (err) {
    showError("Trend Duel could not load its data.\n" + err.message);
    return;
  }
  for (const btn of document.querySelectorAll("[data-preset]")) {
    btn.addEventListener("click", () => startGame(btn.dataset.preset));
  }
  $("continue").addEventListener("click", onContinue);
  $("rematch").addEventListener("click", () => startGame(preset === PRESETS.honors ? "honors" : "cp"));
  $("to-title").addEventListener("click", () => show("title"));
  document.addEventListener("keydown", onKey);
  show("title");
}

main();
