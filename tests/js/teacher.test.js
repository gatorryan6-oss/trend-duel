// Teacher page table builder — Phase 2 kickoff M7.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTable, sortRows, toCsv, splitPreset, tableColumns } from "../../docs/js/teacher.js";

const PASTE = `
TD1|Ryan|2026-10-14|honors|rounds=18|won=11|lost=7|upsets=3|radius=5/6,ie1=3/5,en=2/4,mass=1/3
TD1|Maya|2026-10-14|cp|rounds=20|won=12|lost=8|upsets=1|radius=4/6,ie1=5/8,en=1/2,valence=2/4

TD1|Ben|2026-10-15|honors-call|rounds=20|won=14|lost=6|upsets=2|radius=3/5,ie1=6/7,en=2/4,mass=3/4
this is not a results line
TD1|Zoe|2026-10-15|cp-call|rounds=10|won=7|lost=3|upsets=0|radius=2/3,ie1=3/3,en=1/2,valence=1/2
TD2|Old|2026-10-15|cp|rounds=1|won=1|lost=0|upsets=0|radius=1/1
`;

test("a mixed paste of Duel and Call lines builds rows, with bad lines named", () => {
  const t = buildTable(PASTE);
  assert.equal(t.rows.length, 4);
  assert.deepEqual(t.rows.map(r => r.name), ["Ryan", "Maya", "Ben", "Zoe"]);
  assert.deepEqual(t.rows.map(r => r.mode), ["Duel", "Duel", "Call", "Call"]);
  assert.deepEqual(t.rows.map(r => r.preset), ["honors", "cp", "honors", "cp"]);
  assert.equal(t.errors.length, 2);
  assert.equal(t.errors[0].line, 6);
  assert.match(t.errors[0].reason, /9 fields/);
  assert.equal(t.errors[1].line, 8);
  assert.match(t.errors[1].reason, /version/);
});

test("stat columns are the union, in canonical order; the class row totals them", () => {
  const t = buildTable(PASTE);
  assert.deepEqual(t.statColumns, ["radius", "ie1", "en", "mass", "valence"]);
  assert.equal(t.classRow.games, 4);
  assert.equal(t.classRow.rounds, 68);
  assert.equal(t.classRow.won, 44);
  assert.equal(t.classRow.upsets, 6);
  assert.deepEqual(t.classRow.byStat.ie1, { won: 17, chosen: 23, pct: 74 });
  assert.deepEqual(t.classRow.byStat.mass, { won: 4, chosen: 7, pct: 57 });
  assert.deepEqual(t.classRow.byStat.valence, { won: 3, chosen: 6, pct: 50 });
});

test("an empty paste is an empty table, not an error", () => {
  const t = buildTable("");
  assert.deepEqual(t.rows, []);
  assert.deepEqual(t.errors, []);
  assert.deepEqual(t.statColumns, []);
  assert.equal(t.classRow.games, 0);
});

test("splitPreset reads the -call suffix and leaves Phase 1 presets as Duel", () => {
  assert.deepEqual(splitPreset("honors-call"), { preset: "honors", mode: "Call" });
  assert.deepEqual(splitPreset("custom"), { preset: "custom", mode: "Duel" });
});

test("sorting by a numeric, a text, and a stat column, both directions, stable", () => {
  const { rows } = buildTable(PASTE);
  assert.deepEqual(sortRows(rows, "won", "desc").map(r => r.name), ["Ben", "Maya", "Ryan", "Zoe"]);
  assert.deepEqual(sortRows(rows, "name", "asc").map(r => r.name), ["Ben", "Maya", "Ryan", "Zoe"]);
  // ie1 fractions: Zoe 3/3, Ben 6/7, Maya 5/8 (0.625), Ryan 3/5 (0.6)
  assert.deepEqual(sortRows(rows, "stat:ie1", "desc").map(r => r.name), ["Zoe", "Ben", "Maya", "Ryan"]);
  assert.deepEqual(sortRows(rows, "mode", "asc").map(r => r.name), ["Ben", "Zoe", "Ryan", "Maya"]);
});

test("CSV has the table's columns, one row per line, class row last, quoting where needed", () => {
  const t = buildTable(PASTE);
  const csv = toCsv(t);
  const lines = csv.trim().split("\r\n");
  assert.equal(lines[0], tableColumns(t.statColumns).map(c => c.includes(",") ? `"${c}"` : c).join(","));
  assert.equal(lines.length, 1 + 4 + 1);
  assert.equal(lines[1], "Ryan,2026-10-14,honors,Duel,18,11,7,3,5/6,3/5,2/4,1/3,");
  assert.match(lines[5], /^Class,,,,68,44,24,6,/);
  assert.match(lines[5], /17\/23 \(74%\)/);
  const quoted = toCsv(buildTable('TD1|O"Brien|2026-01-01|cp|rounds=1|won=1|lost=0|upsets=0|radius=1/1'));
  assert.match(quoted, /"O""Brien"/);
});
