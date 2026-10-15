// ui.js — draws the game onto the page. The rules live in engine.js; this
// file only asks the engine for the next state and redraws from it, the way
// a view function in a web app reads a model and never changes it directly.
import { newGame, chooseStat, continueGame, playableStats, score, topCard, makeRng }
  from "./engine.js";
import { renderCard, renderCardBack } from "./cards.js";
import { loadData } from "./data.js";
import { OPPONENTS } from "./opponents.js";
import { explain } from "./trend.js";
import { PRESETS, ALL_STATS, applyPreset, presetOf, validate, toConfig, load, save }
  from "./settings.js";

const OPPONENT_DELAY_MS = 650;

let data = null;          // { elements, stats, exceptions }
let game = null;          // the engine state
let settings = null;      // the toggles (see settings.js)
let viewer = 0;           // whose hand the board shows: 0 vs computer; the picker in hotseat
let lastPicker = null;    // hotseat: who picked last round, to know when to drop the curtain
let opponentRng = makeRng(Date.now() >>> 0);
let busy = false;         // true while the computer is "thinking"

const $ = (id) => document.getElementById(id);
const hotseat = () => settings.mode === "hotseat";

function show(screen) {
  for (const s of document.querySelectorAll("[data-screen]")) {
    s.hidden = s.dataset.screen !== screen;
  }
}

function statByKey(key) {
  return data.stats.find(s => s.key === key);
}

// Names for the two seats. Player 0 is "You" against the computer.
function nameOf(player) {
  if (hotseat()) return `Player ${player + 1}`;
  return player === 0 ? "You" : "Opponent";
}

function showError(message) {
  const banner = document.createElement("div");
  banner.className = "banner error";
  banner.textContent = message;
  document.querySelector("main").prepend(banner);
}

// ---------- settings panel ----------
// The form IS the settings: reading it gives the toggles, writing the
// toggles fills it. Presets just overwrite the toggles and refill.
function fillForm() {
  const f = $("settings-form");
  f.elements.mode.value = settings.mode;
  f.elements.opponent.value = settings.opponent;
  f.elements.allowGreedy.checked = settings.allowGreedy;
  f.elements.face.value = settings.face;
  f.elements.directionToken.checked = settings.directionToken;
  f.elements.roundCap.value = settings.roundCap;
  for (const box of f.querySelectorAll("input[name=stat]")) {
    box.checked = settings.statKeys.includes(box.value);
  }
  const greedyOption = f.elements.opponent.querySelector("option[value=greedy]");
  greedyOption.disabled = !settings.allowGreedy;
  f.elements.opponent.disabled = settings.mode === "hotseat";
  const preset = presetOf(settings);
  $("preset-name").textContent = preset === "custom" ? "Custom" : PRESETS[preset].label;
  const problem = validate(settings);
  $("settings-problem").textContent = problem || "";
  $("start").disabled = Boolean(problem);
  document.documentElement.style.setProperty("--accent", PRESETS[settings.base].accent);
}

function readForm() {
  const f = $("settings-form");
  // Keep stats in the canonical order so presets round-trip exactly.
  const chosen = new Set([...f.querySelectorAll("input[name=stat]:checked")].map(b => b.value));
  settings = {
    ...settings,
    mode: f.elements.mode.value,
    opponent: f.elements.opponent.value,
    allowGreedy: f.elements.allowGreedy.checked,
    face: f.elements.face.value,
    directionToken: f.elements.directionToken.checked,
    roundCap: Number(f.elements.roundCap.value),
    statKeys: ALL_STATS.filter(k => chosen.has(k)),
  };
  save(settings, globalThis.localStorage);
  fillForm();
}

function buildStatBoxes() {
  const holder = $("stat-boxes");
  holder.replaceChildren();
  for (const stat of data.stats) {
    const label = document.createElement("label");
    label.innerHTML = `<input type="checkbox" name="stat" value="${stat.key}"> ${stat.label}`;
    holder.appendChild(label);
  }
}

