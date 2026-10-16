# Trend Duel — project memory

**Read `BUILDLOG.md` before doing anything.** It is the single source of truth
for project state: which milestones are committed, what's deferred, and what
bugs are open. Do not rely on conversation history for any of that.

## What this repo is

A periodic-trends card game (Top Trumps mechanic) for Honors and CP Chemistry
at Medway High School. Every card is a main-group element; each round a player
picks a property — atomic radius, ionization energy, electronegativity, mass —
and the higher value wins. Numbers stay hidden until the reveal, so the only
way to pick well is to reason from the element's position on the table. The
reveal explains itself: trend right, trends conflict, or upset (with a
teacher-reviewed reason). The full spec is `trend_duel_v1_kickoff.md` — read
it before proposing changes.

**The single most important priority: the chemistry must be right.** Real
sourced data, real exceptions, explanations the teacher would put his name on.
Then it must load and play on a school Chromebook from a plain URL. Then fun.

## Standing rules

1. **A milestone is not done until verification passes.** Before declaring any
   milestone complete: run `python verify.py` (smoke test) and
   `python -m pytest tests/test_invariants.py -q` (data + architecture
   checks). Both must pass on THIS machine — "the code looks right" doesn't
   count. From M2, `npm test` (= `node --test "tests/js/**/*.test.js"`) must pass too;
   verify.py runs it for you.
2. **Append to `BUILDLOG.md` at the end of every milestone.** Entry format is
   in that file's header. Log deferrals and open bugs there the moment they
   appear — that is how they survive to the next session.
3. **Extend earlier phases, never rebuild them.** If an earlier phase's code
   seems wrong, say so and stop; don't quietly rewrite it.
4. **Patch, don't regenerate.** Gaps become decimal milestones (M2.5),
   inserted when the build reaches that point. Never rewrite the kickoff.
5. **Commit at every milestone** so any change rolls back cleanly.
6. **Never fabricate provenance.** Every number in `docs/data/` traces to a
   `mendeleev` field and a citation in `data/SOURCES.md`. If the package
   lacks a field or its citation cannot be found, STOP and say so — never
   fill from memory.
7. **Unreviewed chemistry never reaches students.** `exceptions.json`
   explanations display only when `"reviewed": true`. Claude drafts; the
   teacher flips the flag.
8. **JavaScript is explained like Python.** The game is JS because it must
   run on a Chromebook with nothing installed. Explain each piece in one or
   two plain sentences, same as for Python.

## Architecture invariants

Enforced as tests in `tests/test_invariants.py`. If a test blocks something
you're trying to do, the test is right until the human says otherwise.

- **The folder `docs/` IS the app.** Plain HTML, CSS, and JS modules. No
  framework, no bundler, no build step. GitHub Pages serves it as-is.
- **Zero external requests.** No CDN, no web fonts, no analytics, no images.
  Nothing under `docs/` loads anything over http(s). Invariant test, not a
  guideline.
- **Size budget: everything under `docs/` totals under 300 KB.**
- **`docs/js/engine.js` is pure logic.** It takes state and a choice and
  returns new state. It never references `document`, `window`, or
  `localStorage`, and imports nothing from the page layer. That is what makes
  it testable in Node and reusable for Phase 2's Call mode.
- **Data is generated, committed, and never recomputed at runtime.**
  `tools/build_elements.py` (Python, `mendeleev`) writes
  `docs/data/elements.json`, `docs/data/stats.json`, and `data/SOURCES.md`.
  The site and the tests never import `mendeleev`.
- **Undefined is `null`, never 0, never omitted** — and every null is
  documented in `SOURCES.md` as `- undefined \`stat\`: Sym, Sym` (the test
  parses that exact shape, both directions).
- **The deck is frozen at the 42 main-group elements of periods 1–6** for
  Phase 1. The d-block is Phase 2.
- **`column` is 1–8** (main-group column; the d-block gap carries no weight).
  H is column 1, He is column 8. `valence_e == column` for every card.
- **Adding a stat = one record in `stats.json` + one column in the build
  script.** Nothing else.
