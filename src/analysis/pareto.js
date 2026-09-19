/**
 * Pareto fronts: the options no other option beats on every goal, and what
 * to know before trusting one. Shared by the analysis dialog's "Best
 * trade-offs", the assistant's "pareto front of X vs Y", and the
 * scatterplot's front.
 *
 * A direction is "max" (higher is better) or "min" (lower is better), as a
 * goal is (see store/goals.js).
 */

import { FEW_VALUES, spearmanOf } from "./sensitivity.js";
import { GOAL_MARKS, INPUT, columnKind, displayName } from "@/columns.js";

// The filter a front becomes, whichever way it was asked for, so asking again
// replaces it rather than adding another.
export const PARETO_FILTER_KEY = "assistant:pareto";
export const PARETO_LABEL = "Best trade-offs";

// Goal-adjusted rank correlations: at or above AGREE two goals mostly improve
// together; at or below TRADE improving one tends to cost the other.
const AGREE = 0.5;
const TRADE = -0.3;
// This many goals, or a front keeping more than this share of the options,
// and most options are beaten on none.
const MANY_GOALS = 4;
const LARGE_SHARE = 0.25;
// Fewer rows than this and a correlation says nothing.
const MIN_ROWS = 8;

function isFiniteNumber(value) {
  return typeof value === "number" && isFinite(value);
}

function defaultIsMissing(dim, value) {
  return !isFiniteNumber(value);
}

/**
 * `{ rows, missing }`: the rows with a value on every dimension, and how many
 * lacked one, by dimension (`missing.total` overall). `isMissing(dim, value)`
 * says what counts as no value; an unrated option has no rating, say.
 */
export function rowsWithValues(rows, dims, isMissing) {
  let absent = isMissing || defaultIsMissing;
  let kept = [];
  let missing = { total: 0 };
  rows.forEach((row) => {
    let lacking = dims.filter((dim) => absent(dim, row[dim]));
    if (lacking.length === 0) {
      kept.push(row);
      return;
    }
    missing.total += 1;
    lacking.forEach((dim) => (missing[dim] = (missing[dim] || 0) + 1));
  });
  return { rows: kept, missing: missing };
}

/**
 * The rows no other row beats: at least as good on every dimension and
 * better on one. Rows must have a number on every dimension (see
 * rowsWithValues). Identical rows beat neither each other, so both stay.
 *
 * Rows are taken best first, dimension by dimension, so whatever beats a row
 * comes before it; and whatever beats it is itself beaten by, or is, a row
 * already on the front. So each row is checked against the front so far only.
 * Two dimensions need only the best second value so far.
 */
export function paretoFront(rows, dims, directions) {
  let signs = directions.map((d) => (d === "min" ? -1 : 1));
  let points = rows.map((row) => ({
    row: row,
    v: dims.map((dim, i) => Number(row[dim]) * signs[i]),
  }));
  points.sort((a, b) => {
    for (let i = 0; i < dims.length; i++) {
      if (a.v[i] !== b.v[i]) return b.v[i] - a.v[i];
    }
    return 0;
  });
  if (dims.length === 2) {
    let front = [];
    let best = -Infinity;
    points.forEach((p) => {
      let last = front[front.length - 1];
      if (p.v[1] > best) {
        front.push(p);
        best = p.v[1];
      } else if (last && last.v[0] === p.v[0] && last.v[1] === p.v[1]) {
        front.push(p);
      }
    });
    return front.map((p) => p.row);
  }
  let beats = (q, p) => {
    let better = false;
    for (let i = 0; i < dims.length; i++) {
      if (q.v[i] < p.v[i]) return false;
      if (q.v[i] > p.v[i]) better = true;
    }
    return better;
  };
  let front = [];
  points.forEach((p) => {
    if (!front.some((q) => beats(q, p))) front.push(p);
  });
  return front.map((p) => p.row);
}

/**
 * The first `count` fronts, best first: the front, then the front of what it
 * leaves, and so on (non-dominated sorting). The second front holds the
 * options beaten only by the first; with noisy values those could be as good.
 * Fewer come back when the rows run out.
 */
export function paretoFronts(rows, dims, directions, count) {
  let fronts = [];
  let left = rows;
  while (fronts.length < count && left.length > 0) {
    let front = paretoFront(left, dims, directions);
    fronts.push(front);
    let taken = new Set(front);
    left = left.filter((row) => !taken.has(row));
  }
  return fronts;
}

