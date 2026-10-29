# Trend Duel — Claude Code Kickoff Prompt
### Phase 2: Call mode, the teacher results page, and a projector layout — on the live Phase 1 site

**Settled before this spec:** Phase 1 is complete and live at https://gatorryan6-oss.github.io/trend-duel/ (repo `gatorryan6-oss/trend-duel`, Pages from `docs/` on `main`). It plays on a school Chromebook over the school network. The engine, predictor, presets, mastery panel and the frozen `TD1` results string all exist and are tested. Phase 2 reuses them; it does not rebuild them.

**Choices I made for this phase** — each is easy to change, so say so if you want something different:
- Scope: three milestones. **Call mode** (the purest trend drill), the **teacher page** (paste results lines, get a class table), and a **projector layout** for playing the class from the front of the room. Everything else from the Phase 1 §6 list waits for Phase 3 (see §6 here).
- Call mode keeps the deck economics of Duel: a correct call wins both cards into your pile, a wrong call loses them. Score is cards, same as Duel, so the end screen and mastery panel need no new vocabulary.
- Call mode's results line is still `TD1` and still nine fields. The only difference is the preset field reads `cp-call` or `honors-call`. The teacher page shows that as a Mode column. Nothing about the format's grammar changes, so Phase 1 lines and Phase 2 lines paste into the same box.
- The optional timer is a settings toggle, off by default in both presets. When it is on and runs out, the round counts as a wrong call; the reveal still explains itself.
- The service worker (offline play after a network drop) is deliberately NOT in this phase. A cached copy of the game that silently keeps serving last week's code after a push is exactly the "stale passing as fresh" failure the working agreement forbids. It can come in Phase 3 with a versioned cache and a visible "update available" line, once we have seen how often the network actually drops mid-class.

---

## 0 — Working agreement (read this first)

The full working agreement lives in `~/.claude/CLAUDE.md` on this machine and
loads automatically — follow it. The load-bearing points: explain each
significant step in one or two plain-English sentences before doing it; build
in small runnable increments; STOP at phase checkpoints and wait for
confirmation; offer plain-English choices before structural decisions; commit
at every milestone; patch gaps with decimal milestones (M6.5), never regenerate
this document mid-build. Project state lives in `BUILDLOG.md`, not chat history.

**This is a Phase 2 spec, so there is no M0.** Before anything else: read
`BUILDLOG.md` end to end, confirm the scaffolding is present and green
(`python verify.py`, `python -m pytest tests/test_invariants.py -q`,
`npm test` — the smoke test runs the Node tests for you), and lead with any
open bugs logged there. At the time of writing there are none. Also check
`docs/data/exceptions.json` and report how many reasons carry
`"reviewed": true`; that number is mine to raise, not yours, but the reveal in
Call mode will lean on it, so I want it in front of me.

The standing note still holds: the game is JavaScript because it has to run in
a Chromebook browser with nothing installed. Python stays the tooling layer.
When you write JavaScript, explain it the way you would explain Python to me.

## 1 — What we're building (and why)

Duel mode asks "which stat should I pick?" Call mode asks the question I
actually want every student answering out loud: "which of these two elements
wins on this property — and why?" Both cards face up, the stat announced,
numbers hidden, a call before the reveal. It is the drill version of the game,
and it reuses the engine and the predictor exactly as they are.

The teacher page closes the loop the Phase 1 results string opened. Students
paste their `TD1` line into a Google Classroom question; I paste the column of
lines into one page and see, per stat, who is reasoning well and where the
whole class breaks. No server, no accounts, nothing leaves my browser.

The projector layout is for the days I play the class: bigger cards, bigger
type, the settings panel out of the way.

Priority order is unchanged: the chemistry must be right (Call mode shows the
same reviewed explanations, never unreviewed ones), it must keep running on a
Chromebook from the same URL, and then it should be fun.

## 2 — Locked-in design decisions

**Call mode**
- A third `mode` next to `computer` and `hotseat`: `call`. One player, no
  opponent. The deck is shuffled and dealt into two hands exactly as in Duel
  (reuse `newGame`), and each round the two top cards are both shown face up,
  numbers hidden, with their mini periodic tables.
- The game picks the stat each round, uniformly at random from the preset's
  stats that at least one of the two cards has a value for. A stat that is
  undefined on one card is fair game — "He has no comparable radius, so Li
  wins" is a call I want them making. A stat undefined on both cards is never
  asked.
- The direction token works exactly as in Duel: when on, "highest wins" or
  "lowest wins" is announced before the call.
