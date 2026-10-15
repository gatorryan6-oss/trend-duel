// settings.js — every toggle the game has, the two presets, and saving.
//
// A preset is nothing more than a saved combination of toggles (kickoff
// §2). The settings panel edits the toggles; picking a preset overwrites
// them. Pure except for load/save, which take the storage object as an
// argument so tests can hand in a fake.

export const SETTINGS_KEY = "td1.settings.v1";   // versioned: bump on shape change

export const ALL_STATS = ["radius_pm", "ie1_kjmol", "en_pauling", "mass", "valence_e"];

// The toggles each preset sets. Anything not listed here is left alone.
export const PRESETS = {
  cp: {
    label: "CP",
    accent: "#1f6feb",
    toggles: {
      statKeys: ["radius_pm", "ie1_kjmol", "en_pauling", "valence_e"],
      face: "valence",
      directionToken: false,
      allowGreedy: false,
      opponent: "random",
    },
  },
  honors: {
    label: "Honors",
    accent: "#b4420e",
    toggles: {
      statKeys: ["radius_pm", "ie1_kjmol", "en_pauling", "mass"],
      face: "econf",
      directionToken: true,
      allowGreedy: true,
      opponent: "trend",
    },
  },
};

export const DEFAULTS = {
  base: "cp",              // the preset these settings grew from (sets the accent)
  mode: "computer",        // "computer" | "hotseat"
  opponent: "random",      // "random" | "trend" | "greedy"
  allowGreedy: false,
  statKeys: PRESETS.cp.toggles.statKeys,
  face: "valence",         // "valence" | "econf"
  directionToken: false,
  roundCap: 20,
  ...PRESETS.cp.toggles,
};

export function applyPreset(settings, key) {
  const preset = PRESETS[key];
  if (!preset) throw new Error(`Unknown preset "${key}".`);
  return { ...settings, ...preset.toggles, base: key };
}

// Which preset do these settings match exactly? "custom" if none.
export function presetOf(settings) {
  for (const [key, preset] of Object.entries(PRESETS)) {
    const match = Object.entries(preset.toggles).every(([k, v]) =>
      Array.isArray(v) ? sameList(v, settings[k]) : v === settings[k]);
    if (match) return key;
  }
  return "custom";
}

function sameList(a, b) {
  return Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]);
}

// A plain-English problem with the settings, or null when they are playable.
export function validate(settings) {
  if (!Array.isArray(settings.statKeys) || settings.statKeys.length < 2) {
    return "Pick at least two stats.";
  }
  const bad = settings.statKeys.filter(k => !ALL_STATS.includes(k));
  if (bad.length) return `Unknown stat: ${bad.join(", ")}.`;
  if (!(settings.roundCap >= 1 && settings.roundCap <= 42)) return "Round cap must be 1–42.";
  if (settings.mode === "computer" && settings.opponent === "greedy" && !settings.allowGreedy) {
    return "Greedy is switched off for this deck. Allow it in settings or pick another opponent.";
  }
  return null;
}

// The engine only needs these.
export function toConfig(settings) {
  return {
    statKeys: settings.statKeys.slice(),
    directionToken: Boolean(settings.directionToken),
    roundCap: Number(settings.roundCap),
    firstPicker: 0,
  };
}

// Storage may be missing (private window) or throw; both mean "defaults".
export function load(storage) {
  try {
    const raw = storage && storage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULTS };
    const saved = JSON.parse(raw);
    const merged = { ...DEFAULTS, ...saved };
    return validate(merged) ? { ...DEFAULTS } : merged;
  } catch {
    return { ...DEFAULTS };
  }
}

export function save(settings, storage) {
  try {
    storage && storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}
