/**
 * Shared language pieces: column normalisation and resolution, numbers with
 * units, comparators, directions.
 *
 * The split that matters is here rather than in any one approach: fuzzy
 * matching may decide *which column* is meant, but numbers are only ever read
 * by the grammar. A statistical component must never be able to turn "above
 * 50" into 500.
 */

import { DATASETS } from "../schema.mjs";

/* ------------------------------------------------------------------ text -- */

export function normalizeText(s) {
  return String(s)
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9%.<>=\- ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokens(s) {
  return normalizeText(s).split(" ").filter(Boolean);
}

/**
 * Turns a CSV header into the words a person would say.
 *
 *   "out:Avg Solar Rad. (kWh/m2)" -> "avg solar rad"
 *   "in:ZoneRed Area"            -> "zone red area"
 *   "out:Site_Cvr%"              -> "site cvr"
 *   "in:Layer "                  -> "layer"
 *
 * Units in brackets are dropped, not kept: nobody says "heating kwh".
 */
export function normalizeColumn(name) {
  let s = String(name).trim();
  s = s.replace(/^(in|out)\s*:\s*/i, "");
  s = s.replace(/\([^)]*\)/g, " ").replace(/\[[^\]]*\]/g, " ");
  s = s.replace(/([a-z0-9])([A-Z])/g, "$1 $2"); // camelCase
  s = s.replace(/[_/\\]+/g, " ");
  s = s.replace(/%/g, " ");
  s = s.replace(/[^A-Za-z0-9 ]+/g, " ");
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/* -------------------------------------------------------------- aliases -- */

/**
 * Domain vocabulary. `surface` is what a person might say; `target` names the
 * normalised columns it stands for, matched whole or as a trailing word.
 *
 * This table is unavoidable. No off-the-shelf embedding model has a useful
 * vector for SVF, FSR, Site_Cvr% or A/V ratio, and those abbreviations carry
 * most of the entity difficulty in these datasets.
 */
export const ALIAS_GROUPS = [
  // --- daylight, deliberately kept apart from one another -------------------
  { surface: ["sky view factor", "skyview factor"], target: ["svf"] },
  { surface: ["daylight autonomy"], target: ["da"] },
  { surface: ["continuous daylight autonomy"], target: ["cda"] },
  { surface: ["spatial daylight autonomy"], target: ["sda", "s da"] },
  { surface: ["useful daylight illuminance"], target: ["udi"] },
  { surface: ["daylight", "daylit"], target: ["sda", "s da", "da"] },
  // --- planning ratios ------------------------------------------------------
  { surface: ["floor area ratio"], target: ["far"] },
  { surface: ["floor space ratio"], target: ["fsr"] },
  { surface: ["window to wall ratio", "window wall ratio"], target: ["wwr"] },
  { surface: ["shading"], target: ["shd"] },
  { surface: ["area to volume ratio", "area volume ratio"], target: ["a v ratio"] },
  { surface: ["site coverage"], target: ["site cvr"] },
  { surface: ["max height", "maximum height"], target: ["max h"] },
  { surface: ["effective depth"], target: ["eff depth"] },
  { surface: ["hours", "hrs"], target: ["sunshine hrs", "sunshine rs"] },
  // --- money ----------------------------------------------------------------
  {
    surface: ["cost", "price", "cheap", "cheaper", "cheapest", "expensive", "pricey", "costly"],
    target: ["cost", "price", "facade cost"],
  },
  // --- used cars ------------------------------------------------------------
  { surface: ["mileage", "miles", "millage", "milage", "odometer"], target: ["odometer"] },
  { surface: ["make", "brand"], target: ["manufacturer"] },
  { surface: ["newest", "newer", "new", "oldest", "older", "age"], target: ["year"] },
  // --- geometry -------------------------------------------------------------
  { surface: ["planar", "flat", "flatter", "flattest", "curved", "curvier"], target: ["percent planar"] },
  { surface: ["room depth", "depth"], target: ["depth"] },
  { surface: ["glazing", "glass"], target: ["glazing"] },
  { surface: ["timber", "wood"], target: ["timber structure use"] },
  { surface: ["parking"], target: ["parking area"] },
  { surface: ["sunshine", "sun", "sunlight"], target: ["sunshine rs", "sunshine hrs"] },
  { surface: ["surface view"], target: ["surface view"] },
  { surface: ["isovist"], target: ["isovist gp"] },
  { surface: ["panels", "panel"], target: ["num panels"] },
  { surface: ["solar radiation", "solar rad"], target: ["avg solar rad"] },
  { surface: ["deviation", "closest", "close"], target: ["floor area deviation"] },
];

