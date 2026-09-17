/**
 * Custom and weighted dimensions: the criteria a user adds to a collection to
 * compare its options by the weighted-sum method.
 *
 *   { name: "custom:performance", kind: "custom", bounds: [0, 10] }
 *   { name: "weighted:score", kind: "weighted",
 *     terms: [{ dim: "custom:performance", weight: 1, lowerIsBetter: false },
 *             { dim: "price", weight: 0.5, lowerIsBetter: true }] }
 *
 * A custom dimension holds values the user enters, one per option, within its
 * bounds. A weighted dimension is a weighted average of other dimensions, each
 * first scaled to 0-1 by its bounds (and flipped when lower is better), so its
 * value always lies in 0-1. Neither can be filtered by: a value the user is
 * still deciding on would silently move options in and out of the result.
 *
 * Names carry the column prefix of their kind (see columns.js), so a file
 * saved with these dimensions loads back with them. A data file can bring its
 * own: its "custom:" columns load as custom dimensions holding the file's
 * values, and its "weighted:" columns as weighted dimensions whose weights
 * are unknown, holding the file's values until weights are given. Such a
 * dimension is marked `fromFile`; a weighted one without weights keeps the
 * range of its values as `bounds`.
 *
 * Values live on the rows under the dimension's name; `undefined` means no
 * value yet. They persist per dataset in localStorage as
 *   { version: 2, dimensions: [...], values: { dim: { id: value } } }
 * where, for a dimension from the file, only values that differ from the
 * file's are kept, and null is a value the user cleared.
 */

import {
  CUSTOM,
  WEIGHTED,
  columnKind,
  displayName,
  prefixedName,
} from "./columns.js";

export { CUSTOM, WEIGHTED };
export const STORAGE_PREFIX = "designsense-dimensions-v1:";
export const DEFAULT_CUSTOM_BOUNDS = [0, 10];
export const WEIGHTED_BOUNDS = [0, 1];

const STORAGE_VERSION = 2;
const MAX_NAME_LENGTH = 40;
const RESERVED_NAMES = [
  "selected",
  "index",
  "constructor",
  "prototype",
  "__proto__",
  "hasownproperty",
  "tostring",
  "valueof",
];

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

export function isNumber(value) {
  return typeof value === "number" && isFinite(value);
}

function clamp(value, bounds) {
  return Math.max(bounds[0], Math.min(bounds[1], value));
}

/** A typed or dragged value as stored: blank or not a number is no value, anything else is clamped. */
export function cleanValue(raw, bounds) {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === "string" && raw.trim() === "") return undefined;
  let value = Number(raw);
  if (!isFinite(value)) return undefined;
  return bounds ? clamp(value, bounds) : value;
}

function decimalsOf(step) {
  return Math.max(0, -Math.floor(Math.log10(step)));
}

/** A round step giving about a hundred positions along the bounds: 0.1 for 0-10. */
export function stepFor(bounds) {
  let span = bounds ? bounds[1] - bounds[0] : 0;
  if (!(span > 0)) return 1;
  return Math.pow(10, Math.floor(Math.log10(span / 100)));
}

/** A dragged value, rounded to its dimension's step and kept within bounds. */
export function snapValue(value, bounds) {
  let step = stepFor(bounds);
  let snapped = Math.round((value - bounds[0]) / step) * step + bounds[0];
  return Number(clamp(snapped, bounds).toFixed(decimalsOf(step)));
}

/**
 * `preferred` when the values' `extent` fits in it; otherwise both together,
 * widened to round numbers: [0, 10] and values up to 37 give [0, 40].
 */
export function boundsAround(extent, preferred) {
  if (!extent) return preferred.slice();
  let lo = Math.min(preferred[0], extent[0]);
  let hi = Math.max(preferred[1], extent[1]);
  if (lo === preferred[0] && hi === preferred[1]) return preferred.slice();
  let step = Math.pow(10, Math.floor(Math.log10(hi - lo)));
  let decimals = decimalsOf(step);
  return [
    Number((Math.floor(lo / step) * step).toFixed(decimals)),
    Number((Math.ceil(hi / step) * step).toFixed(decimals)),
  ];
}

