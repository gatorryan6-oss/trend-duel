"""Invariant tests for Trend Duel — the checkable rules from kickoff §2/§5.

The kickoff settles decisions that must never silently break. Prose in a spec
stops working the moment it falls out of Claude Code's context window; these
tests don't. They guard:

  (a) verify.py and run.bat agree on this project's dedicated port (5093),
      and that port collides with no other project on this machine,
  (b) the identity marker is set: MUST_CONTAIN[0] == "Trend Duel", and the
      served index page actually contains it,
  (c) the launcher serves docs/ with http.server and opens the browser only
      once the server answers,
  (d) .claude/settings.json pins the model and runs verify.py as a Stop hook,
  and the nine data/architecture invariants from kickoff §5:
  (1) elements.json holds exactly the 42 locked main-group atomic numbers
      plus Sc-Zn (Phase 3), no duplicates; block "d" exactly for Sc-Zn,
  (2) every record has every schema field; null ONLY where data/SOURCES.md
      documents the stat as undefined for that element (and vice versa),
  (3) value ranges,
  (4) canonical orderings the teacher teaches, so a swapped dataset fails loudly,
  (5) no file under docs/ loads anything over http:// or https://,
  (6) everything under docs/ totals under 300 KB, and holds no image files,
  (7) every stats.json key has a SOURCES.md entry; every stat on a card is
      declared in stats.json,
  (8) engine.js never references document, window, or localStorage,
  (9) exceptions.json validates against the deck and the stat keys.

Tests whose inputs don't exist yet SKIP with a loud reason naming the
milestone that arms them. Do not delete the skips; just build the milestones.

Run: python -m pytest tests/test_invariants.py -q
"""

import json
import re
import socket
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

DOCS = ROOT / "docs"
ELEMENTS_FILE = DOCS / "data" / "elements.json"
STATS_FILE = DOCS / "data" / "stats.json"
EXCEPTIONS_FILE = DOCS / "data" / "exceptions.json"
SOURCES_FILE = ROOT / "data" / "SOURCES.md"
ENGINE_FILE = DOCS / "js" / "engine.js"
SETTINGS_FILE = ROOT / ".claude" / "settings.json"

# ---------------- CONFIG (from kickoff §2 and §5) ----------------
# Ports already owned by other projects on this machine (read from their
# verify.py / run.bat files at M0, 2026-10-14). 5040 is a Windows service.
FORBIDDEN_PORTS = {5000, 5040, 5050, 5055, 5057, 8000, 8501, 8503, 8504,
                   *range(5077, 5093)}

IDENTITY_MARKER = "Trend Duel"

# (1) The 42 locked cards: main-group elements of periods 1-6, no d-block.
LOCKED_Z = sorted(
    [1, 2]                                   # H, He
    + list(range(3, 11))                     # Li-Ne
    + list(range(11, 19))                    # Na-Ar
    + [19, 20] + list(range(31, 37))         # K, Ca, Ga-Kr
    + [37, 38] + list(range(49, 55))         # Rb, Sr, In-Xe
    + [55, 56] + list(range(81, 87))         # Cs, Ba, Tl-Rn
)
assert len(LOCKED_Z) == 42
# Phase 3 kickoff §5 invariant 1: the Honors extension adds the 3d row.
D_BLOCK_Z = list(range(21, 31))              # Sc-Zn
DECK_Z = sorted(LOCKED_Z + D_BLOCK_Z)

# (2) The card schema. Identity fields are not stats. `column` is the one
# identity field allowed to be null (d-block cards have no main-group column).
IDENTITY_FIELDS = {"z", "symbol", "name", "period", "group", "column", "block", "econf"}
# The chosen ion for ionic radius: null exactly when the radius is null.
ION_FIELDS = {"ion", "ion_charge"}
STAT_KEYS = {"radius_pm", "ie1_kjmol", "en_pauling", "mass", "valence_e",
             "ea_kjmol", "ionic_radius_pm"}