- The call is one of three: **left card**, **right card**, or **tie**. Keys
  `1`, `2`, `3`; the buttons are at least 44 px. Tie is a real answer (two
  column-1 cards on valence electrons tie); it is not a hedge.
- Scoring keeps Duel's economics so no new vocabulary is needed: a correct
  call moves both cards to the player's pile; a wrong call moves them to a
  "missed" pile. A tie round called correctly also goes to the player's pile.
  Game ends at the round cap or when the hands run out; the end screen reports
  correct calls over rounds, plus cards, the same way Duel reports cards.
- The reveal is the same reveal: both cards' values, the winning stat
  highlighted, the one explanation line from `explain()`, the upset badge.
  Call mode is where upsets teach the most, which is why unreviewed reasons
  stay hidden here too — the generic line until I flip the flag.
- Optional timer: a settings toggle `timerSeconds` (off by default in CP and
  Honors; 10 s when switched on; any value 3–60). A visible countdown; when it
  reaches zero the round is scored as a wrong call with "no call" in the
  reveal. The timer never runs during the reveal.
- Mastery counts Call rounds too: every Call round counts as "chosen" for the
  announced stat (the game chose it for you) and "won" when the call was
  correct. Upsets encountered are counted the same way as Duel.
- The results string for a Call game is `TD1|name|date|<preset>-call|rounds=…|won=…|lost=…|upsets=…|radius=…/…,…`
  with `won` = correct calls and `lost` = wrong calls (ties called correctly
  count as won; a timed-out round counts as lost). `<preset>` is `cp`,
  `honors` or `custom` from `presetOf()` exactly as today.

**Teacher page**
- `docs/teacher.html` + `docs/js/teacher.js`. A textarea, a "Build table"
  button, and the table. Paste any number of lines; blank lines are ignored.
- **There is one parser.** `teacher.js` imports `parseResults` from
  `docs/js/results.js` and contains no splitting of its own. A line
  `parseResults` rejects is listed under the table with its line number and the
  parser's plain-English reason — never silently dropped, never guessed at.
