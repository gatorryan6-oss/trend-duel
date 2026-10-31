// trend.js — the naive trend predictor and the reveal's one explanation line.
//
// PURE, like engine.js: no document, no window. The predictor works ONLY
// from position — period and group — never from the numbers, so it reasons
// exactly the way a student reading the table would, and it is wrong
// exactly where the chemistry is interesting.
//
// Rules per stat come from stats.json:
//   down/across "+"/"-"  radius rises going down, falls going right, etc.
//                        "Across" is measured by IUPAC group (Phase 3), which
//                        orders main-group cards exactly as the column did.
//   anion_first          before position: an anion is larger than a cation
//   by_z                 mass rises with atomic number
//   by_column            valence electrons equal the column — no exceptions
import { formatValue, formatIon } from "./format.js";

function sign(x) { return x > 0 ? 1 : x < 0 ? -1 : 0; }

// Is this card an anion / a cation for an anion_first stat? null = no ion.
function ionSign(card) {
  return card.ion_charge === null || card.ion_charge === undefined ? null : sign(card.ion_charge);
}

// Which card does the trend say has the HIGHER value?
// Returns { higher: 0 | 1 | null, kind } where kind explains the call:
//   "anion"    one anion, one cation; the anion is predicted larger
//   "down"     the cards share a group; the down-a-group rule decided
//   "across"   the cards share a period; the across-a-period rule decided
//   "both"     both rules point the same way
//   "conflict" the rules pull opposite ways — no prediction
//   "z"        by atomic number (mass)
//   "column"   by column (valence electrons)
//   "tie"      the rule predicts equal values (same column, valence)
//   "none"     the rule cannot apply (a d-block card has no column)
export function predict(a, b, stat) {
  if (stat.by_z) return { higher: a.z > b.z ? 0 : 1, kind: "z" };
  if (stat.by_column) {
    if (a.column === null || b.column === null) return { higher: null, kind: "none" };
    if (a.column === b.column) return { higher: null, kind: "tie" };
    return { higher: a.column > b.column ? 0 : 1, kind: "column" };
  }
  if (stat.anion_first) {
    const sa = ionSign(a), sb = ionSign(b);
    if (sa !== null && sb !== null && sa !== sb) return { higher: sa < 0 ? 0 : 1, kind: "anion" };
  }
  const downSign = stat.down === "+" ? 1 : -1;
  const acrossSign = stat.across === "+" ? 1 : -1;
  // Positive means "a is predicted higher than b" on that axis.
  const down = sign(a.period - b.period) * downSign;
  const across = sign(a.group - b.group) * acrossSign;
  if (down === 0 && across === 0) return { higher: null, kind: "tie" };
  if (down === 0) return { higher: across > 0 ? 0 : 1, kind: "across" };
  if (across === 0) return { higher: down > 0 ? 0 : 1, kind: "down" };
  if (down === across) return { higher: down > 0 ? 0 : 1, kind: "both" };
  return { higher: null, kind: "conflict" };
}

// Which card actually has the higher value? null for a tie or an undefined.
export function actualHigher(a, b, key) {
  const va = a[key], vb = b[key];
  if (va === null || va === undefined || vb === null || vb === undefined) return null;
  if (va === vb) return null;
  return va > vb ? 0 : 1;
}

// Is this pair an upset for this stat: the trend predicts one card higher
// and the data says the other? Undefined values and ties are never upsets.
export function isUpset(a, b, stat) {
  const p = predict(a, b, stat);
  if (p.higher === null) return false;
  const actual = actualHigher(a, b, stat.key);
  return actual !== null && actual !== p.higher;
}

const verb = (dir) => (dir === "+" ? "rises" : "falls");
const verbs = (dir) => (dir === "+" ? "raises" : "lowers");

// Main-group pairs keep Phase 1's wording ("column 7"); once a d-block card
// is involved there is no column, so the line names the group ("group 12").
function positionWords(a, b) {
  const d = a.block === "d" || b.block === "d";
  return { word: d ? "group" : "column", of: (card) => (d ? card.group : card.column) };
}

// Find the reviewed explanation for a pair, in either order.
export function findException(exceptions, key, a, b) {
  return exceptions.find(x => x.stat === key &&
    ((x.a === a.symbol && x.b === b.symbol) || (x.a === b.symbol && x.b === a.symbol))) || null;
}