SCHEMA_FIELDS = IDENTITY_FIELDS | ION_FIELDS | STAT_KEYS

# (3) Sanity ranges (kickoff §5).
RANGES = {
    "radius_pm": (25, 300),
    "ie1_kjmol": (370, 2400),
    "en_pauling": (0.7, 4.0),
    "mass": (1, 225),
    "ea_kjmol": (0, 400),            # Phase 3 §5 invariant 3
    "ionic_radius_pm": (20, 250),
}

# (6) Size budget for everything the browser could load.
SIZE_BUDGET_BYTES = 300 * 1024

# (8) Engine purity.
ENGINE_FORBIDDEN = ("document", "window", "localStorage")


# ---------------- helpers ----------------

def rel(path):
    return str(Path(path).relative_to(ROOT))


def require(path, arming_milestone, what):
    """Skip (loudly, naming the milestone) until `path` exists."""
    if not path.exists():
        pytest.skip(f"{what} doesn't exist yet — this test arms at "
                    f"{arming_milestone} when {rel(path)} is built.")


def load_json(path, arming_milestone, what):
    require(path, arming_milestone, what)
    return json.loads(path.read_text(encoding="utf-8"))


@pytest.fixture
def elements():
    return load_json(ELEMENTS_FILE, "M1", "The element data")


@pytest.fixture
def stats():
    return load_json(STATS_FILE, "M1", "The stat definitions")


@pytest.fixture
def by_symbol(elements):
    return {e["symbol"]: e for e in elements}


def documented_undefined(sources_text):
    """Parse SOURCES.md's undefined-cell declarations.

    The build script writes one line per stat that has holes, in this exact
    shape (a test reads it, so the shape is a contract):
        - undefined `radius_pm`: He, Ne, Ar, Kr, Xe, Rn
    Returns {(stat_key, symbol), ...}.
    """
    cells = set()
    for m in re.finditer(r"^- undefined `(\w+)`:\s*(.+)$", sources_text,
                         re.MULTILINE):
        key, symbols = m.group(1), m.group(2)
        for sym in re.split(r"[,\s]+", symbols.strip()):
            if sym:
                cells.add((key, sym))
    return cells


# ---------------- (a) port discipline ----------------

def test_port_agreement_and_no_collisions():
    """verify.py and run.bat must name the same port, and it must not be a
    framework default nor any port another project on this machine holds."""
    verify_text = (ROOT / "verify.py").read_text(encoding="utf-8")
    runbat_text = (ROOT / "run.bat").read_text(encoding="utf-8")

    m = re.search(r"^PORT\s*=\s*(\d+)", verify_text, re.MULTILINE)
    assert m, "verify.py must define PORT = <number>"
    verify_port = int(m.group(1))

    m = re.search(r"^set\s+PORT\s*=\s*(\d+)", runbat_text,
                  re.MULTILINE | re.IGNORECASE)
    assert m, "run.bat must contain 'set PORT=<number>'"
    runbat_port = int(m.group(1))

    assert verify_port == runbat_port, (
        f"verify.py says port {verify_port} but run.bat says {runbat_port} — "
        "they must always agree (kickoff M0).")
    assert verify_port not in FORBIDDEN_PORTS, (
        f"Port {verify_port} belongs to another project on this machine "
        f"(kickoff M0: never collide; forbidden = {sorted(FORBIDDEN_PORTS)}).")


# ---------------- (b) identity marker ----------------

def test_identity_marker_is_set():
    """MUST_CONTAIN[0] must be this app's unique marker — an empty or
    borrowed marker would let verify.py green-light another project's app
    answering on our port."""
    import verify
    assert verify.MUST_CONTAIN, "verify.py MUST_CONTAIN must not be empty."
    assert verify.MUST_CONTAIN[0] == IDENTITY_MARKER, (
        f"MUST_CONTAIN[0] must be {IDENTITY_MARKER!r} "
        f"(got {verify.MUST_CONTAIN[0]!r}).")