export function makeCustomDimension(name, bounds, fromFile) {
  let def = {
    name: name,
    kind: CUSTOM,
    bounds: [Number(bounds[0]), Number(bounds[1])],
  };
  if (fromFile) def.fromFile = true;
  return def;
}

function cleanTerm(term) {
  let weight = Number(term.weight);
  return {
    dim: String(term.dim),
    weight: isFinite(weight) && weight > 0 ? weight : 0,
    lowerIsBetter: !!term.lowerIsBetter,
  };
}

/** `options.fromFile` and `options.bounds` for a weighted dimension from the data file. */
export function makeWeightedDimension(name, terms, options) {
  let def = { name: name, kind: WEIGHTED, terms: terms.map(cleanTerm) };
  if (options && options.fromFile) {
    def.fromFile = true;
    if (options.bounds) {
      def.bounds = [Number(options.bounds[0]), Number(options.bounds[1])];
    }
  }
  return def;
}

export function isCustom(def) {
  return !!def && def.kind === CUSTOM;
}

export function isWeighted(def) {
  return !!def && def.kind === WEIGHTED;
}

/** A weighted dimension from the file with no weights given: its values are the file's. */
export function holdsFileValues(def) {
  return isWeighted(def) && def.terms.length === 0;
}

/** The range a dimension is drawn over and scaled by. */
export function fixedBounds(def) {
  if (isCustom(def)) return def.bounds.slice();
  if (holdsFileValues(def) && def.bounds) return def.bounds.slice();
  return WEIGHTED_BOUNDS.slice();
}

/**
 * `{ name }`, the name to show, with surrounding and repeated spaces removed,
 * or `{ error }`. `taken` lists the column names already in use, whose shown
 * names are compared ignoring case.
 */
