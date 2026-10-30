# Trend Duel — Claude Code Kickoff Prompt
### Phase 3: the Honors deck extension — the 3d block, electron affinity, and ionic radius

**Measured before this spec was written** (2026-10-30, from `mendeleev` 1.3.0 installed in the project `.venv`, and the mendeleev data documentation page at mendeleev.readthedocs.io/en/stable/data.html, fetched this session):
- `Element.electron_affinity` exists, in eV, positive meaning energy released (Cl 3.6127 eV = 348.6 kJ/mol). The docs cite the CRC Handbook, 95th ed. (2014). For **He, Be, N, Ar and Xe** the docs say the values come from T. Andersen, *Physics Reports* 394 (2004) 157–313, "specified for metastable ions and therefore the values are negative". **Ne, Mg, Kr, Rn, Mn and Zn** have no value.
- Ionic radii are a table per element (`IonicRadius`: charge, coordination number, spin, `ionic_radius` in pm), cited to R. D. Shannon, *Acta Cryst. A* 32 (1976) 751–767. There is no single "ionic radius" per element, so one ion must be chosen for each card.
- Every 3d element (Sc–Zn) has a Cordero radius, first ionization energy, Pauling electronegativity, atomic weight and configuration. The docs note mendeleev averages the low- and high-spin Cordero values for Mn, Fe and Co.
- A sizing run of the game's own predictor rules (scratch script, not committed) gave these upset counts:

| Stat | 42 main-group cards (today) | 52 cards with Sc–Zn |
|---|---|---|
| Atomic radius | 10 | 13 |
| Ionization energy | 13 | 44 |
| Electronegativity | 7 | 27 |
| Atomic mass | 2 | 3 (Co/Ni joins Ar/K and Te/I) |
| Electron affinity (new) | 48 | 83 |
| Ionic radius, naive rule (new) | 119 | 209 |
| Ionic radius, anion-first rule (new) | 9 | 39 |

  With "across" measured by IUPAC group instead of main-group column, the existing four stats reproduce today's 32 upsets exactly. That is why §2 switches the predictor to group: it changes no Phase 1 verdict.

**Choices I made beyond "do the Honors extension"** — each is easy to change, so say so if you want something different. The ones marked ⚑ are chemistry calls I want your eye on specifically.
- The extension is **Honors-only**. CP keeps the 42-card main-group deck and its four stats, unchanged.
- The Honors preset becomes **52 cards** (the 42 plus Sc–Zn) and **six stats**: radius, ionization energy, electronegativity, electron affinity, ionic radius, atomic mass.
- ⚑ **Electron affinity** is shown in kJ/mol as *energy released* (positive = released). The five metastable negative values are shown as **undefined**, not as negative numbers. Helium at −1901 kJ/mol would teach a metastable-state energy as if it were a ground-state property. With the six blanks, that makes 11 undefined cells. The alternative is to show the negatives and let them lose every comparison.
- ⚑ **Ionic radius** uses one ion per element, Shannon effective ionic radius at **coordination number 6**, high-spin where Shannon lists both. The proposed charges are in §5. The notable calls are Tl³⁺ (not Tl⁺), Pb²⁺ (not Pb⁴⁺), Ge⁴⁺, Sn⁴⁺, Ti⁴⁺, V³⁺ and Fe³⁺. Fourteen elements are undefined: no common simple ion, or no CN 6 entry. N³⁻ is listed by Shannon only at CN 4, so it is undefined rather than mixing coordination numbers.
- ⚑ **Ionic radius uses an anion-first predictor rule.** An anion beats a cation; otherwise the usual down/across rules apply. The naive rule alone flags 209 "upsets" that are really one idea, anions are bigger than cations, and 209 items is not a reviewable list.
- **Exceptions are reviewed by family.** About 210 upsets is too many to review one by one. Each upset gets a `family` (for example "half-filled subshell", "s-to-p drop", "3d contraction", "large cation beats small anion"). You review a family's one reason, and a helper script flips every pair in it.
- No new opponents, modes or screens. Call mode, hotseat, mastery, the teacher page and the projector layout all just work with the bigger deck.

---

## 0 — Working agreement (read this first)

The full working agreement lives in `~/.claude/CLAUDE.md` on this machine and
loads automatically — follow it. The load-bearing points: explain each
significant step in one or two plain-English sentences before doing it; build
in small runnable increments; STOP at phase checkpoints and wait for
confirmation; offer plain-English choices before structural decisions; commit
at every milestone; patch gaps with decimal milestones (M10.5), never
regenerate this document mid-build. Project state lives in `BUILDLOG.md`, not
chat history.