def test_index_page_carries_the_marker():
    """The page a student opens must say Trend Duel, so the smoke test is
    testing OUR site and not whatever else answers on the port."""
    index = DOCS / "index.html"
    assert index.exists(), "docs/index.html must exist from M0 on."
    assert IDENTITY_MARKER in index.read_text(encoding="utf-8"), (
        f"docs/index.html must contain {IDENTITY_MARKER!r}.")


# ---------------- (c) the launcher ----------------

def _runbat_commands():
    runbat_text = (ROOT / "run.bat").read_text(encoding="utf-8")
    return "\n".join(
        line for line in runbat_text.splitlines()
        if not line.strip().upper().startswith("REM"))


def test_run_bat_serves_docs_with_http_server():
    """The folder docs/ IS the app (kickoff §2: no build step). run.bat must
    serve exactly that folder with Python's built-in server."""
    commands = _runbat_commands()
    assert re.search(r"python\s+-m\s+http\.server\s+%PORT%", commands), (
        "run.bat must run `python -m http.server %PORT%` so the port is "
        "the one variable both files share.")
    assert re.search(r"--directory\s+docs\b", commands), (
        "run.bat must serve the docs/ folder (--directory docs).")


def test_run_bat_opens_the_browser_only_once_the_server_answers():
    """run.bat must not point the browser at a port nothing has bound yet.
    It launches open_when_ready.py, which waits for the port to answer."""
    helper = ROOT / "open_when_ready.py"
    assert helper.exists(), "open_when_ready.py (kit launcher helper) is missing."

    commands = _runbat_commands()
    assert not re.search(r'start\s+""\s+http', commands, re.IGNORECASE), (
        "run.bat must not open the browser directly — that fires before "
        "the server has bound the port. Launch open_when_ready.py instead.")
    assert "open_when_ready.py" in commands, (
        "run.bat must launch open_when_ready.py so the browser waits for "
        "the server to actually answer.")

    # With nothing listening, the helper must report failure and open no tab.
    import open_when_ready
    probe = socket.socket()
    probe.bind(("127.0.0.1", 0))
    dead_port = probe.getsockname()[1]
    probe.close()
    opened = []
    code = open_when_ready.open_when_ready(dead_port, give_up_after_s=0.75,
                                           opener=opened.append)
    assert code == 1 and opened == [], (
        "with nothing listening, the helper must report failure and open "
        "no browser at all")


# ---------------- (d) Claude Code settings ----------------

def test_settings_pin_model_and_stop_hook():
    """.claude/settings.json is project config (kickoff M0): a model pin and
    a Stop hook that runs verify.py so no session ends on a broken site."""
    assert SETTINGS_FILE.exists(), ".claude/settings.json is missing."
    settings = json.loads(SETTINGS_FILE.read_text(encoding="utf-8"))
    assert settings.get("model"), "settings.json must pin a model."
    stop_hooks = settings.get("hooks", {}).get("Stop", [])
    commands = [h.get("command", "")
                for group in stop_hooks for h in group.get("hooks", [])]
    assert any("verify.py" in c for c in commands), (
        "settings.json must run verify.py as a Stop hook.")


# ---------------- (1) exactly the locked cards ----------------

def test_deck_is_exactly_the_42_locked_elements_plus_the_3d_row(elements):
    zs = [e["z"] for e in elements]
    assert len(zs) == len(set(zs)), "elements.json has duplicate atomic numbers."
    assert sorted(zs) == DECK_Z, (
        f"elements.json must hold exactly the 42 locked atomic numbers plus 21-30.\n"
        f"  missing: {sorted(set(DECK_Z) - set(zs))}\n"
        f"  extra:   {sorted(set(zs) - set(DECK_Z))}")