export function validateName(raw, taken) {
  let name = String(raw === undefined || raw === null ? "" : raw)
    .trim()
    .replace(/\s+/g, " ");
  if (name === "") return { error: "Enter a name." };
  if (name.length > MAX_NAME_LENGTH) {
    return { error: "Use at most " + MAX_NAME_LENGTH + " characters." };
  }
  // Number-like names turn into numeric keys in the parallel coordinates.
  if (!isNaN(Number(name))) return { error: "A name can't be just a number." };
  if (/[|"\\]/.test(name)) {
    return { error: 'A name can\'t contain |, " or \\.' };
  }
  let lower = name.toLowerCase();
  if (RESERVED_NAMES.includes(lower)) {
    return { error: "\u201c" + name + "\u201d is reserved. Pick another name." };
  }
  if (
    (taken || []).some(
      (other) => displayName(other).toLowerCase() === lower
    )
  ) {
    return {
      error: "There's already a dimension called \u201c" + name + "\u201d.",
    };
  }
  return { name: name };
}

/** `{ bounds: [min, max] }` as numbers, or `{ error }`. */
export function validateBounds(bounds) {
  let min = cleanValue(bounds && bounds[0]);
  let max = cleanValue(bounds && bounds[1]);
  if (min === undefined || max === undefined) {
    return { error: "Enter a number for both the minimum and the maximum." };
  }
  if (!(min < max)) {
    return { error: "The minimum has to be less than the maximum." };
  }
  return { bounds: [min, max] };
}

/**
 * `{ terms }` cleaned, or `{ error }`. Every term names one of `candidates`,
 * at most once, and the weights add up to more than zero.
 */
export function validateTerms(terms, candidates) {
  let list = (terms || []).map(cleanTerm);
  if (list.length === 0) return { error: "Add at least one dimension." };
  let seen = new Set();
  for (let term of list) {
    if (!(candidates || []).includes(term.dim)) {
      return { error: "Pick a dimension for every row." };
    }
    if (seen.has(term.dim)) {
      return {
        error: "\u201c" + displayName(term.dim) + "\u201d is listed twice.",
      };
    }
    seen.add(term.dim);
  }
  if (!list.some((term) => term.weight > 0)) {
    return { error: "Give at least one dimension a weight above zero." };
  }
  return { terms: list };
}

/**
 * A value scaled to 0-1 by `bounds` and flipped when lower is better, or null
 * when either is unknown. A dimension whose bounds are one value scales to 0.5.
 */
export function normalize(value, bounds, lowerIsBetter) {
  if (!isNumber(value) || !bounds) return null;
  let span = bounds[1] - bounds[0];
  let scaled = span === 0 ? 0.5 : (value - bounds[0]) / span;
  scaled = Math.max(0, Math.min(1, scaled));
  return lowerIsBetter ? 1 - scaled : scaled;
}

/**
 * The weighted average of a row's scaled term values, or undefined when a
 * weighted term has no value. Terms weighted zero are left out entirely.
 * `boundsOf(dim)` gives the bounds a term scales by; `isMissing(dim, value)`
 * says whether a value counts as absent (an unrated option, say).
 */
export function weightedValue(row, def, boundsOf, isMissing) {
  let total = 0;
  let weights = 0;
  for (let term of def.terms) {
    if (!(term.weight > 0)) continue;
    let value = row[term.dim];
    if (isMissing(term.dim, value)) return undefined;
    let scaled = normalize(value, boundsOf(term.dim), term.lowerIsBetter);
    if (scaled === null) return undefined;
    total += term.weight * scaled;
    weights += term.weight;
  }
  return weights > 0 ? total / weights : undefined;
}

/** Each term's share of the total weight, 0-1, in term order. */
export function weightShares(terms) {
  let total = terms.reduce(
    (sum, term) => sum + (term.weight > 0 ? term.weight : 0),
    0
  );
  return terms.map((term) =>
    total > 0 && term.weight > 0 ? term.weight / total : 0
  );
}

/** The weighted dimensions that weigh `dim`. */
export function dependentsOf(defs, dim) {
  return defs.filter(
    (def) => isWeighted(def) && def.terms.some((term) => term.dim === dim)
  );
}

/**
 * The definitions without `name`: weighted dimensions that weighed it lose
 * that term, and one left with no terms goes too, unless it came from the
 * file, which then holds the file's values again. `removed` lists every
 * dimension that goes; `changed` the weighted ones that lost a term, as they
 * now are.
 */
export function withoutDimension(defs, name) {
  let removed = [name];
  let changed = [];
  let next = [];
  defs.forEach((def) => {
    if (def.name === name) return;
    if (isWeighted(def) && def.terms.some((term) => term.dim === name)) {
      let terms = def.terms.filter((term) => term.dim !== name);
      if (terms.length === 0 && !def.fromFile) {
        removed.push(def.name);
        return;
      }
      let kept = Object.assign({}, def, { terms: terms });
      changed.push(kept);
      next.push(kept);
      return;
    }
    next.push(def);
  });
  return { defs: next, removed: removed, changed: changed };
}

/** The dimensions a weighted dimension can weigh: numeric ones, but not weighted ones. */
export function termCandidates(numericDimensions, defs, selfName) {
  let weighted = new Set(defs.filter(isWeighted).map((def) => def.name));
  return numericDimensions.filter(
    (dim) =>
      !weighted.has(dim) && columnKind(dim) !== WEIGHTED && dim !== selfName
  );
}

/**
 * How many rows have a value: `{ complete, total, missingByDim }`, where
 * `missingByDim` counts, for a weighted dimension, the rows each weighted term
 * leaves without a value.
 */
export function coverage(rows, def, isMissing) {
  let missingByDim = {};
  let complete = 0;
  rows.forEach((row) => {
    if (isCustom(def) || holdsFileValues(def)) {
      if (isNumber(row[def.name])) complete += 1;
      return;
    }
    let whole = true;
    def.terms.forEach((term) => {
      if (!(term.weight > 0)) return;
      if (isMissing(term.dim, row[term.dim])) {
        missingByDim[term.dim] = (missingByDim[term.dim] || 0) + 1;
        whole = false;
      }
    });
    if (whole) complete += 1;
  });
  return { complete: complete, total: rows.length, missingByDim: missingByDim };
}

/** `{ dim: [min, max] }` over the rows' numeric values, or null for a dimension with none. */
export function numericExtents(rows, dims) {
  let extents = {};
  dims.forEach((dim) => {
    let min = Infinity;
    let max = -Infinity;
    rows.forEach((row) => {
      let value = row[dim];
      if (!isNumber(value)) return;
      if (value < min) min = value;
      if (value > max) max = value;
    });
    extents[dim] = min <= max ? [min, max] : null;
  });
  return extents;
}

/**
 * The dimensions a data file brings, from its "custom:" and "weighted:"
 * columns, drawn over a range that holds the file's values.
 */
export function fileDimensions(rows, columns) {
  let defs = [];
  columns.forEach((column) => {
    let kind = columnKind(column);
    if (kind !== CUSTOM && kind !== WEIGHTED) return;
    let extent = numericExtents(rows, [column])[column];
    defs.push(
      kind === CUSTOM
        ? makeCustomDimension(
            column,
            boundsAround(extent, DEFAULT_CUSTOM_BOUNDS),
            true
          )
        : makeWeightedDimension(column, [], {
            fromFile: true,
            bounds: boundsAround(extent, WEIGHTED_BOUNDS),
          })
    );
  });
  return defs;
}

/** `{ dim: { id: value } }`: the numbers these dimensions hold on the rows. */
function valuesOn(rows, defs) {
  let values = {};
  defs.forEach((def) => {
    let own = {};
    rows.forEach((row) => {
      if (isNumber(row[def.name])) own[row._id] = row[def.name];
    });
    values[def.name] = own;
  });
  return values;
}

/**
 * Sets up the dimensions of freshly loaded rows, before anything observes
 * them: those the file's columns bring, changed as saved, then those saved
 * for this dataset. Every row gets a key per dimension (undefined for no
 * value) and weighted dimensions are computed.
 *
 * `file` keeps the file's own dimensions and values as loaded, to tell what
 * the user changed and to restore on reset.
 *
 * A saved dimension whose name the data now uses for another column, or whose
 * definition no longer holds, is skipped rather than lost; so are values for
 * rows the data no longer has. Both come back in `skipped` and `orphanValues`
 * so the next save writes them again.
 *
 * `numericColumns` are the data's numeric columns a weighted dimension may
 * weigh. `boundsFor(defs)` returns the `boundsOf(dim)` weights scale by.
 */
export function loadDefinitions(options) {
  let rows = options.rows;
  let stored = options.stored;
  let columns = options.columns || [];
  let numericColumns = options.numericColumns || [];

  let fromFile = fileDimensions(rows, columns);
  let result = {
    defs: [],
    file: { defs: fromFile, values: valuesOn(rows, fromFile) },
    skipped: { defs: [], values: {} },
    orphanValues: {},
  };
  // The file's dimensions, as the saved changes leave them.
  let current = new Map(fromFile.map((def) => [def.name, def]));
  let savedDims =
    stored && Array.isArray(stored.dimensions) ? stored.dimensions : [];
  let values = (stored && stored.values) || {};
  let taken = new Set(columns.map((column) => column.toLowerCase()));
  let added = [];
  let skip = (def) => {
    result.skipped.defs.push(def);
    if (hasOwn(values, def.name)) {
      result.skipped.values[def.name] = values[def.name];
    }
  };
  // A saved name must be one this kind of dimension could have been given.
  let isValidName = (def) => {
    let label = displayName(def.name);
    let check = validateName(label, []);
    return (
      columnKind(def.name) === def.kind &&
      !check.error &&
      check.name === label &&
      !taken.has(def.name.toLowerCase())
    );
  };

  savedDims.forEach((def) => {
    if (!isCustom(def)) return;
    let bounds = validateBounds(def.bounds);
    let own = current.get(def.name);
    if (own) {
      if (!isCustom(own) || bounds.error) return skip(def);
      // The saved range, stretched over the file's values.
      let extent = numericExtents(rows, [def.name])[def.name];
      current.set(
        def.name,
        makeCustomDimension(def.name, boundsAround(extent, bounds.bounds), true)
      );
      return;
    }
    if (bounds.error || !isValidName(def)) return skip(def);
    taken.add(def.name.toLowerCase());
    added.push(makeCustomDimension(def.name, bounds.bounds));
  });

  let weighable = new Set(
    numericColumns
      .filter((dim) => columnKind(dim) !== WEIGHTED)
      .concat(added.map((def) => def.name))
  );
  savedDims.forEach((def) => {
    if (!isWeighted(def)) return;
    let terms = (def.terms || []).filter(
      (term) => term && weighable.has(term.dim)
    );
    let own = current.get(def.name);
    if (own) {
      if (!isWeighted(own)) return skip(def);
      // Weights that no longer hold leave the file's values in place.
      if (terms.length > 0) {
        current.set(
          def.name,
          makeWeightedDimension(def.name, terms, {
            fromFile: true,
            bounds: own.bounds,
          })
        );
      }
      return;
    }
    if (terms.length === 0 || !isValidName(def)) return skip(def);
    taken.add(def.name.toLowerCase());
    added.push(makeWeightedDimension(def.name, terms));
  });

  let order = savedDims.map((def) => def && def.name);
  added.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
  let defs = fromFile.map((def) => current.get(def.name)).concat(added);

  let ids = new Set(rows.map((row) => String(row._id)));
  defs.filter(isCustom).forEach((def) => {
    let own = hasOwn(values, def.name) ? values[def.name] || {} : {};
    rows.forEach((row) => {
      // The file's values stand unless the user changed them.
      if (!def.fromFile || hasOwn(own, row._id)) {
        row[def.name] = hasOwn(own, row._id)
          ? cleanValue(own[row._id], def.bounds)
          : undefined;
      }
    });
    let orphans = {};
    Object.keys(own).forEach((id) => {
      if (!ids.has(id)) orphans[id] = own[id];
    });
    if (Object.keys(orphans).length > 0) result.orphanValues[def.name] = orphans;
  });
  let boundsOf = options.boundsFor(defs);
  defs
    .filter((def) => isWeighted(def) && !holdsFileValues(def))
    .forEach((def) => {
      rows.forEach((row) => {
        row[def.name] = weightedValue(row, def, boundsOf, options.isMissing);
      });
    });
  result.defs = defs;
  return result;
}

/** cyrb53: a fast 53-bit string hash, as base 36. Not for security. */
export function hash53(text, seed) {
  let h1 = 0xdeadbeef ^ (seed || 0);
  let h2 = 0x41c6ce57 ^ (seed || 0);
  for (let i = 0; i < text.length; i++) {
    let ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * What identifies a dataset across visits: its link when it has one, since the
 * data behind a link may gain rows; otherwise (a local file) its file name,
 * columns and row IDs. Null when there is nothing to go by.
 */
export function datasetKey(source) {
  if (!source) return null;
  if (source.link) return "url:" + hash53(String(source.link));
  let ids = source.ids || [];
  if (ids.length === 0) return null;
  return (
    "file:" +
    hash53(
      [
        source.name || "",
        (source.fields || []).join("\u001f"),
        ids.join("\u001f"),
      ].join("\u001e")
    )
  );
}

function plainDefinition(def) {
  return isCustom(def)
    ? makeCustomDimension(def.name, def.bounds)
    : makeWeightedDimension(def.name, def.terms);
}

function sameBounds(a, b) {
  return !!a && !!b && a[0] === b[0] && a[1] === b[1];
}

/**
 * What to store: the definitions and the custom values, keyed by row ID. For
 * a dimension from the file, only what the user changed: its range, its
 * weights, and values that differ from the file's (null for one cleared).
 * `file` is `loadDefinitions`' record of the file's own; `preserved` holds
 * what loading skipped (`{ defs, values }`), written back so that a dataset
 * that changed for a while doesn't lose them.
 */
export function serializeDimensions(defs, rows, preserved, file) {
  let kept = preserved || { defs: [], values: {} };
  let keptValues = kept.values || {};
  let fileDefs = (file && file.defs) || [];
  let fileValues = (file && file.values) || {};
  let values = {};
  let dimensions = [];
  defs.forEach((def) => {
    let own = Object.assign({}, keptValues[def.name]);
    if (isCustom(def) && def.fromFile) {
      let original = fileValues[def.name] || {};
      rows.forEach((row) => {
        let value = isNumber(row[def.name]) ? row[def.name] : null;
        let before = hasOwn(original, row._id) ? original[row._id] : null;
        if (value !== before) own[row._id] = value;
        else delete own[row._id];
      });
    } else if (isCustom(def)) {
      rows.forEach((row) => {
        if (isNumber(row[def.name])) own[row._id] = row[def.name];
        else delete own[row._id];
      });
    }
    if (Object.keys(own).length > 0) values[def.name] = own;

    if (def.fromFile) {
      let loaded = fileDefs.find((d) => d.name === def.name);
      let changed = isCustom(def)
        ? hasOwn(values, def.name) ||
          !loaded ||
          !sameBounds(def.bounds, loaded.bounds)
        : def.terms.length > 0;
      if (!changed) return;
    }
    dimensions.push(plainDefinition(def));
  });
  let names = new Set(defs.map((def) => def.name));
  let skippedDefs = (kept.defs || []).filter((def) => !names.has(def.name));
  skippedDefs.forEach((def) => {
    if (hasOwn(keptValues, def.name)) values[def.name] = keptValues[def.name];
  });
  return {
    version: STORAGE_VERSION,
    dimensions: dimensions.concat(skippedDefs),
    values: values,
  };
}

function isStoredDefinition(def) {
  if (!def || typeof def.name !== "string") return false;
  if (def.kind === CUSTOM) {
    return (
      Array.isArray(def.bounds) &&
      def.bounds.length === 2 &&
      def.bounds.every(isNumber)
    );
  }
  if (def.kind === WEIGHTED) {
    return (
      Array.isArray(def.terms) &&
      def.terms.every(
        (term) => term && typeof term.dim === "string" && isNumber(term.weight)
      )
    );
  }
  return false;
}

/**
 * Version 1 named dimensions without a prefix and called weighted ones
 * "compound": { name: "score", kind: "compound", terms: [...] }.
 */
function upgradeFromVersion1(parsed) {
  let renamed = new Map();
  let dimensions = parsed.dimensions.map((def) => {
    if (!def || typeof def.name !== "string") return def;
    let kind = def.kind === "compound" ? WEIGHTED : def.kind;
    if (kind !== CUSTOM && kind !== WEIGHTED) return def;
    let name = prefixedName(kind, def.name);
    renamed.set(def.name, name);
    return Object.assign({}, def, { name: name, kind: kind });
  });
  dimensions = dimensions.map((def) =>
    def && Array.isArray(def.terms)
      ? Object.assign({}, def, {
          terms: def.terms.map((term) =>
            term && renamed.has(term.dim)
              ? Object.assign({}, term, { dim: renamed.get(term.dim) })
              : term
          ),
        })
      : def
  );
  let values = {};
  Object.keys(parsed.values).forEach((name) => {
    values[renamed.has(name) ? renamed.get(name) : name] = parsed.values[name];
  });
  return { dimensions: dimensions, values: values };
}

/** The stored object, or null when the text is missing, malformed or from an unknown version. */
export function parseStoredDimensions(text) {
  if (typeof text !== "string" || text === "") return null;
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return null;
  }
  if (!parsed || (parsed.version !== 1 && parsed.version !== STORAGE_VERSION)) {
    return null;
  }
  if (!Array.isArray(parsed.dimensions)) return null;
  let values =
    parsed.values && typeof parsed.values === "object" ? parsed.values : {};
  let current =
    parsed.version === 1
      ? upgradeFromVersion1({ dimensions: parsed.dimensions, values: values })
      : { dimensions: parsed.dimensions, values: values };
  return {
    version: STORAGE_VERSION,
    dimensions: current.dimensions.filter(isStoredDefinition),
    values: current.values,
  };
}

export function readStored(storage, key) {
  if (!storage || !key) return null;
  try {
    return storage.getItem(key);
  } catch (e) {
    return null;
  }
}

/** Null when saved; otherwise a message saying why it wasn't. */
export function writeStored(storage, key, payload) {
  if (!storage || !key) return null;
  try {
    storage.setItem(key, JSON.stringify(payload));
    return null;
  } catch (e) {
    return (
      "Custom dimensions couldn't be saved in this browser" +
      (e && e.message ? " (" + e.message + ")" : "") +
      ". They stay until the page is reloaded."
    );
  }
}

export function removeStored(storage, key) {
  if (!storage || !key) return;
  try {
    storage.removeItem(key);
  } catch (e) {
    /* nothing to remove */
  }
}
