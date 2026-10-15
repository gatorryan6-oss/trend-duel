"""build_elements.py — generate Trend Duel's data files from the mendeleev package.

Run:  .venv\\Scripts\\python.exe tools\\build_elements.py

Writes (all committed; the running game never imports mendeleev):
  docs/data/elements.json   42 card records, kickoff §5 schema
  docs/data/stats.json      the stat definitions every mode shares
  data/SOURCES.md           dataset + citation per stat, the undefined cells,
                            and ten hand-checked values

Rules it applies (kickoff §2):
  * The deck is the 42 main-group elements of periods 1-6. Anything else is
    refused, not skipped.
  * Undefined is null, never 0, never omitted. Atomic radius is null for all
    six noble gases (Cordero radii for them are on a different footing and
    not comparable). Electronegativity is null wherever the dataset leaves it
    blank — He, Ne, Ar, Kr, Rn in mendeleev 1.3.0; Xe has a value and keeps it.
  * Any OTHER missing value is a data gap: the script stops and says so
    rather than filling from memory.
  * Ten values are compared against reference tables consulted by hand;
    a mismatch beyond tolerance fails the build.

Column (1-8) is the main-group column: IUPAC groups 1, 2 map to 1, 2 and
groups 13-18 map to 3-8. Hydrogen is column 1; helium is column 8.
"""

import json
import sys
from pathlib import Path

try:
    import mendeleev
    from mendeleev import element
except ImportError:
    sys.exit("mendeleev is not installed. Run: "
             ".venv\\Scripts\\python.exe -m pip install -r tools\\requirements.txt")

ROOT = Path(__file__).resolve().parent.parent
ELEMENTS_OUT = ROOT / "docs" / "data" / "elements.json"
STATS_OUT = ROOT / "docs" / "data" / "stats.json"
SOURCES_OUT = ROOT / "data" / "SOURCES.md"

EV_TO_KJMOL = 96.485          # kickoff §2: convert NIST eV to kJ/mol

# The 42 locked cards, in deck order (kickoff §2).
DECK = ["H", "He",
        "Li", "Be", "B", "C", "N", "O", "F", "Ne",
        "Na", "Mg", "Al", "Si", "P", "S", "Cl", "Ar",
        "K", "Ca", "Ga", "Ge", "As", "Se", "Br", "Kr",
        "Rb", "Sr", "In", "Sn", "Sb", "Te", "I", "Xe",
        "Cs", "Ba", "Tl", "Pb", "Bi", "Po", "At", "Rn"]
NOBLE_GASES = {"He", "Ne", "Ar", "Kr", "Xe", "Rn"}

# Stat definitions (kickoff §5). Adding a stat = one record here + one line
# in card_record(). `decimals` is how the card displays it.
# `short` is the stat's name inside the results string (kickoff §5, frozen:
# radius, ie1, en, mass) — the Phase 2 teacher page parses exactly these.
STATS = [
    {"key": "radius_pm", "short": "radius", "label": "Atomic radius", "unit": "pm",
     "decimals": 0, "down": "+", "across": "-",
     "undefined_note": "Noble-gas radii are measured on a different basis "
                       "and are not comparable."},
    {"key": "ie1_kjmol", "short": "ie1", "label": "Ionization energy", "unit": "kJ/mol",
     "decimals": 1, "down": "-", "across": "+"},
    {"key": "en_pauling", "short": "en", "label": "Electronegativity", "unit": "",
     "decimals": 2, "down": "-", "across": "+",
     "undefined_note": "Most noble gases form no ordinary bonds, so the "
                       "Pauling scale assigns them no value."},
    {"key": "mass", "short": "mass", "label": "Atomic mass", "unit": "u", "decimals": 2,
     "by_z": True},
    {"key": "valence_e", "short": "valence", "label": "Valence electrons", "unit": "",
     "decimals": 0, "by_column": True},
]

