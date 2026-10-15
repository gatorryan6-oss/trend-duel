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

- **Phase 1 in progress.** Spec is `trend_duel_v1_kickoff.md`. M0-M2 done;
  M3 (the reveal explains itself) is next.
- **Port:** 5093 (this project's own; see CLAUDE.md for the machine registry).
  The port map was read from every other project's verify.py on disk at M0
  rather than asked — 5093 is the next free after travel app's 5092.
- **Environment:** global Python 3.13.15 with pytest 9.1.1. `mendeleev` 1.3.0
  is installed in the project `.venv` (tools/requirements.txt); run the
  build with `.venv\Scripts\python.exe toolsuild_elements.py`. Node
  **v24.16.0** is installed, so JS engine tests will run with
  `node --test tests/js`; `docs/selftest.html` is the fallback only if Node
  disappears.
- **Suite:** `python verify.py` PASSES (index + gallery + both data files
  parsed). pytest: 22 passed, 1 skipped (exceptions.json arms at
  M3). `npm test`: 14 engine tests pass; verify.py runs them.
- **Open bugs:** none.
- **Machine note:** pytest.ini pins `--basetemp=.pytest_tmp` because this
  machine's system temp has an ACL-broken `pytest-of-gator` directory that
  errors any suite using tmp_path. Do not remove it.
- **Standards label:** the kickoff says to confirm HS-PS1-1 wording against the
  MA 2016 STE Framework text before writing it into the app. Not done yet;
  the human holds the framework. Do it at M5 (About page) — ask first.

---

## Milestones

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
