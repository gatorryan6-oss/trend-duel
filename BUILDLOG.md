# Build log — TREND DUEL

Single source of truth for project state. Newest entry at the top of the
Milestones section. Claude Code: read this whole file at session start; append
an entry at the end of every milestone. Never delete or rewrite old entries.

Entry format:

```
## YYYY-MM-DD — M[n]: [milestone name]
- Shipped: [what now works, one or two lines]
- Deferred: [anything pushed to later, with the milestone it moved to]
- Open bugs: [anything known-broken, even if minor]
- Decisions: [any design/architecture choice made mid-milestone]
```

---

## Current state

- **PHASE 3 COMPLETE (2026-10-31) — STOPPED, awaiting the human's
  confirmation before Phase 4.** Spec `trend_duel_phase3_kickoff.md`; M9 data,
  M10 predictor + exception families, M11 Honors deck in play — all shipped
  and pushed. Still to be confirmed by the human (M11 checkpoint): an Honors
  Duel and Call game on a laptop, one projected, a CP game unchanged, and the
  live URL on a school Chromebook.
- **Phase 2 complete (2026-10-28).** Spec `trend_duel_phase2_kickoff.md`; M6 Call
  mode, M7 teacher page, M8 projector layout all shipped and pushed (Pages
  redeploys on each push). Phase 1 (`trend_duel_v1_kickoff.md`, M0-M5 + M4.1) is
  complete and live. Remote:
  https://github.com/gatorryan6-oss/trend-duel (public). Live site:
  https://gatorryan6-oss.github.io/trend-duel/ (GitHub Pages, main /docs).
  **Chromebook result: the Pages URL loads and plays on a school Chromebook
  over the school network** (reported by the human 2026-10-21).
- **Next up:** nothing until the human confirms Phase 3. Phase 4 candidates
  (spec §6): the 4d block, an offline service worker with a versioned cache
  (also the real fix for the deploy-cache window), sound/animation polish,
  an optional Flask score server.
- **Still the teacher's:** exceptions.json has 209 entries in 29 families,
  0 reviewed. He approves a family with `python tools/review_family.py
  <family>` (the only tool that sets the flag); the game shows the generic
  upset line until then. Seven families are marked lower-confidence drafts. Helium's valence_e is 8 by the kickoff's locked column rule
  (flagged at M1; changing it means changing the rule and the invariant).
