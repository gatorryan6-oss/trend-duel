// ui.js — draws the game onto the page. The rules live in engine.js; this
// file only asks the engine for the next state and redraws from it, the way
// a view function in a web app reads a model and never changes it directly.
import { newGame, chooseStat, continueGame, playableStats, score, topCard, makeRng }
  from "./engine.js";
import { renderCard, renderCardBack } from "./cards.js";
import { loadData } from "./data.js";
import { OPPONENTS } from "./opponents.js";
import { explain } from "./trend.js";
import { PRESETS, ALL_STATS, EXTENSION_STATS, deckCards, applyPreset, presetOf, validate, toConfig, load, save }
  from "./settings.js";
import { resultsString, localDate, cleanName } from "./results.js";
import * as Mastery from "./mastery.js";
import { newCallGame, makeCall, continueCall, timeLeft, callScore, masteryReveal }
  from "./callmode.js";

const OPPONENT_DELAY_MS = 650;
const NAME_KEY = "td1.name.v1";     // the self-entered first name, remembered

let data = null;          // { elements, stats, exceptions }
let game = null;          // the engine state
let settings = null;      // the toggles (see settings.js)
let gameTally = null;     // this game's rounds/wins per stat (seat 0)
let mastery = null;       // the all-time tally from localStorage
let viewer = 0;           // whose hand the board shows: 0 vs computer; the picker in hotseat
let lastPicker = null;    // hotseat: who picked last round, to know when to drop the curtain
let opponentRng = makeRng(Date.now() >>> 0);
let busy = false;         // true while the computer is "thinking"
let callTimer = null;     // interval handle for the Call-mode countdown

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
  f.elements.deck.value = settings.deck;
  f.elements.opponent.value = settings.opponent;
  f.elements.allowGreedy.checked = settings.allowGreedy;
  f.elements.face.value = settings.face;
  f.elements.directionToken.checked = settings.directionToken;
  f.elements.roundCap.value = settings.roundCap;
  const timerOn = settings.timerSeconds !== null && settings.timerSeconds !== undefined;
  f.elements.timerOn.checked = timerOn;
  f.elements.timerSeconds.value = timerOn ? settings.timerSeconds : 10;
  f.elements.timerSeconds.disabled = !timerOn;
  f.elements.timerOn.disabled = settings.mode !== "call";
  f.elements.projector.checked = Boolean(settings.projector);
  applyProjector();
  for (const box of f.querySelectorAll("input[name=stat]")) {
    box.checked = settings.statKeys.includes(box.value);
    box.parentElement.hidden = !showsStat(box.value);
  }
  const greedyOption = f.elements.opponent.querySelector("option[value=greedy]");
  greedyOption.disabled = !settings.allowGreedy;
  f.elements.opponent.disabled = settings.mode !== "computer";
  const preset = presetOf(settings);
  $("preset-name").textContent = preset === "custom" ? "Custom" : PRESETS[preset].label;
  const problem = validate(settings);
  $("settings-problem").textContent = problem || "";
  $("start").disabled = Boolean(problem);
  document.documentElement.style.setProperty("--accent", PRESETS[settings.base].accent);
  if (mastery) renderMastery();
}

// The Phase 3 stats stay out of a CP player's views (checkboxes, mastery
// rows) unless the 3d deck is chosen or the stat is actually in use, so a CP
// screen looks exactly as it did before Phase 3.
function showsStat(key) {
  if (!EXTENSION_STATS.includes(key)) return true;
  const t = mastery && mastery.byStat[key];
  return settings.deck === "main+3d" || settings.statKeys.includes(key) || Boolean(t && t.chosen);
}

