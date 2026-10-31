"""build_elements.py — generate Trend Duel's data files from the mendeleev package.

Run:  .venv\\Scripts\\python.exe tools\\build_elements.py

Writes (all committed; the running game never imports mendeleev):
  docs/data/elements.json   52 card records (42 main-group + Sc-Zn), kickoff §5 schema
  docs/data/stats.json      the stat definitions every mode shares
  data/SOURCES.md           dataset + citation per stat, the undefined cells,
                            the ion table, and twenty hand-checked values

Rules it applies (kickoff §2):
  * The deck is the 42 main-group elements of periods 1-6 plus the ten 3d
    elements Sc-Zn (Phase 3). Anything else is refused, not skipped.
  * Undefined is null, never 0, never omitted. Atomic radius is null for all
    six noble gases (Cordero radii for them are on a different footing and
    not comparable). Electronegativity is null wherever the dataset leaves it
    blank — He, Ne, Ar, Kr, Rn in mendeleev 1.3.0; Xe has a value and keeps it.
  * Any OTHER missing value is a data gap: the script stops and says so
    rather than filling from memory.
  * Twenty values are compared against reference tables consulted by hand;
    a mismatch beyond tolerance fails the build.

Column (1-8) is the main-group column: IUPAC groups 1, 2 map to 1, 2 and
groups 13-18 map to 3-8. Hydrogen is column 1; helium is column 8. A d-block
card has no column (null), and so no valence_e (Phase 3 kickoff §2).

Phase 3 adds electron affinity (kJ/mol, energy released) and ionic radius
(one chosen ion per card, Shannon CN 6; the choices are ION_TABLE below and
the teacher reviews them in SOURCES.md).
"""

import json
import math
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

# The 42 locked main-group cards, in deck order (kickoff §2).
DECK_MAIN = ["H", "He",
             "Li", "Be", "B", "C", "N", "O", "F", "Ne",
             "Na", "Mg", "Al", "Si", "P", "S", "Cl", "Ar",
             "K", "Ca", "Ga", "Ge", "As", "Se", "Br", "Kr",
             "Rb", "Sr", "In", "Sn", "Sb", "Te", "I", "Xe",
             "Cs", "Ba", "Tl", "Pb", "Bi", "Po", "At", "Rn"]
# The Honors extension (Phase 3 kickoff §2): the 3d row.
DECK_3D = ["Sc", "Ti", "V", "Cr", "Mn", "Fe", "Co", "Ni", "Cu", "Zn"]
DECK = DECK_MAIN + DECK_3D
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
     "decimals": 0, "by_column": True,
     "undefined_note": "Valence electrons equal the column only for main-group "
                       "elements; a d-block card has no column."},
    # Phase 3 (Honors). `anion_first`: the predictor calls an anion larger than
    # a cation before it looks at position. `show_with`: the card prints this
    # field beside the value (Na+ 102 pm).
    {"key": "ea_kjmol", "short": "ea", "label": "Electron affinity", "unit": "kJ/mol",
     "decimals": 1, "down": "-", "across": "+",
     "undefined_note": "This element does not form a stable negative ion, so it "
                       "has no comparable electron affinity."},
    {"key": "ionic_radius_pm", "short": "ionic", "label": "Ionic radius", "unit": "pm",
     "decimals": 0, "down": "+", "across": "-", "anion_first": True, "show_with": "ion",
     "undefined_note": "This element has no common simple ion with a comparable "
                       "six-coordinate radius."},
]