def test_block_is_d_exactly_for_the_3d_row(elements):
    for e in elements:
        assert (e["block"] == "d") == (e["z"] in D_BLOCK_Z), (
            f"{e['symbol']}: block {e['block']!r} but z={e['z']}")
        assert e["block"] in ("s", "p", "d"), f"{e['symbol']}: unknown block {e['block']!r}"


# ---------------- (2) schema, and null only where documented ----------------

def test_every_record_has_every_field(elements):
    offenders = []
    for e in elements:
        missing = SCHEMA_FIELDS - set(e)
        extra = set(e) - SCHEMA_FIELDS
        if missing or extra:
            offenders.append(f"{e.get('symbol')}: missing={sorted(missing)} "
                             f"extra={sorted(extra)}")
    assert not offenders, "Schema drift in elements.json:\n  " + "\n  ".join(offenders)
    for e in elements:
        if e["block"] == "d":
            assert e["column"] is None, (
                f"{e['symbol']}: a d-block card has no main-group column (got {e['column']})")
        else:
            assert 1 <= e["column"] <= 8, f"{e['symbol']}: column must be 1-8 (got {e['column']})"
        assert 1 <= e["period"] <= 6, f"{e['symbol']}: period must be 1-6"
        for f in IDENTITY_FIELDS - {"column"}:
            assert e[f] is not None, f"{e['symbol']}: identity field {f} is null"


def test_null_only_where_sources_documents_undefined(elements):
    """A null is a claim ('this value is not comparable'), so every null must
    be documented in SOURCES.md — and every documented hole must be null."""
    require(SOURCES_FILE, "M1", "data/SOURCES.md")
    documented = documented_undefined(SOURCES_FILE.read_text(encoding="utf-8"))
    actual = {(k, e["symbol"]) for e in elements for k in STAT_KEYS
              if e[k] is None}
    assert actual == documented, (
        "Null cells and SOURCES.md disagree.\n"
        f"  null in data but undocumented: {sorted(actual - documented)}\n"
        f"  documented but not null:       {sorted(documented - actual)}")
    for e in elements:
        for k in STAT_KEYS:
            assert e[k] != 0, f"{e['symbol']}.{k} is 0 — undefined must be null, never zero."


# ---------------- (3) ranges ----------------

def test_value_ranges(elements):
    offenders = []
    for e in elements:
        for key, (lo, hi) in RANGES.items():
            v = e[key]
            if v is not None and not (lo <= v <= hi):
                offenders.append(f"{e['symbol']}.{key}={v} outside [{lo}, {hi}]")
    assert not offenders, "Out-of-range values:\n  " + "\n  ".join(offenders)


# ---------------- (4) canonical orderings ----------------

def _descending(by_symbol, key, symbols):
    vals = [by_symbol[s][key] for s in symbols]
    assert None not in vals, f"{key}: undefined value among {symbols}"
    pairs = list(zip(symbols, vals))
    for (sa, a), (sb, b) in zip(pairs, pairs[1:]):
        assert a > b, f"{key}: expected {sa} ({a}) > {sb} ({b})"


def test_radius_orderings(by_symbol):
    _descending(by_symbol, "radius_pm", ["Cs", "Rb", "K", "Na", "Li"])
    _descending(by_symbol, "radius_pm", ["Li", "Be", "B", "C", "N", "O", "F"])


def test_ionization_energy_orderings(elements, by_symbol):
    vals = {e["symbol"]: e["ie1_kjmol"] for e in elements}
    assert max(vals, key=vals.get) == "He", "He must have the deck's highest IE1."
    assert min(vals, key=vals.get) == "Cs", "Cs must have the deck's lowest IE1."
    _descending(by_symbol, "ie1_kjmol", ["N", "O"])


def test_electronegativity_maximum_is_fluorine(elements):
    defined = {e["symbol"]: e["en_pauling"] for e in elements
               if e["en_pauling"] is not None}
    assert max(defined, key=defined.get) == "F"