- **Port:** 5093 (this project's own; see CLAUDE.md for the machine registry).
  The port map was read from every other project's verify.py on disk at M0
  rather than asked — 5093 is the next free after travel app's 5092.
- **Environment:** global Python 3.13.15 with pytest 9.1.1. `mendeleev` 1.3.0
  is installed in the project `.venv` (tools/requirements.txt); run the
  build with `.venv\Scripts\python.exe tools/build_elements.py`. Node
  **v24.16.0** is installed; JS tests run with `npm test` (verify.py runs
  them too). `docs/selftest.html` deferred — only needed if Node disappears.
- **Suite:** `python verify.py` PASSES (index + gallery + three data files
  parsed). pytest: 37 passed, 0 skipped. `npm test`: 78 tests pass;
  verify.py runs them, parses all three data files, and smoke-tests
  gallery.html, about.html and teacher.html.
- **Open bugs:** none.
- **Machine note:** pytest.ini pins `--basetemp=.pytest_tmp` because this
  machine's system temp has an ACL-broken `pytest-of-gator` directory that
  errors any suite using tmp_path. Do not remove it.
- **Standards label:** HS-PS1-1 wording on about.html was taken from the
  DESE 2016 STE framework PDF (p. 85), extracted with pypdf at M5 — confirmed
  against the framework text, not recalled.

---

## Milestones

## 2026-10-31 — M11: The Honors deck in play (Phase 3) — PHASE 3 COMPLETE
- Shipped: settings `deck` ("main" | "main+3d"; DEFAULTS and old saves load
  "main"); the Honors preset is 52 cards with radius, IE, EN, electron
  affinity, ionic radius, mass (ALL_STATS reordered so presets round-trip
  through the form). Duel and Call deal `deckCards(elements, settings.deck)`;
  the engine is byte-identical (hash pin unchanged). Settings form has a Deck
  choice; keys 1-6 work. Teacher page learns `ea` / `ionic` labels and order.
  About page: Honors deck, EA and ionic-radius sources, undefined cells and
  why, a live ion list (js/about.js), the predictor's group and anion rules,
  "why the 3d metals bend the trends" (numbers from the game's own data).
  Projector: card mini table 80% and tighter stat rows so a six-row card fits
  at 1366x768 (card bottom 746 of 768 px; the reveal fits with no scroll).
  Browser-checked: CP title/board identical (21/21, same 5 checkboxes and
  mastery rows, 4 stats, keys 1-4); Honors Duel 26/26 with d-block cards
  winning and losing; Honors Call with d-block cards; About ion list (52);
  teacher table with ea/ionic. verify.py PASS; pytest 37; npm test 78.
  docs/ about 216 KB.
- Deferred: the human's M11 checkpoint (laptop games, projector, Chromebook).
- Open bugs: none new. Deploy-cache window (logged at M10) still stands;
  it is now LOUD instead of blank — see decision (3).
- Decisions: (1) CP sees no difference: the two Phase 3 stats are hidden
  from the settings checkboxes and mastery rows unless the 3d deck is chosen,
  the stat is in use, or it has a mastery tally (EXTENSION_STATS); the
  gallery's CP view also leaves them out. The only new thing on a CP screen
  is the Deck choice inside Settings and the Honors button's longer text.
  (2) Phase 1 JS tests now pin an explicit PHASE1_STATS list instead of
  borrowing ALL_STATS. (3) Found while testing: a stale cached module made
  the title page go BLANK with no message (a link error before any app code
  runs). New js/startup_guard.js, a plain script on every page, shows "could
  not start... reload" for load/link failures during startup only; proven
  with a temporary page importing a missing export (page deleted). An
  invariant requires it before every page's module. (4) The "why the 3d
  metals bend" paragraph is Claude's draft prose on a student-facing page;
  flagged for the teacher's read.

## 2026-10-31 — M10: The predictor and the exception families (Phase 3)
- Shipped: trend.js measures "across" by IUPAC group; lines say "column" for
  main-group pairs and "group" once a d-block card is involved ("Zn, group
  12, beats Ca, group 2"); the anion-first rule ("Anions are larger than
  cations: O²⁻ 140 pm vs Mg²⁺ 72 pm"); stats with show_with name the ion in
  data lines (K⁺ 138 pm). positionScore uses group order (acrossIndex: d-block
  slots between columns 2 and 3, main-group unchanged) and scores any anion
  above any cation. exceptions.json rebuilt over all 52 cards and 7 stats:
  209 entries (radius 13, IE 44, EN 27, mass 3, EA 83, ionic 39 — exactly the
  spec's sizing), each with a `family`; 29 families drafted in
  tools/exception_reasons.json, explicit pair lists, the 32 Phase 1 reasons
  kept as per-pair overrides. tools/review_family.py (list / approve /
  --unreview / --report) and data/EXCEPTION_FAMILIES.md. verify.py PASS;
  pytest 35 passed; npm test 72 passed. docs/ 206.6 KB of 300.
- Deferred: deck setting, Honors preset, teacher columns, About page, keys
  1-6, projector check to M11 (per spec).
- Open bugs: (minor, pre-existing, not a code bug) GitHub Pages lets browsers
  cache files ~10 minutes, so a student mid-visit during a deploy can briefly
  get old JS with new data and see the loud load-error banner until a reload
  (seen locally as stale modules while testing). Phase 4's versioned service
  worker is the fix; until then, deploy outside class time.
- Decisions: (1) Family membership is EXPLICIT pair lists, not hidden rules:
  a one-time scratch classifier proposed them and the committed JSON is the
  source. The build fails on an unlisted pair, a pair in two families, a
  listed pair that is no longer an upset, or a stale override. (2) A pair
  shows its override if it has one, else the family reason; review_family
  shows every distinct text a family would put on screen before asking.
  (3) Seven families carry `confidence: "lower"` (radius-3d-upturn,
  ie-3d-row-flat, en-mn-half-filled, ea-group-2-down, ea-3d-irregular,
  ea-3d-beats-p, ionic-same-charge-3d) so the teacher reads those first.
  (4) Invariants 5-6: the 32 Phase 1 records are frozen as a literal in the
  test (taken before the predictor changed), and the main-group/Phase-1-stat
  slice of exceptions.json must equal them exactly; every exception has a
  family with a label and reason for the right stat. (5) review_family.py's
  writer was checked byte-identical to the Node build's, so approving a
  family never makes `--check` fail. Claude did not run it in approve mode.

## 2026-10-31 — M9: The data (Phase 3)
- Shipped: elements.json now 52 cards (42 + Sc-Zn) with `block`, `ea_kjmol`,
  `ionic_radius_pm`, `ion`, `ion_charge`; `column`/`valence_e` null for
  d-block. stats.json gains `ea_kjmol` and `ionic_radius_pm` (with
  `anion_first`, and `show_with: "ion"` so the card prints `Na⁺ 102 pm`).
  SOURCES.md gains both citations, an ion table (element, ion, CN, spin,
  stored, shown, Shannon most_reliable, reason if undefined) and an EA
  undefined-cells table with the dataset's raw values. Ten new hand-checks
  (Cl/F/O EA, Na⁺/K⁺/F⁻/Cl⁻/O²⁻ ionic radius, Fe/Zn IE1) against Wikipedia
  data pages fetched 2026-10-31, as a build gate: all 20 pass. Gallery has a
  CP/Honors filter (CP default = the old page; `gallery.html#honors` links
  the 52-card view); d-block cards read `P4 · group 8` and light their cell.
  verify.py PASS; pytest 33 passed; npm test 63 passed. docs/ 176 KB.
- Deferred: predictor/exceptions to M10; deck setting, Honors preset, teacher
  columns, About page to M11 (all per spec).
- Open bugs: none. Fixed in passing: package.json's `npm test` script was
  still the bare-directory form Node refuses (`node --test tests/js`) — now
  the glob form CLAUDE.md documents. verify.py was never affected (it calls
  Node with the glob itself).
- Decisions: (1) The game and the exceptions build see only
  `narrow(data, MAIN_BLOCKS, ALL_STATS)` until M11 (new helper in data.js), so
  exceptions.json is byte-identical (32 entries) and CP sees no change; the
  five JS test files use the same view. (2) Shannon values stored to 0.1 pm
  (float noise rounded, .5s kept: Al³⁺ 53.5, Sc³⁺ 74.5, Ti⁴⁺ 60.5, Cr³⁺
  61.5, Fe³⁺ 64.5, Co²⁺ 74.5, Tl³⁺ 88.5); the card rounds half up (JS
  toFixed), and SOURCES' "Shown" column uses the same rule, not Python's
  half-to-even. (3) EA: the build stops if the set of negative values ever
  differs from {He, Be, N, Ar, Xe} or a no-value element gains one. (4) Ion
  rows are looked up by (charge, CN VI, spin) and must match exactly one
  Shannon row, else the build stops. (5) valence_e gains an undefined_note
  for d-block cards (only reachable in a Custom game after M11).

## 2026-10-28 — M8: Projector layout (Phase 2) — PHASE 2 COMPLETE
- Shipped: settings.projector (checkbox under Display; key P on the title
  screen toggles it; persisted). One class on <html> scales the root font
  to 24px (1.5x); the board and Call grids are now rem-based so cards,
  buttons and type grow together; the settings and mastery panels collapse
  when it switches on. New invariant: html.projector scales font-size, the
  .table/.call-table grid columns contain no px, and no projector rule pins
  a width over 1300 px. pytest 29; `npm test` 60; verify.py PASS. Browser
  checkpoint at 1366x768: root 16px -> 24px on P, card width 390 px, no
  horizontal overflow on title, board, reveal, Call and Call reveal
  (scrollWidth <= 1366), P again -> 16px with the checkbox cleared.
- Deferred: nothing.
- Open bugs: none.
- Decisions: 1.5x rather than the spec's "roughly 1.6x" — at 1.6x the
  three-column board needed 1380 px for its widest case; 1.5x fits 1366 with
  the two outer columns capped at 16.25rem / 17.5rem.

## 2026-10-28 — M7: Teacher page (Phase 2)
- Shipped: docs/teacher.html + docs/js/teacher.js. buildTable(text) is pure:
  rows (with Mode read from the preset's -call suffix), errors
  [{line, text, reason}] straight from parseResults, the Class row with
  per-stat won/chosen and %, and statColumns as the canonical-ordered union.
  sortRows (stable; stat columns by win fraction), toCsv (same columns, class
  row last, quoted where needed), Download CSV via a Blob URL. "Teacher" link
  in every header; verify.py smoke-tests /teacher.html. 6 new Node tests (60
  total); pytest 28 (new: teacher.js imports parseResults and never splits on
  '|' itself). Browser checkpoint: a paste of 7 lines (2 Call games, 1 blank,
  1 garbage) gave 5 rows, the garbage line named with the parser's reason,
  a class row (88 rounds, 53 won, ie1 21/29 · 72%), and header sorting.
- Deferred: nothing.
- Open bugs: none.
- Decisions: (1) teacher.js exports the pure functions and wires the page
  only when a document with #paste exists, so Node imports it cleanly.
  (2) Lines are reported by their position in the paste (1-based, blanks
  counted) so the teacher can find them in the sheet. (3) The CSV writes
  the class row's per-stat cells as "won/chosen (pct%)" in one cell to keep
  the column count identical to the table.

## 2026-10-28 — M6: Call mode (Phase 2)
- Shipped: docs/js/callmode.js — pure Call-mode rules on top of the Duel
  state (newCallGame, startRound, askableStats, makeCall, continueCall,
  timeLeft, callScore, masteryReveal); engine.js untouched and now pinned by
  SHA-256 in the invariants. settings.js: mode "call", timerSeconds (null =
  off; 3-60), projector key (false; UI at M8), validation for both. UI: the
  Call screen (both cards face up, numbers hidden, the stat as a question,
  Left / Right / Tie with keys 1-3, optional countdown that scores a timeout
  as "No call"), the shared reveal (showReveal), Call end screen with calls
  correct, and results lines with the `-call` suffix. 11 new Node tests
  (54 total); pytest 27 (3 new: engine hash, callmode purity, Phase 2
  settings defaults); verify.py PASS. Browser checkpoint: a 20-round Honors
  Call game (both directions seen) ended 10/20 with
  TD1|Ryan|2026-10-28|honors-call|rounds=20|won=10|lost=10|upsets=0|radius=1/3,ie1=4/7,en=0/3,mass=5/7
  which parseResults accepts; a 3 s timer produced "No call — time ran out".
  N-vs-O upset and the valence tie are covered by Node tests (forced hands).
- Deferred: nothing.
- Open bugs: none.
- Decisions: (1) Call mode passes `now` and an rng into every function, so
  the timer and the stat choice are testable without a clock. (2) A Call
  round feeds mastery through masteryReveal() — chosen for the announced
  stat, won when correct — so mastery.js and results.js stay unchanged.
  (3) The per-call timer restarts from the moment the next round is shown
  (not from the previous deadline), so a slow Continue never eats clock.

## 2026-10-15 — M5: Mastery, results string, About page, audits
- Shipped: docs/js/mastery.js — per-stat chosen/won tally for seat 0, all-time
  copy saved under localStorage key td1.mastery.v1 with a Reset button on the
  title screen. docs/js/results.js — the FROZEN TD1 results string plus
  parseResults() for the Phase 2 teacher page; stats.json records now carry
  `short` (radius, ie1, en, mass, valence) and an invariant pins them to
  [a-z0-9]+. End screen: first-name field (remembered under td1.name.v1),
  the results line, Copy with a select-and-Ctrl+C fallback. docs/about.html:
  datasets + citations, why textbooks differ, undefined cells, how the
  reveal decides, privacy, and HS-PS1-1 quoted from the 2016 MA STE
  framework (text extracted from the DESE PDF, framework p. 85). Audits:
  size (76 KB of 300) and zero external references are invariants; the
  browser network log for a full game showed only localhost requests.
  43 Node tests; pytest 24; verify.py PASS (index, gallery, about, 3 data
  files). Sample line produced in the browser:
  TD1|Ryan|2026-10-15|honors|rounds=20|won=7|lost=13|upsets=1|radius=1/2,ie1=3/3,en=0/2,mass=0/1
- Deferred: nothing. 2026-10-15 (later): GitHub CLI 2.102.0 installed via
  winget and signed in as gatorryan6-oss; repo created public, main pushed,
  Pages enabled on main /docs via the API. URL: https://gatorryan6-oss.github.io/trend-duel/
  Chromebook result (2026-10-21): PASS — loads and plays on a school
  Chromebook over the school network. PHASE 1 COMPLETE.
- Open bugs: none.
- Decisions: (1) rounds counts every resolved round incl. ties; won/lost
  exclude ties, so won+lost <= rounds. (2) Mastery tracks seat 0 only (the
  student at the keyboard; Player 1 in hotseat). (3) `preset` in the
  results string is cp / honors / custom via presetOf(). (4) The GitHub CLI
  was not installed at first; it is now (winget GitHub.cli), signed in via
  `gh auth login --web`. `gh` is NOT on PATH in shells opened before the
  install — use the full path C:\Program Files\GitHub CLI\gh.exe.

## 2026-10-14 — M4.1: hidden screens stay hidden
- Shipped: `[hidden] { display: none !important }` in style.css. The curtain
  screen's `display: flex` was beating the browser's `hidden` rule, so the
  "Pass to Player 2" block sat under the title screen. Found by reading the
  page TEXT (get_page_text) rather than a screenshot — hidden sections
  contribute no text, so the leak was visible there.
- Deferred: nothing.
- Open bugs: none.
- Decisions: every screen is switched by the `hidden` attribute only; no
  author CSS may set display on a [data-screen] section without that guard.

## 2026-10-14 — M4: Opponents, hotseat, presets
- Shipped: docs/js/opponents.js — Trend-reasoner (scores each stat from
  position with the predictor's rules) and Greedy (ranks the true value
  against the deck); both honour the direction token. docs/js/settings.js —
  every toggle (mode, opponent, allow-Greedy, stats, card face, direction
  token, round cap), CP/Honors as toggle bundles, presetOf() shows "Custom"
  when edited, saved under localStorage key td1.settings.v1 with a loud
  fallback to defaults. Hotseat mode with a "Pass to Player N" curtain that
  drops whenever the picker changes hands. Settings panel on the title
  screen; keys 1-5 pick, Space/Enter continue or lift the curtain. 35 Node
  tests (11 new); pytest 24; verify.py PASS. Checkpoint driven in the
  browser: trend-position play vs Random 1-1; random play vs Greedy lost
  7-35 and 13-29; Honors switches buttons to mass and the face to econf;
  hotseat game showed 7 curtains and both players' seats.
- Deferred: nothing.
- Open bugs: none.
- Decisions: (1) Greedy is gated by an allowGreedy toggle (off in CP, on in
  Honors) rather than hidden, so a CP teacher can still switch it on.
  (2) The curtain shows only when the picker CHANGES, not every round — the
  winner usually picks again, and a curtain every round was a tap tax.
  (3) Opponents pick for whichever seat is active (state.active), so the
  same code serves Phase 2 if the computer ever plays seat 0.
  (4) Settings persistence is a browser convenience only; the mastery panel
  (M5) gets its own versioned key.

## 2026-10-14 — M3: The reveal explains itself
- Shipped: docs/js/trend.js — the naive predictor (period + column only) and
  explain(): the three kickoff cases plus undefined and tie lines; upset
  badge and gold card ring in the reveal. docs/data/exceptions.json: 32
  predictor failures (radius 10, IE 13, EN 7, mass 2), each with a drafted
  one-sentence reason, ALL reviewed:false. Generated by
  tools/build_exceptions.mjs from the game's own predictor; reasons live in
  tools/exception_reasons.json. New invariant: --check recomputes and fails
  on a stale file; a placeholder reason can never be marked reviewed.
  24 Node tests (10 new, built from the kickoff's examples: Cl/Al across,
  Li/I conflict, N/O upset, Ar/K + Te/I mass). pytest 24 passed, 0 skipped.
  verify.py also parses exceptions.json.
- Deferred: nothing.
- Open bugs: none.
- Decisions: (1) The exceptions generator is Node, not Python, because the
  list must be exactly what docs/js/trend.js gets wrong — a second predictor
  in Python could drift. (2) Rebuilds keep reviewed:true only while the
  reason text is unchanged; an edited reason drops back to false.
  (3) "Upset" is defined on VALUE ordering (trend said A higher, data says
  B), independent of the direction token; low-wins rounds say "ranks above"
  instead of "beats". (4) Ten of the 32 are period-4/5/6 p-block radius
  pairs that differ by 1-10 pm — within Cordero's own uncertainty, or the
  sparsely measured Po/At corner. The teacher may prefer to leave those
  unreviewed (generic line) rather than teach an artifact.
- AWAITING REVIEW: docs/data/exceptions.json. The game shows a reason only
  when the teacher flips its reviewed flag to true.

## 2026-10-14 — M2: Duel against Random
- Shipped: docs/js/engine.js — pure rules (seeded shuffle, even deal, playable
  stats, resolve with undefined-loses, pot on ties, winner picks next, round
  cap, end state); docs/js/opponents.js (Random); docs/js/ui.js draws title
  / board / reveal / end screens and reuses cards.js. CP and Honors presets
  as toggle bundles (stat set, card face, direction token, accent). Keys 1-4
  pick, Space continues. 14 engine tests in tests/js/engine.test.js; verify.py
  now runs them and FAILS on red. Two full games driven end to end in the
  browser (CP: 25-17 at the cap; Honors: both directions seen, econf face).
- Deferred: docs/selftest.html (browser fallback for the JS tests) — Node
  v24 is on this machine, so the kickoff's "if Node is not there" branch is
  not needed; verify.py names the gap if Node disappears.
- Open bugs: none.
- Decisions: `node --test tests/js` (bare directory) is refused by Node 24;
  the working form is `node --test "tests/js/**/*.test.js"` (= `npm test`).
  package.json exists ONLY to set type=module for Node; the site has no
  build. Human is always player 0 and picks first. Ties keep the picker.
  Reveal line at M2 is a plain data line; M3 replaces it with the predictor.

## 2026-10-14 — M1: Data build and card gallery
- Shipped: tools/build_elements.py generates docs/data/elements.json (42
  cards), docs/data/stats.json (5 stats) and data/SOURCES.md from mendeleev
  1.3.0 in the project .venv; ten hand-checked values are a BUILD GATE (the
  script fails on drift). docs/gallery.html renders every card from the JSON
  with a CSS-only mini periodic table; click/Space flips hidden <-> revealed.
  Cs flips to 244 pm (Cordero 2008). pytest 21 passed, 2 skipped (M2, M3);
  verify.py PASS with both data files parsed and the gallery page answering.
- Deferred: nothing.
- Open bugs: none.
- Decisions: (1) Undefined cells: radius null for all six noble gases by
  rule; electronegativity null where the dataset is blank — He, Ne, Ar, Kr,
  Rn. Xe HAS a Pauling value (2.6) in this dataset and keeps it. (2) Helium's
  valence_e is 8 by the kickoff's locked column rule (invariant: valence_e ==
  column, no exceptions). Chemically He has 2 electrons total — FLAGGED for
  the teacher; changing it means changing the kickoff rule and the invariant.
  (3) Mass stored to 3 decimals, displayed to 2; Po/At/Rn carry the mass
  number of the longest-lived isotope, as mendeleev stores them.
  (4) Hydrogen's econf comes out of mendeleev as "1s" (no superscript 1).
  (5) Shared card renderer lives in docs/js/cards.js so the M2 board reuses
  it; data loading with loud checks (42 cards, every stat present) in
  docs/js/data.js.

## 2026-10-14 — M0: Repo scaffolding
- Shipped: kit files adapted for a static site — run.bat serves docs/ on
  port 5093 with http.server; verify.py starts/reuses that server, checks
  the `Trend Duel` marker and parses every data file; 23 invariants in
  tests/test_invariants.py (9 pass, 14 skip until M1/M2/M3);
  .claude/settings.json (Sonnet pin + Stop hook); placeholder docs/index.html.
  `python verify.py` PASS; pytest 9 passed, 14 skipped.
- Deferred: nothing.
- Open bugs: none.
- Decisions: port 5093 chosen by reading every other project's verify.py on
  disk (next free after 5092) rather than asking. Node v24.16.0 present, so
  JS tests will use `node --test tests/js`. Undefined cells are documented
  in SOURCES.md as `- undefined `key`: Sym, Sym` and the invariant parses
  that shape both ways (every null documented, every documented cell null).