# Where each stat comes from. The citations are the ones the mendeleev
# documentation lists for these fields (consulted 2026-10-14, and again for
# the Phase 3 fields on 2026-10-30, at mendeleev.readthedocs.io/en/stable/data.html).
SOURCES = {
    "radius_pm": {
        "field": "Element.covalent_radius_cordero (pm)",
        "dataset": "Covalent radii, Cordero et al.",
        "citation": "B. Cordero, V. Gómez, A. E. Platero-Prats, M. Revés, "
                    "J. Echeverría, E. Cremades, F. Barragán, S. Alvarez, "
                    "\"Covalent radii revisited\", Dalton Trans. 2008, 2832-2838. "
                    "doi:10.1039/b801115j",
        "note": "Rounded to the nearest picometre. mendeleev averages carbon's "
                "three valence values, and the low- and high-spin values for Mn, "
                "Fe and Co. Null for all six noble gases by Trend Duel's rule "
                "(kickoff §2), even though the dataset lists values.",
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
                "explicit decision (invariant 4: valence_e == column for every card). "
                "Null for the ten d-block cards, which have no column (Phase 3 §2).",
    },
    "ea_kjmol": {
        "field": "Element.electron_affinity (eV), converted x 96.485 to kJ/mol",
        "dataset": "Electron affinity, CRC Handbook",
        "citation": "W. M. Haynes (ed.), CRC Handbook of Chemistry and Physics, "
                    "95th ed., CRC Press, 2014 — as cited by the mendeleev docs.",
        "note": "Positive = energy released when the atom gains an electron. "
                "Rounded to one decimal after conversion. Null for two reasons, "
                "listed under 'Electron affinity: the undefined cells' below: the "
                "dataset has no value (Ne, Mg, Kr, Rn, Mn, Zn), or its value is "
                "negative. The mendeleev docs say the negative values (He, Be, N, "
                "Ar, Xe) come from T. Andersen, Physics Reports 394 (2004) 157-313, "
                "and are specified for metastable ions; the game does not compare a "
                "metastable-ion energy with ground-state ones.",
    },
    "ionic_radius_pm": {
        "field": "Element.ionic_radii -> IonicRadius.ionic_radius (pm), one row "
                 "per card chosen by ION_TABLE: (charge, coordination VI, spin)",
        "dataset": "Effective ionic radii, Shannon",
        "citation": "R. D. Shannon, Acta Cryst. A 32 (1976) 751-767 — as cited by "
                    "the mendeleev docs.",
        "note": "One ion per card, six-coordinate, high spin where Shannon lists "
                "both (the ion table below). Stored exactly as listed (Al3+ 53.5) "
                "and shown to the nearest pm; comparisons use the stored value, so "
                "rounding never makes a tie. Null where the element has no common "
                "simple ion with a CN 6 entry; each such cell's reason is in the "
                "ion table.",
    },
}

EA_METASTABLE = {"He", "Be", "N", "Ar", "Xe"}    # negative in the dataset
EA_NO_VALUE = {"Ne", "Mg", "Kr", "Rn", "Mn", "Zn"}

# The ion each card uses for ionic radius (Phase 3 kickoff §5, for the
# teacher's review). (charge, spin) picks one Shannon row at coordination VI;
# spin "" means Shannon lists no spin state for that ion. A string instead of
# a tuple means undefined, and the string is the reason SOURCES.md prints.
ION_TABLE = {
    "H": "Shannon lists H+ only at coordination 1-2.",
    "He": "No simple ion; Shannon lists none.",
    "Li": (1, ""), "Be": (2, ""), "B": (3, ""),
    "C": "No common simple ion; Shannon lists only a formal C4+.",
    "N": "N3- is listed only at coordination 4; the CN 6 entries are formal N3+ and N5+.",
    "O": (-2, ""), "F": (-1, ""),
    "Ne": "No simple ion; Shannon lists none.",
    "Na": (1, ""), "Mg": (2, ""), "Al": (3, ""),
    "Si": "No common simple ion; Shannon lists only a formal Si4+.",
    "P": "No common simple ion; Shannon lists only formal P3+ and P5+.",
    "S": (-2, ""), "Cl": (-1, ""),
    "Ar": "No simple ion; Shannon lists none.",
    "K": (1, ""), "Ca": (2, ""), "Ga": (3, ""), "Ge": (4, ""),
    "As": "No common simple ion; Shannon lists only formal As3+ and As5+.",
    "Se": (-2, ""), "Br": (-1, ""),
    "Kr": "No simple ion; Shannon lists none.",
    "Rb": (1, ""), "Sr": (2, ""), "In": (3, ""), "Sn": (4, ""), "Sb": (3, ""),
    "Te": (-2, ""), "I": (-1, ""),
    "Xe": "No common simple ion; Shannon lists only a formal Xe8+.",
    "Cs": (1, ""), "Ba": (2, ""), "Tl": (3, ""), "Pb": (2, ""), "Bi": (3, ""),
    "Po": "No common simple ion; Shannon lists only formal Po4+ and Po6+.",
    "At": "No common simple ion; Shannon lists only a formal At7+.",
    "Rn": "No simple ion; Shannon lists none.",
    "Sc": (3, ""), "Ti": (4, ""), "V": (3, ""), "Cr": (3, ""), "Mn": (2, "HS"),
    "Fe": (3, "HS"), "Co": (2, "HS"), "Ni": (2, ""), "Cu": (2, ""), "Zn": (2, ""),
}

