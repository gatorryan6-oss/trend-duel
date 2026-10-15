// format.js — pure helpers for turning a stat value into text. Shared by the
// card renderer (page code) and the trend explainer (pure code), so it must
// never touch the page itself.

// null is "undefined", never 0 and never blank — the kickoff's rule.
export function formatValue(stat, value) {
  if (value === null || value === undefined) return "undefined";
  return Number(value).toFixed(stat.decimals) + (stat.unit ? " " + stat.unit : "");
}
