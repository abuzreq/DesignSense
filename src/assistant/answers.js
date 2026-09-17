/**
 * The half of the assistant that answers rather than acts.
 *
 * These are plain statistics over the loaded rows, so the answers are exact
 * and cost nothing. They are also the part a user cannot get from the existing
 * controls at all: how many match, what the selection has in common, what
 * trades off against what, and why one option is missing from the results.
 *
 * Free of Vue and of the store, so it can be exercised on its own.
 */

import { compileFilters, describeFilter } from "@/store/filters.js";

function numbers(rows, dim) {
  let out = [];
  for (let row of rows) {
    let value = Number(row[dim]);
    if (Number.isFinite(value)) out.push(value);
  }
  return out;
}

function mean(values) {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdev(values) {
  if (values.length < 2) return 0;
  let m = mean(values);
  return Math.sqrt(values.reduce((a, v) => a + (v - m) * (v - m), 0) / (values.length - 1));
}

function median(values) {
  let sorted = values.slice().sort((a, b) => a - b);
  let middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Enough precision to be useful, not so much that it reads as noise. */
export function pretty(value) {
  if (!Number.isFinite(value)) return String(value);
  let magnitude = Math.abs(value);
  if (magnitude >= 1e6) return (value / 1e6).toPrecision(3) + "M";
  if (magnitude >= 1e4) return Math.round(value).toLocaleString("en-US");
  if (magnitude >= 100) return String(Math.round(value));
  return String(Number(value.toPrecision(3)));
}

export function stat(rows, dim, which) {
  let values = numbers(rows, dim);
  if (values.length === 0) return null;
  switch (which) {
    case "mean": return mean(values);
    case "median": return median(values);
    case "min": return Math.min.apply(null, values);
    case "max": return Math.max.apply(null, values);
    case "std": return stdev(values);
    case "count": return values.length;
    case "range": return [Math.min.apply(null, values), Math.max.apply(null, values)];
    default: return null;
  }
}

/** The rows at the extreme of a dimension, best first. */
export function extreme(rows, dim, direction, n) {
  let usable = rows.filter((row) => Number.isFinite(Number(row[dim])));
  usable.sort((a, b) =>
    direction === "min" ? a[dim] - b[dim] : b[dim] - a[dim]
  );
  return usable.slice(0, n || 1);
}

export function topIds(rows, dim, direction, k) {
  return extreme(rows, dim, direction, k).map((row) => row._id);
}

/** The ids in the given percentile band of a dimension. */
export function percentileIds(rows, dim, percent, direction) {
  let count = Math.max(1, Math.round((rows.length * percent) / 100));
  return topIds(rows, dim, direction === "bottom" ? "min" : "max", count);
}

/**
 * What separates a group from the rest, ranked by standardised difference.
 *
 * This is the single most useful thing an assistant can say about a design
 * space, and it is forty lines of arithmetic.
 */
export function describeGroup(rows, ids, numericDims) {
  let chosen = new Set(ids.map(String));
  let inside = rows.filter((row) => chosen.has(String(row._id)));
  let outside = rows.filter((row) => !chosen.has(String(row._id)));
  if (inside.length === 0 || outside.length === 0) return [];

  let scored = [];
  for (let dim of numericDims) {
    let a = numbers(inside, dim);
    let b = numbers(outside, dim);
    if (a.length < 2 || b.length < 2) continue;
    let spread = stdev(rows.map((r) => Number(r[dim])).filter(Number.isFinite));
    if (!spread) continue;
    let difference = (mean(a) - mean(b)) / spread;
    scored.push({
      dim: dim,
      effect: difference,
      inside: median(a),
      outside: median(b),
    });
  }
  scored.sort((x, y) => Math.abs(y.effect) - Math.abs(x.effect));
  return scored.slice(0, 3);
}

function pearson(rows, a, b) {
  let xs = [];
  let ys = [];
  for (let row of rows) {
    let x = Number(row[a]);
    let y = Number(row[b]);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      xs.push(x);
      ys.push(y);
    }
  }
  if (xs.length < 3) return null;
  let mx = mean(xs);
  let my = mean(ys);
  let top = 0;
  let left = 0;
  let right = 0;
  for (let i = 0; i < xs.length; i++) {
    let dx = xs[i] - mx;
    let dy = ys[i] - my;
    top += dx * dy;
    left += dx * dx;
    right += dy * dy;
  }
  if (!left || !right) return null;
  return top / Math.sqrt(left * right);
}

/** Strongest relationships, negative ones first: those are the trade-offs. */
export function correlations(rows, dims) {
  let pairs = [];
  for (let i = 0; i < dims.length; i++) {
    for (let j = i + 1; j < dims.length; j++) {
      let r = pearson(rows, dims[i], dims[j]);
      if (r !== null && Math.abs(r) >= 0.3) {
        pairs.push({ a: dims[i], b: dims[j], r: r });
      }
    }
  }
  pairs.sort((x, y) => Math.abs(y.r) - Math.abs(x.r));
  return pairs;
}

/**
 * Which filter is keeping an option out of the results. The most common
 * confusion in any filter interface, and the filters already know the answer.
 */
export function whyExcluded(filters, row) {
  if (!row) return null;
  let failing = filters.filter((filter) => !compileFilters([filter])(row));
  return failing.map((filter) => describeFilter(filter).text);
}

export function describeRelation(r) {
  let strength = Math.abs(r) > 0.7 ? "strongly" : Math.abs(r) > 0.45 ? "clearly" : "weakly";
  return strength + (r < 0 ? " opposed" : " aligned");
}

/* --------------------------------------------------------------- groups -- */

/** Rows as unit-scaled vectors over `dims`, with the rows that have every value. */
function vectors(rows, dims) {
  let usable = rows.filter((row) => dims.every((d) => Number.isFinite(Number(row[d]))));
  let lo = dims.map((d) => Math.min.apply(null, usable.map((r) => Number(r[d]))));
  let hi = dims.map((d) => Math.max.apply(null, usable.map((r) => Number(r[d]))));
  let points = usable.map((row) =>
    dims.map((d, i) => (hi[i] === lo[i] ? 0 : (Number(row[d]) - lo[i]) / (hi[i] - lo[i])))
  );
  return { rows: usable, points: points };
}

function squared(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) * (a[i] - b[i]);
  return sum;
}