/**
 * Everything showing or keeping the best trade-offs needs, in one:
 * `{ rows, fronts, kept, caveats }`, the rows compared (those with a value on
 * every dimension), the first `fronts` fronts among them, their rows
 * together, and frontCaveats. `info` is `{ rows, dims, directions, fronts,
 * isMissing, scoped, skipped, unset }`; see rowsWithValues and frontCaveats.
 */
export function tradeOffs(info) {
  let values = rowsWithValues(info.rows, info.dims, info.isMissing);
  let fronts = paretoFronts(values.rows, info.dims, info.directions, info.fronts || 1);
  return {
    rows: values.rows,
    fronts: fronts,
    kept: [].concat(...fronts),
    caveats: frontCaveats({
      dims: info.dims,
      directions: info.directions,
      rows: values.rows,
      front: fronts[0] || [],
      missing: values.missing,
      scoped: info.scoped,
      skipped: info.skipped,
      unset: info.unset,
    }),
  };
}

/**
 * The corners of a two-goal front drawn as steps, in data units: the front's
 * rows by x, joined through the corner that is the worse of each neighbour
 * pair on both goals, so the line bounds what the front beats.
 */
export function frontSteps(front, dims, directions) {
  let [x, y] = dims;
  let sorted = front.slice().sort((a, b) => a[x] - b[x] || a[y] - b[y]);
  let worse = (a, b, i) =>
    directions[i] === "min" ? Math.max(a, b) : Math.min(a, b);
  let points = [];
  sorted.forEach((row, i) => {
    if (i > 0) {
      let previous = sorted[i - 1];
      points.push([worse(previous[x], row[x], 0), worse(previous[y], row[y], 1)]);
    }
    points.push([row[x], row[y]]);
  });
  return points;
}

function names(dims, conjunction) {
  let labels = dims.map(displayName);
  if (labels.length === 1) return labels[0];
  return (
    labels.slice(0, -1).join(", ") +
    " " +
    (conjunction || "and") +
    " " +
    labels[labels.length - 1]
  );
}

function withGoal(dim, direction) {
  let mark = GOAL_MARKS[direction];
  return displayName(dim) + (mark ? " " + mark.mark : "");
}

function fixed(value) {
  return value.toFixed(2).replace("-", "−");
}

function distinctCount(rows, dim, limit) {
  let seen = new Set();
  for (let i = 0; i < rows.length && seen.size <= limit; i++) seen.add(rows[i][dim]);
  return seen.size;
}

/**
 * What to know before trusting a front, as `{ key, text, detail, warn,
 * sentence }`: a few words to show, the whole of it a line each for
 * hovering, whether it is a warning, and for the most telling warnings a
 * sentence the assistant can say after its answer.
 *
 * `info` is `{ dims, directions, rows, front, missing, scoped, skipped,
 * unset }`: the dimensions and their directions; the rows compared and the
 * front among them; `missing` from rowsWithValues; whether the rows are a
 * narrowed part of the collection; dimensions left out (custom and weighted
 * ones, which a filter can't hold); and dimensions whose direction didn't
 * come from a goal.
 */