- Table columns: Name, Date, Preset, Mode (Duel or Call, read from the preset
  field's `-call` suffix), Rounds, Won, Lost, Upsets, then one column per stat
  short name that appears in ANY pasted line (`radius`, `ie1`, `en`, `mass`,
  `valence`), showing `won/chosen`. A final **Class** row totals every numeric
  column and shows per-stat `won/chosen` and a percentage. Sortable by
  clicking a column header; default order is paste order.
- "Download CSV" writes the same table to a `.csv` file through a Blob URL —
  no network, nothing stored. Column order matches the table.
- Privacy line on the page: nothing pasted is stored or sent; close the tab
  and it is gone.

**Projector layout**
- A `projector` toggle in settings (off by default; keyboard `P` on the title
  screen toggles it, and the setting persists like the others). On: the board
  and reveal scale cards and type by roughly 1.6×, the settings and mastery
  panels collapse, and the stat buttons stay reachable with the number keys.
  Target is a 1366×768 projector; nothing may overflow horizontally.

**Unchanged by this phase — enforced**
- `docs/js/engine.js` is reused as-is. Call mode lives in its own pure module
  (`docs/js/callmode.js`) that imports `newGame`, `topCard`, `resolve` and
  `shuffle`/`makeRng` from the engine and `explain` from `trend.js`. If Call
  mode genuinely needs an engine change, stop and tell me; do not edit
  `engine.js` quietly.
- The `TD1` format stays nine fields with the same grammar. `parseResults`
  must accept every Phase 1 line unchanged.
- Zero external requests, no images, under 300 KB total for `docs/` — the
  existing invariants keep running and must stay green.

## 3 — Tech stack

Unchanged from Phase 1. Plain HTML, CSS and vanilla JavaScript modules in
`docs/`; Python for tooling and the two gates; Node's built-in test runner for
the JavaScript (`npm test`, which `verify.py` also runs). Git is already on
GitHub; every push to `main` redeploys Pages in a minute or two, so each
milestone's commit is also a deploy — say so in the build log each time with
the commit hash.

## 4 — Milestones

Build in order. Each milestone ends at a runnable checkpoint, and a milestone
is only done when `python verify.py` and
`python -m pytest tests/test_invariants.py -q` pass on my machine (the smoke
test runs `npm test` and fails on a red Node test). Each milestone ends with a
`BUILDLOG.md` append, a commit, and a push.

- **M6 — Call mode.** `docs/js/callmode.js`: pure functions for starting a Call
  game from the existing `newGame` state, choosing the round's stat, scoring a
  call (left / right / tie / none), and ending the game. Node tests in
  `tests/js/callmode.test.js` cover: a correct call wins both cards; a wrong
  call loses them; a correct tie call; an undefined-on-one-side round; a
  timed-out round scores as wrong; the stat is never one both cards lack;
  the results string carries `-call`. Then the page: `mode: call` in
  `settings.js` (with `timerSeconds`), the title screen offers it, the board
  shows both cards face up with Left / Right / Tie buttons and the optional
  countdown, the reveal is the existing reveal, the end screen shows calls
  and the results line. Mastery and the results string record Call games as
  specified in §2. Invariant: `engine.js` is byte-identical to its Phase 1
  commit (pin its SHA-256 in `tests/test_invariants.py`; a deliberate change
  means updating the pin with a build-log note, not deleting the test).
  ✅ *Checkpoint: I play a full Honors Call game on a laptop, call N vs O on
  ionization energy, see the upset badge and the generic line (unreviewed),
  call a valence tie correctly, and the end screen gives me a `TD1|…|honors-call|…` line that `parseResults` accepts.*

- **M7 — Teacher page.** `docs/teacher.html` and `docs/js/teacher.js` as
  specified in §2, linked from the site header as "Teacher". Node tests for
  the table-building function (pure: lines in, rows + errors + class totals
  out) including a mixed paste of Duel and Call lines, a bad line in the
  middle, and a stat that appears in only some lines. Invariants: `teacher.js`
  imports `parseResults` and contains no `split("|")`; `teacher.html` contains
  the `Trend Duel` marker; `verify.py` smoke-tests `/teacher.html`.
  ✅ *Checkpoint: I paste six results lines (two of them Call games, one
  deliberately broken), see a class table with per-stat percentages, the bad
  line named with its reason, and a CSV downloads that opens in Sheets.*

- **M8 — Projector layout.** The `projector` toggle and the scaled board and
  reveal, as specified in §2. Invariant: with the toggle on, no element on the
  board or reveal screen is wider than the viewport at 1366 px (checked in the
  browser at the checkpoint, and as a CSS rule that `projector` styles never
  set a fixed width over 1300 px).
  ✅ *Checkpoint: I project a Duel game and a Call game at 1366×768 and can
  read every card from the back of the room; `P` toggles it; the Chromebook
  layout is unchanged with the toggle off.*

**STOP at the end of this phase and wait for my confirmation before Phase 3.**

## 5 — Data products and frozen contracts

Everything from Phase 1 §5 still holds. Additions:

**Results string, Call mode** — same `TD1` grammar, nine fields; preset field
is `<preset>-call`. The teacher page derives Mode from that suffix and must
treat an unsuffixed preset as Duel. `parseResults` is unchanged; the
`-call` suffix is a value, not new syntax.

**Call-mode state** (`docs/js/callmode.js`) — built on the Duel state from
`newGame` plus: `call` phase data `{ a, b, stat, direction, deadline }`, a
`piles` pair `{ won: [], missed: [] }`, and a `log` entry per round
`{ round, stat, call, correct, winner, upset }`. Pure: no `document`, no
`window`, no `localStorage` (extend the engine-purity invariant to cover
`callmode.js`).

**Teacher table** — the pure function in `teacher.js` returns
`{ rows, errors, classRow, statColumns }` where each row carries the parsed
line plus `mode`, and `errors` is `[{ line, text, reason }]`. Phase 3's score
server, if it ever exists, would consume exactly this shape.

**Settings** — new keys `timerSeconds` (null = off, else 3–60) and
`projector` (boolean). The localStorage key stays `td1.settings.v1`; adding
keys with defaults is not a shape change. Both presets leave the timer off.

**Invariants to add in `tests/test_invariants.py`:**
1. `engine.js` SHA-256 equals the pinned Phase 1 value.
2. `callmode.js` contains no `document`, `window` or `localStorage`.
3. `teacher.js` imports `parseResults` from `./results.js` and contains no
   `split("|")` or `split('|')`.
4. `settings.json` defaults: `timerSeconds` is null and `projector` is false
   in `DEFAULTS` and in both presets (read via Node, or by regex if simpler —
   say which).
5. `teacher.html` and every other page under `docs/` still contain no external
   references, and the size budget still holds (existing tests, re-run).

## 6 — Phase 3 candidates (listed so Phase 2 leaves room; not built now)

- Honors deck extension: the 3d block, electron affinity, ionic radius, with
  its own build-script columns, `stats.json` records and exceptions pass.
- Offline service worker with a versioned cache and a visible "update
  available" line, after we know how often the network actually drops.
- Sound and animation polish.
- Optional Flask score server for a live class leaderboard, consuming the
  teacher table's shape.