def test_mass_inversions(by_symbol):
    _descending(by_symbol, "mass", ["Ar", "K"])
    _descending(by_symbol, "mass", ["Te", "I"])
    _descending(by_symbol, "mass", ["Co", "Ni"])        # Phase 3 §5 invariant 4


def test_phase3_canonical_orderings(elements, by_symbol):
    """Phase 3 §5 invariant 4: what a swapped or mis-chosen dataset would break."""
    _descending(by_symbol, "ionic_radius_pm", ["I", "Br", "Cl", "F"])
    ea = {e["symbol"]: e["ea_kjmol"] for e in elements if e["ea_kjmol"] is not None}
    assert max(ea, key=ea.get) == "Cl", "Cl must have the deck's largest electron affinity."
    row = {e["symbol"]: e["ie1_kjmol"] for e in elements if e["block"] == "d"}
    assert max(row, key=row.get) == "Zn", "Zn must have the 3d row's highest IE1."


def test_ion_fields_follow_the_radius(elements):
    """ion and ion_charge are null exactly when ionic_radius_pm is, and the
    ion's name spells its charge (Na+, O2-, Fe3+)."""
    for e in elements:
        r, ion, q = e["ionic_radius_pm"], e["ion"], e["ion_charge"]
        assert (r is None) == (q is None) == (ion is None), (
            f"{e['symbol']}: ionic_radius_pm={r}, ion={ion!r}, ion_charge={q} must be "
            "all null or all set")
        if q is not None:
            size = "" if abs(q) == 1 else str(abs(q))
            assert ion == f"{e['symbol']}{size}{'+' if q > 0 else '-'}", (
                f"{e['symbol']}: ion {ion!r} does not match charge {q}")
            assert q < 0 or e["group"] < 16, f"{e['symbol']}: a cation from group {e['group']}?"


def test_valence_electrons_equal_column(elements):
    for e in elements:
        if e["block"] == "d":
            assert e["valence_e"] is None, (
                f"{e['symbol']}: valence_e must be null for a d-block card")
        else:
            assert e["valence_e"] == e["column"], (
                f"{e['symbol']}: valence_e {e['valence_e']} != column {e['column']}")


# Phase 1's ten and Phase 3's ten (§5 invariant 8). The build script fails on
# drift; this checks the list is still in SOURCES.md and still the data.
HAND_CHECKED_PHASE3 = {("Cl", "ea_kjmol"), ("F", "ea_kjmol"), ("O", "ea_kjmol"),
                       ("Na", "ionic_radius_pm"), ("K", "ionic_radius_pm"),
                       ("F", "ionic_radius_pm"), ("Cl", "ionic_radius_pm"),
                       ("O", "ionic_radius_pm"), ("Fe", "ie1_kjmol"), ("Zn", "ie1_kjmol")}


def test_hand_checked_values_are_listed_and_current(by_symbol):
    require(SOURCES_FILE, "M1", "data/SOURCES.md")
    text = SOURCES_FILE.read_text(encoding="utf-8")
    rows = re.findall(r"^\| (\w+) \| `(\w+)` \| ([\d.]+) \| ([\d.]+) \| \[\w\] \|$",
                      text, re.MULTILINE)
    assert len(rows) == 20, f"SOURCES.md should list 20 hand-checked values; found {len(rows)}"
    listed = {(sym, key) for sym, key, _, _ in rows}
    assert HAND_CHECKED_PHASE3 <= listed, (
        f"missing Phase 3 hand-checks: {sorted(HAND_CHECKED_PHASE3 - listed)}")
    for sym, key, built, _ in rows:
        assert float(built) == by_symbol[sym][key], (
            f"SOURCES.md says {sym}.{key} built {built}; elements.json has "
            f"{by_symbol[sym][key]}. Rebuild with tools/build_elements.py.")


