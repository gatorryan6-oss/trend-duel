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

- **Phase 1 in progress.** Spec is `trend_duel_v1_kickoff.md`. M0-M5 built;
  M5's last step (push to GitHub, enable Pages on docs/, Chromebook test)
  needs the repo to exist — see the M5 entry. exceptions.json: 32 drafted reasons, 0 flipped to
  reviewed:true so far — the game shows the generic upset line until the
  teacher flips them.
- **Port:** 5093 (this project's own; see CLAUDE.md for the machine registry).
  The port map was read from every other project's verify.py on disk at M0
  rather than asked — 5093 is the next free after travel app's 5092.
- **Environment:** global Python 3.13.15 with pytest 9.1.1. `mendeleev` 1.3.0
  is installed in the project `.venv` (tools/requirements.txt); run the
  build with `.venv\Scripts\python.exe tools/build_elements.py`. Node
  **v24.16.0** is installed; JS tests run with `npm test` (verify.py runs
  them too). `docs/selftest.html` deferred — only needed if Node disappears.
- **Suite:** `python verify.py` PASSES (index + gallery + three data files
  parsed). pytest: 24 passed, 0 skipped. `npm test`: 43 tests pass;
  verify.py runs them, parses all three data files, and smoke-tests
  gallery.html and about.html.
- **Open bugs:** none.
- **Machine note:** pytest.ini pins `--basetemp=.pytest_tmp` because this
  machine's system temp has an ACL-broken `pytest-of-gator` directory that
  errors any suite using tmp_path. Do not remove it.
- **Standards label:** the kickoff says to confirm HS-PS1-1 wording against the
  MA 2016 STE Framework text before writing it into the app. Not done yet;
  the human holds the framework. Do it at M5 (About page) — ask first.

---

## Milestones

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
- Deferred: GitHub push + Pages — see below.
- Open bugs: none.
- Decisions: (1) rounds counts every resolved round incl. ties; won/lost
  exclude ties, so won+lost <= rounds. (2) Mastery tracks seat 0 only (the
  student at the keyboard; Player 1 in hotseat). (3) `preset` in the
  results string is cp / honors / custom via presetOf(). (4) The GitHub CLI
  is not installed and no token is in the environment; git uses the
  credential manager, so a push works once the repo exists.

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
