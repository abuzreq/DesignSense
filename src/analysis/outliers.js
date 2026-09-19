/*
 * Options whose values stand far outside the rest of their dimension, as the
 * analysis dialog flags them before a front or a correlation leans on them.
 *
 * Each dimension is judged on its own, by Tukey's "far out" fences: below the
 * lower quartile, or above the upper, by more than three interquartile
 * ranges. Quartiles, unlike an average and standard deviation, aren't pulled
 * along by the very values being judged.
 *
 * Kept free of imports beyond sensitivity.js, like summary.js, so a plain
 * Node script can check the arithmetic.
 */

import { FEW_VALUES } from "./sensitivity.js";

// How many interquartile ranges past a quartile a value must be.
export const FAR_OUT = 3;
// Fewer values than this, and the quartiles themselves are guesses.
export const MIN_VALUES = 10;

// A blank is missing, not zero, though Number("") is 0.
function defaultIsMissing(dim, value) {
  return value === "" || value === null || value === undefined || !isFinite(Number(value));
}

/** The value a fraction `p` of the way through sorted `values`, between neighbours. */
function quantile(sorted, p) {
  let at = (sorted.length - 1) * p;
  let below = Math.floor(at);
  let above = Math.ceil(at);
  return sorted[below] + (sorted[above] - sorted[below]) * (at - below);
}

/** `[q1, q3]` of numbers sorted ascending. */
export function quartiles(sorted) {
  return [quantile(sorted, 0.25), quantile(sorted, 0.75)];
}

/**
 * `{ ids, byDim, byId }` for the options far out on any of `dims`:
 *   ids    a Set of their ids;
 *   byDim  `{ dim: { fences: [lo, hi], low: [ids], high: [ids] } }` for each
 *          dimension with any, lowest and highest first;
 *   byId   `{ id: [{ dim, value, side }] }`, side "low" or "high".
 *
 * A dimension is passed over when it can't be judged this way: fewer than
 * MIN_VALUES values, no more than FEW_VALUES distinct ones (a sweep's
 * levels), or half its values or more alike, so its quartiles meet.
 */
export function findOutliers(rows, dims, options) {
  let isMissing = (options && options.isMissing) || defaultIsMissing;
  let result = { ids: new Set(), byDim: {}, byId: {} };
  dims.forEach(function(dim) {
    let entries = [];
    let distinct = new Set();
    rows.forEach(function(row) {
      let value = row[dim];
      if (isMissing(dim, value)) return;
      value = Number(value);
      entries.push({ id: row._id, value: value });
      if (distinct.size <= FEW_VALUES) distinct.add(value);
    });
    if (entries.length < MIN_VALUES || distinct.size <= FEW_VALUES) return;
    let sorted = entries.map((entry) => entry.value).sort((a, b) => a - b);
    let [q1, q3] = quartiles(sorted);
    let spread = q3 - q1;
    if (!(spread > 0)) return;
    let fences = [q1 - FAR_OUT * spread, q3 + FAR_OUT * spread];
    let low = entries.filter((entry) => entry.value < fences[0]);
    let high = entries.filter((entry) => entry.value > fences[1]);
    if (low.length === 0 && high.length === 0) return;
    low.sort((a, b) => a.value - b.value);
    high.sort((a, b) => b.value - a.value);
    result.byDim[dim] = {
      fences: fences,
      low: low.map((entry) => entry.id),
      high: high.map((entry) => entry.id),
    };
    [
      [low, "low"],
      [high, "high"],
    ].forEach(function(pair) {
      pair[0].forEach(function(entry) {
        result.ids.add(entry.id);
        (result.byId[entry.id] = result.byId[entry.id] || []).push({
          dim: dim,
          value: entry.value,
          side: pair[1],
        });
      });
    });
  });
  return result;
}
