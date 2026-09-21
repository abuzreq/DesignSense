/*
 * What an Expert selection is, as a short logical statement rather than the
 * steps that built it.
 *
 * Every selection operation acts on each option by itself: whether an option
 * ends up selected depends only on which of the steps' conditions it meets.
 * The steps since the last Replace therefore define a boolean function of
 * those conditions, which is tabulated over every combination of them and
 * reduced (Quine-McCluskey) to a minimal OR of ANDs. Combinations no option
 * can meet -- a value inside two disjoint ranges, an option in two clusters
 * -- are free to take either value, which is what lets "5k-15k, then add
 * 10k-20k" read "5k-20k".
 *
 * A step is `{ op, atom }`:
 *   op    "replace" | "add" | "subtract" | "intersect" | "invert"
 *         (a toggle is recorded as the add or subtract it turned out to be;
 *         "invert" has no atom)
 *   atom  { kind: "region", boxes: [{ dim: [lo, hi], ... }] }
 *           the boxes OR-ed, each an AND of ranges: a scatterplot rectangle
 *           has two, an axis brush one
 *         { kind: "set", label, ids, title? }
 *           options named by who they are: a cluster, a saved set, a lasso
 *         { kind: "pick", id }
 *           one option clicked on its own
 *
 * Picks are kept out of the logic, or twenty clicks would be twenty
 * variables. The statement is reduced without them, and the picked options
 * whose outcome it gets wrong are listed as exceptions.
 *
 * Kept free of imports, like analysis/summary.js, so a plain Node script can
 * check it.
 */

export const STEP_OPS = {
  REPLACE: "replace",
  ADD: "add",
  SUBTRACT: "subtract",
  INTERSECT: "intersect",
  INVERT: "invert",
};

// Past this many conditions the table (2^n rows) gets slow and the statement
// long; the steps are shown as they are instead.
export const MAX_VARIABLES = 12;

/**
 * `{ exact, nothing, everything, common, any, picked, unpicked, steps }`:
 *   common    literals every option in the selection meets
 *   any       further alternatives, each a list of literals; an option meets
 *             at least one (empty when `common` says it all)
 *   picked    ids of options added by hand beyond the statement
 *   unpicked  ids of options removed by hand despite it
 *   steps     the steps described
 * A literal is `{ kind: "range", dim, lo, hi, negated }` or
 * `{ kind: "set", label, title, count, negated }`.
 * `exact` is false when there were too many conditions to reduce; then only
 * `steps` is meaningful.
 *
 * `options.rowOf(id)` gives an option's row, for working out picks.
 */
export function describeSelection(steps, options) {
  let rowOf = (options && options.rowOf) || (() => null);
  let maxVariables = (options && options.maxVariables) || MAX_VARIABLES;
  let slate = slateOf(steps || []);
  let result = {
    exact: true,
    nothing: false,
    everything: false,
    common: [],
    any: [],
    picked: [],
    unpicked: [],
    steps: slate,
  };
  if (slate.length === 0) {
    result.nothing = true;
    return result;
  }

  let model = compile(slate);
  let n = model.vars.length;
  if (n > maxVariables) {
    result.exact = false;
    return result;
  }

  // Tabulate: which combinations select an option, which can't occur.
  let feasible = feasibility(model.vars);
  let ones = [];
  let dontCares = [];
  let size = 1 << n;
  for (let mask = 0; mask < size; mask++) {
    if (!feasible(mask)) dontCares.push(mask);
    else if (evaluate(model.steps, mask, null)) ones.push(mask);
  }

  if (ones.length === 0) {
    result.nothing = true;
  } else if (ones.length + dontCares.length === size) {
    result.everything = true;
  } else {
    let cover = minimize(n, ones, dontCares);
    let terms = cover.map((imp) => termLiterals(imp, model.vars));
    terms = mergeTerms(terms.map(tidyTerm).filter(Boolean));
    let factored = factor(terms);
    result.common = factored.common;
    result.any = factored.any;
  }

  // Picks the statement gets wrong are exceptions to it.
  model.pickIds.forEach((id) => {
    let row = rowOf(id);
    let mask = maskOf(model.vars, id, row);
    let actual = evaluate(model.steps, mask, id);
    let stated = evaluate(model.steps, mask, null);
    if (actual && !stated) result.picked.push(id);
    else if (!actual && stated) result.unpicked.push(id);
  });
  return result;
}

