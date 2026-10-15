# Trend Duel — Claude Code Kickoff Prompt
### Phase 1: a playable, deployable periodic-trends card game that runs on a school Chromebook from a URL

**Settled in the pre-write interview:** periodic-trends card battle; kickoff spec, not a prototype; static HTML/JS site with no server.

**Choices I made beyond that** — each is easy to change, so say so if you want something different:
- Name: **Trend Duel**. It is also the identity marker in `verify.py`.
- Deck: the 42 main-group elements of periods 1–6. The d-block is Phase 2.
- Phase 1 stats: atomic radius, first ionization energy, electronegativity, atomic mass, valence electrons.
- Element data is generated once from the `mendeleev` Python package and committed to the repo; the running game never depends on it.
- Honors and CP are two presets of one game, not two games.
- Look: clean, high-contrast, playing-card feel. No image files. CSS only, one accent color per preset.

---

## 0 — Working agreement (read this first)

The full working agreement lives in `~/.claude/CLAUDE.md` on this machine and
loads automatically — follow it. The load-bearing points: explain each
significant step in one or two plain-English sentences before doing it; build
in small runnable increments; STOP at phase checkpoints and wait for
confirmation; offer plain-English choices before structural decisions; set up
git early; patch gaps with decimal milestones (M4.5), never regenerate this
document mid-build. Project state lives in `BUILDLOG.md`, not chat history.

One standing note for this project: the game itself is JavaScript, because it has to run in a Chromebook browser with nothing installed and nothing to keep running. Python is still the tooling layer — the data build, `verify.py`, the invariants tests, and the local server. When you write JavaScript, explain it the same way you would explain Python to me: one or two plain sentences on what the piece does and why it is shaped that way.

## 1 — What we're building (and why)

A browser card game for my Honors and CP Chemistry classes at Medway High School, used as a 5–10 minute warm-up or review activity on student Chromebooks, and projected when I want to play the class. Every card is a main-group element. Each round a player picks a periodic property — atomic radius, ionization energy, electronegativity, mass — and the higher value takes the round. The numbers stay hidden until the reveal, so the only way to pick well is to reason from where the element sits on the periodic table. That is the point: the game rewards trend reasoning, and when the trend fails it shows the real data and tells the student why.

Priority order: the chemistry must be right — real sourced data, real exceptions, explanations I would put my name on. Then it must load and play on a school Chromebook from a plain URL. Then it should be fun enough that students start a second game without being told to.

Standards anchor: Massachusetts 2016 STE Framework HS-PS1-1, which covers using the periodic table to predict relative properties of main-group elements including ionization energy, atomic radius, electronegativity, and reactivity. Confirm the wording against the framework text before writing any standards label into the app; I have the framework as the authoritative reference.

## 2 — Locked-in design decisions

**The core loop**
- Top Trumps mechanic. The deck is shuffled and split evenly. Each round the active player sees only their own top card, picks one stat, and both top cards flip. Higher value wins both cards. Winner picks next round.
- Numbers are hidden on the unflipped card. The position cue is a mini periodic table drawn on every card — an 18-column grid with the element's cell lit and the d-block drawn dim. Symbol, name, atomic number, period, and column are printed. The stat rows show the stat names only, values blank, until the reveal.
- Ties on value: both cards go to a pot; the next round's winner takes the pot.
- Game length: play until one player is out of cards or 20 rounds have been played, whichever comes first; more cards wins. Target game length is about five minutes. The round cap is a setting.
- Undefined stats. A stat with no value on a card cannot be chosen by that card's holder. If the opponent chooses it, the card with no value loses the round, and the reveal says in one line why the value is undefined. In Phase 1 the undefined cells are: electronegativity for He, Ne, Ar, and any other noble gas the dataset leaves blank; atomic radius for all six noble gases. Noble-gas radii are measured on a different basis from the rest of the table and are not comparable, so I would rather show "undefined" than teach an artifact. Helium therefore wins on ionization energy and almost nothing else, which is true to the chemistry.
- Direction token, toggle. When on, each round opens by announcing "highest wins" or "lowest wins" before the active player picks a stat. Off by default; on in the Honors preset.

**The reveal explains itself**
- Every reveal shows both cards face up with all values, highlights the winning stat, and prints exactly one explanation line. Three cases, decided by a naive trend predictor that works only from period and column:
  1. **Trend predicts and is right.** Example line: "Across a period, ionization energy rises. Cl, column 7, beats Al, column 3."
  2. **Trends conflict.** One card is down-and-right or up-and-left of the other, so the two rules pull opposite ways. Line: "Trends disagree here: going down raises radius, going right lowers it. The data decides: I 139 pm vs Li 128 pm."
  3. **Trend predicts and is wrong.** This is an upset. The card gets an upset badge and the line comes from `exceptions.json` when a reviewed explanation exists; otherwise a generic line: "This pair breaks the simple trend. The data wins."