function readForm() {
  const f = $("settings-form");
  // Keep stats in the canonical order so presets round-trip exactly.
  const chosen = new Set([...f.querySelectorAll("input[name=stat]:checked")].map(b => b.value));
  settings = {
    ...settings,
    mode: f.elements.mode.value,
    deck: f.elements.deck.value,
    opponent: f.elements.opponent.value,
    allowGreedy: f.elements.allowGreedy.checked,
    face: f.elements.face.value,
    directionToken: f.elements.directionToken.checked,
    roundCap: Number(f.elements.roundCap.value),
    statKeys: ALL_STATS.filter(k => chosen.has(k)),
    timerSeconds: f.elements.timerOn.checked ? Number(f.elements.timerSeconds.value) : null,
    projector: f.elements.projector.checked,
  };
  save(settings, globalThis.localStorage);
  fillForm();
}

function buildStatBoxes() {
  const holder = $("stat-boxes");
  holder.replaceChildren();
  for (const stat of ALL_STATS.map(statByKey)) {
    const label = document.createElement("label");
    label.innerHTML = `<input type="checkbox" name="stat" value="${stat.key}"> ${stat.label}`;
    holder.appendChild(label);
  }
}

// Projector layout: one class on <html> scales the root font size, and
// everything measured in rem (cards, buttons, grid columns) grows with it.
function applyProjector() {
  const on = Boolean(settings.projector);
  document.documentElement.classList.toggle("projector", on);
  if (on) for (const d of document.querySelectorAll("details.settings")) d.open = false;
}

function toggleProjector() {
  settings = { ...settings, projector: !settings.projector };
  save(settings, globalThis.localStorage);
  fillForm();
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
  stopTimer();
  gameTally = Mastery.emptyTally();
  if (settings.mode === "call") return startCallGame();
  game = newGame(deckCards(data.elements, settings.deck), data.stats,
                 toConfig(settings), Date.now() >>> 0);
  viewer = 0;
  lastPicker = null;
  renderBoard();
}

// ---------- Call mode ----------
// Both cards face up, the stat announced, numbers hidden; the player calls
// Left, Right or Tie before the reveal. All rules live in callmode.js.
function startCallGame() {
  game = newCallGame(deckCards(data.elements, settings.deck), data.stats,
    { ...toConfig(settings), timerSeconds: settings.timerSeconds },
    Date.now() >>> 0, opponentRng, Date.now());
  renderCall();
}

function stopTimer() {
  if (callTimer) { clearInterval(callTimer); callTimer = null; }
}

function renderCall() {
  const c = game.call;
  const stat = statByKey(c.stat);
  const s = callScore(game);
  $("call-correct").textContent = s.correct;
  $("call-rounds").textContent = s.rounds;
  $("call-won").textContent = s.won;
  $("call-round").textContent = `Round ${game.round} of ${game.config.roundCap}`;

  const banner = $("call-direction");
  banner.hidden = !game.config.directionToken;
  if (game.config.directionToken) {
    banner.textContent = c.direction === "high" ? "Highest wins" : "Lowest wins";
    banner.dataset.direction = c.direction;
  }
  const which = c.direction === "low" ? "lower" : "higher";
  $("call-question").innerHTML = `Which has the ${which} <b>${stat.label.toLowerCase()}</b>?`;

  const opts = { statKeys: game.config.statKeys, revealed: false, face: settings.face };
  $("call-left").replaceChildren(renderCard(c.a, data.stats, opts));
  $("call-right").replaceChildren(renderCard(c.b, data.stats, opts));

  const holder = $("call-buttons");
  const timerEl = $("call-timer");
  holder.replaceChildren(timerEl);
  [["left", `Left (${c.a.symbol})`], ["right", `Right (${c.b.symbol})`], ["tie", "Tie"]]
    .forEach(([call, label], i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "call-btn";
      btn.dataset.call = call;
      btn.innerHTML = `<kbd>${i + 1}</kbd> ${label}`;
      btn.addEventListener("click", () => onCall(call));
      holder.appendChild(btn);
    });

  stopTimer();
  if (c.deadline !== null) {
    timerEl.hidden = false;
    const tick = () => {
      const left = timeLeft(game, Date.now());
      timerEl.textContent = (left / 1000).toFixed(1) + " s";
      timerEl.dataset.urgent = left <= 3000;
      if (left <= 0) onCall("none");
    };
    tick();
    callTimer = setInterval(tick, 100);
  } else {
    timerEl.hidden = true;
  }
  show("call");
}

