// format.js — pure helpers for turning a stat value into text. Shared by the
// card renderer (page code) and the trend explainer (pure code), so it must
// never touch the page itself.

// null is "undefined", never 0 and never blank — the kickoff's rule.
export function formatValue(stat, value) {
  if (value === null || value === undefined) return "undefined";
  return Number(value).toFixed(stat.decimals) + (stat.unit ? " " + stat.unit : "");
}

// "O2-" -> "O²⁻", "Na+" -> "Na⁺". The data stores plain ASCII; this draws it.
const SUPERSCRIPT = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵",
                      "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻" };
export function formatIon(ion) {
  const m = /^([A-Z][a-z]?)(\d*[+-])$/.exec(ion || "");
  if (!m) throw new Error(`"${ion}" is not an ion name like Na+ or O2-.`);
  return m[1] + [...m[2]].map(ch => SUPERSCRIPT[ch]).join("");
}
