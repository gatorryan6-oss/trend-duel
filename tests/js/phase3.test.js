// Phase 3 predictor tests (M10): the full 52-card deck and all seven stats.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { predict, isUpset, explain, computeExceptions } from "../../docs/js/trend.js";
import { resolve } from "../../docs/js/engine.js";
import { positionScore, acrossIndex } from "../../docs/js/opponents.js";

const here = dirname(fileURLToPath(import.meta.url));
const elements = JSON.parse(readFileSync(join(here, "../../docs/data/elements.json"), "utf8"));
const stats = JSON.parse(readFileSync(join(here, "../../docs/data/stats.json"), "utf8"));
const exceptions = JSON.parse(readFileSync(join(here, "../../docs/data/exceptions.json"), "utf8"));
const S = Object.fromEntries(stats.map(s => [s.key, s]));
const E = Object.fromEntries(elements.map(e => [e.symbol, e]));

test("anion-first: O2- beats Mg2+ and the line says why", () => {
  assert.deepEqual(predict(E.O, E.Mg, S.ionic_radius_pm), { higher: 0, kind: "anion" });
  const out = explain(resolve(E.Mg, E.O, "ionic_radius_pm"), S.ionic_radius_pm);
  assert.equal(out.case, "trend");
  assert.equal(out.line, "Anions are larger than cations: O²⁻ 140 pm vs Mg²⁺ 72 pm.");
});

test("anion-first only applies across charge signs; two cations use position", () => {
  assert.equal(predict(E.Na, E.Mg, S.ionic_radius_pm).kind, "across");
  assert.equal(predict(E.F, E.Cl, S.ionic_radius_pm).kind, "down");
  assert.equal(predict(E.Na, E.Mg, S.radius_pm).kind, "across", "atomic radius has no anion rule");
});

test("a large cation beating a small anion is an upset: K+ over F-", () => {
  assert.ok(isUpset(E.K, E.F, S.ionic_radius_pm));
  const out = explain(resolve(E.K, E.F, "ionic_radius_pm"), S.ionic_radius_pm, exceptions);
  assert.equal(out.case, "upset");
  assert.equal(out.line, "This pair breaks the simple trend. The data wins: K⁺ 138 pm vs F⁻ 133 pm.");
});

test("d-block lines say group: Zn beats Ca on ionization energy", () => {
  const out = explain(resolve(E.Zn, E.Ca, "ie1_kjmol"), S.ie1_kjmol);
  assert.equal(out.case, "trend");
  assert.equal(out.line, "Across a period, ionization energy rises. Zn, group 12, beats Ca, group 2.");
});

test("Cu vs Zn ionization reads by group, and main-group lines still say column", () => {
  const out = explain(resolve(E.Cu, E.Zn, "ie1_kjmol"), S.ie1_kjmol);
  assert.equal(out.line, "Across a period, ionization energy rises. Zn, group 12, beats Cu, group 11.");
  const main = explain(resolve(E.Cl, E.Al, "ie1_kjmol"), S.ie1_kjmol);
  assert.equal(main.line, "Across a period, ionization energy rises. Cl, column 7, beats Al, column 3.");
});

test("cobalt outweighs nickel: a mass upset in the isotope family", () => {
  assert.ok(isUpset(E.Co, E.Ni, S.mass));
  const x = exceptions.find(e => e.stat === "mass" && e.a === "Co" && e.b === "Ni");
  assert.equal(x.family, "mass-isotope-mix");
  assert.equal(x.reviewed, false);
});

test("valence electrons make no call for a d-block card", () => {
  assert.equal(predict(E.Fe, E.Cl, S.valence_e).kind, "none");
  assert.equal(computeExceptions(elements, stats).filter(x => x.stat === "valence_e").length, 0);
});

test("the predictor measures across by group, matching column for main-group cards", () => {
  for (const a of elements) for (const b of elements) {
    if (a.block === "d" || b.block === "d") continue;
    assert.equal(Math.sign(a.group - b.group), Math.sign(a.column - b.column));
  }
});

test("positionScore: main-group cards keep their column, the 3d row sits between columns 2 and 3", () => {
  for (const e of elements.filter(c => c.block !== "d")) assert.equal(acrossIndex(e), e.column);
  const row = ["Ca", "Sc", "Ti", "V", "Cr", "Mn", "Fe", "Co", "Ni", "Cu", "Zn", "Ga"].map(s => acrossIndex(E[s]));
  for (let i = 1; i < row.length; i++) assert.ok(row[i] > row[i - 1], "strictly increasing by group");
  assert.ok(positionScore(E.Zn, S.ie1_kjmol) > positionScore(E.Sc, S.ie1_kjmol));
  assert.ok(positionScore(E.F, S.ionic_radius_pm) > positionScore(E.Cs, S.ionic_radius_pm),
    "the Trend-reasoner calls any anion larger than any cation");
});
