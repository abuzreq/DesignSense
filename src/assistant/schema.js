/**
 * The parser's view of whatever CSV is loaded.
 *
 * In the evaluation the schema was a frozen list of headers. Here it is built
 * from the store, which means two things the eval could not have: the column
 * list is the user's own, and the category values are read from the rows
 * rather than written down in advance.
 */

import { buildColumnIndex } from "./lexicon.js";
import { isAssetColumn } from "../data/assets.js";
import { goalFor, goalSourceFor } from "../store/goals.js";

/**
 * Columns a question is never about. Pictures and models are left to
 * isAssetColumn, which also covers "img_2"; a "model" column holding car
 * models is not one of them, so the assistant can still talk about it.
 */
const SKIP = ["_id", "image_url", "url", "region_url", "lat", "long"];

function isSkipped(column) {
  return (
    SKIP.includes(String(column).trim().toLowerCase()) || isAssetColumn(column)
  );
}

/** Above this many distinct values a column is free text, not a category. */
const MAX_CATEGORIES = 60;
/** Values longer than this are descriptions, not labels. */
const MAX_VALUE_LENGTH = 24;

let cached = null;
let cachedSignature = "";

function signature(state) {
  return (
    state.allDimensions.join("|") +
    "#" +
    (state.data ? state.data.length : 0) +
    "#" +
    unfilterableOf(state).join("|") +
    "#" +
    JSON.stringify(state.goalChoices || {})
  );
}

/** Custom and weighted dimensions: numeric, but never filtered by. */
function unfilterableOf(state) {
  return (state.customDimensions || []).map((def) => def.name);
}

/** `{ dim: "max" | "min" }` for the columns that have a goal (see store/goals.js). */
function goalsOf(state, numeric) {
  let goals = {};
  numeric.forEach((dim) => {
    let goal = goalFor(dim, state.goalChoices);
    if (goal) goals[dim] = goal;
  });
  return goals;
}

/** Distinct values of each non-numeric column, for "only toyotas". */
function categoryValues(data, dimensions) {
  let values = {};
  dimensions.forEach((dim) => {
    let seen = new Set();
    for (let row of data) {
      let value = row[dim];
      if (value === undefined || value === null) continue;
      value = String(value).trim().toLowerCase();
      if (value === "" || value.length > MAX_VALUE_LENGTH) continue;
      seen.add(value);
      if (seen.size > MAX_CATEGORIES) return; // free text; not a category column
    }
    if (seen.size > 0) values[dim] = Array.from(seen);
  });
  return values;
}

/**
 * `{ index, values, columns, numeric, unfilterable, goals, goalDims }`,
 * rebuilt only when the data or the goals change. `goals` is `{ dim: "max" |
 * "min" }` for every numeric column with one; `goalDims` those the user or
 * the file set, which "best trade-offs" uses when it names no columns.
 */
export function buildSchema(state) {
  let current = signature(state);
  if (cached && cachedSignature === current) return cached;

  let columns = state.allDimensions.filter((c) => !isSkipped(c));
  let numeric = state.numericDimensions.filter((c) => columns.includes(c));
  let categorical = columns.filter((c) => !numeric.includes(c));

  cached = {
    columns: columns,
    numeric: numeric,
    unfilterable: unfilterableOf(state).filter((c) => columns.includes(c)),
    goals: goalsOf(state, numeric),
    goalDims: numeric.filter((c) => {
      let source = goalSourceFor(c, state.goalChoices);
      return (
        (source === "user" || source === "file") &&
        goalFor(c, state.goalChoices) !== null
      );
    }),
    index: buildColumnIndex(columns),
    values: categoryValues(state.data || [], categorical),
  };
  cachedSignature = current;
  return cached;
}