export function frontCaveats(info) {
  let dims = info.dims;
  let directions = info.directions;
  let rows = info.rows || [];
  let front = info.front || [];
  let caveats = [
    {
      key: "about",
      text: "When a front helps",
      detail: [
        "It keeps the options no other option beats on every goal.",
        "It is most telling when the goals are results that pull against each other: the final population of a multi-objective optimisation approximates one, as does a well-spread sweep of the design space.",
        "It says nothing about how much better an option is: one at an end of the front can be poor on the other goals.",
        "Small differences decide it, so with simulation noise the options just behind it could be as good. Keeping the next front too adds those beaten only by the front, as a buffer.",
        "A value far outside the rest, such as a failed run's, can take a place on the front and push sound options behind it.",
      ],
    },
  ];

  let inputs = dims.filter((dim) => columnKind(dim) === INPUT);
  if (inputs.length > 0) {
    let one = inputs.length === 1;
    caveats.push({
      key: "inputs",
      text: names(inputs) + (one ? " is a design input" : " are design inputs"),
      detail: [
        "A front over inputs picks extremes of what was chosen, not the best results. Use outputs.",
      ],
      sentence:
        names(inputs) +
        (one ? " is a design input" : " are design inputs") +
        ", so this picks extremes of what was chosen rather than the best results.",
      warn: true,
    });
  }

  // Goal-adjusted: positive means better goes with better.
  if (rows.length >= MIN_ROWS) {
    let agree = [];
    let trade = [];
    for (let i = 0; i < dims.length; i++) {
      for (let j = i + 1; j < dims.length; j++) {
        let rho = spearmanOf(
          rows.map((row) => row[dims[i]]),
          rows.map((row) => row[dims[j]])
        );
        if (rho === null) continue;
        let sign = (directions[i] === "min" ? -1 : 1) * (directions[j] === "min" ? -1 : 1);
        let pair = { dims: [dims[i], dims[j]], rho: rho * sign };
        if (pair.rho >= AGREE) agree.push(pair);
        else if (pair.rho <= TRADE) trade.push(pair);
      }
    }
    if (agree.length > 0) {
      let first = agree[0];
      caveats.push({
        key: "agree",
        text:
          agree.length === 1
            ? names(first.dims) + " don't trade off"
            : agree.length + " pairs don't trade off",
        detail: agree
          .map(
            (pair) =>
              names(pair.dims) +
              " mostly improve together (ρ " +
              fixed(pair.rho) +
              ")."
          )
          .concat([
            "So the front is short and names the options best on both, not a range of compromises.",
          ]),
        sentence:
          names(first.dims) +
          " mostly improve together, so " +
          (dims.length === 2
            ? "these are simply the best on both."
            : "they count almost as one goal here."),
        warn: true,
      });
    } else if (dims.length === 2 && trade.length === 1) {
      caveats.push({
        key: "trade",
        text: names(dims) + " trade off",
        detail: [
          "Improving one tends to cost the other (ρ " +
            fixed(trade[0].rho) +
            "): the front is the menu of best compromises.",
        ],
      });
    }
  }

  // The first front only: the ones kept behind it are there by choice.
  let share = rows.length > 0 ? front.length / rows.length : 0;
  if (dims.length >= MANY_GOALS || (rows.length >= MIN_ROWS && share > LARGE_SHARE)) {
    caveats.push({
      key: "size",
      text: "The front keeps " + Math.round(share * 100) + "%",
      detail: [
        "With many goals most options are beaten on none, so the front holds much of the collection.",
        "Use fewer goals, or weigh them into a weighted dimension to rank the options.",
      ],
      sentence: "With this many goals most options are beaten on none.",
      warn: true,
    });
  }

  let missing = info.missing || { total: 0 };
  if (missing.total > 0) {
    let lacking = dims.filter((dim) => missing[dim] > 0);
    caveats.push({
      key: "missing",
      text:
        missing.total +
        (missing.total === 1 ? " option left out" : " options left out"),
      detail: [
        (missing.total === 1 ? "It lacks" : "They lack") +
          " a value for " +
          names(lacking, "or") +
          ", so " +
          (missing.total === 1 ? "it" : "they") +
          " can't be compared.",
      ],
    });
  }

  let few = dims.filter((dim) => distinctCount(rows, dim, FEW_VALUES) <= FEW_VALUES);
  if (rows.length > FEW_VALUES && few.length > 0) {
    caveats.push({
      key: "few",
      text:
        few.length === 1
          ? displayName(few[0]) + " has few values"
          : few.length + " goals have few values",
      detail: [
        names(few) +
          (few.length === 1 ? " has" : " have") +
          " only a few distinct values: many options tie, and the front keeps every tied one.",
      ],
    });
  }

  if (info.scoped) {
    caveats.push({
      key: "scoped",
      text: "Over the current " + rows.length + " options",
      detail: [
        "The filters narrowed the collection; the front is of what remains.",
      ],
    });
  }

  let unset = info.unset || [];
  if (unset.length > 0) {
    caveats.push({
      key: "unset",
      text:
        "Assumed " +
        unset.map((dim) => withGoal(dim, directions[dims.indexOf(dim)])).join(", "),
      detail: [
        names(unset) +
          (unset.length === 1 ? " has" : " have") +
          " no goal, so which way is better came from your words or the name. Set goals in Dimensions to say.",
      ],
      sentence:
        unset
          .map((dim) => withGoal(dim, directions[dims.indexOf(dim)]))
          .join(" and ") +
        (unset.length === 1 ? " was assumed, as it has no goal." : " were assumed, as they have no goals."),
      warn: true,
    });
  }

  let skipped = info.skipped || [];
  if (skipped.length > 0) {
    caveats.push({
      key: "skipped",
      text: names(skipped) + " left out",
      detail: [
        "Custom and weighted dimensions hold values that can still change, which would outdate the front.",
      ],
    });
  }
  return caveats;
}

/** The first warning's sentence, for saying after an answer; "" when none. */
export function frontWarning(caveats) {
  let warning = caveats.find((caveat) => caveat.warn && caveat.sentence);
  return warning ? warning.sentence : "";
}