/** The steps from the last Replace on; the ones before it no longer count. */
function slateOf(steps) {
  let start = 0;
  steps.forEach((step, index) => {
    if (step.op === STEP_OPS.REPLACE) start = index;
  });
  return steps.slice(start);
}

/**
 * The conditions as variables, and each step as a test over a bitmask of
 * them. Equal conditions share a variable, so repeating one adds nothing.
 */
function compile(slate) {
  let vars = [];
  let index = new Map();
  let pickIds = [];
  let seenPicks = new Set();
  let variable = (key, make) => {
    if (!index.has(key)) {
      index.set(key, vars.length);
      vars.push(make());
    }
    return index.get(key);
  };

  let steps = slate.map((step) => {
    let atom = step.atom;
    if (step.op === STEP_OPS.INVERT || !atom) return { op: step.op, test: null };
    if (atom.kind === "region") {
      let boxes = (atom.boxes || []).map((box) =>
        Object.keys(box)
          .filter((dim) => box[dim])
          .map((dim) => {
            let lo = Math.min(box[dim][0], box[dim][1]);
            let hi = Math.max(box[dim][0], box[dim][1]);
            return variable("r|" + dim + "|" + lo + "|" + hi, () => ({
              kind: "range",
              dim: dim,
              lo: lo,
              hi: hi,
            }));
          })
      );
      return {
        op: step.op,
        test: (mask) =>
          boxes.some((vs) => vs.every((v) => (mask >> v) & 1)),
      };
    }
    if (atom.kind === "pick") {
      let id = String(atom.id);
      if (!seenPicks.has(id)) {
        seenPicks.add(id);
        pickIds.push(atom.id);
      }
      return { op: step.op, pick: id, test: () => false };
    }
    // A set: its members, whatever brought them together.
    let ids = (atom.ids || []).map(String);
    let key = "s|" + (atom.label || "") + "|" + ids.slice().sort().join(",");
    let v = variable(key, () => ({
      kind: "set",
      key: key,
      label: atom.label || "Selection",
      title: atom.title || null,
      ids: new Set(ids),
    }));
    return { op: step.op, test: (mask) => !!((mask >> v) & 1) };
  });
  return { vars: vars, steps: steps, pickIds: pickIds };
}

/** Runs the steps over one combination; `pickId` makes that option's picks count. */
function evaluate(steps, mask, pickId) {
  let selected = false;
  for (let i = 0; i < steps.length; i++) {
    let step = steps[i];
    if (step.op === STEP_OPS.INVERT) {
      selected = !selected;
      continue;
    }
    let met =
      step.pick !== undefined
        ? pickId !== null && String(pickId) === step.pick
        : step.test(mask);
    if (step.op === STEP_OPS.REPLACE) selected = met;
    else if (step.op === STEP_OPS.ADD) selected = selected || met;
    else if (step.op === STEP_OPS.SUBTRACT) selected = selected && !met;
    else if (step.op === STEP_OPS.INTERSECT) selected = selected && met;
  }
  return selected;
}

/** Which conditions one option meets. A missing value is in no range. */
function maskOf(vars, id, row) {
  let mask = 0;
  vars.forEach((v, i) => {
    let met;
    if (v.kind === "range") {
      let value = row ? Number(row[v.dim]) : NaN;
      met = row && row[v.dim] !== "" && row[v.dim] !== null && isFinite(value)
        ? value >= v.lo && value <= v.hi
        : false;
    } else {
      met = v.ids.has(String(id));
    }
    if (met) mask |= 1 << i;
  });
  return mask;
}

/**
 * Which combinations some option could meet. Ranges on one dimension allow
 * only the patterns some value falls into; sets allow nothing their members
 * rule out -- both in two disjoint sets, in a subset but not its superset.
 * Anything left out here only costs simplification, never correctness.
 */