function choosePreset(key) {
  settings = applyPreset(settings, key);
  save(settings, globalThis.localStorage);
  fillForm();
}

// ---------- starting ----------
function startGame() {
  const problem = validate(settings);
  if (problem) { $("settings-problem").textContent = problem; return; }
  game = newGame(data.elements, data.stats, toConfig(settings), Date.now() >>> 0);
  viewer = 0;
  lastPicker = null;
  renderBoard();
}

// ---------- the board ----------
function renderBoard() {
  // In hotseat the board belongs to whoever picks; drop the curtain when
  // that changes hands so the other player's card is never on screen.
  if (hotseat() && lastPicker !== null && game.active !== lastPicker) {
    return renderCurtain();
  }
  viewer = hotseat() ? game.active : 0;
  const other = 1 - viewer;
  const [mine, theirs] = [score(game)[viewer], score(game)[other]];
  $("seat-me").textContent = nameOf(viewer);
  $("seat-them").textContent = nameOf(other);
  $("score-me").textContent = mine;
  $("score-them").textContent = theirs;
  $("round").textContent = `Round ${game.round} of ${game.config.roundCap}`;
  $("pot").textContent = game.pot.length ? `Pot: ${game.pot.length} cards` : "";

  const banner = $("direction");
  banner.hidden = !game.config.directionToken;
  if (game.config.directionToken) {
    banner.textContent = game.direction === "high" ? "Highest wins" : "Lowest wins";
    banner.dataset.direction = game.direction;
  }

  $("my-card").replaceChildren(renderCard(topCard(game, viewer), data.stats,
    { statKeys: game.config.statKeys, revealed: false, face: settings.face }));
  $("their-card").replaceChildren(renderCardBack());

  const buttons = $("stat-buttons");
  buttons.replaceChildren();
  const playable = new Set(playableStats(game, game.active));
  const isMine = game.active === viewer;
  $("whose-turn").textContent = isMine
    ? (hotseat() ? `${nameOf(viewer)}, choose a stat:` : "Your pick. Choose a stat:")
    : "Opponent is choosing…";
  game.config.statKeys.forEach((key, i) => {
    const stat = statByKey(key);
    const btn = document.createElement("button");
    btn.className = "stat-btn";
    btn.type = "button";
    btn.dataset.stat = key;
    btn.innerHTML = `<kbd>${i + 1}</kbd> ${stat.label}`;
    btn.disabled = !(isMine && playable.has(key));
    if (isMine && !playable.has(key)) {
      btn.title = stat.undefined_note || "Your card has no value for this stat.";
      btn.classList.add("undefined");
    }
    btn.addEventListener("click", () => humanPicks(key));
    buttons.appendChild(btn);
  });
  $("key-hint").textContent = `Keys 1–${game.config.statKeys.length} pick a stat.`;
  show("board");
  if (!isMine) computerPicks();
}

function renderCurtain() {
  $("curtain-title").textContent = `Pass to ${nameOf(game.active)}`;
  $("curtain-detail").textContent = `${nameOf(game.active)} picks this round. Tap when the screen is yours.`;
  show("curtain");
  $("curtain-go").focus();
}

function liftCurtain() {
  lastPicker = game.active;
  renderBoard();
}

function humanPicks(key) {
  if (busy || game.phase !== "pick" || game.active !== viewer) return;
  if (!playableStats(game, game.active).includes(key)) return;
  lastPicker = game.active;
  game = chooseStat(game, key);
  renderReveal();
}

function computerPicks() {
  busy = true;
  setTimeout(() => {
    const key = OPPONENTS[settings.opponent].pick(game, opponentRng);
    game = chooseStat(game, key);
    busy = false;
    renderReveal();
  }, OPPONENT_DELAY_MS);
}

