// Predictor + explanation tests, built from the kickoff's own examples.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { narrow, MAIN_BLOCKS } from "../../docs/js/data.js";
import { ALL_STATS } from "../../docs/js/settings.js";

import { predict, isUpset, explain, computeExceptions, findException } from "../../docs/js/trend.js";
import { resolve } from "../../docs/js/engine.js";

const here = dirname(fileURLToPath(import.meta.url));
const allElements = JSON.parse(readFileSync(join(here, "../../docs/data/elements.json"), "utf8"));
const allStats = JSON.parse(readFileSync(join(here, "../../docs/data/stats.json"), "utf8"));
// The deck the game plays until the M11 deck setting: main-group cards, Phase 1 stats.
const { elements, stats } = narrow({ elements: allElements, stats: allStats }, MAIN_BLOCKS, ALL_STATS);
const S = Object.fromEntries(stats.map(s => [s.key, s]));
const E = Object.fromEntries(elements.map(e => [e.symbol, e]));

test("across a period: Cl beats Al on ionization energy, and the line says so", () => {
  const p = predict(E.Cl, E.Al, S.ie1_kjmol);
  assert.deepEqual(p, { higher: 0, kind: "across" });
  const out = explain(resolve(E.Cl, E.Al, "ie1_kjmol"), S.ie1_kjmol);
  assert.equal(out.case, "trend");
  assert.equal(out.line, "Across a period, ionization energy rises. Cl, column 7, beats Al, column 3.");
});

test("trends conflict: Li vs I on radius makes no prediction and the data decides", () => {
  assert.equal(predict(E.Li, E.I, S.radius_pm).kind, "conflict");
  const out = explain(resolve(E.I, E.Li, "radius_pm"), S.radius_pm);
  assert.equal(out.case, "conflict");
  assert.equal(out.line,
    "Trends disagree here: going down raises atomic radius, going right lowers it. " +
    "The data decides: I 139 pm vs Li 128 pm.");
});

test("upset: nitrogen over oxygen on ionization energy", () => {
  assert.ok(isUpset(E.N, E.O, S.ie1_kjmol));
  const out = explain(resolve(E.N, E.O, "ie1_kjmol"), S.ie1_kjmol, []);
  assert.equal(out.case, "upset");
  assert.ok(out.upset);
  assert.match(out.line, /^This pair breaks the simple trend\. The data wins: N 1402\.3 kJ\/mol vs O 1313\.9 kJ\/mol\.$/);
});

test("upset: the argon/potassium mass inversion", () => {
  assert.ok(isUpset(E.Ar, E.K, S.mass));
  assert.ok(isUpset(E.Te, E.I, S.mass));
  const p = predict(E.K, E.Ar, S.mass);
  assert.deepEqual(p, { higher: 0, kind: "z" });
});

test("a reviewed exception reason is shown; an unreviewed one is not", () => {
  const drafted = [{ stat: "ie1_kjmol", a: "N", b: "O", predicted: "O", actual: "N",
                     reason: "DRAFT REASON", reviewed: false }];
  let out = explain(resolve(E.O, E.N, "ie1_kjmol"), S.ie1_kjmol, drafted);
  assert.ok(out.upset);
  assert.ok(!out.line.includes("DRAFT REASON"), "unreviewed reasons never reach students");
  drafted[0].reviewed = true;
  out = explain(resolve(E.O, E.N, "ie1_kjmol"), S.ie1_kjmol, drafted);
  assert.equal(out.line, "DRAFT REASON");
  assert.ok(findException(drafted, "ie1_kjmol", E.O, E.N), "lookup works in either order");
});

test("valence electrons have no exceptions and the column line reads right", () => {
  const ex = computeExceptions(elements, stats).filter(x => x.stat === "valence_e");
  assert.equal(ex.length, 0);
  const out = explain(resolve(E.Cl, E.Al, "valence_e"), S.valence_e);
  assert.equal(out.line, "Valence electrons equal the main-group column. Cl, column 7, beats Al, column 3.");
});

test("an undefined value is explained, not called an upset", () => {
  const out = explain(resolve(E.He, E.Li, "radius_pm"), S.radius_pm);
  assert.equal(out.case, "undefined");
  assert.ok(!out.upset);
  assert.match(out.line, /^He has no comparable atomic radius\. Noble-gas radii/);
});

test("down a group and both-agree lines", () => {
  let out = explain(resolve(E.Cs, E.Li, "radius_pm"), S.radius_pm);
  assert.equal(out.line, "Down a group, atomic radius rises. Cs, period 6, beats Li, period 2.");
  out = explain(resolve(E.F, E.Cs, "ie1_kjmol"), S.ie1_kjmol);
  assert.equal(out.case, "trend");
  assert.match(out.line, /^Both trends agree: ionization energy falls going down and rises going right\. F \(period 2, column 7\) beats Cs/);
});

test("lowest-wins rounds say 'ranks above' instead of 'beats'", () => {
  const out = explain(resolve(E.Cl, E.Al, "ie1_kjmol", "low"), S.ie1_kjmol);
  assert.match(out.line, /Cl, column 7, ranks above Al, column 3\./);
});

test("the exceptions list contains the famous ones", () => {
  const ex = computeExceptions(elements, stats);
  const has = (stat, a, b) => ex.some(x => x.stat === stat &&
    ((x.a === a && x.b === b) || (x.a === b && x.b === a)));
  assert.ok(has("ie1_kjmol", "N", "O"));
  assert.ok(has("ie1_kjmol", "Be", "B"));
  assert.ok(has("ie1_kjmol", "Mg", "Al"));
  assert.ok(has("mass", "Ar", "K"));
  assert.ok(has("mass", "Te", "I"));
  assert.ok(has("en_pauling", "Ga", "Al"));
  assert.ok(has("en_pauling", "Ge", "Si"));
  for (const x of ex) assert.notEqual(x.predicted, x.actual);
});