function feasibility(vars) {
  let byDim = new Map();
  vars.forEach((v, i) => {
    if (v.kind !== "range") return;
    if (!byDim.has(v.dim)) byDim.set(v.dim, []);
    byDim.get(v.dim).push(i);
  });
  let dimRules = [];
  byDim.forEach((indices) => {
    if (indices.length < 2) return;
    let dimMask = indices.reduce((m, i) => m | (1 << i), 0);
    // A value below every range stands for a missing one too.
    let cuts = [];
    indices.forEach((i) => cuts.push(vars[i].lo, vars[i].hi));
    cuts.sort((a, b) => a - b);
    let points = [cuts[0] - 1, cuts[cuts.length - 1] + 1];
    cuts.forEach((c, k) => {
      points.push(c);
      if (k > 0) points.push((cuts[k - 1] + c) / 2);
    });
    let patterns = new Set();
    points.forEach((p) => {
      let pattern = 0;
      indices.forEach((i) => {
        if (p >= vars[i].lo && p <= vars[i].hi) pattern |= 1 << i;
      });
      patterns.add(pattern);
    });
    dimRules.push({ dimMask: dimMask, patterns: patterns });
  });

  let setRules = [];
  vars.forEach((a, i) => {
    if (a.kind !== "set") return;
    if (a.ids.size === 0) setRules.push({ on: 1 << i, off: 0 });
    vars.forEach((b, j) => {
      if (j <= i || b.kind !== "set") return;
      let shared = 0;
      a.ids.forEach((id) => {
        if (b.ids.has(id)) shared++;
      });
      if (shared === 0) setRules.push({ on: (1 << i) | (1 << j), off: 0 });
      else {
        if (shared === a.ids.size) setRules.push({ on: 1 << i, off: 1 << j });
        if (shared === b.ids.size) setRules.push({ on: 1 << j, off: 1 << i });
      }
    });
  });

  return (mask) => {
    for (let r = 0; r < dimRules.length; r++) {
      if (!dimRules[r].patterns.has(mask & dimRules[r].dimMask)) return false;
    }
    for (let r = 0; r < setRules.length; r++) {
      let rule = setRules[r];
      if ((mask & rule.on) === rule.on && (mask & rule.off) === 0) return false;
    }
    return true;
  };
}

/**
 * Quine-McCluskey: the prime implicants of `ones` (with `dontCares` free),
 * then a cover of `ones` -- the essential ones first, then greedily the one
 * covering most, fewer conditions breaking ties.
 */