# ---------------- (5) no external requests ----------------

def test_no_external_references_under_docs():
    """The school network filters; the game must not care (kickoff §2).
    Anything the browser would FETCH over http(s) is forbidden. A plain
    <a href> citation link in prose is allowed — a click is not a load."""
    patterns = {
        ".html": [r"<script[^>]+src\s*=\s*[\"']https?://",
                  r"<link[^>]+href\s*=\s*[\"']https?://",
                  r"<img[^>]+src\s*=\s*[\"']https?://",
                  r"@import\s+[\"']?https?://", r"url\(\s*[\"']?https?://",
                  r"<iframe[^>]+src\s*=\s*[\"']https?://"],
        ".js": [r"https?://"],
        ".css": [r"https?://"],
        ".json": [r"https?://"],
    }
    offenders = []
    for path in DOCS.rglob("*"):
        if not path.is_file() or path.suffix not in patterns:
            continue
        text = path.read_text(encoding="utf-8")
        for pat in patterns[path.suffix]:
            for m in re.finditer(pat, text, re.IGNORECASE):
                line = text.count("\n", 0, m.start()) + 1
                offenders.append(f"{rel(path)}:{line}: {m.group(0)[:60]}")
    assert not offenders, (
        "External references under docs/ (kickoff §2: zero network "
        "dependencies):\n  " + "\n  ".join(offenders))


# ---------------- (6) size budget ----------------

def test_docs_total_size_under_budget():
    total = sum(p.stat().st_size for p in DOCS.rglob("*") if p.is_file())
    assert total < SIZE_BUDGET_BYTES, (
        f"docs/ totals {total/1024:.1f} KB; the budget is "
        f"{SIZE_BUDGET_BYTES/1024:.0f} KB (kickoff §2).")


def test_no_image_files_under_docs():
    images = [rel(p) for p in DOCS.rglob("*")
              if p.suffix.lower() in {".png", ".jpg", ".jpeg", ".gif", ".webp",
                                      ".svg", ".ico", ".bmp"}]
    assert not images, f"No image files (kickoff §2: CSS only): {images}"


# ---------------- (7) stats <-> sources <-> cards ----------------

def test_stats_json_shape(stats):
    keys = [s["key"] for s in stats]
    assert len(keys) == len(set(keys)), "stats.json has duplicate keys."
    assert set(keys) == STAT_KEYS, (
        f"stats.json keys {sorted(keys)} != locked keys {sorted(STAT_KEYS)}")
    shorts = [s.get("short") for s in stats]
    assert len(shorts) == len(set(shorts)), "stats.json short names must be unique."
    for s in stats:
        for f in ("key", "short", "label", "unit", "decimals"):
            assert f in s, f"stats.json {s.get('key')}: missing {f}"
        assert re.fullmatch(r"[a-z0-9]+", s["short"]), (
            f"stats.json {s['key']}: short name {s['short']!r} must be lowercase "
            "letters/digits — it goes inside the frozen results string.")
        directional = {"down", "across"} <= set(s)
        assert directional or s.get("by_z") or s.get("by_column"), (
            f"stats.json {s['key']}: needs down/across, or by_z, or by_column")
        if directional:
            assert s["down"] in "+-" and s["across"] in "+-"
        if "anion_first" in s:
            assert s["anion_first"] is True and directional, (
                f"stats.json {s['key']}: anion_first is a flag on a down/across stat")
        if "show_with" in s:
            assert s["show_with"] in ION_FIELDS, (
                f"stats.json {s['key']}: show_with must name a card field")


def test_every_stat_key_is_sourced(stats):
    require(SOURCES_FILE, "M1", "data/SOURCES.md")
    text = SOURCES_FILE.read_text(encoding="utf-8")
    missing = [s["key"] for s in stats if f"`{s['key']}`" not in text]
    assert not missing, f"data/SOURCES.md has no entry for: {missing}"


