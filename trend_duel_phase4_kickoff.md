# Trend Duel — Claude Code Kickoff Prompt
### Phase 4: offline play and safe updates

**Measured before this spec was written** (2026-10-31):
- `curl -I` against the live site (https://gatorryan6-oss.github.io/trend-duel/): `index.html`, `js/ui.js`, `data/exceptions.json` and `css/style.css` all answer `Cache-Control: max-age=600`, and every file carries the same `Last-Modified` (the deploy time). For ten minutes after a deploy, a browser may therefore hold old copies of some files and fetch new copies of others.
- That window has already bitten twice, in testing during M10 and M11. A stale `settings.js` paired with a fresh `ui.js` failed to link and left the title page blank. M11's `startup_guard.js` now turns that into a "could not start, reload" banner. That makes the failure loud, but it doesn't prevent it.
- `docs/` is 23 files, 216.8 KB (budget 300 KB).
- From MDN, fetched this session:
  - With no `scope` option, a worker's default scope is "the directory where the service worker script is located", so `docs/sw.js` controls the whole site ([register](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register)).
  - With the default `updateViaCache` (`imports`), "the main script will always be updated from the network" ([register](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register), [updateViaCache](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/updateViaCache)).
  - A plain `fetch()` in the default cache mode looks in the HTTP cache first, while `cache: "reload"` fetches from the server "without first looking in the cache" ([Request.cache](https://developer.mozilla.org/en-US/docs/Web/API/Request/cache)). Applying that to install-time precaching is an inference, not a sentence on that page.
  - Loopback addresses (`localhost`, `127.0.0.0/8`) are secure contexts, and only secure contexts may register service workers ([Secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts)). So the local server on port 5093 can test this.
- **Not measured:** whether the district's managed Chromebooks allow service workers. The M13 checkpoint finds out on a real Chromebook. The game must play exactly as today if they don't.

**Choices I made beyond "offline + safe updates"** — each is easy to change, so say so if you want something different.
- **An update never interrupts a game.** A new version downloads quietly and waits. The page shows a line, "A new version of Trend Duel is ready — Reload", and only a click switches over. No automatic reload, ever, because an automatic switch mid-game is the same mixed-version bug in a new form.
- **All-or-nothing, hash-checked downloads.** The worker downloads every file of a new version and checks each one against a SHA-256 listed in `sw.js`. If any file doesn't match (an old copy from a cache, or a half-finished deploy), the whole new version is thrown away, the old one keeps running, and it tries again later. Stale data never passes as fresh.
- **The version is a content fingerprint, and it's visible.** The version is a short hash of every file's hash, so it changes exactly when the content changes. The title screen and the About page show it (e.g. "Version 3f9a2c1 · saved for offline"), so you can check at a glance that a Chromebook has the latest.
- **No service worker, no difference.** If registration fails or is blocked by policy, the game runs exactly as it does today and the version line says "not saved for offline".
- **A kill switch exists before it's needed.** One command replaces `sw.js` with a worker that deletes its caches and unregisters itself, for the day something goes wrong.
- Phase 3's other candidates (the 4d block, sound and animation, a score server) move to Phase 5.

---

## 0 — Working agreement (read this first)

The full working agreement lives in `~/.claude/CLAUDE.md` on this machine and
loads automatically — follow it. The load-bearing points: explain each
significant step in one or two plain-English sentences before doing it; build
in small runnable increments; STOP at phase checkpoints and wait for
confirmation; offer plain-English choices before structural decisions; commit
at every milestone; patch gaps with decimal milestones (M12.5), never
regenerate this document mid-build. Project state lives in `BUILDLOG.md`, not
chat history.

**This is a Phase 4 spec, so there is no M0.** Before anything else: read
`BUILDLOG.md` end to end, confirm the three gates are green
(`python verify.py`, `python -m pytest tests/test_invariants.py -q`; the smoke
test runs `npm test`), and lead with any open bugs logged there. Report how
many exception pairs carry `"reviewed": true`; that number is mine to raise.

**Never guess a browser API.** Service workers, the Cache API and
`crypto.subtle` are easy to misremember. Before writing calls against them,
read the current MDN page for each one and note the URL in the build log, the
same way Python libraries are checked against the installed version.

The game stays JavaScript and Python stays the tooling layer. Explain
JavaScript to me the way you would explain Python. A service worker is new to
me, so explain its life cycle (install, waiting, active) in plain English the
first time it comes up.

## 1 — What we're building (and why)

After this phase, Trend Duel loads with no network after the first visit, so a
class keeps playing when the school Wi-Fi drops. Every update arrives whole and
verified, with a visible line inviting a reload. It's never a silent half-swap
that blanks the page in front of a class. The motivating cases are mine: when I
approve a batch of exception reasons and push, every student should get all of
it, cleanly, at the next natural pause.

Priority order is unchanged: the chemistry must be right, then it must load
and play on a school Chromebook from a plain URL, then fun. This phase serves
the second priority. **It must change nothing about how the game plays.**

## 2 — Locked-in design decisions

**One generated worker**
- `docs/sw.js` sits at the site root so its scope is the whole site. A
  generated block inside it, between clearly marked comment lines, holds
  `VERSION` and `FILES`: every file under `docs/` except `sw.js` itself, each
  with its SHA-256.
- `tools/build_sw.py` (Python, standard library only) writes that block.
  `--check` exits non-zero if the block is stale. Like `build_exceptions.mjs
  --check`, a forgotten rebuild fails the tests. Because the block lives in
  `sw.js`, any content change changes `sw.js`'s bytes, which is what makes the
  browser notice an update.
- **Hash definition (one rule, used everywhere):** SHA-256 of the file's
  bytes after converting CRLF to LF, as hex. This is the same normalisation as
  the engine hash pin, so a Windows checkout and the served file agree. The
  Python builder and the worker's JavaScript implement it identically. A test
  proves they agree on every file.
- `VERSION` is the first 7 hex characters of the SHA-256 of the sorted
  `path:hash` lines.

**What the worker does**
- **Install:** fetch every file in `FILES` with `cache: "reload"`, check each
  hash, and only if *all* match, store them in a cache named for the version
  (`trend-duel-<VERSION>`). Any mismatch or failed fetch makes the install
  fail, so the old version keeps serving.
- **Fetch:** for same-origin GET requests inside its scope, answer from the
  current version's cache. A request for the folder (`/trend-duel/`) answers
  with `index.html`. Anything not in the cache goes to the network unchanged.
  The game makes no other requests, and the zero-external-requests invariant
  still holds.
- **Activate:** delete every `trend-duel-*` cache except the current one.
- **Never `skipWaiting()` on its own.** It is called only in answer to a
  message from a page, sent when the player clicks Reload.

**What every page does** (`docs/js/offline.js`, loaded by all four pages after
`startup_guard.js`)
- Registers `sw.js`. If service workers are missing or registration fails, it
  does nothing else and the game is unaffected.
- Shows the version line on the title screen and the About page:
  `Version 3f9a2c1 · saved for offline`, or `· not saved for offline` when
  there is no active worker.
- Asks for an update check on load (`registration.update()`).
- When a new worker is installed and waiting, shows one line: "A new version
  of Trend Duel is ready — Reload". The click tells the waiting worker to take
  over, then reloads once the new one is in control. Nothing else ever
  reloads the page.
- When the browser reports it is offline, the version line says so:
  `Offline — playing saved version 3f9a2c1`.

**Tools for me**
- `python tools/check_live.py` fetches the live site's `sw.js` and every file
  it lists, then reports either "live site is version X, all N files match"
  or exactly which files are stale. This answers "has my push finished
  deploying?" without guessing.
- `python tools/build_sw.py --kill` writes a kill-switch `sw.js` that deletes
  every `trend-duel-*` cache and unregisters itself. Push it and every device
  drops back to plain network loading on its next visit. The procedure goes
  in `CLAUDE.md` before it is ever needed.

**Unchanged by this phase — enforced**
- `engine.js` is byte-identical (existing hash pin). No game rule, stat, card,
  explanation line or results-string change.
- Zero external requests, no images, under 300 KB: existing invariants, with
  `sw.js` counted.
- Settings, mastery and names stay in localStorage, untouched by the worker.

## 3 — Tech stack

Unchanged: plain HTML, CSS and vanilla JavaScript in `docs/`, no build step,
served by GitHub Pages. The worker is plain JavaScript in one file. The
generated block is written by a committed Python tool, as `elements.json` is.
New Python tools use only the standard library (`hashlib`, `urllib`), so the
system Python runs them.

## 4 — Milestones

Build in order. Each milestone ends at a runnable checkpoint, and a milestone
is only done when `python verify.py` and
`python -m pytest tests/test_invariants.py -q` pass on my machine (the smoke
test runs `npm test`). Each milestone ends with a `BUILDLOG.md` append, a
commit, and a push.

- **M12 — The offline copy.** `tools/build_sw.py` (+ `--check`), `docs/sw.js`
  with the generated block, install / fetch / activate as in §2, and
  `docs/js/offline.js` on all four pages with the version line. `verify.py`
  runs `build_sw.py --check` and fetches `/sw.js`. Tests: the Python and
  JavaScript hash functions agree on every file; the block lists exactly the
  files on disk.
  ✅ *Checkpoint: I start `run.bat`, open the game, see "Version … · saved
  for offline", close the server window, reload, and the game still plays,
  with the gallery, About and teacher pages too.*

- **M13 — Safe updates.** The update line and Reload click; the offline
  wording; the update check on load; `tools/check_live.py`; `build_sw.py
  --kill` and its `CLAUDE.md` procedure (rehearsed locally, then restored).
  Show me, in a local run, an update arriving mid-game. The game carries on
  untouched, the line appears, and Reload brings the new version.
  ✅ *Checkpoint: with the live game open on my laptop, you push a small
  visible change. I run `python tools/check_live.py` until it says the live
  site matches, see the update line, and click Reload. Then on a school
  Chromebook: open the live URL, see the version line, turn Wi-Fi off,
  reload, and play a round. If the Chromebook shows "not saved for offline",
  the game must still work exactly as before. Log which one happened.*

**STOP at the end of this phase and wait for my confirmation before Phase 5.**

## 5 — Data products and frozen contracts

Everything from the Phase 1–3 §5 sections still holds, with these additions.

**`docs/sw.js` generated block** — `VERSION` (7 hex) and `FILES` (path → hex
SHA-256 under the one hash rule). This is a data product: `check_live.py`, the
worker and the tests all read it, and nothing else defines the version.

**Cache names** — `trend-duel-<VERSION>`, one per version. The prefix is
reserved: the worker deletes every other `trend-duel-*` cache on activate, and
the kill switch deletes them all.

**Invariants to add in `tests/test_invariants.py`:**
1. `docs/sw.js` exists at the docs root, and `python tools/build_sw.py --check`
   passes (the block matches the files on disk).
2. `FILES` lists every file under `docs/` except `sw.js`, with no extras and
   no duplicates.
3. `skipWaiting` appears in `sw.js` only inside the handler for a page's
   message, so the worker never takes over on its own.
4. Every page that runs a module loads `js/offline.js`, after
   `js/startup_guard.js`.
5. `sw.js` and `offline.js` never reference `localStorage`; the worker never
   touches settings or mastery.
6. Existing: engine hash pin, zero external requests (covers `sw.js`), size
   budget.

## 6 — Phase 5 candidates (listed so Phase 4 leaves room; not built now)

- The 4d block (Y–Cd), through the Phase 3 data, predictor and family pipeline.
- Sound and animation polish: motion that respects reduced-motion settings,
  optional sounds made in code (no audio files), off by default.
- Optional Flask score server consuming the teacher table's shape. It would be
  a separate, hosted piece, because the site itself stays request-free.