function minimize(n, ones, dontCares) {
  // An implicant is a base-3 number, a digit per variable: 0 or 1 where it
  // is fixed, 2 where either will do. Flat arrays over the 3^n of them keep
  // the merging fast; a string key per implicant took seconds at n = 12.
  let pow3 = [1];
  for (let b = 1; b <= n; b++) pow3.push(pow3[b - 1] * 3);
  let toTernary = (mask) => {
    let t = 0;
    for (let b = 0; b < n; b++) if ((mask >> b) & 1) t += pow3[b];
    return t;
  };
  let present = new Uint8Array(pow3[n]);
  let used = new Uint8Array(pow3[n]);
  let current = ones.concat(dontCares).map(toTernary);
  current.forEach((t) => (present[t] = 1));
  let primes = [];
  while (current.length > 0) {
    let next = [];
    for (let k = 0; k < current.length; k++) {
      let t = current[k];
      for (let b = 0; b < n; b++) {
        if (Math.floor(t / pow3[b]) % 3 !== 0) continue;
        let partner = t + pow3[b];
        if (!present[partner]) continue;
        used[t] = 1;
        used[partner] = 1;
        let merged = t + 2 * pow3[b];
        if (!present[merged]) {
          present[merged] = 1;
          next.push(merged);
        }
      }
    }
    current.forEach((t) => {
      if (!used[t]) primes.push(t);
    });
    current = next;
  }
  primes = primes.map((t) => {
    let value = 0;
    let dash = 0;
    for (let b = 0; b < n; b++) {
      let digit = Math.floor(t / pow3[b]) % 3;
      if (digit === 1) value |= 1 << b;
      else if (digit === 2) dash |= 1 << b;
    }
    return { value: value, dash: dash };
  });

  // Which of `ones` each prime covers, and which primes cover each one.
  let coverOf = primes.map((imp) => {
    let list = [];
    for (let i = 0; i < ones.length; i++) {
      if ((ones[i] & ~imp.dash) === imp.value) list.push(i);
    }
    return list;
  });
  let coveredBy = ones.map(() => []);
  coverOf.forEach((list, p) => list.forEach((i) => coveredBy[i].push(p)));

  let literals = (p) => n - popcount(primes[p].dash);
  let uncovered = new Uint8Array(ones.length).fill(1);
  let left = ones.length;
  let chosen = [];
  let choose = (p) => {
    chosen.push(primes[p]);
    coverOf[p].forEach((i) => {
      if (uncovered[i]) {
        uncovered[i] = 0;
        left--;
      }
    });
  };
  coveredBy.forEach((list, i) => {
    if (uncovered[i] && list.length === 1) choose(list[0]);
  });
  while (left > 0) {
    let best = -1;
    let bestCount = 0;
    coverOf.forEach((list, p) => {
      let count = 0;
      for (let k = 0; k < list.length; k++) count += uncovered[list[k]];
      if (
        count > bestCount ||
        (count === bestCount && count > 0 && literals(p) < literals(best))
      ) {
        best = p;
        bestCount = count;
      }
    });
    choose(best);
  }
  return chosen;
}

function popcount(x) {
  let count = 0;
  while (x) {
    count += x & 1;
    x >>>= 1;
  }
  return count;
}

function termLiterals(imp, vars) {
  let out = [];
  vars.forEach((v, i) => {
    let bit = 1 << i;
    if (imp.dash & bit) return;
    out.push({ v: v, negated: !(imp.value & bit) });
  });
  return out;
}

/**
 * One AND as literals: ranges on a dimension folded into one where they
 * can be -- positives intersected, a negative that clips an end trimmed off,
 * one outside dropped, overlapping negatives joined. Null if it is empty.
 */
function tidyTerm(term) {
  let byDim = new Map();
  let sets = [];
  term.forEach((lit) => {
    if (lit.v.kind === "range") {
      if (!byDim.has(lit.v.dim)) byDim.set(lit.v.dim, { pos: null, negs: [] });
      let entry = byDim.get(lit.v.dim);
      if (lit.negated) entry.negs.push([lit.v.lo, lit.v.hi]);
      else if (!entry.pos) entry.pos = [lit.v.lo, lit.v.hi];
      else {
        entry.pos = [
          Math.max(entry.pos[0], lit.v.lo),
          Math.min(entry.pos[1], lit.v.hi),
        ];
      }
    } else {
      sets.push({
        kind: "set",
        key: lit.v.key,
        label: lit.v.label,
        title: lit.v.title,
        count: lit.v.ids.size,
        ids: lit.v.ids,
        negated: lit.negated,
      });
    }
  });

  let out = [];
  let empty = false;
  byDim.forEach((entry, dim) => {
    let pos = entry.pos;
    let negs = joinRanges(entry.negs);
    if (pos) {
      if (pos[0] > pos[1]) {
        empty = true;
        return;
      }
      negs = negs.filter((neg) => {
        if (neg[1] < pos[0] || neg[0] > pos[1]) return false;
        if (neg[0] <= pos[0] && neg[1] >= pos[1]) {
          empty = true;
          return false;
        }
        if (neg[0] <= pos[0]) {
          pos = [neg[1], pos[1]];
          return false;
        }
        if (neg[1] >= pos[1]) {
          pos = [pos[0], neg[0]];
          return false;
        }
        return true;
      });
      out.push({ kind: "range", dim: dim, lo: pos[0], hi: pos[1], negated: false });
    }
    negs.forEach((neg) => {
      out.push({ kind: "range", dim: dim, lo: neg[0], hi: neg[1], negated: true });
    });
  });
  if (empty) return null;
  // What an option has to be before what it must not be.
  let all = out.concat(sets);
  return all.filter((lit) => !lit.negated).concat(all.filter((lit) => lit.negated));
}