def test_every_card_stat_is_declared(elements, stats):
    declared = {s["key"] for s in stats}
    for e in elements:
        on_card = set(e) - IDENTITY_FIELDS - ION_FIELDS
        undeclared = on_card - declared
        assert not undeclared, (
            f"{e['symbol']} carries stat(s) {sorted(undeclared)} that "
            "stats.json does not declare (kickoff §5: add the record there).")


# ---------------- (8) engine purity ----------------

def test_engine_never_touches_the_page():
    require(ENGINE_FILE, "M2", "The game engine")
    text = ENGINE_FILE.read_text(encoding="utf-8")
    offenders = []
    for name in ENGINE_FORBIDDEN:
        for m in re.finditer(rf"\b{name}\b", text):
            line = text.count("\n", 0, m.start()) + 1
            offenders.append(f"engine.js:{line}: {name}")
    assert not offenders, (
        "engine.js must be pure logic (kickoff §5):\n  " + "\n  ".join(offenders))
    assert not re.search(r"^\s*import\b[^\n]*\bui\b", text, re.MULTILINE), (
        "engine.js must not import the page layer.")


# ---------------- Phase 2: engine reused as-is, Call mode pure ----------------

# SHA-256 of docs/js/engine.js at the end of Phase 1 (commit 5188d22, line
# endings normalised to LF). Phase 2 reuses the engine AS-IS (Phase 2 kickoff
# §2). A deliberate change means updating this pin WITH a build-log note.
ENGINE_SHA256_PHASE1 = "32a62cfaff09d4dea3bae237e0af18259db2ae13fe3d25ec7c987a4ed41f23c2"
CALLMODE_FILE = DOCS / "js" / "callmode.js"
SETTINGS_JS = DOCS / "js" / "settings.js"


def test_engine_is_unchanged_since_phase_1():
    import hashlib
    text = ENGINE_FILE.read_bytes().replace(b"\r\n", b"\n")
    digest = hashlib.sha256(text).hexdigest()
    assert digest == ENGINE_SHA256_PHASE1, (
        "docs/js/engine.js has changed since Phase 1. Call mode must build on "
        "the engine, not edit it. If the change is deliberate, update "
        "ENGINE_SHA256_PHASE1 and say why in BUILDLOG.md.")


def test_callmode_never_touches_the_page():
    require(CALLMODE_FILE, "M6", "The Call-mode module")
    text = CALLMODE_FILE.read_text(encoding="utf-8")
    offenders = [f"callmode.js:{text.count(chr(10), 0, m.start()) + 1}: {name}"
                 for name in ENGINE_FORBIDDEN
                 for m in re.finditer(rf"\b{name}\b", text)]
    assert not offenders, "callmode.js must be pure logic:\n  " + "\n  ".join(offenders)


def test_settings_defaults_for_phase_2():
    """timerSeconds is off and projector is off by default, and no preset
    switches the timer on (Phase 2 kickoff §5)."""
    text = SETTINGS_JS.read_text(encoding="utf-8")
    defaults = text[text.index("export const DEFAULTS"):text.index("};", text.index("export const DEFAULTS"))]
    assert re.search(r"timerSeconds:\s*null", defaults), "DEFAULTS.timerSeconds must be null (off)."
    assert re.search(r"projector:\s*false", defaults), "DEFAULTS.projector must be false."
    presets = text[text.index("export const PRESETS"):text.index("export const DEFAULTS")]
    assert not re.search(r"timerSeconds:\s*\d", presets), "No preset may switch the timer on."


TEACHER_JS = DOCS / "js" / "teacher.js"
TEACHER_HTML = DOCS / "teacher.html"