- The naive predictor's rules per stat: radius rises going down and falls going right; first ionization energy and electronegativity do the opposite; mass rises with atomic number; valence electrons equal the column index and have no exceptions. "Column" means main-group column 1–8, so the d-block gap between groups 2 and 13 carries no weight. Hydrogen sits in column 1, period 1; helium in column 8, period 1.
- The exceptions list is computed, not hand-typed: run the predictor over every pair in the deck where it makes a prediction, compare with the data, and write out every pair it gets wrong. Expect a few dozen, including the famous ones — nitrogen over oxygen on ionization energy, beryllium over boron, magnesium over aluminum, the argon/potassium and tellurium/iodine mass inversions, and gallium and germanium beating their period-3 neighbors on electronegativity. Draft a one-sentence chemical reason for each, mark every entry `"reviewed": false`, and show me the file. The game only displays explanations I have flipped to `true`. I review the chemistry; you do not ship unreviewed reasons to students.

**Opponents and modes**
- Single player against the computer, three opponents: **Random** picks any playable stat. **Trend-reasoner** scores each stat from the card's position using the same naive rules and picks the best; it loses on upsets the way a student does. **Greedy** picks the stat where the card's true value ranks highest in the deck; it is hard to beat and is Honors-only by default.
- Hotseat: two players on one Chromebook, with a "Pass to Player 2" curtain that hides the board between turns.
- No network multiplayer in Phase 1. A static site cannot do it; it is on the Phase 2 list as an optional Flask score server.

**Presets**
- **CP:** stats are radius, ionization energy, electronegativity, valence electrons. The card shows the valence-electron count. Direction token off. Opponents Random and Trend-reasoner.
- **Honors:** stats are radius, ionization energy, electronegativity, atomic mass. The card shows the noble-gas-shorthand electron configuration. Direction token on. All three opponents. Mass is in the Honors deck specifically for the argon/potassium and tellurium/iodine inversions — ordering by mass versus by atomic number is a history-of-the-table conversation I want to have.
- Presets are just saved combinations of toggles. Every toggle is exposed in a settings panel.

**Progress a student can show me, without a server**
- Mastery panel: for each stat, how many rounds the player chose it and how many they won, plus a count of upsets encountered. Stored in the browser's localStorage under a versioned key, with a reset button.
- "Copy results" button that puts a one-line results string on the clipboard for pasting into a Google Classroom question. Format is frozen in §5 because the Phase 2 teacher page will parse it.

**Deck and data**
- 42 cards: H, He; Li–Ne; Na–Ar; K, Ca, Ga–Kr; Rb, Sr, In–Xe; Cs, Ba, Tl–Rn. No period 7.
- Data comes from the `mendeleev` Python package at build time: Cordero covalent radii in picometers, first ionization energy from NIST (the package stores it in eV; convert at 96.485 kJ/mol per eV and store kJ/mol), Pauling electronegativity, standard atomic weight, electron configuration. `data/SOURCES.md` names the dataset behind every stat, with the package's documented citation. If the package lacks a field or you cannot find its citation, stop and tell me rather than fill from memory.
- After the build, spot-check ten values by hand against a reference table and record the ten in `SOURCES.md`. I will check more.
- Textbook numbers will differ from these in places. Ordering is what the game uses; an "About the data" page says where the numbers come from and why they may not match a student's book.

**Runs on a Chromebook, period**
- Static site. Plain HTML, CSS, and JavaScript modules. No framework, no bundler, no build step: the folder is the app.
- No external requests of any kind — no CDN scripts, no web fonts, no analytics. The school network filters, and the game must not care. This is an invariant test, not a guideline.
- Size budget: everything the browser loads totals under 300 KB. No image files; the periodic-table grid is CSS.
- Target screen 1366×768. Works with trackpad, touchscreen, and keyboard: number keys pick a stat, Space continues. Tap targets at least 44 px.
- Hosting: GitHub Pages serving the `docs/` folder of the repo. The site folder is named `docs/` only because that is the one folder GitHub Pages will serve with zero configuration.

## 3 — Tech stack