# Values checked by hand against reference tables (kickoff M1, Phase 3 M9).
# [A], [B] consulted 2026-10-14; [C], [D] and the Fe/Zn rows of [B] 2026-10-31:
#   [A] en.wikipedia.org/wiki/Covalent_radius — Cordero 2008 column, pm
#   [B] en.wikipedia.org/wiki/Ionization_energies_of_the_elements_(data_page)
#       — first ionization energy, kJ/mol (CRC eV column x 96.485 agrees)
#   [C] en.wikipedia.org/wiki/Electron_affinity_(data_page) — "Elements"
#       table, kJ/mol (revision 1382065069)
#   [D] en.wikipedia.org/wiki/Ionic_radius — "Effective ionic radii" table,
#       six-coordinate, pm (revision 1374374808)
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
    # Phase 3, M9
    ("Cl", "ea_kjmol", 348.575, "[C]"),
    ("F", "ea_kjmol", 328.165, "[C]"),
    ("O", "ea_kjmol", 140.976, "[C]"),
    ("Na", "ionic_radius_pm", 102, "[D]"),
    ("K", "ionic_radius_pm", 138, "[D]"),
    ("F", "ionic_radius_pm", 133, "[D]"),
    ("Cl", "ionic_radius_pm", 181, "[D]"),
    ("O", "ionic_radius_pm", 140, "[D]"),
    ("Fe", "ie1_kjmol", 762.5, "[B]"),
    ("Zn", "ie1_kjmol", 906.4, "[B]"),
]
HAND_CHECK_TOLERANCE = {"radius_pm": 0.5, "ie1_kjmol": 0.2,
                        "ea_kjmol": 0.1, "ionic_radius_pm": 0.5}


def column_of(group_id):
    """IUPAC group -> main-group column 1-8. The d-block gap carries no weight."""
    if group_id in (1, 2):
        return group_id
    if 13 <= group_id <= 18:
        return group_id - 10
    raise ValueError(f"group {group_id} is not a main-group column")


def ion_name(symbol, charge):
    """Na+ / O2- / Fe3+ — plain ASCII; the page draws the superscripts."""
    size = "" if abs(charge) == 1 else str(abs(charge))
    return f"{symbol}{size}{'+' if charge > 0 else '-'}"


def tidy(x):
    """Round away float noise (28.999999999999996) but keep Shannon's .5s."""
    x = round(x, 1)
    return int(x) if x == int(x) else x


def ionic_row(e):
    """The one Shannon row ION_TABLE picks for this element, or None."""
    choice = ION_TABLE[e.symbol]
    if isinstance(choice, str):
        return None
    charge, spin = choice
    rows = [r for r in e.ionic_radii
            if r.charge == charge and r.coordination == "VI" and (r.spin or "") == spin]
    if len(rows) != 1:
        sys.exit(f"ION TABLE: {e.symbol} charge {charge} CN VI spin {spin!r} matched "
                 f"{len(rows)} Shannon rows in mendeleev; expected exactly one.")
    return rows[0]


def electron_affinity(e):
    """kJ/mol released, or None for the documented holes. Any surprise stops."""
    ea = e.electron_affinity
    if e.symbol in EA_NO_VALUE:
        if ea is not None:
            sys.exit(f"EA: {e.symbol} now HAS a value ({ea} eV); update EA_NO_VALUE.")
        return None
    if ea is None:
        return None                     # reported as a data gap by build()
    if (ea < 0) != (e.symbol in EA_METASTABLE):
        sys.exit(f"EA: {e.symbol} is {ea} eV, which disagrees with EA_METASTABLE.")
    return None if ea < 0 else round(ea * EV_TO_KJMOL, 1)


def card_record(symbol):
    e = element(symbol)
    d_block = symbol in DECK_3D
    if d_block != (e.block == "d"):
        sys.exit(f"{symbol}: mendeleev says block {e.block!r}; the deck disagrees.")
    column = None if d_block else column_of(e.group_id)
    ie1_ev = e.ionenergies.get(1)
    ion = ionic_row(e)
    rec = {
        "z": e.atomic_number,
        "symbol": e.symbol,
        "name": e.name,
        "period": e.period,
        "group": e.group_id,
        "column": column,
        "block": e.block,
        "mass": round(e.atomic_weight, 3) if e.atomic_weight is not None else None,
        "radius_pm": (None if symbol in NOBLE_GASES
                      else round(e.covalent_radius_cordero)
                      if e.covalent_radius_cordero is not None else None),
        "ie1_kjmol": round(ie1_ev * EV_TO_KJMOL, 1) if ie1_ev is not None else None,
        "en_pauling": round(e.en_pauling, 2) if e.en_pauling is not None else None,
        "valence_e": column,
        "ea_kjmol": electron_affinity(e),
        "ionic_radius_pm": tidy(ion.ionic_radius) if ion else None,
        "ion": ion_name(symbol, ion.charge) if ion else None,
        "ion_charge": ion.charge if ion else None,
        "econf": e.econf,
    }
    return rec