function aliasMatchesColumn(target, norm) {
  if (norm === target) return true;
  let parts = norm.split(" ");
  return parts[parts.length - 1] === target || parts.includes(target);
}

/* ---------------------------------------------------------------- index -- */

/** One searchable entry per column: its own words plus every alias phrase. */
export function buildColumnIndex(dataset) {
  let columns = DATASETS[dataset] || [];
  // Images, geometry and raw urls are never what a question is about.
  let skip = ["img", "images", "image", "image_url", "threed", "json", "url", "region_url", "_id", "lat", "long"];
  return columns
    .filter((c) => !skip.includes(String(c).trim().toLowerCase()))
    .map((column) => {
      let norm = normalizeColumn(column);
      let phrases = [norm];
      ALIAS_GROUPS.forEach((group) => {
        if (group.target.some((t) => aliasMatchesColumn(t, norm))) {
          group.surface.forEach((s) => phrases.push(normalizeText(s)));
        }
      });
      // camelCase splitting turns "sDa" into "s da", which nobody types.
      // Index the unsplit spelling alongside it.
      let joined = String(column)
        .replace(/^(in|out)\s*:\s*/i, "")
        .replace(/\([^)]*\)/g, "")
        .replace(/\[[^\]]*\]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "");
      if (joined && joined !== norm.split(" ").join("")) phrases.push(joined);
      if (joined) phrases.push(joined);
      phrases = Array.from(new Set(phrases)).filter(Boolean);
      return {
        column,
        norm,
        tokens: norm.split(" ").filter(Boolean),
        phrases: phrases.map((p) => p.split(" ").filter(Boolean)),
      };
    });
}

