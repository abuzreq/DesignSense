/*
 * How strongly each input moves each output.
 *
 * Three numbers, because they answer different questions:
 *   r    how closely two dimensions move together in a straight line
 *   rho  the same on rank order, which catches relationships that bend
 *   beta how much an output moves per input, with the other inputs held
 *        still, in standard deviations
 * plus R2 per output: how much of it the chosen inputs explain together.
 *
 * Kept free of imports, so a plain Node script can check the arithmetic
 * against hand-computed examples.
 */

// Fewer pairs than this and a correlation is noise, not a reading. The
// assistant's own answers use the same floor.
export const MIN_PAIRS = 3;
// A regression on n = p + 1 fits perfectly by construction, so ask for more.
const MIN_MODEL_MARGIN = 3;
// Below this the correlation matrix is singular: two inputs are one input.
const SINGULAR = 1e-8;
// A pinch of ridge, only ever as a labelled fallback.
const RIDGE = 0.01;
// Above this two inputs are close enough that their betas can't be told apart.
const COLLINEAR = 0.9;
const IDENTICAL = 0.999;
// More distinct values than this and a column reads as a measurement rather
// than a code ("option 1, 2, 3"), for which the linear number is nonsense.
const FEW_VALUES = 6;

function isFiniteNumber(value) {
  return typeof value === "number" && isFinite(value);
}

function defaultIsMissing(dim, value) {
  return !isFiniteNumber(Number(value));
}

/** A dimension's values, with anything missing left as undefined. */
function column(rows, dim, isMissing) {
  return rows.map(function(row) {
    let value = row[dim];
    if (isMissing(dim, value)) return undefined;
    let number = Number(value);
    return isFiniteNumber(number) ? number : undefined;
  });
}

function mean(values) {
  let total = 0;
  for (let i = 0; i < values.length; i++) total += values[i];
  return total / values.length;
}

/**
 * Fractional ranks, ties sharing the average of the places they cover. Design
 * spaces are full of repeated values -- three wall thicknesses over a thousand
 * options -- and ordinal ranks would invent an order inside every tie.
 */
export function rank(values) {
  let order = values
    .map(function(value, index) {
      return { value: value, index: index };
    })
    .sort(function(a, b) {
      return a.value - b.value;
    });
  let ranks = new Array(values.length);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1].value === order[i].value) j += 1;
    // Places i+1 .. j+1, shared.
    let shared = (i + j + 2) / 2;
    for (let k = i; k <= j; k++) ranks[order[k].index] = shared;
    i = j + 1;
  }
  return ranks;
}

/** Pearson's r over paired values; null when there are too few or no spread. */
export function pearsonOf(xs, ys) {
  let n = xs.length;
  if (n < MIN_PAIRS || ys.length !== n) return null;
  let mx = mean(xs);
  let my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    let dx = xs[i] - mx;
    let dy = ys[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

/** Spearman's rho: Pearson over the ranks, so one routine serves both. */
export function spearmanOf(xs, ys) {
  if (xs.length < MIN_PAIRS || ys.length !== xs.length) return null;
  return pearsonOf(rank(xs), rank(ys));
}

/** Values as z-scores, or null when the column never varies. */
export function standardize(values) {
  let n = values.length;
  if (n < 2) return null;
  let m = mean(values);
  let ss = 0;
  for (let i = 0; i < n; i++) ss += (values[i] - m) * (values[i] - m);
  // Sample standard deviation, as the rest of the app computes it.
  let sd = Math.sqrt(ss / (n - 1));
  if (!(sd > 0)) return null;
  return {
    z: values.map(function(value) {
      return (value - m) / sd;
    }),
    mean: m,
    sd: sd,
  };
}

/**
 * Solves `matrix * x = vector` by Gauss-Jordan with partial pivoting, or
 * returns null when the matrix is singular.
 *
 * The matrix handed in is a correlation matrix: unit diagonal, every entry in
 * [-1, 1]. That is deliberate -- it removes the scaling that makes raw normal
 * equations badly conditioned, which is the problem a QR factorisation exists
 * to solve. For the twenty-odd inputs this panel allows, this is enough.
 */
function solve(matrix, vector) {
  let n = vector.length;
  let a = matrix.map(function(row, i) {
    return row.slice().concat([vector[i]]);
  });
  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivotRow][col])) pivotRow = row;
    }
    if (Math.abs(a[pivotRow][col]) < SINGULAR) return null;
    let swap = a[col];
    a[col] = a[pivotRow];
    a[pivotRow] = swap;
    let pivot = a[col][col];
    for (let k = col; k <= n; k++) a[col][k] /= pivot;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      let factor = a[row][col];
      if (factor === 0) continue;
      for (let k = col; k <= n; k++) a[row][k] -= factor * a[col][k];
    }
  }
  return a.map(function(row) {
    return row[n];
  });
}

