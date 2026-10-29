// teacher.js — paste a column of TD1 results lines, get a class table.
//
// The table builder is PURE (lines in; rows, errors and totals out) so Node
// can test it. There is ONE parser for results lines — parseResults in
// results.js — and this file never splits a line itself (an invariant checks
// that). The page wiring at the bottom runs only in a browser.
import { parseResults } from "./results.js";

// Canonical column order for the per-stat columns; anything unknown goes
// after, in first-seen order.
export const STAT_ORDER = ["radius", "ie1", "en", "mass", "valence"];
export const STAT_LABELS = { radius: "Radius", ie1: "Ioniz. energy", en: "Electroneg.",
                             mass: "Mass", valence: "Valence e⁻" };

// "honors-call" -> { preset: "honors", mode: "Call" }; "cp" -> Duel.
export function splitPreset(preset) {
  const m = /^(.*)-call$/.exec(preset);
  return m ? { preset: m[1], mode: "Call" } : { preset, mode: "Duel" };
}

export function buildTable(text) {
  const rows = [];
  const errors = [];
  const lines = String(text ?? "").split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    try {
      const parsed = parseResults(line);
      const { preset, mode } = splitPreset(parsed.preset);
      rows.push({ ...parsed, preset, mode, line: i + 1 });
    } catch (err) {
      errors.push({ line: i + 1, text: line, reason: err.message });
    }
  });

  const seen = new Set();
  for (const r of rows) for (const k of Object.keys(r.byStat)) seen.add(k);
  const statColumns = [...STAT_ORDER.filter(k => seen.has(k)),
                       ...[...seen].filter(k => !STAT_ORDER.includes(k))];

  const classRow = { rounds: 0, won: 0, lost: 0, upsets: 0, games: rows.length, byStat: {} };
  for (const r of rows) {
    classRow.rounds += r.rounds; classRow.won += r.won; classRow.lost += r.lost;
    classRow.upsets += r.upsets;
    for (const k of statColumns) {
      const t = r.byStat[k];
      if (!t) continue;
      const c = classRow.byStat[k] || { won: 0, chosen: 0 };
      classRow.byStat[k] = { won: c.won + t.won, chosen: c.chosen + t.chosen };
    }
  }
  for (const k of statColumns) {
    const c = classRow.byStat[k] || { won: 0, chosen: 0 };
    classRow.byStat[k] = { ...c, pct: c.chosen ? Math.round(100 * c.won / c.chosen) : null };
  }
  return { rows, errors, classRow, statColumns };
}

// Sort rows by a column; stat columns sort by win fraction. Stable.
export function sortRows(rows, key, direction = "asc") {
  const value = (r) => {
    if (key.startsWith("stat:")) {
      const t = r.byStat[key.slice(5)];
      return t && t.chosen ? t.won / t.chosen : -1;
    }
    return r[key];
  };
  const out = rows.map((r, i) => ({ r, i }));
  out.sort((x, y) => {
    const a = value(x.r), b = value(y.r);
    const cmp = typeof a === "number" && typeof b === "number"
      ? a - b : String(a).localeCompare(String(b));
    return (direction === "asc" ? cmp : -cmp) || x.i - y.i;
  });
  return out.map(x => x.r);
}

export function tableColumns(statColumns) {
  return ["Name", "Date", "Preset", "Mode", "Rounds", "Won", "Lost", "Upsets",
          ...statColumns.map(k => STAT_LABELS[k] || k)];
}

function csvCell(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// The same table as CSV text, class row last.
export function toCsv({ rows, classRow, statColumns }) {
  const head = tableColumns(statColumns);
  const body = rows.map(r => [r.name, r.date, r.preset, r.mode, r.rounds, r.won, r.lost, r.upsets,
    ...statColumns.map(k => r.byStat[k] ? `${r.byStat[k].won}/${r.byStat[k].chosen}` : "")]);
  const cls = ["Class", "", "", "", classRow.rounds, classRow.won, classRow.lost, classRow.upsets,
    ...statColumns.map(k => {
      const c = classRow.byStat[k];
      return c && c.chosen ? `${c.won}/${c.chosen} (${c.pct}%)` : "";
    })];
  return [head, ...body, cls].map(r => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

// ---------- page wiring (browser only) ----------
if (typeof globalThis.document !== "undefined" && globalThis.document.getElementById("paste")) {
  const $ = (id) => document.getElementById(id);
  let table = null;
  let sort = { key: null, direction: "asc" };

  function render() {
    const head = $("table-head");
    const body = $("table-body");
    head.replaceChildren();
    body.replaceChildren();
    if (!table) return;
    const keys = ["name", "date", "preset", "mode", "rounds", "won", "lost", "upsets",
                  ...table.statColumns.map(k => "stat:" + k)];
    const tr = document.createElement("tr");
    tableColumns(table.statColumns).forEach((label, i) => {
      const th = document.createElement("th");
      th.textContent = label + (sort.key === keys[i] ? (sort.direction === "asc" ? " ▲" : " ▼") : "");
      th.tabIndex = 0;
      th.title = "Sort by " + label;
      const flip = () => {
        sort = { key: keys[i], direction: sort.key === keys[i] && sort.direction === "asc" ? "desc" : "asc" };
        render();
      };
      th.addEventListener("click", flip);
      th.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); } });
      tr.appendChild(th);
    });
    head.appendChild(tr);

    const rows = sort.key ? sortRows(table.rows, sort.key, sort.direction) : table.rows;
    for (const r of rows) {
      const cells = [r.name, r.date, r.preset, r.mode, r.rounds, r.won, r.lost, r.upsets,
        ...table.statColumns.map(k => r.byStat[k] ? `${r.byStat[k].won}/${r.byStat[k].chosen}` : "—")];
      const row = document.createElement("tr");
      for (const c of cells) { const td = document.createElement("td"); td.textContent = c; row.appendChild(td); }
      body.appendChild(row);
    }
    const c = table.classRow;
    const cls = document.createElement("tr");
    cls.className = "class-row";
    const cells = ["Class", `${c.games} lines`, "", "", c.rounds, c.won, c.lost, c.upsets,
      ...table.statColumns.map(k => {
        const t = c.byStat[k];
        return t && t.chosen ? `${t.won}/${t.chosen} · ${t.pct}%` : "—";
      })];
    for (const v of cells) { const td = document.createElement("td"); td.textContent = v; cls.appendChild(td); }
    body.appendChild(cls);

    const errs = $("errors");
    errs.replaceChildren();
    for (const e of table.errors) {
      const li = document.createElement("li");
      li.textContent = `Line ${e.line}: ${e.reason} — "${e.text.slice(0, 60)}${e.text.length > 60 ? "…" : ""}"`;
      errs.appendChild(li);
    }
    $("errors-box").hidden = table.errors.length === 0;
    $("summary").textContent = `${table.rows.length} result line(s) read` +
      (table.errors.length ? `, ${table.errors.length} rejected` : "") + ".";
    $("download").disabled = table.rows.length === 0;
  }

  $("build").addEventListener("click", () => { table = buildTable($("paste").value); sort = { key: null, direction: "asc" }; render(); });
  $("download").addEventListener("click", () => {
    if (!table) return;
    const blob = new Blob([toCsv(table)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `trend-duel-results-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
}