# Where each stat comes from. The citations are the ones the mendeleev
# documentation lists for these fields (consulted 2026-10-14 at
# mendeleev.readthedocs.io/en/stable/data.html).
SOURCES = {
    "radius_pm": {
        "field": "Element.covalent_radius_cordero (pm)",
        "dataset": "Covalent radii, Cordero et al.",
        "citation": "B. Cordero, V. Gómez, A. E. Platero-Prats, M. Revés, "
                    "J. Echeverría, E. Cremades, F. Barragán, S. Alvarez, "
                    "\"Covalent radii revisited\", Dalton Trans. 2008, 2832-2838. "
                    "doi:10.1039/b801115j",
        "note": "Rounded to the nearest picometre. mendeleev averages carbon's "
                "three valence values. Null for all six noble gases by Trend "
                "Duel's rule (kickoff §2), even though the dataset lists values.",
    },
    "ie1_kjmol": {
        "field": "Element.ionenergies[1] (eV), converted x 96.485 to kJ/mol",
        "dataset": "First ionization energy, NIST Atomic Spectra Database",
        "citation": "A. Kramida, Yu. Ralchenko, J. Reader and NIST ASD Team, "
                    "NIST Atomic Spectra Database (ver. 5.11), "
                    "physics.nist.gov/asd — as cited by the mendeleev docs.",
        "note": "Rounded to one decimal after conversion.",
    },
    "en_pauling": {
        "field": "Element.en_pauling",
        "dataset": "Pauling electronegativity, CRC Handbook",
        "citation": "W. M. Haynes (ed.), CRC Handbook of Chemistry and Physics, "
                    "95th ed., CRC Press, 2014 — as cited by the mendeleev docs.",
        "note": "Null wherever the dataset is blank (He, Ne, Ar, Kr, Rn). Xe "
                "carries a value in this dataset and keeps it.",
    },
    "mass": {
        "field": "Element.atomic_weight (Da)",
        "dataset": "Standard atomic weights, IUPAC-CIAAW",
        "citation": "J. Meija et al., \"Atomic weights of the elements 2013 "
                    "(IUPAC Technical Report)\", Pure Appl. Chem. 88(3), 265-291, "
                    "2016, doi:10.1515/pac-2015-0305; and IUPAC-CIAAW, Standard "
                    "atomic weights, ciaaw.org/atomic-weights.htm — as cited by "
                    "the mendeleev docs. Conventional values for interval "
                    "elements; mass number of the longest-lived isotope for "
                    "radioactive elements (Po, At, Rn).",
        "note": "Stored to three decimals; displayed to two.",
    },
    "valence_e": {
        "field": "derived: main-group column (IUPAC group 1-2 -> 1-2, 13-18 -> 3-8)",
        "dataset": "Definition, not measurement",
        "citation": "Kickoff §2: valence electrons equal the column index and "
                    "have no exceptions. Helium is column 8 with 2 electrons "
                    "total; the card follows the column rule the kickoff locked.",
        "note": "He's valence_e is 8 by the column rule, which is the kickoff's "
                "explicit decision (invariant 4: valence_e == column for every card).",
    },
}

# Ten values checked by hand against reference tables (kickoff M1).
# Consulted 2026-10-14:
#   [A] en.wikipedia.org/wiki/Covalent_radius — Cordero 2008 column, pm
#   [B] en.wikipedia.org/wiki/Ionization_energies_of_the_elements_(data_page)
#       — first ionization energy, kJ/mol (CRC eV column x 96.485 agrees)
HAND_CHECKS = [
    ("Cs", "radius_pm", 244, "[A]"),
    ("Li", "radius_pm", 128, "[A]"),
    ("F", "radius_pm", 57, "[A]"),
    ("I", "radius_pm", 139, "[A]"),
    ("Pb", "radius_pm", 146, "[A]"),
    ("He", "ie1_kjmol", 2372.3, "[B]"),
    ("Cs", "ie1_kjmol", 375.7, "[B]"),
    ("N", "ie1_kjmol", 1402.3, "[B]"),
    ("O", "ie1_kjmol", 1313.9, "[B]"),
    ("Cl", "ie1_kjmol", 1251.2, "[B]"),
]
HAND_CHECK_TOLERANCE = {"radius_pm": 0.5, "ie1_kjmol": 0.2}


def column_of(group_id):
    """IUPAC group -> main-group column 1-8. The d-block gap carries no weight."""
    if group_id in (1, 2):
        return group_id
    if 13 <= group_id <= 18:
        return group_id - 10
    raise ValueError(f"group {group_id} is not a main-group column")


def card_record(symbol):
    e = element(symbol)
    column = column_of(e.group_id)
    ie1_ev = e.ionenergies.get(1)
    rec = {
        "z": e.atomic_number,
        "symbol": e.symbol,
        "name": e.name,
        "period": e.period,
        "group": e.group_id,
        "column": column,
        "mass": round(e.atomic_weight, 3) if e.atomic_weight is not None else None,
        "radius_pm": (None if symbol in NOBLE_GASES
                      else round(e.covalent_radius_cordero)
                      if e.covalent_radius_cordero is not None else None),
        "ie1_kjmol": round(ie1_ev * EV_TO_KJMOL, 1) if ie1_ev is not None else None,
        "en_pauling": round(e.en_pauling, 2) if e.en_pauling is not None else None,
        "valence_e": column,
        "econf": e.econf,
    }
    return rec


def expected_nulls(rec):
    """The cells the kickoff ALLOWS to be null for this card."""
    allowed = set()
    if rec["symbol"] in NOBLE_GASES:
        allowed.add("radius_pm")
        allowed.add("en_pauling")       # only if the dataset is blank
    return allowed


