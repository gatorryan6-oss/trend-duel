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
//   1. Runs the predictor over every pair in the deck (all 52 cards) for
//      every stat and keeps the pairs it gets wrong (computeExceptions).
//   2. Looks each pair up in tools/exception_reasons.json: every upset must
//      be listed in exactly ONE family (Phase 3). The pair's reason is its
//      per-pair override if it has one, otherwise the family's reason. An
//      unlisted pair, a pair in two families, or a listed pair that is no
//      longer an upset stops the build — never a silent "other".
//   3. Keeps the teacher's `reviewed: true` flags from the existing file for
//      any pair that is still an exception, so a rebuild never undoes a
//      review. A pair whose REASON changed since review is flagged back to
//      false, because the reviewed text is no longer the text on screen.
//      (Only tools/review_family.py sets the flag, and the teacher runs it.)
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
const { families, overrides } = JSON.parse(readFileSync(REASONS, "utf8"));
const existing = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : [];

function fail(message) {
  console.error("build_exceptions: " + message);
  process.exit(1);
}

const keyOf = (stat, a, b) => `${stat}|${a}|${b}`;
const lookup = (map, stat, a, b) => map[keyOf(stat, a, b)] ?? map[keyOf(stat, b, a)];
const existingByKey = {};
for (const x of existing) existingByKey[keyOf(x.stat, x.a, x.b)] = x;

// Family membership, keyed both ways round. Two families claiming one pair
// is a drafting mistake, caught here.
const familyOf = {};
for (const [name, f] of Object.entries(families)) {
  if (!f.reason || !f.reason.trim()) fail(`family "${name}" has no reason.`);
  for (const pair of f.pairs) {
    const [a, b] = pair.split("|");
    for (const k of [keyOf(f.stat, a, b), keyOf(f.stat, b, a)]) {
      if (familyOf[k] && familyOf[k] !== name) fail(`${k} is in both "${familyOf[k]}" and "${name}".`);
      familyOf[k] = name;
    }
  }
}

const computed = computeExceptions(elements, stats);
const unlisted = computed.filter(x => !familyOf[keyOf(x.stat, x.a, x.b)])
                         .map(x => keyOf(x.stat, x.a, x.b));
if (unlisted.length) {
  fail(`${unlisted.length} upset(s) belong to no family in tools/exception_reasons.json: ` +
       unlisted.join(", "));
}
const computedKeys = new Set(computed.flatMap(x => [keyOf(x.stat, x.a, x.b), keyOf(x.stat, x.b, x.a)]));
const stale = Object.entries(families).flatMap(([name, f]) =>
  f.pairs.filter(p => !computedKeys.has(`${f.stat}|${p}`)).map(p => `${name}: ${p}`));
if (stale.length) fail(`listed pair(s) are no longer upsets: ${stale.join(", ")}`);
const staleOverrides = Object.keys(overrides).filter(k => !computedKeys.has(k));
if (staleOverrides.length) fail(`override(s) for pairs that are no longer upsets: ${staleOverrides.join(", ")}`);

const records = computed.map(x => {
  const family = familyOf[keyOf(x.stat, x.a, x.b)];
  const reason = lookup(overrides, x.stat, x.a, x.b) ?? families[family].reason;
  const prior = lookup(existingByKey, x.stat, x.a, x.b);
  const reviewed = Boolean(prior && prior.reviewed === true && prior.reason === reason);
  return { ...x, family, reason, reviewed };
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
console.log(`wrote ${records.length} exceptions in ${Object.keys(families).length} families -> docs/data/exceptions.json`);
for (const [k, n] of Object.entries(byStat)) console.log(`  ${k}: ${n}`);
console.log(`  reviewed: ${records.filter(r => r.reviewed).length}`);