- **The results string is a frozen contract** (kickoff §5, `TD1|...`). Phase
  2's teacher page parses exactly that.
- **Presets are saved toggle combinations, not separate games.**

## Layout

```
docs/                      THE SITE (GitHub Pages serves this folder)
  index.html               entry page (M0 placeholder; gallery at M1; game at M2)
  css/                     plain CSS, no images
  js/engine.js             pure game logic (M2)
  js/ui.js                 draws state onto the page (M2)
  js/trend.js              pure predictor + the reveal's explanation line (M3)
  js/opponents.js          Random / Trend-reasoner / Greedy, pure (M2, M4)
  js/settings.js           every toggle, presets, localStorage save/load (M4)
  js/mastery.js            per-stat tally, localStorage td1.mastery.v1 (M5)
  js/results.js            the FROZEN TD1 results string + parser (M5)
  about.html  gallery.html  sources/standards page; the deck gallery
  js/cards.js  js/data.js  js/format.js   card renderer, loud data loader, value formatting
  data/elements.json       42 card records (M1, generated)
  data/stats.json          stat definitions (M1, generated)
  data/exceptions.json     predictor failures + drafted reasons (M3, generated)
data/SOURCES.md            dataset + citation per stat, ten hand-checked values (M1)
tools/build_elements.py    the data build (M1) — the only thing that imports mendeleev
tools/build_exceptions.mjs computes exceptions.json from the game's own predictor (M3)
tools/exception_reasons.json  drafted reasons, keyed stat|A|B (M3)
tools/requirements.txt     tooling deps, version-pinned
tests/test_invariants.py   kickoff §2/§5 as checks
tests/js/                  engine unit tests, `npm test` (M2)
package.json               tooling marker only: type=module so Node loads docs/js
verify.py                  smoke test against the served site
run.bat                    one double-click: serve docs/ on port 5093
open_when_ready.py         launcher helper: opens the browser once the port answers
trend_duel_v1_kickoff.md   the spec
```

## How to run

- **Live site:** https://gatorryan6-oss.github.io/trend-duel/ — GitHub Pages serving
  `docs/` on `main` of https://github.com/gatorryan6-oss/trend-duel. Every
  push to main redeploys in a minute or two. `gh` lives at
  `C:\Program Files\GitHub CLI\gh.exe` (not on PATH in older shells).

- `run.bat` — serves `docs/` on **port 5093** with `python -m http.server`
  and opens the browser once the server answers. Other devices on the same
  network can reach it at this PC's LAN address on that port.
- `python verify.py` — smoke test: starts the server if needed, fetches `/`
  and every data file, checks the `Trend Duel` marker, parses the JSON. A
  running server is reused as-is (a static server serves disk live).
- `python -m pytest tests/test_invariants.py -q` — data and architecture
  checks. Tests whose inputs don't exist yet SKIP naming the milestone.
- `npm test` — engine unit tests in Node's built-in runner (M2+); verify.py
  runs the same command and FAILS on a red test. Node v24.16.0 is on this
  machine. (Node refuses a bare directory, so the glob form is the one that
  works.) If Node ever disappears, verify.py says so by name.
- `python tools/build_elements.py` — regenerate the data (needs
  `pip install -r tools/requirements.txt`).

Port 5093 is this project's dedicated port. Taken by other projects on this
machine (read from their verify.py files 2026-10-14): 5000 (FieldStop), 5040
(a Windows service), 5050 (Statecraft), 5055 (Garage Lab), 5057 (CFB Sim),
5077 (Chaos), 5078 (Tsunami), 5079 (TERRANE), 5080 (THE PIT), 5081 (Sharp /
Cooking app), 5082 (bio test / CFB Predictor / hopscotch), 5083 (Vital Loop),
5084 (CritterCross), 5085 (bio engineering), 5086 (PitLane), 5087
(chokepoint), 5088 (cascade / ten blue links), 5089 (crystal grower), 5090
(Cambrian), 5091 (biohacking), 5092 (travel app), 8000, 8501 (options
pricer), 8503 (cipher), 8504 (Placer). Do not collide.