def expected_nulls(rec):
    """The cells the kickoff ALLOWS to be null for this card."""
    allowed = set()
    if rec["symbol"] in NOBLE_GASES:
        allowed.add("radius_pm")
        allowed.add("en_pauling")       # only if the dataset is blank
    if rec["block"] == "d":
        allowed.add("valence_e")
    if rec["symbol"] in EA_METASTABLE | EA_NO_VALUE:
        allowed.add("ea_kjmol")
    if isinstance(ION_TABLE[rec["symbol"]], str):
        allowed.add("ionic_radius_pm")
    return allowed


def build():
    assert set(ION_TABLE) == set(DECK), "ION_TABLE must name every card exactly once"
    records = [card_record(s) for s in DECK]

    # Loud checks: the deck, then the holes.
    assert len(records) == 52, f"expected 52 cards, built {len(records)}"
    zs = [r["z"] for r in records]
    assert len(set(zs)) == 52, "duplicate atomic numbers in the deck"

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


def shown_as_card(x):
    """Round half UP, as the card's JavaScript toFixed(0) does (74.5 -> 75).
    Python's own round() and :.0f round half to even, which would misreport."""
    return math.floor(x + 0.5)


def ion_table_lines(by_symbol):
    """The ion table, one row per card, for the teacher's review."""
    lines = ["## Ion table (ionic radius)", "",
             "One ion per card: the Shannon effective ionic radius at coordination "
             "number 6 (VI), high spin (HS) where Shannon lists both spins. "
             "'Most reliable' is the dataset's own `most_reliable` flag. "
             "Comparisons use the stored value; the card shows it rounded.", "",
             "| Element | Ion | CN | Spin | Stored (pm) | Shown | Most reliable | Undefined because |",
             "|---|---|---|---|---|---|---|---|"]
    for sym in DECK:
        row = ionic_row(element(sym))
        rec = by_symbol[sym]
        if row is None:
            lines.append(f"| {sym} | — | — | — | null | undefined | — | {ION_TABLE[sym]} |")
        else:
            flag = {True: "yes", False: "no"}.get(row.most_reliable, "—")
            lines.append(f"| {sym} | {rec['ion']} | VI | {row.spin or '—'} | "
                         f"{rec['ionic_radius_pm']} | {shown_as_card(rec['ionic_radius_pm'])} | {flag} | |")
    return lines + [""]


def ea_undefined_lines():
    """What the dataset holds for each undefined electron-affinity cell."""
    lines = ["## Electron affinity: the undefined cells", "",
             "| Element | Dataset value | Why undefined in the game |",
             "|---|---|---|"]
    for sym in DECK:
        if sym in EA_METASTABLE:
            ev = element(sym).electron_affinity
            lines.append(f"| {sym} | {ev:g} eV ({ev * EV_TO_KJMOL:.0f} kJ/mol) | negative: a "
                         "metastable-ion value (Andersen 2004), not comparable |")
        elif sym in EA_NO_VALUE:
            lines.append(f"| {sym} | none | the dataset has no value |")
    return lines + [""]


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
    lines += [""] + ion_table_lines(by_symbol) + ea_undefined_lines()
    lines += ["## Hand-checked values", "",
              "Twenty values compared against reference tables: the first ten "
              "consulted on 2026-10-14 (Phase 1), the last ten on 2026-10-31 "
              "(Phase 3). The build script fails if any drifts beyond "
              "tolerance (0.5 pm; 0.2 kJ/mol for ionization energy; 0.1 kJ/mol "
              "for electron affinity).", "",
              "- [A] en.wikipedia.org/wiki/Covalent_radius — the Cordero et al. "
              "2008 column (pm)",
              "- [B] en.wikipedia.org/wiki/Ionization_energies_of_the_elements_"
              "(data_page) — first ionization energy (kJ/mol); the CRC eV "
              "column × 96.485 agrees",
              "- [C] en.wikipedia.org/wiki/Electron_affinity_(data_page) — the "
              "\"Elements\" table (kJ/mol), revision 1382065069",
              "- [D] en.wikipedia.org/wiki/Ionic_radius — the \"Effective ionic "
              "radii\" table, six-coordinate (pm), revision 1374374808", "",
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
    print(f"hand-checks: all {len(HAND_CHECKS)} within tolerance")


if __name__ == "__main__":
    main()