def test_teacher_page_has_one_parser():
    """The teacher page reads results lines through results.js parseResults
    and nothing else — a second parser would be a second source of truth for
    the frozen TD1 format (Phase 2 kickoff §2)."""
    require(TEACHER_JS, "M7", "The teacher page script")
    text = TEACHER_JS.read_text(encoding="utf-8")
    assert re.search(r"import\s*\{[^}]*\bparseResults\b[^}]*\}\s*from\s*[\"']\./results\.js[\"']", text), (
        "teacher.js must import parseResults from ./results.js")
    assert not re.search(r"split\(\s*[\"']\|[\"']\s*\)", text), (
        "teacher.js must not split results lines on '|' itself — use parseResults.")
    assert TEACHER_HTML.exists(), "docs/teacher.html is missing."
    assert IDENTITY_MARKER in TEACHER_HTML.read_text(encoding="utf-8")


CSS_FILE = DOCS / "css" / "style.css"


def test_projector_layout_scales_without_fixed_widths():
    """The projector toggle scales the root font size; layouts must be in rem
    so they grow with it, and no projector rule may pin a width over 1300 px
    (Phase 2 kickoff M8: nothing overflows a 1366 px projector)."""
    css = CSS_FILE.read_text(encoding="utf-8")
    assert re.search(r"html\.projector\s*\{[^}]*font-size", css), (
        "style.css must scale the root font size under html.projector.")
    for selector in (".table", ".call-table"):
        m = re.search(re.escape(selector) + r"\s*\{([^}]*)\}", css)
        assert m, f"{selector} rule missing"
        cols = re.search(r"grid-template-columns:([^;]*);", m.group(1))
        assert cols and "px" not in cols.group(1), (
            f"{selector} grid columns must be in rem so the projector scale applies.")
    for block in re.finditer(r"html\.projector[^{]*\{([^}]*)\}", css):
        for w in re.finditer(r"(?<![-\w])width:\s*(\d+)px", block.group(1)):
            assert int(w.group(1)) <= 1300, f"projector rule pins width {w.group(1)}px"


# ---------------- (9) exceptions.json validates ----------------

def test_exceptions_file_validates(elements, stats):
    exceptions = load_json(EXCEPTIONS_FILE, "M3", "The exceptions list")
    symbols = {e["symbol"] for e in elements}
    keys = {s["key"] for s in stats}
    for i, x in enumerate(exceptions):
        where = f"exceptions.json[{i}]"
        for f in ("stat", "a", "b", "predicted", "actual", "reason", "reviewed"):
            assert f in x, f"{where}: missing {f}"
        assert x["stat"] in keys, f"{where}: unknown stat {x['stat']!r}"
        assert x["a"] in symbols and x["b"] in symbols, f"{where}: not deck symbols"
        assert x["predicted"] in (x["a"], x["b"]), f"{where}: predicted must be a or b"
        assert x["actual"] in (x["a"], x["b"]), f"{where}: actual must be a or b"
        assert x["predicted"] != x["actual"], f"{where}: not an exception if predicted == actual"
        assert isinstance(x["reviewed"], bool), f"{where}: reviewed must be true/false"
        assert isinstance(x["reason"], str) and x["reason"].strip(), f"{where}: empty reason"
        if x["reviewed"]:
            assert "(no reason drafted" not in x["reason"], (
                f"{where}: a placeholder reason cannot be marked reviewed")


def test_exceptions_file_matches_the_predictor():
    """exceptions.json is COMPUTED by running the game's own predictor over
    the deck. A stale file would show students explanations for pairs that
    are no longer upsets, or miss new ones. The build script's --check mode
    recomputes and compares byte-for-byte."""
    import shutil
    import subprocess
    require(EXCEPTIONS_FILE, "M3", "The exceptions list")
    node = shutil.which("node")
    if node is None:
        pytest.skip("Node is not installed; cannot re-run the predictor.")
    out = subprocess.run([node, str(ROOT / "tools" / "build_exceptions.mjs"), "--check"],
                         capture_output=True, text=True, timeout=60)
    assert out.returncode == 0, out.stderr or out.stdout