/**
 * Standardized regression coefficients from the correlations among the inputs
 * (`matrix`) and between each input and the output (`vector`). Everything is
 * standardized already, so the solution *is* the beta vector and R2 is b . c.
 */
export function betaWeights(matrix, vector, options) {
  let ridge = !options || options.ridge !== false;
  let betas = solve(matrix, vector);
  let ridged = false;
  if (!betas && ridge) {
    let nudged = matrix.map(function(row, i) {
      let copy = row.slice();
      copy[i] += RIDGE;
      return copy;
    });
    betas = solve(nudged, vector);
    ridged = betas !== null;
  }
  if (!betas) return null;
  let r2 = 0;
  for (let i = 0; i < betas.length; i++) r2 += betas[i] * vector[i];
  return { betas: betas, r2: r2, ridged: ridged, lambda: ridged ? RIDGE : 0 };
}

function distinctCount(values, limit) {
  let seen = {};
  let count = 0;
  for (let i = 0; i < values.length; i++) {
    let key = String(values[i]);
    if (seen[key]) continue;
    seen[key] = true;
    count += 1;
    if (count > limit) return count;
  }
  return count;
}

function pairsOf(xs, ys) {
  let a = [];
  let b = [];
  for (let i = 0; i < xs.length; i++) {
    if (xs[i] === undefined || ys[i] === undefined) continue;
    a.push(xs[i]);
    b.push(ys[i]);
  }
  return { xs: a, ys: b };
}

/**
 * The whole reading: every input-output pair, and one model per output.
 *
 * Correlations drop a row only when that pair is incomplete, so a gap in an
 * unrelated column can't change a number. The regression is one model over all
 * the inputs at once, so it needs rows complete on all of them -- which is why
 * every cell carries its own `n` and the model carries another.
 */
export function sensitivity(rows, inputs, outputs, options) {
  let opts = options || {};
  let isMissing = opts.isMissing || defaultIsMissing;
  let data = rows || [];
  let sampled = false;
  if (opts.maxRows && data.length > opts.maxRows) {
    // Every k-th row, never a random sample: the same dataset must give the
    // same answer twice.
    let step = Math.ceil(data.length / opts.maxRows);
    let strided = [];
    for (let i = 0; i < data.length; i += step) strided.push(data[i]);
    data = strided;
    sampled = true;
  }

  let columns = {};
  let ranks = {};
  let flags = {};
  inputs.concat(outputs).forEach(function(dim) {
    if (columns[dim]) return;
    let values = column(data, dim, isMissing);
    columns[dim] = values;
    let present = values.filter(function(value) {
      return value !== undefined;
    });
    ranks[dim] = null;
    flags[dim] = {
      n: present.length,
      constant: present.length > 0 && standardize(present) === null,
      fewValues:
        present.length > FEW_VALUES &&
        distinctCount(present, FEW_VALUES) <= FEW_VALUES,
    };
  });

  let pairs = {};
  outputs.forEach(function(output) {
    pairs[output] = {};
    inputs.forEach(function(input) {
      if (input === output) {
        pairs[output][input] = { r: null, rho: null, n: 0, same: true };
        return;
      }
      let both = pairsOf(columns[input], columns[output]);
      pairs[output][input] = {
        r: pearsonOf(both.xs, both.ys),
        rho: spearmanOf(both.xs, both.ys),
        n: both.xs.length,
      };
    });
  });

  let models = {};
  outputs.forEach(function(output) {
    models[output] = modelFor(output, inputs, columns, flags, opts);
  });

  return {
    inputs: inputs.slice(),
    outputs: outputs.slice(),
    rows: data.length,
    sampled: sampled,
    pairs: pairs,
    models: models,
    flags: flags,
  };
}