**This is a Phase 3 spec, so there is no M0.** Before anything else: read
`BUILDLOG.md` end to end, confirm the three gates are green
(`python verify.py`, `python -m pytest tests/test_invariants.py -q`; the smoke
test runs `npm test`), and lead with any open bugs logged there. Report how
many exception reasons carry `"reviewed": true` — that number is mine to raise,
not yours.

The provenance rule is the spine of this phase. Every new number traces to a
`mendeleev` field and a citation in `data/SOURCES.md`. If a field is missing or
a citation cannot be found, STOP and tell me; never fill from memory. Drafted
reasons and the ion table are drafts until I approve them.

The game stays JavaScript and Python stays the tooling layer. Explain
JavaScript to me the way you would explain Python.

## 1 — What we're building (and why)

Honors students meet the transition metals, electron affinity and ion sizes in
this unit, and those are exactly where the simple trends get interesting: the
3d row's radii barely shrink, ionization energy jumps at Zn and dips at Cr and
Cu, cobalt outweighs nickel, nitrogen will not take an electron, and K⁺ is
bigger than F⁻. Phase 3 puts those cards and stats in the Honors deck so the
reveal can show them.

Priority order is unchanged: the chemistry must be right — sourced data,
reviewed explanations, no unreviewed reason on a student's screen. It must
still load and play on a school Chromebook from the same URL. Then it should
be fun. **CP students must see no difference at all.**

## 2 — Locked-in design decisions

**The deck**
- `elements.json` holds **52** records: the 42 main-group cards plus Sc, Ti, V,
  Cr, Mn, Fe, Co, Ni, Cu, Zn. Each record gains `block` (`"s"`, `"p"` or `"d"`).
- A new setting `deck`: `"main"` (42 cards) or `"main+3d"` (52). CP sets
  `"main"`; Honors sets `"main+3d"`. The engine is not told about decks: the UI
  filters the card list before calling `newGame` / `newCallGame`, so
  `engine.js` stays byte-identical (its hash pin stays as it is).
- 52 cards deal 26 / 26. The round cap stays 20.

**Fields on a 3d card**
- `column` is **null** for d-block cards and stays 1–8 for main-group cards.
  `group` (1–18) is already on every record.
- `valence_e` is **null** for d-block cards. "Valence electrons equal the
  column" is a main-group rule; the undefined note says so in one line.
  Honors does not use valence electrons, so this only matters in a Custom game.
- The card's top line shows `P4 · group 8` for a d-block card where a
  main-group card shows `P3 · col 7`. The mini table lights the d-block cell
  (the cells are already drawn; they are just dim today).
- `econf` comes from mendeleev as is, so Cr shows `[Ar] 3d5 4s` and Cu shows
  `[Ar] 3d10 4s`. Those are the anomalies Honors should notice.

**Two new stats** (one record each in `stats.json` + one column each in the build script)
- `ea_kjmol` — "Electron affinity", kJ/mol, energy released, `decimals: 1`,
  `short: "ea"`, `down: "-"`, `across: "+"`. eV × 96.485, same constant as
  ionization energy. Undefined for He, Be, N, Ar, Xe (metastable values) and
  Ne, Mg, Kr, Rn, Mn, Zn (no value), with the undefined note: "This element
  does not form a stable negative ion, so it has no comparable electron
  affinity."
- `ionic_radius_pm` — "Ionic radius", pm, `decimals: 0`, `short: "ionic"`,
  `down: "+"`, `across: "-"`, plus `"anion_first": true`. Each card also
  gains `ion` (for example `"Na+"`, `"O2-"`, `"Fe3+"`) and `ion_charge`
  (integer, or null). Shannon effective ionic radius at CN 6, high-spin where
  both spins are listed. Values are **stored exactly as Shannon lists them**
  (several end in .5, such as Al³⁺ 53.5 and Sc³⁺ 74.5) and only *displayed*
  to the nearest pm. Comparisons use the stored value, so rounding never
  manufactures a tie (Sc³⁺ 74.5 still beats Zn²⁺ 74).
  Undefined note: "This element has no common simple ion with a comparable
  six-coordinate radius."
- Cards show the ion beside the value on reveal: `Na⁺ 102 pm`.

