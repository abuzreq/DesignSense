/*
 * Each dimension on its own: its average, its standard deviation and the
 * shape of its values, as the analysis dialog shows above the sensitivity
 * reading.
 *
 * Kept free of imports, like sensitivity.js, so a plain Node script can check
 * the arithmetic.
 */

// Bars in a histogram of a measured dimension.
export const BINS = 16;
// A dimension of whole numbers spanning no more values than this gets a bar
// per value: equal-width bins over "1 to 20 floors" would put two values in
// some bars and one in others, and draw a comb that isn't in the data.
const MAX_VALUE_BARS = 32;

// A blank is missing, not zero, though Number("") is 0.
function defaultIsMissing(dim, value) {
  return value === "" || value === null || value === undefined || !isFinite(Number(value));
}

/**
 * `{ dim, n, missing, mean, std, min, max, lo, hi, bins, peak }` for each
 * dimension. `std` is the sample standard deviation (n - 1); `bins` count the
 * values in equal slices of [lo, hi], which for whole numbers are centred on
 * each value, and `peak` is the largest count.
 * A dimension with no values has n 0 and nothing else.
 */
export function summarize(rows, dims, options) {
  let isMissing = (options && options.isMissing) || defaultIsMissing;
  return dims.map(function(dim) {
    return summarizeOne(rows, dim, isMissing);
  });
}

function summarizeOne(rows, dim, isMissing) {
  let values = new Float64Array(rows.length);
  let n = 0;
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  let whole = true;
  for (let i = 0; i < rows.length; i++) {
    let raw = rows[i][dim];
    if (isMissing(dim, raw)) continue;
    let value = Number(raw);
    if (!isFinite(value)) continue;
    values[n++] = value;
    sum += value;
    if (value < min) min = value;
    if (value > max) max = value;
    if (whole && value !== Math.round(value)) whole = false;
  }
  if (n === 0) return { dim: dim, n: 0, missing: rows.length };

  let mean = sum / n;
  // Two passes, so a large mean doesn't swallow a small spread.
  let squares = 0;
  for (let i = 0; i < n; i++) squares += (values[i] - mean) * (values[i] - mean);
  let std = n > 1 ? Math.sqrt(squares / (n - 1)) : 0;

  let lo, hi, count;
  if (max === min) {
    lo = min - 0.5;
    hi = max + 0.5;
    count = 1;
  } else if (whole && max - min + 1 <= MAX_VALUE_BARS) {
    lo = min - 0.5;
    hi = max + 0.5;
    count = max - min + 1;
  } else {
    lo = min;
    hi = max;
    count = BINS;
  }
  let bins = new Array(count).fill(0);
  let width = (hi - lo) / count;
  for (let i = 0; i < n; i++) {
    let index = Math.floor((values[i] - lo) / width);
    bins[Math.min(count - 1, Math.max(0, index))] += 1;
  }

  return {
    dim: dim,
    n: n,
    missing: rows.length - n,
    mean: mean,
    std: std,
    min: min,
    max: max,
    lo: lo,
    hi: hi,
    bins: bins,
    peak: Math.max.apply(null, bins),
  };
}