function modelFor(output, allInputs, columns, flags, opts) {
  // An input is only usable if it varies and isn't the output itself.
  let used = allInputs.filter(function(input) {
    return input !== output && !flags[input].constant && flags[input].n > 0;
  });
  let dropped = allInputs.filter(function(input) {
    return used.indexOf(input) === -1;
  });
  if (used.length === 0) {
    return { ok: false, reason: "no-inputs", dropped: dropped, n: 0 };
  }
  if (opts.maxInputs && used.length > opts.maxInputs) {
    return {
      ok: false,
      reason: "too-many-inputs",
      dropped: dropped,
      used: used,
      n: 0,
    };
  }

  // Listwise: the model needs rows complete on the output and every input.
  let keep = [];
  for (let i = 0; i < columns[output].length; i++) {
    if (columns[output][i] === undefined) continue;
    let complete = used.every(function(input) {
      return columns[input][i] !== undefined;
    });
    if (complete) keep.push(i);
  }
  let n = keep.length;
  if (n < used.length + MIN_MODEL_MARGIN) {
    return { ok: false, reason: "too-few-rows", n: n, dropped: dropped, used: used };
  }

  let pick = function(dim) {
    return keep.map(function(i) {
      return columns[dim][i];
    });
  };
  let outputZ = standardize(pick(output));
  if (!outputZ) {
    return { ok: false, reason: "constant-output", n: n, dropped: dropped, used: used };
  }
  let inputZ = [];
  let usable = [];
  used.forEach(function(input) {
    let z = standardize(pick(input));
    // Constant within the complete rows, even if it varies elsewhere.
    if (!z) {
      dropped.push(input);
      return;
    }
    usable.push(input);
    inputZ.push(z.z);
  });
  if (usable.length === 0) {
    return { ok: false, reason: "no-inputs", n: n, dropped: dropped, used: used };
  }

  let matrix = usable.map(function(_, i) {
    return usable.map(function(__, j) {
      if (i === j) return 1;
      let r = pearsonOf(inputZ[i], inputZ[j]);
      return r === null ? 0 : r;
    });
  });
  let vector = usable.map(function(_, i) {
    let r = pearsonOf(inputZ[i], outputZ.z);
    return r === null ? 0 : r;
  });

  // Which inputs are so alike that splitting credit between them is a guess.
  let culprits = [];
  for (let i = 0; i < usable.length; i++) {
    for (let j = i + 1; j < usable.length; j++) {
      if (Math.abs(matrix[i][j]) >= COLLINEAR) {
        culprits.push([usable[i], usable[j], matrix[i][j]]);
      }
    }
  }

  let fit = betaWeights(matrix, vector, opts);
  if (!fit) {
    return {
      ok: false,
      reason: "collinear",
      n: n,
      used: usable,
      dropped: dropped,
      culprits: culprits.filter(function(pair) {
        return Math.abs(pair[2]) >= IDENTICAL;
      }),
    };
  }

  let betas = {};
  usable.forEach(function(input, i) {
    betas[input] = fit.betas[i];
  });
  let p = usable.length;
  let adjusted =
    n - p - 1 > 0 ? 1 - ((1 - fit.r2) * (n - 1)) / (n - p - 1) : null;
  return {
    ok: true,
    n: n,
    used: usable,
    dropped: dropped,
    betas: betas,
    r2: fit.r2,
    adjustedR2: adjusted,
    ridged: fit.ridged,
    lambda: fit.lambda,
    culprits: culprits,
  };
}

/** The reading as a CSV, for taking the numbers elsewhere. */
export function sensitivityCsv(result) {
  let lines = ["input,output,pearson,spearman,n,beta"];
  result.outputs.forEach(function(output) {
    let model = result.models[output];
    result.inputs.forEach(function(input) {
      let cell = result.pairs[output][input];
      let beta = model && model.ok && model.betas[input] !== undefined
        ? model.betas[input]
        : "";
      lines.push(
        [
          input,
          output,
          cell.r === null ? "" : cell.r,
          cell.rho === null ? "" : cell.rho,
          cell.n,
          beta,
        ].join(",")
      );
    });
  });
  lines.push("");
  lines.push("output,r2,adjusted_r2,n");
  result.outputs.forEach(function(output) {
    let model = result.models[output];
    lines.push(
      [
        output,
        model && model.ok ? model.r2 : "",
        model && model.ok && model.adjustedR2 !== null ? model.adjustedR2 : "",
        model ? model.n : 0,
      ].join(",")
    );
  });
  return lines.join("\n");
}