**The predictor** (`docs/js/trend.js`, which is not hash-pinned)
- "Across" is measured by **IUPAC group**, not main-group column. For two
  main-group cards the order is identical, so every Phase 1 verdict stands; an
  invariant proves it (§5).
- Explanation text keeps saying "column" when both cards are main-group, so
  every Phase 1 line reads exactly as before. When either card is d-block it
  says "group": "Across a period, ionization energy rises. Zn, group 12, beats
  Ca, group 2."
- **Anion-first rule**, applied only to stats with `anion_first`: if one card
  is an anion and the other a cation, the anion is predicted larger; otherwise
  the down/across rules apply. Its explanation line: "Anions are larger than
  cations: O²⁻ 140 pm vs Mg²⁺ 72 pm."
- `opponents.js` `positionScore` uses group for "across" too, so the
  Trend-reasoner reads the 3d block the way a student would.

**Exceptions**
- `exceptions.json` keeps its frozen shape and adds one field: `family`.
- Reasons are drafted **per family** in `tools/exception_reasons.json`, with
  optional per-pair overrides. Every pair is assigned a family by Claude; a pair
  with no family is a build failure, not a silent "other".
- A helper, `python tools/review_family.py <family>`, flips `reviewed: true`
  for every pair in one family. It is the only tool that writes the flag, and
  it is run by me, never by Claude. Rebuilds still drop the flag when a reason's
  text changes.
- Expected size: about 210 entries, roughly 70 KB. `docs/` stays under the
  300 KB budget (about 200 KB estimated).

**Unchanged by this phase — enforced**
- CP: 42 cards, four stats, card face, presets, explanation text — identical.
- `engine.js` byte-identical (existing hash pin).
- `TD1` grammar unchanged. New per-stat short names `ea` and `ionic` are values,
  not syntax. The teacher page learns their column labels and order.
- Zero external requests, no images, size budget — existing invariants.

## 3 — Tech stack

Unchanged. Plain HTML, CSS and vanilla JavaScript modules in `docs/`; Python
(`mendeleev` 1.3.0 in `.venv`) for the data build; Node for the exceptions
build and the JavaScript tests. Every push to `main` redeploys GitHub Pages.

## 4 — Milestones

Build in order. Each milestone ends at a runnable checkpoint, and a milestone
is only done when `python verify.py` and
`python -m pytest tests/test_invariants.py -q` pass on my machine (the smoke
test runs `npm test`). Each milestone ends with a `BUILDLOG.md` append, a
commit, and a push.

- **M9 — The data.** Extend `tools/build_elements.py`: the ten 3d cards, the
  `block` field, null `column`/`valence_e` for d-block, `ea_kjmol`,
  `ionic_radius_pm`, `ion`, `ion_charge`. The ion choices live in one table in
  the build script, mirrored into `data/SOURCES.md` as a table you can review
  (element, ion, CN, spin, radius, Shannon `most_reliable` flag). Add the two
  stat records with citations (CRC 95th ed. for electron affinity, with the
  Andersen 2004 note explaining why those five cells are undefined; Shannon
  1976 for ionic radii). Add **ten more hand-checked values** against a
  reference table consulted at build time (for example Cl, F and O electron
  affinity; Na⁺, Cl⁻, O²⁻, K⁺ and F⁻ ionic radius; Fe and Zn first ionization
  energy) as a build gate, like Phase 1's ten. The gallery shows all 52 cards
  with a CP/Honors deck filter.
  ✅ *Checkpoint: I open the gallery, filter to Honors, flip Cr and Cu and see
  their configurations, flip Na and Cl and see Na⁺ 102 pm and Cl⁻ 181 pm. **I
  review the ion table and the undefined electron-affinity cells in SOURCES.md
  before M10 starts** — a review gate, not a phase stop.*

- **M10 — The predictor and the exceptions.** `trend.js`: group for "across",
  column/group wording, the anion-first rule. Regenerate `exceptions.json`
  with `family`; draft one reason per family, all unreviewed; write
  `tools/review_family.py`. Node tests for the anion-first rule, the d-block
  wording, Co/Ni mass, and the Zn/Ca and Cu/Zn ionization lines. Show me the
  family list with counts and its reasons.
  ✅ *Checkpoint: the family list is in my hands. The 32 Phase 1 records come
  out of the rebuild identical, which an invariant checks.*

