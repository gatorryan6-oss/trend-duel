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

- **Phase 1 in progress.** Spec is `trend_duel_v1_kickoff.md`. M0 scaffolding
  done; M1 (data build + card gallery) is next.
- **Port:** 5093 (this project's own; see CLAUDE.md for the machine registry).
  The port map was read from every other project's verify.py on disk at M0
  rather than asked — 5093 is the next free after travel app's 5092.
- **Environment:** global Python 3.13.15 with pytest 9.1.1. `mendeleev` is
  NOT installed yet; M1 installs it (pinned 1.3.0 in tools/requirements.txt)
  into a project `.venv` so the global interpreter stays clean. Node
  **v24.16.0** is installed, so JS engine tests will run with
  `node --test tests/js`; `docs/selftest.html` is the fallback only if Node
  disappears.
- **Suite:** `python verify.py` PASSES against the placeholder
  `docs/index.html` carrying the `Trend Duel` marker; data files are NOTEd
  as not built (DATA_REQUIRED flips to True at M1). Invariants whose inputs
  don't exist yet SKIP naming the milestone that arms them (M1, M2, M3).
- **Open bugs:** none.
- **Machine note:** pytest.ini pins `--basetemp=.pytest_tmp` because this
  machine's system temp has an ACL-broken `pytest-of-gator` directory that
  errors any suite using tmp_path. Do not remove it.
- **Standards label:** the kickoff says to confirm HS-PS1-1 wording against the
  MA 2016 STE Framework text before writing it into the app. Not done yet;
  the human holds the framework. Do it at M5 (About page) — ask first.

---

## Milestones

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