/** Overlapping or touching ranges joined, in order. */
function joinRanges(ranges) {
  let sorted = ranges.slice().sort((a, b) => a[0] - b[0]);
  let out = [];
  sorted.forEach((r) => {
    let last = out[out.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else out.push([r[0], r[1]]);
  });
  return out;
}

function literalKey(lit) {
  if (lit.kind === "range") {
    return "r|" + lit.dim + "|" + lit.negated + "|" + lit.lo + "|" + lit.hi;
  }
  return lit.key + "|" + lit.negated;
}

/**
 * ORs of ANDs the reduction can't see through, because its ranges are
 * separate variables: terms equal but for overlapping ranges on one
 * dimension become one over their union, and a term containing another is
 * dropped. Repeated until nothing changes.
 */
function mergeTerms(terms) {
  let changed = true;
  while (changed) {
    changed = false;
    outer: for (let i = 0; i < terms.length; i++) {
      for (let j = 0; j < terms.length; j++) {
        if (i === j) continue;
        let a = terms[i];
        let b = terms[j];
        let aKeys = new Set(a.map(literalKey));
        // b asks for everything a does and more: a covers it.
        if (a.length <= b.length && a.every((lit) => b.some((o) => literalKey(o) === literalKey(lit)))) {
          if (a.length < b.length || i < j) {
            terms.splice(j, 1);
            changed = true;
            break outer;
          }
        }
        if (a.length !== b.length) continue;
        let onlyA = a.filter((lit) => !b.some((o) => literalKey(o) === literalKey(lit)));
        let onlyB = b.filter((lit) => !aKeys.has(literalKey(lit)));
        if (onlyA.length !== 1 || onlyB.length !== 1) continue;
        let x = onlyA[0];
        let y = onlyB[0];
        if (
          x.kind !== "range" || y.kind !== "range" || x.dim !== y.dim ||
          x.negated || y.negated || y.lo > x.hi || x.lo > y.hi
        ) {
          continue;
        }
        let union = Object.assign({}, x, {
          lo: Math.min(x.lo, y.lo),
          hi: Math.max(x.hi, y.hi),
        });
        terms[i] = a.map((lit) => (lit === x ? union : lit));
        terms.splice(j, 1);
        changed = true;
        break outer;
      }
    }
  }
  return terms;
}

/** What every term shares, taken out: common AND (term1 OR term2 ...). */
function factor(terms) {
  if (terms.length === 1) return { common: terms[0], any: [] };
  let common = terms[0].filter((lit) =>
    terms.every((t) => t.some((o) => literalKey(o) === literalKey(lit)))
  );
  let commonKeys = new Set(common.map(literalKey));
  let any = terms.map((t) => t.filter((lit) => !commonKeys.has(literalKey(lit))));
  // A term with nothing left is met by everything common: the rest add nothing.
  if (any.some((t) => t.length === 0)) any = [];
  return { common: common, any: any };
}

/** Whether a statement's literals hold for one option, for checking. */
export function literalHolds(lit, id, row) {
  let met;
  if (lit.kind === "range") {
    let value = row ? Number(row[lit.dim]) : NaN;
    met = row && row[lit.dim] !== "" && row[lit.dim] !== null && isFinite(value)
      ? value >= lit.lo && value <= lit.hi
      : false;
  } else {
    met = lit.ids.has(String(id));
  }
  return lit.negated ? !met : met;
}

/** Whether a description selects one option, for checking. */
export function descriptionSelects(description, id, row) {
  let key = String(id);
  if (description.picked.some((p) => String(p) === key)) return true;
  if (description.unpicked.some((p) => String(p) === key)) return false;
  if (description.nothing) return false;
  if (description.everything) return true;
  let all = (lits) => lits.every((lit) => literalHolds(lit, id, row));
  if (!all(description.common)) return false;
  return description.any.length === 0 || description.any.some(all);
}