/**
 * k-means over unit-scaled numeric dimensions. Deterministic: seeds are the
 * farthest-first traversal from the first row, so the same request gives
 * the same groups. Returns `[{ ids, centre }]`, largest group first.
 */
export function cluster(rows, dims, k) {
  let { rows: usable, points } = vectors(rows, dims);
  let n = points.length;
  if (n === 0 || dims.length === 0) return [];
  k = Math.max(1, Math.min(k, n));

  let centres = [points[0]];
  while (centres.length < k) {
    let far = 0;
    let farD = -1;
    points.forEach((p, i) => {
      let d = Math.min.apply(null, centres.map((c) => squared(p, c)));
      if (d > farD) { farD = d; far = i; }
    });
    centres.push(points[far]);
  }

  let assign = new Array(n).fill(0);
  for (let round = 0; round < 30; round++) {
    let moved = false;
    points.forEach((p, i) => {
      let best = 0;
      let bestD = Infinity;
      centres.forEach((c, j) => {
        let d = squared(p, c);
        if (d < bestD) { bestD = d; best = j; }
      });
      if (assign[i] !== best) { assign[i] = best; moved = true; }
    });
    centres = centres.map((c, j) => {
      let members = points.filter((_, i) => assign[i] === j);
      if (members.length === 0) return c;
      return dims.map((_, d) => members.reduce((s, m) => s + m[d], 0) / members.length);
    });
    if (!moved) break;
  }

  return centres
    .map((centre, j) => ({
      centre: centre,
      ids: usable.filter((_, i) => assign[i] === j).map((row) => row._id),
    }))
    .filter((g) => g.ids.length > 0)
    .sort((a, b) => b.ids.length - a.ids.length);
}

/** The n rows nearest to `item` over unit-scaled numeric dimensions, nearest first. */
export function nearest(rows, dims, item, n) {
  let { rows: usable, points } = vectors(rows.concat([item]), dims);
  let at = usable.findIndex((row) => String(row._id) === String(item._id));
  if (at < 0) return [];
  let origin = points[at];
  return usable
    .map((row, i) => ({ row: row, d: squared(points[i], origin) }))
    .filter((x) => String(x.row._id) !== String(item._id))
    .sort((a, b) => a.d - b.d)
    .slice(0, n || 5)
    .map((x) => x.row);
}
