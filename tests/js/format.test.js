// Formatting tests (Phase 3 M9): ion names and the stored-vs-shown rule.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { formatIon, formatValue } from "../../docs/js/format.js";

const here = dirname(fileURLToPath(import.meta.url));
const elements = JSON.parse(readFileSync(join(here, "../../docs/data/elements.json"), "utf8"));
const stats = JSON.parse(readFileSync(join(here, "../../docs/data/stats.json"), "utf8"));
const ionic = stats.find(s => s.key === "ionic_radius_pm");

test("ion names get superscript charges", () => {
  assert.equal(formatIon("Na+"), "Na⁺");
  assert.equal(formatIon("Cl-"), "Cl⁻");
  assert.equal(formatIon("O2-"), "O²⁻");
  assert.equal(formatIon("Fe3+"), "Fe³⁺");
  assert.throws(() => formatIon("Na"), /not an ion name/);
});

test("every ion in the deck formats", () => {
  for (const e of elements) if (e.ion) assert.match(formatIon(e.ion), /^[A-Z][a-z]?[¹²³⁴]?[⁺⁻]$/);
});

test("Shannon's .5 values are shown rounded half up but stored exactly", () => {
  const sc = elements.find(e => e.symbol === "Sc");
  const zn = elements.find(e => e.symbol === "Zn");
  assert.equal(sc.ionic_radius_pm, 74.5);
  assert.equal(formatValue(ionic, sc.ionic_radius_pm), "75 pm");
  assert.ok(sc.ionic_radius_pm > zn.ionic_radius_pm, "rounding must not decide Sc3+ vs Zn2+");
});