// ---------- the reveal ----------
function renderReveal() {
  const r = game.reveal;
  const stat = statByKey(r.stat);
  const cardA = renderCard(r.a, data.stats, { statKeys: game.config.statKeys, revealed: true, face: settings.face });
  const cardB = renderCard(r.b, data.stats, { statKeys: game.config.statKeys, revealed: true, face: settings.face });
  for (const card of [cardA, cardB]) {
    card.querySelector(`li[data-stat="${r.stat}"]`)?.classList.add("winning");
  }
  $("reveal-seat-a").textContent = nameOf(0);
  $("reveal-seat-b").textContent = nameOf(1);
  $("reveal-a").replaceChildren(cardA);
  $("reveal-b").replaceChildren(cardB);

  $("reveal-stat").textContent = `${nameOf(r.chooser)} chose ${stat.label}` +
    (game.config.directionToken ? ` — ${r.direction === "high" ? "highest" : "lowest"} wins` : "");

  let outcome;
  if (r.winner === null) outcome = "Tie — both cards go to the pot.";
  else if (hotseat()) outcome = `${nameOf(r.winner)} takes the round.`;
  else outcome = r.winner === 0 ? "You take the round." : "Opponent takes the round.";
  $("reveal-outcome").textContent = outcome;

  // The one explanation line (kickoff §2): trend right, trends conflict,
  // or an upset. Only reviewed exception reasons ever reach the screen.
  const why = explain(r, stat, data.exceptions);
  $("reveal-line").textContent = why.line;
  $("reveal-line").dataset.case = why.case;
  $("upset-badge").hidden = !why.upset;
  for (const card of [cardA, cardB]) card.classList.toggle("upset", why.upset);
  show("reveal");
  $("continue").focus();
}

function onContinue() {
  if (game.phase !== "reveal") return;
  game = continueGame(game);
  if (game.phase === "over") return renderEnd();
  renderBoard();
}

// ---------- the end ----------
function renderEnd() {
  const [a, b] = score(game);
  let headline;
  if (game.winner === "draw") headline = "It's a draw.";
  else if (hotseat()) headline = `${nameOf(game.winner)} wins!`;
  else headline = game.winner === 0 ? "You win!" : "Opponent wins.";
  $("end-headline").textContent = headline;
  $("end-detail").textContent =
    `${nameOf(0)} ${a} cards, ${nameOf(1)} ${b} cards after ${game.round - 1} rounds (${game.endReason}).`;
  show("end");
  $("rematch").focus();
}

// ---------- keyboard ----------
function onKey(e) {
  const tag = e.target.tagName;
  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
  const screen = document.querySelector("[data-screen]:not([hidden])")?.dataset.screen;
  const go = e.key === " " || e.key === "Enter";
  if (screen === "board" && /^[1-9]$/.test(e.key)) {
    const key = game.config.statKeys[Number(e.key) - 1];
    if (key) humanPicks(key);
  } else if (screen === "reveal" && go) {
    e.preventDefault(); onContinue();
  } else if (screen === "curtain" && go) {
    e.preventDefault(); liftCurtain();
  } else if (screen === "end" && go) {
    e.preventDefault(); startGame();
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
  settings = load(globalThis.localStorage);
  buildStatBoxes();
  fillForm();
  for (const btn of document.querySelectorAll("[data-preset]")) {
    btn.addEventListener("click", () => { choosePreset(btn.dataset.preset); startGame(); });
  }
  for (const btn of document.querySelectorAll("[data-apply-preset]")) {
    btn.addEventListener("click", () => choosePreset(btn.dataset.applyPreset));
  }
  $("settings-form").addEventListener("change", readForm);
  $("settings-form").addEventListener("submit", (e) => { e.preventDefault(); startGame(); });
  $("continue").addEventListener("click", onContinue);
  $("curtain-go").addEventListener("click", liftCurtain);
  $("rematch").addEventListener("click", startGame);
  $("to-title").addEventListener("click", () => show("title"));
  document.addEventListener("keydown", onKey);
  show("title");
}

main();
