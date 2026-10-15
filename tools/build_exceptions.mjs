// build_exceptions.mjs — compute docs/data/exceptions.json.
//
// Run:    node tools/build_exceptions.mjs           (rewrite the file)
//         node tools/build_exceptions.mjs --check   (exit 1 if the file is stale)
//
// Why Node and not Python: the list must be EXACTLY what the game's own
// predictor (docs/js/trend.js) gets wrong, so the honest way to compute it
// is to run that predictor, not a second copy of it in another language.
//
// What it does, in plain English:
//   1. Runs the predictor over every pair in the deck for every stat and
//      keeps the pairs it gets wrong (computeExceptions).
//   2. Attaches a drafted one-sentence reason from tools/exception_reasons.json,
//      keyed "stat|A|B" in either order. A pair with no draft gets a
//      placeholder and a loud warning — never silence.
//   3. Keeps the teacher's `reviewed: true` flags from the existing file for
//      any pair that is still an exception, so a rebuild never undoes a
//      review. A pair whose REASON changed since review is flagged back to
//      false, because the reviewed text is no longer the text on screen.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { computeExceptions } from "../docs/js/trend.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const ELEMENTS = join(root, "docs/data/elements.json");
const STATS = join(root, "docs/data/stats.json");
const OUT = join(root, "docs/data/exceptions.json");
const REASONS = join(here, "exception_reasons.json");

const elements = JSON.parse(readFileSync(ELEMENTS, "utf8"));
const stats = JSON.parse(readFileSync(STATS, "utf8"));
const reasons = existsSync(REASONS) ? JSON.parse(readFileSync(REASONS, "utf8")) : {};
const existing = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : [];

const keyOf = (stat, a, b) => `${stat}|${a}|${b}`;
const lookup = (map, stat, a, b) => map[keyOf(stat, a, b)] ?? map[keyOf(stat, b, a)];
const existingByKey = {};
for (const x of existing) existingByKey[keyOf(x.stat, x.a, x.b)] = x;

const PLACEHOLDER = "(no reason drafted yet)";
const computed = computeExceptions(elements, stats);
const missing = [];
const records = computed.map(x => {
  let reason = lookup(reasons, x.stat, x.a, x.b);
  if (!reason) { reason = PLACEHOLDER; missing.push(keyOf(x.stat, x.a, x.b)); }
  const prior = lookup(existingByKey, x.stat, x.a, x.b);
  const reviewed = Boolean(prior && prior.reviewed === true && prior.reason === reason);
  return { ...x, reason, reviewed };
});

const text = JSON.stringify(records, null, 1) + "\n";

if (process.argv.includes("--check")) {
  const current = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  if (current !== text) {
    console.error("exceptions.json is STALE: it does not match what the predictor computes now. " +
                  "Run: node tools/build_exceptions.mjs");
    process.exit(1);
  }
  console.log(`exceptions.json is current (${records.length} entries).`);
  process.exit(0);
}

writeFileSync(OUT, text);
const byStat = {};
for (const r of records) byStat[r.stat] = (byStat[r.stat] || 0) + 1;
console.log(`wrote ${records.length} exceptions -> docs/data/exceptions.json`);
for (const [k, n] of Object.entries(byStat)) console.log(`  ${k}: ${n}`);
console.log(`  reviewed: ${records.filter(r => r.reviewed).length}`);
if (missing.length) {
  console.warn(`WARNING: ${missing.length} pair(s) have no drafted reason: ${missing.join(", ")}`);
}