- **M11 — The Honors deck in play.** The `deck` setting and the Honors preset
  (52 cards, six stats); the card face for d-block; the Trend-reasoner on
  group; Call mode, hotseat and mastery with 52 cards; the teacher page's
  `ea` / `ionic` columns; the About page updated (new sources, the
  undefined cells and why, the ion table, a short "why the 3d block bends the
  trends" note). Keys 1–6 pick a stat. Check the board and the projector
  layout at 1366×768 with six stat rows.
  ✅ *Checkpoint: I play an Honors Duel and an Honors Call game on a laptop
  and see a d-block card win and lose; I project one; a CP game looks exactly
  like it did before this phase; then I open the live URL on a school
  Chromebook.*

**STOP at the end of this phase and wait for my confirmation before Phase 4.**

## 5 — Data products and frozen contracts

Everything from the Phase 1 and Phase 2 §5 still holds, with these changes.

**`docs/data/elements.json`** — 52 records. Each adds `block`, `ea_kjmol`,
`ionic_radius_pm`, `ion` and `ion_charge`. `column` and `valence_e` are null
for d-block. Undefined is still `null`, never zero, and every null is
documented in `SOURCES.md` in the existing `- undefined `key`: Sym, Sym` shape.

**Proposed ion table** (Shannon CN 6; HS = high spin; radii in pm as displayed,
stored values keep Shannon's .5s) — for my review at M9:

| Group | Ions |
|---|---|
| 1 | Li⁺ 76, Na⁺ 102, K⁺ 138, Rb⁺ 152, Cs⁺ 167 |
| 2 | Be²⁺ 45, Mg²⁺ 72, Ca²⁺ 100, Sr²⁺ 118, Ba²⁺ 135 |
| 13 | B³⁺ 27, Al³⁺ 54, Ga³⁺ 62, In³⁺ 80, Tl³⁺ 89 |
| 14 | Ge⁴⁺ 53, Sn⁴⁺ 69, Pb²⁺ 119 (C, Si undefined) |
| 15 | Sb³⁺ 76, Bi³⁺ 103 (N, P, As undefined) |
| 16 | O²⁻ 140, S²⁻ 184, Se²⁻ 198, Te²⁻ 221 (Po undefined) |
| 17 | F⁻ 133, Cl⁻ 181, Br⁻ 196, I⁻ 220 (At undefined) |
| 3d | Sc³⁺ 75, Ti⁴⁺ 61, V³⁺ 64, Cr³⁺ 62, Mn²⁺ HS 83, Fe³⁺ HS 65, Co²⁺ HS 75, Ni²⁺ 69, Cu²⁺ 73, Zn²⁺ 74 |
| — | H and the six noble gases undefined |

**`docs/data/stats.json`** — two new records, `ea_kjmol` and
`ionic_radius_pm`, as specified in §2. The `anion_first` flag is new rule
syntax: the predictor honours it, and adding it to another stat is a one-line
change.

**`docs/data/exceptions.json`** — same shape plus `family` (a short slug).

**Settings** — new key `deck` (`"main"` | `"main+3d"`). Still stored under
`td1.settings.v1`; adding a key with a default is not a shape change. Old saved
settings load as `deck: "main"`.

**Invariants to add or change in `tests/test_invariants.py`:**
1. The deck is exactly the 42 locked main-group atomic numbers plus 21–30, no
   duplicates; `block` is `"d"` exactly for 21–30.
2. `column` is 1–8 for main-group records and null for d-block; `valence_e ==
   column` for main-group records and null for d-block (both nulls documented).
3. Ranges for the new stats: electron affinity 0–400 kJ/mol where defined;
   ionic radius 20–250 pm where defined; `ion_charge` is null exactly when
   `ionic_radius_pm` is.
4. Canonical orderings: F⁻ < Cl⁻ < Br⁻ < I⁻ in ionic radius; Cl has the
   deck's largest electron affinity; Co is heavier than Ni; Zn has the highest
   first ionization energy of the 3d row.
5. The 32 Phase 1 exception records (stat, a, b, predicted, actual) are all
   present after the rebuild, and no main-group-only pair on the four Phase 1
   stats gains or loses an exception.
6. Every exception has a `family`, and every family has a non-empty reason.
7. The CP preset's `deck` is `"main"` and its stat keys are unchanged.
8. Ten new hand-checked values are listed in `SOURCES.md` (the build fails on
   drift, as in Phase 1).

## 6 — Phase 4 candidates (listed so Phase 3 leaves room; not built now)

- The 4d block, once the 3d block has been played in class.
- Offline service worker with a versioned cache and a visible "update
  available" line.
- Sound and animation polish.
- Optional Flask score server consuming the teacher table's shape.