def build():
    records = [card_record(s) for s in DECK]

    # Loud checks: the deck, then the holes.
    assert len(records) == 42, f"expected 42 cards, built {len(records)}"
    zs = [r["z"] for r in records]
    assert len(set(zs)) == 42, "duplicate atomic numbers in the deck"

    gaps = []
    for r in records:
        for key in [s["key"] for s in STATS]:
            if r[key] is None and key not in expected_nulls(r):
                gaps.append(f"{r['symbol']}.{key}")
        if not r["econf"]:
            gaps.append(f"{r['symbol']}.econf")
    if gaps:
        sys.exit("DATA GAP — mendeleev has no value for: " + ", ".join(gaps) +
                 "\nStopping rather than filling from memory (kickoff §2).")

    # The hand-checks are a build gate, not a comment.
    by_symbol = {r["symbol"]: r for r in records}
    mismatches = []
    for sym, key, ref, src in HAND_CHECKS:
        got = by_symbol[sym][key]
        if got is None or abs(got - ref) > HAND_CHECK_TOLERANCE[key]:
            mismatches.append(f"{sym}.{key}: built {got}, reference {ref} {src}")
    if mismatches:
        sys.exit("HAND-CHECK MISMATCH:\n  " + "\n  ".join(mismatches))

    # Which cells actually came out null, per stat, for SOURCES.md.
    undefined = {}
    for r in records:
        for key in [s["key"] for s in STATS]:
            if r[key] is None:
                undefined.setdefault(key, []).append(r["symbol"])

    return records, undefined, by_symbol


def write_sources(undefined, by_symbol):
    lines = ["# Data sources — Trend Duel",
             "",
             f"Generated by `tools/build_elements.py` from the `mendeleev` "
             f"Python package, version {mendeleev.__version__}. The game "
             "uses these numbers for ORDERING; a student's textbook may print "
             "slightly different values from a different compilation.",
             "",
             "## Stats", ""]
    for s in STATS:
        src = SOURCES[s["key"]]
        lines += [f"### `{s['key']}` — {s['label']}"
                  + (f" ({s['unit']})" if s["unit"] else ""),
                  f"- mendeleev field: {src['field']}",
                  f"- dataset: {src['dataset']}",
                  f"- citation: {src['citation']}",
                  f"- note: {src['note']}",
                  ""]
    lines += ["## Undefined cells", "",
              "A null in `elements.json` is a claim that the value is not "
              "comparable, not a missing number. Each is listed here and the "
              "invariant test checks both directions.", ""]
    for key in [s["key"] for s in STATS]:
        if key in undefined:
            lines.append(f"- undefined `{key}`: " + ", ".join(undefined[key]))
    lines += ["", "## Hand-checked values", "",
              "Ten values compared against reference tables consulted on "
              "2026-10-14. The build script fails if any drifts beyond "
              "tolerance (0.5 pm, 0.2 kJ/mol).", "",
              "- [A] en.wikipedia.org/wiki/Covalent_radius — the Cordero et al. "
              "2008 column (pm)",
              "- [B] en.wikipedia.org/wiki/Ionization_energies_of_the_elements_"
              "(data_page) — first ionization energy (kJ/mol); the CRC eV "
              "column × 96.485 agrees", "",
              "| Element | Stat | Built | Reference | Source |",
              "|---|---|---|---|---|"]
    for sym, key, ref, src in HAND_CHECKS:
        lines.append(f"| {sym} | `{key}` | {by_symbol[sym][key]} | {ref} | {src} |")
    lines.append("")
    SOURCES_OUT.write_text("\n".join(lines), encoding="utf-8")


def main():
    records, undefined, by_symbol = build()
    ELEMENTS_OUT.parent.mkdir(parents=True, exist_ok=True)
    SOURCES_OUT.parent.mkdir(parents=True, exist_ok=True)
    ELEMENTS_OUT.write_text(json.dumps(records, indent=1, ensure_ascii=False) + "\n",
                            encoding="utf-8")
    STATS_OUT.write_text(json.dumps(STATS, indent=1, ensure_ascii=False) + "\n",
                         encoding="utf-8")
    write_sources(undefined, by_symbol)
    print(f"wrote {len(records)} cards -> {ELEMENTS_OUT.relative_to(ROOT)}")
    print(f"wrote {len(STATS)} stats -> {STATS_OUT.relative_to(ROOT)}")
    print(f"wrote {SOURCES_OUT.relative_to(ROOT)}")
    for key, syms in undefined.items():
        print(f"  undefined {key}: {', '.join(syms)}")
    print("hand-checks: all 10 within tolerance")


if __name__ == "__main__":
    main()
