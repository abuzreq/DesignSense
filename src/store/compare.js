/*
 * What the compare view and the gallery's details agree on: which columns are
 * the app's own rather than the collection's, and how a row of values across
 * several options reads. Kept free of imports so a plain Node script can test
 * it.
 */

/** Columns the app added or that hold assets, never shown as dimensions. */
export const DETAIL_BLACKLIST = [
  "index",
  "selected",
  "gltf",
  "image",
  "ID",
  "id",
  "_id",
  "geometry",
  "json",
  "img",
  "threeD",
  "collection",
  "images",
  "description",
  // Shown as stars rather than as a number.
  "Rating",
  // Added for every row and never filled in by the app.
  "Tags",
];

// Columns holding an address rather than a value: pictures, 3D files, links.
// Names alone settle the plain cases; anything that could also be a real
// measurement ("3d_printer_cost") has to look like an address as well.
const LINK_NAME = /(^|[^a-z])(url|href|img|image|images|photo|thumb|thumbnail|model3d|model_3d|threed|gltf|glb)([^a-z]|$)/i;
const LINK_VALUE = /^(https?:|data:|blob:|\/\/)|\.(png|jpe?g|gif|webp|svg|bmp|glb|gltf|obj|3dm)(\?|#|$)/i;

/**
 * Whether a column holds addresses. The compare view shows the picture itself,
 * so repeating its URL as a row costs a line and says nothing.
 */
export function isLinkColumn(name, values) {
  let seen = 0;
  let links = 0;
  let numbers = 0;
  (values || []).forEach(function(value) {
    if (typeof value === "number" && isFinite(value)) {
      numbers += 1;
      return;
    }
    if (typeof value !== "string" || value === "") return;
    seen += 1;
    if (LINK_VALUE.test(value.trim())) links += 1;
  });
  // A column of numbers is data, whatever it is called.
  if (numbers > 0) return false;
  if (LINK_NAME.test(String(name))) return true;
  return seen > 0 && links === seen;
}

/** More columns than this and the values stop being comparable at a glance. */
export const COMPARE_LIMIT = 8;

/**
 * How one dimension reads across the compared options: whether the values are
 * numbers, whether they all agree (so the row can be dimmed or hidden), and
 * which option holds the highest and the lowest.
 */
export function rowSummary(values) {
  let list = Array.isArray(values) ? values : [];
  let numeric = list.length > 0;
  let allEqual = true;
  let maxIndex = -1;
  let minIndex = -1;
  for (let i = 0; i < list.length; i++) {
    let value = list[i];
    if (typeof value !== "number" || !isFinite(value)) {
      numeric = false;
    } else {
      if (maxIndex === -1 || value > list[maxIndex]) maxIndex = i;
      if (minIndex === -1 || value < list[minIndex]) minIndex = i;
    }
    if (i > 0 && !sameValue(list[i - 1], value)) allEqual = false;
  }
  // Marking a high and a low only says something when they differ.
  if (!numeric || allEqual) {
    maxIndex = -1;
    minIndex = -1;
  }
  return {
    numeric: numeric,
    allEqual: allEqual,
    maxIndex: maxIndex,
    minIndex: minIndex,
  };
}

function sameValue(a, b) {
  if (a === b) return true;
  // Missing values are shown alike, so two of them count as agreeing.
  let aMissing = a === null || a === undefined || a === "";
  let bMissing = b === null || b === undefined || b === "";
  return aMissing && bMissing;
}

/** Whether a cell has nothing to order by: blank, or a number that isn't one. */
export function isMissingValue(value) {
  if (value === null || value === undefined || value === "") return true;
  return typeof value === "number" && !isFinite(value);
}

/**
 * Orders two values of one dimension: numbers by size, text by text, and
 * digits inside text by their number, so "opt_2" sorts before "opt_10".
 * Missing values are not ordered here -- the caller keeps them last whichever
 * way the sort runs, since "no value" is not smaller than every value.
 */
export function compareValues(a, b) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}