function onCall(call) {
  if (!game || game.phase !== "call") return;
  stopTimer();
  game = makeCall(game, call, data.stats);
  const r = game.reveal;
  const stat = statByKey(r.stat);
  const why = explain(r, stat, data.exceptions);
  gameTally = Mastery.recordReveal(gameTally, masteryReveal(r), why.upset, 0);
  const winnerName = r.winner === null ? "a tie" : (r.winner === 0 ? `Left, ${r.a.symbol}` : `Right, ${r.b.symbol}`);
  let outcome;
  if (call === "none") outcome = `No call — time ran out. The answer was ${winnerName}.`;
  else if (r.correct) outcome = "Correct call!";
  else outcome = `Wrong call — it was ${winnerName}.`;
  const called = { left: `Left (${r.a.symbol})`, right: `Right (${r.b.symbol})`, tie: "Tie", none: "nothing" }[call];
  showReveal(r, why, {
    header: `${stat.label}` + (game.config.directionToken ? ` — ${r.direction === "high" ? "highest" : "lowest"} wins` : "") +
            `. You called ${called}.`,
    outcome, seatA: "Left", seatB: "Right",
  });
}

// ---------- mastery panel ----------
function renderMastery() {
  const body = $("mastery-body");
  body.replaceChildren();
  for (const stat of ALL_STATS.filter(showsStat).map(statByKey)) {
    const t = mastery.byStat[stat.key] || { chosen: 0, won: 0 };
    const pct = t.chosen ? Math.round(100 * t.won / t.chosen) + "%" : "—";
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${stat.label}</td><td>${t.chosen}</td><td>${t.won}</td><td>${pct}</td>`;
    body.appendChild(tr);
  }
  $("mastery-totals").textContent =
    `${mastery.games} games · ${mastery.rounds} rounds · ${mastery.won} won · ` +
    `${mastery.lost} lost · ${mastery.upsets} upsets seen`;
}

function resetMastery() {
  mastery = Mastery.reset(globalThis.localStorage);
  renderMastery();
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
// Duel: name the chooser and the round's winner, then hand off to showReveal.
function renderReveal() {
  const r = game.reveal;
  const stat = statByKey(r.stat);
  // The one explanation line (kickoff §2): trend right, trends conflict,
  // or an upset. Only reviewed exception reasons ever reach the screen.
  const why = explain(r, stat, data.exceptions);
  gameTally = Mastery.recordReveal(gameTally, r, why.upset, 0);
  let outcome;
  if (r.winner === null) outcome = "Tie — both cards go to the pot.";
  else if (hotseat()) outcome = `${nameOf(r.winner)} takes the round.`;
  else outcome = r.winner === 0 ? "You take the round." : "Opponent takes the round.";
  showReveal(r, why, {
    header: `${nameOf(r.chooser)} chose ${stat.label}` +
            (game.config.directionToken ? ` — ${r.direction === "high" ? "highest" : "lowest"} wins` : ""),
    outcome, seatA: nameOf(0), seatB: nameOf(1),
  });
}

// Shared by Duel and Call: both cards face up, the winning stat lit, the
// explanation line and the upset badge.
function showReveal(r, why, { header, outcome, seatA, seatB }) {
  const cardA = renderCard(r.a, data.stats, { statKeys: game.config.statKeys, revealed: true, face: settings.face });
  const cardB = renderCard(r.b, data.stats, { statKeys: game.config.statKeys, revealed: true, face: settings.face });
  for (const card of [cardA, cardB]) {
    card.querySelector(`li[data-stat="${r.stat}"]`)?.classList.add("winning");
    card.classList.toggle("upset", why.upset);
  }
  $("reveal-seat-a").textContent = seatA;
  $("reveal-seat-b").textContent = seatB;
  $("reveal-a").replaceChildren(cardA);
  $("reveal-b").replaceChildren(cardB);
  $("reveal-stat").textContent = header;
  $("reveal-outcome").textContent = outcome;
  $("reveal-line").textContent = why.line;
  $("reveal-line").dataset.case = why.case;
  $("upset-badge").hidden = !why.upset;
  show("reveal");
  $("continue").focus();
}

function onContinue() {
  if (game.phase !== "reveal") return;
  if (game.mode === "call") {
    game = continueCall(game, opponentRng, Date.now());
    if (game.phase === "over") return renderEnd();
    return renderCall();
  }
  game = continueGame(game);
  if (game.phase === "over") return renderEnd();
  renderBoard();
}

// ---------- the end ----------
function renderEnd() {
  let headline, detail;
  if (game.mode === "call") {
    const s = callScore(game);
    headline = `${s.correct} of ${s.rounds} calls correct.`;
    detail = `${s.won} cards won, ${s.missed} missed (${game.endReason}).`;
  } else {
    const [a, b] = score(game);
    if (game.winner === "draw") headline = "It's a draw.";
    else if (hotseat()) headline = `${nameOf(game.winner)} wins!`;
    else headline = game.winner === 0 ? "You win!" : "Opponent wins.";
    detail = `${nameOf(0)} ${a} cards, ${nameOf(1)} ${b} cards after ${game.round - 1} rounds (${game.endReason}).`;
  }
  $("end-headline").textContent = headline;
  $("end-detail").textContent = detail;
  // Fold this game into the all-time tally and offer the results string.
  gameTally = Mastery.recordGameEnd(gameTally);
  mastery = Mastery.merge(mastery, gameTally);
  Mastery.save(mastery, globalThis.localStorage);
  renderMastery();
  renderResults();
  show("end");
  $("rematch").focus();
}

// ---------- results string (kickoff §5, frozen) ----------
function rememberedName() {
  try { return globalThis.localStorage?.getItem(NAME_KEY) || ""; } catch { return ""; }
}

function renderResults() {
  const name = $("player-name").value || rememberedName();
  $("player-name").value = name;
  const line = resultsString({
    name,
    date: localDate(),
    preset: presetOf(settings) + (game.mode === "call" ? "-call" : ""),
    tally: gameTally,
    stats: game.config.statKeys.map(statByKey),
  });
  $("results-line").value = line;
  $("copy-status").textContent = "";
}

function onNameInput() {
  try { globalThis.localStorage?.setItem(NAME_KEY, cleanName($("player-name").value)); } catch { /* fine */ }
  if (game && game.phase === "over") renderResults();
}

async function copyResults() {
  const field = $("results-line");
  const status = $("copy-status");
  try {
    await navigator.clipboard.writeText(field.value);
    status.textContent = "Copied — paste it into the Google Classroom question.";
  } catch {
    // No clipboard permission (older browser, or a non-secure page): select
    // the text so Ctrl+C works, and say so.
    field.focus();
    field.select();
    status.textContent = "Press Ctrl+C to copy the selected line.";
  }
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
  } else if (screen === "call" && /^[123]$/.test(e.key)) {
    onCall(["left", "right", "tie"][Number(e.key) - 1]);
  } else if (screen === "reveal" && go) {
    e.preventDefault(); onContinue();
  } else if (screen === "curtain" && go) {
    e.preventDefault(); liftCurtain();
  } else if (screen === "end" && go) {
    e.preventDefault(); startGame();
  } else if (screen === "title" && (e.key === "p" || e.key === "P")) {
    toggleProjector();
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
  mastery = Mastery.load(globalThis.localStorage);
  buildStatBoxes();
  fillForm();
  renderMastery();
  $("mastery-reset").addEventListener("click", resetMastery);
  $("copy-results").addEventListener("click", copyResults);
  $("player-name").addEventListener("input", onNameInput);
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
  $("to-title").addEventListener("click", () => { stopTimer(); show("title"); });
  document.addEventListener("keydown", onKey);
  show("title");
}

main();