// The one line the reveal prints (kickoff §2), plus which case it is.
//   reveal: the engine's reveal record ({ a, b, stat, direction, winner, undefinedLoser })
//   stat:   the stats.json record for reveal.stat
//   exceptions: exceptions.json (only reviewed reasons are ever shown)
export function explain(reveal, stat, exceptions = []) {
  const { a, b, stat: key, undefinedLoser, direction } = reveal;
  const label = stat.label.toLowerCase();
  // A stat with show_with names the ion, not the atom: "O²⁻ 140 pm".
  const name = (card) => (stat.show_with && card[stat.show_with]
    ? formatIon(card[stat.show_with]) : card.symbol);
  const fmt = (card) => `${name(card)} ${formatValue(stat, card[key])}`;

  if (undefinedLoser !== null && undefinedLoser !== undefined) {
    const loser = undefinedLoser === 0 ? a : b;
    return { case: "undefined", upset: false,
             line: `${loser.symbol} has no comparable ${label}. ${stat.undefined_note || ""}`.trim() };
  }

  const actual = actualHigher(a, b, key);
  if (actual === null) {
    return { case: "tie", upset: false,
             line: `${a.symbol} and ${b.symbol} tie at ${formatValue(stat, a[key])}.` };
  }
  const hi = actual === 0 ? a : b;
  const lo = actual === 0 ? b : a;
  const beats = direction === "low" ? "ranks above" : "beats";
  const data = `${fmt(hi)} vs ${fmt(lo)}`;
  const p = predict(a, b, stat);
  const pos = positionWords(a, b);

  if (p.kind === "conflict") {
    return { case: "conflict", upset: false,
             line: `Trends disagree here: going down ${verbs(stat.down)} ${label}, ` +
                   `going right ${verbs(stat.across)} it. The data decides: ${data}.` };
  }

  if (p.higher !== null && p.higher !== actual) {
    const x = findException(exceptions, key, a, b);
    const line = x && x.reviewed === true
      ? x.reason
      : `This pair breaks the simple trend. The data wins: ${data}.`;
    return { case: "upset", upset: true, line };
  }

  // Trend predicted and was right (or, for valence, predicted the column order).
  let line;
  switch (p.kind) {
    case "anion":
      line = `Anions are larger than cations: ${data}.`;
      break;
    case "across":
      line = `Across a period, ${label} ${verb(stat.across)}. ` +
             `${hi.symbol}, ${pos.word} ${pos.of(hi)}, ${beats} ${lo.symbol}, ${pos.word} ${pos.of(lo)}.`;
      break;
    case "down":
      line = `Down a group, ${label} ${verb(stat.down)}. ` +
             `${hi.symbol}, period ${hi.period}, ${beats} ${lo.symbol}, period ${lo.period}.`;
      break;
    case "both":
      line = `Both trends agree: ${label} ${verb(stat.down)} going down and ${verb(stat.across)} going right. ` +
             `${hi.symbol} (period ${hi.period}, ${pos.word} ${pos.of(hi)}) ${beats} ` +
             `${lo.symbol} (period ${lo.period}, ${pos.word} ${pos.of(lo)}).`;
      break;
    case "z":
      line = `${stat.label} rises with atomic number. ${hi.symbol} (${hi.z}) ${beats} ${lo.symbol} (${lo.z}).`;
      break;
    case "column":
      line = `Valence electrons equal the main-group column. ` +
             `${hi.symbol}, column ${hi.column}, ${beats} ${lo.symbol}, column ${lo.column}.`;
      break;
    default:
      line = `${data}.`;
  }
  return { case: "trend", upset: false, line };
}

// Every pair in the deck where the predictor makes a call and the data
// disagrees — the raw material for exceptions.json. Order is deterministic
// (by stat order, then atomic number) so regenerating gives a stable diff.
export function computeExceptions(elements, stats) {
  const sorted = elements.slice().sort((x, y) => x.z - y.z);
  const out = [];
  for (const stat of stats) {
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i], b = sorted[j];
        if (!isUpset(a, b, stat)) continue;
        const p = predict(a, b, stat);
        out.push({ stat: stat.key, a: a.symbol, b: b.symbol,
                   predicted: p.higher === 0 ? a.symbol : b.symbol,
                   actual: actualHigher(a, b, stat.key) === 0 ? a.symbol : b.symbol });
      }
    }
  }
  return out;
}