function containsRun(haystack, needle) {
  if (needle.length === 0 || needle.length > haystack.length) return false;
  for (let i = 0; i + needle.length <= haystack.length; i++) {
    let ok = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

function trigrams(s) {
  let padded = "  " + s + "  ";
  let out = new Set();
  for (let i = 0; i + 3 <= padded.length; i++) out.add(padded.slice(i, i + 3));
  return out;
}

function dice(a, b) {
  let shared = 0;
  a.forEach((g) => b.has(g) && shared++);
  return (2 * shared) / (a.size + b.size);
}

/**
 * Which column an utterance is about.
 *
 * Returns `{ column, score, ambiguous }`. `ambiguous` lists the columns that a
 * person could equally have meant, and it is not a failure: a question is a
 * better answer than a confident guess, because a wrong column applied
 * silently is the one mistake the filter chips cannot make cheap.
 */
export function resolveColumn(index, utteranceTokens, options) {
  let exclude = (options && options.exclude) || [];
  let pool = index.filter((e) => !exclude.includes(e.column));
  let scored = [];

  for (let entry of pool) {
    let best = 0;
    let matched = null;
    // A longer phrase is a more specific claim: "spatial daylight autonomy"
    // must beat "daylight autonomy" on the same words.
    for (let phrase of entry.phrases) {
      if (containsRun(utteranceTokens, phrase)) {
        let score = 100 + phrase.length * 10;
        if (score > best) { best = score; matched = phrase; }
      }
    }
    if (best === 0) {
      let overlap = entry.tokens.filter((t) => utteranceTokens.includes(t)).length;
      if (overlap > 0) best = 30 + overlap * 10;
    }
    if (best === 0) {
      // Typos: compare the column against every window of the same length.
      let target = trigrams(entry.norm);
      for (let n = 1; n <= Math.min(3, utteranceTokens.length); n++) {
        for (let i = 0; i + n <= utteranceTokens.length; i++) {
          let window = utteranceTokens.slice(i, i + n).join(" ");
          if (Math.abs(window.length - entry.norm.length) > 4) continue;
          let d = dice(trigrams(window), target);
          if (d > 0.62) best = Math.max(best, 20 + d * 20);
        }
      }
    }
    if (best > 0) scored.push({ entry: entry, score: best, matched: matched });
  }

  if (scored.length === 0) return { column: null, score: 0, ambiguous: [] };
  scored.sort((a, b) => b.score - a.score);
  let top = scored[0];
  let tied = scored.filter((s) => s.score === top.score);

  // A phrase that is a proper part of another column's name did not pick one
  // column, it picked a family: "floor area" against "floor area small".
  let exactName = top.matched && top.matched.join(" ") === top.entry.norm;
  if (tied.length === 1 && top.matched && !exactName) {
    let broader = pool.filter(
      (e) =>
        e.column !== top.entry.column &&
        e.phrases.some((p) => p.length > top.matched.length && containsRun(p, top.matched))
    );
    if (broader.length > 0) {
      tied = [top].concat(broader.map((e) => ({ entry: e, score: top.score })));
    }
  }

  if (tied.length > 1) {
    return {
      column: top.entry.column,
      score: top.score,
      ambiguous: tied.map((t) => t.entry.column),
    };
  }
  return { column: top.entry.column, score: top.score, ambiguous: [] };
}

/* --------------------------------------------------------------- values -- */

export const COMPARATORS = [
  { words: ["between"], op: "between" },
  { words: ["at least", "no less than", "not less than", "minimum of", "or more", ">=", ">"], op: "gte" },
  { words: ["at most", "no more than", "not more than", "maximum of", "or less", "<=", "<"], op: "lte" },
  { words: ["above", "over", "greater than", "more than", "higher than", "bigger than", "larger than", "newer than", "taller than", "exceeds"], op: "gte" },
  { words: ["below", "under", "less than", "lower than", "smaller than", "cheaper than", "older than", "beneath"], op: "lte" },
  { words: ["equal to", "equals", "is exactly", "exactly", "="], op: "eq" },
];

export const MAX_WORDS = ["most", "highest", "largest", "biggest", "best", "top", "maximum", "max", "greatest", "newest", "flattest", "widest"];
export const MIN_WORDS = ["least", "lowest", "smallest", "cheapest", "minimum", "min", "bottom", "fewest", "oldest", "closest"];

const SCALES = { k: 1e3, grand: 1e3, thousand: 1e3, m: 1e6, million: 1e6, b: 1e9, billion: 1e9 };

/**
 * Every number in an utterance, with its scale applied and percentages
 * flagged. "under 15k" is 15000; "the cheapest 10%" is 10, percent.
 */
export function parseNumbers(utterance) {
  let text = normalizeText(utterance);
  let out = [];
  let re = /(-?\d+(?:\.\d+)?)\s*(k|m|b|grand|thousand|million|billion|%|percent)?(?![a-z])/gi;
  let match;
  while ((match = re.exec(text)) !== null) {
    let value = parseFloat(match[1]);
    let unit = match[2];
    let percent = unit === "%" || unit === "percent";
    if (unit && SCALES[unit]) value *= SCALES[unit];
    out.push({ value: value, percent: percent, index: match.index, raw: match[0].trim() });
  }
  return out;
}

/** The comparator an utterance uses, longest phrase first so "at least" beats "least". */
export function findComparator(utterance) {
  let text = " " + normalizeText(utterance) + " ";
  let best = null;
  COMPARATORS.forEach((entry) => {
    entry.words.forEach((word) => {
      let at = text.indexOf(" " + word + " ");
      if (at < 0 && (word === ">" || word === "<" || word === ">=" || word === "<=" || word === "=")) {
        at = text.indexOf(word);
      }
      if (at >= 0 && (best === null || word.length > best.word.length)) {
        best = { op: entry.op, word: word, index: at };
      }
    });
  });
  return best;
}

export function findDirection(utterance) {
  let t = tokens(utterance);
  if (t.some((w) => MIN_WORDS.includes(w))) return "min";
  if (t.some((w) => MAX_WORDS.includes(w))) return "max";
  return null;
}