- **HTML + CSS + vanilla JavaScript modules** for the game. The only choice that meets "runs in a Chromebook browser from a URL with nothing installed." No framework because a framework adds a build step and kilobytes and buys nothing at this size.
- **Python 3** for everything that is not the game: `tools/build_elements.py` generates the data files; `verify.py` and `tests/test_invariants.py` gate every milestone; `python -m http.server` serves the folder locally. This keeps the kit intact even though the product is JavaScript.
- **`mendeleev`** Python package, version pinned in `tools/requirements.txt`, used only by the build script. Its output is committed, so the site and the tests never import it.
- **Node's built-in test runner, if Node is installed** — check `node --version` at M0. If it is there, JavaScript unit tests run with `node --test tests/js` and need no installs. If it is not, `docs/selftest.html` runs the same tests in the browser and prints PASS or FAIL, and `verify.py` tells me to open it.
- **Git from M0, GitHub remote by M5** for Pages hosting.

## 4 — Milestones

Build in order. Each milestone ends at a runnable checkpoint, and a milestone
is only done when `python verify.py` and
`python -m pytest tests/test_invariants.py -q` pass on my machine.

- **M0 — Repo scaffolding.** Copy the standing files from my kit into the repo
  and configure them for this project: `CLAUDE.md` (project memory),
  `BUILDLOG.md` (seed the Current state section), `run.bat` (this project's
  launch line), `verify.py`, `tests/test_invariants.py` (encode §2's locked
  decisions as checks), `.claude/settings.json` (Sonnet pin + Stop hook).
  **This project gets its own port** — never the framework default (Flask's
  5000, and not http.server's 8000 either). Ask me which ports my other projects use and take the next free one;
  set it in `verify.py` (`PORT`) and `run.bat` so they always agree. **Set the
  identity marker**: `MUST_CONTAIN[0]` in `verify.py` must be a string that
  appears in this app's pages and no other project's — use "Trend Duel".
  Leaving it empty is a failure, not a default.
  Kit adaptations for a static site: `run.bat` runs `python -m http.server PORT --directory docs`. `verify.py` checks whether anything answers on `PORT`; if not, it starts that server itself for the duration of the check and stops it after. It fetches `/`, `/data/elements.json`, and `/data/stats.json`, checks the marker, and parses both JSON files. Check `node --version` and record the result in `BUILDLOG.md`.
  ✅ *Checkpoint: `python verify.py` passes against a placeholder `docs/index.html` containing the marker, and the invariants tests run.*

- **M1 — Data build and card gallery.** Write `tools/build_elements.py`: it uses `mendeleev` to produce `docs/data/elements.json` for the 42 locked elements and `docs/data/stats.json` from the stat definitions in §5, and writes `data/SOURCES.md`. Apply the undefined-cell rules from §2. Then build the first page: a gallery of all 42 cards rendered from the JSON, each with its mini periodic table, symbol, name, number, period, and column. Click a card to flip it between hidden and revealed values. Write the data invariants listed in §5 into `tests/test_invariants.py` now, including the canonical-ordering checks.
  ✅ *Checkpoint: I open the gallery, see 42 correct cards, flip cesium and see 244 pm-class radius with a real source behind it, and the data tests pass.*

- **M2 — Duel against Random.** The game engine in `docs/js/engine.js`: shuffle, deal, choose stat, resolve, pot on ties, round cap, end state. The engine never touches the page — it takes state and a choice and returns new state. A separate `docs/js/ui.js` draws it. Screens: title with preset choice, board with my card face up and the opponent's face down, stat buttons, score strip and round counter, reveal overlay, continue, end screen with a rematch button. Opponent is Random. Engine unit tests in `tests/js/engine.test.js`.
  ✅ *Checkpoint: I play a complete game start to finish on a laptop and the winner is declared correctly.*

- **M3 — The reveal explains itself.** Implement the naive trend predictor and the three explanation cases from §2. Generate `docs/data/exceptions.json` with every pair the predictor gets wrong, drafted reasons, all marked unreviewed. Add the upset badge. Show me the exceptions file before moving on.
  ✅ *Checkpoint: I force an argon-versus-potassium reveal on mass and see the inversion called out; nitrogen versus oxygen on ionization energy shows the upset badge; lithium versus iodine on radius shows the conflict line. Exceptions file is in my hands for review.*

- **M4 — Opponents, hotseat, presets.** Add Trend-reasoner and Greedy. Add hotseat with the pass curtain. Add the settings panel with every toggle and the CP and Honors presets, including the electron configuration versus valence-count card variant and the direction token. Keyboard shortcuts.
  ✅ *Checkpoint: I beat Random, lose to Greedy, and play one hotseat game against myself without seeing the other hand. Switching presets changes the stat buttons and the card face.*

- **M5 — Mastery, results string, and a real Chromebook.** Mastery panel in localStorage with reset. "Copy results" producing the frozen §5 string. "About the data" page. Audit for the 300 KB budget and zero external requests, both as invariant tests. Push to GitHub, enable Pages on `docs/`, and give me the URL. I will open it on a school Chromebook and report back.
  ✅ *Checkpoint: the Pages URL loads and plays on a Chromebook over the school network; `verify.py` and all tests pass; `BUILDLOG.md` records the URL and the Chromebook result.*

**STOP at the end of this phase and wait for my confirmation before Phase 2.**

## 5 — Data products and frozen contracts

Later phases consume these, so they are stored and queryable from the start, never just drawn on screen.

**`docs/data/elements.json`** — a list of card records, one per element, frozen at 42 entries for Phase 1:
```
{ "z": 17, "symbol": "Cl", "name": "Chlorine", "period": 3, "group": 17, "column": 7,
  "mass": 35.45, "radius_pm": 102, "ie1_kjmol": 1251.2, "en_pauling": 3.16,
  "valence_e": 7, "econf": "[Ne] 3s2 3p5" }
```
Undefined values are `null`, never zero, never omitted. `column` is 1–8 as defined in §2.

**`docs/data/stats.json`** — the stat definitions every mode and the Phase 2 teacher page share:
```
{ "key": "radius_pm", "label": "Atomic radius", "unit": "pm", "decimals": 0,
  "down": "+", "across": "-", "undefined_note": "Noble-gas radii are measured on a different basis and are not comparable." }
```
Keys in Phase 1: `radius_pm`, `ie1_kjmol`, `en_pauling`, `mass`, `valence_e`. Mass uses `"by_z": true` instead of down/across; valence uses `"by_column": true`. Adding a stat means adding a record here and a column in the build script, nothing else.

**`docs/data/exceptions.json`** — computed list of predictor failures:
```
{ "stat": "ie1_kjmol", "a": "N", "b": "O", "predicted": "O", "actual": "N",
  "reason": "Oxygen's extra 2p electron pairs up and repulsion makes it easier to remove than one of nitrogen's half-filled, unpaired 2p electrons.",
  "reviewed": false }
```

**`data/SOURCES.md`** — one entry per stat key naming the dataset, its citation, and the `mendeleev` field used, plus the ten hand-checked values.

**Results string** — frozen format, version-prefixed, one line, no personal data beyond a self-entered first name:
```
TD1|Ryan|2026-10-14|honors|rounds=18|won=11|lost=7|upsets=3|radius=5/6,ie1=3/5,en=2/4,mass=1/3
```
`TD1` is the format version. The per-stat fields are rounds won over rounds chosen. Phase 2's teacher page parses exactly this.

**Engine boundary** — `docs/js/engine.js` is pure logic: it imports nothing from the page and never references `document` or `window`. That is what makes it testable in Node and what lets Phase 2 reuse it for Call mode unchanged.

**Invariants to encode in `tests/test_invariants.py`:**
1. `elements.json` holds exactly the 42 locked atomic numbers, no duplicates.
2. Every record has every field in the schema; `null` appears only where `SOURCES.md` documents the stat as undefined for that element.
3. Ranges: radius 25–300 pm, first ionization energy 370–2400 kJ/mol, electronegativity 0.7–4.0, mass 1–225.
4. Canonical orderings I teach, so a swapped dataset fails loudly: radius Cs > Rb > K > Na > Li and Li > Be > B > C > N > O > F; ionization energy He is the deck maximum and Cs the minimum, and N > O; electronegativity F is the maximum; mass Ar > K and Te > I; valence electrons equal column for every card.
5. No file under `docs/` contains an `http://` or `https://` reference in a script, link, image, import, or CSS `url()`.
6. Total size of all files under `docs/` is under 300 KB.
7. Every key in `stats.json` has an entry in `SOURCES.md`, and every stat key present on a card record appears in `stats.json`.
8. `engine.js` contains no reference to `document`, `window`, or `localStorage`.
9. `exceptions.json` validates: every `a` and `b` is a deck symbol, every `stat` is a stats key, every record has a boolean `reviewed`.

## 6 — Phase 2 candidates (listed so Phase 1 leaves room; not built now)

- **Call mode**: both elements shown, numbers hidden, the player names the winner before the reveal, optional timer. This is the purest trend-reasoning drill and reuses the engine and predictor as-is.
- Honors deck extension: the 3d block, electron affinity, ionic radius, with its own exceptions pass.
- Teacher page: paste a column of results strings, get a class table by stat.
- Offline service worker so the game survives a network drop mid-class.
- Sound and animation polish, and an optional Flask score server for a live class leaderboard.
