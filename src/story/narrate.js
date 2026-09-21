/*
 * What a snapshot says, for the summary card: a title, the goals, the options
 * worth featuring, the plotted pair, and a few sentences of findings.
 *
 * The sentences are templates filled with exact statistics (the assistant's,
 * see assistant/answers.js), never generated text, so every number in them is
 * one the data gives. Each has an `id`, so a user's rewording of it can be
 * kept, and dropped again to go back to what the data says.
 *
 * Free of Vue and the store: it reads a snapshot (see snapshot.js) and rows.
 */

import { GOAL_MARKS, OUTPUT, columnKind, displayName, optionName } from "@/columns.js";
import { describeFilter, formatValue, isScopeFilter } from "@/store/filters.js";
import { describeSelection } from "@/store/selectionLogic.js";
import { correlations, describeGroup, describeRelation, pretty } from "@/assistant/answers.js";
import { frontCaveats, frontSteps, frontWarning, paretoFront, rowsWithValues } from "@/analysis/pareto.js";
import { RATING_DIMENSION } from "@/ratings.js";
import { snapshotRows } from "./snapshot.js";

// The card has room for this many options, and this many values on each.
export const MAX_FEATURED = 6;
const MAX_VALUES = 3;
// More axes than this and the card's parallel coordinates can't be read.
const MAX_AXES = 10;
// Below this standardised difference a group isn't set apart by a dimension.
const NOTABLE_EFFECT = 0.3;
// Goal-adjusted correlations at or past these are worth a sentence.
const TRADE = -0.3;
const AGREE = 0.5;

function plural(n, one, many) {
  return n.toLocaleString("en-US") + " " + (n === 1 ? one : many || one + "s");
}

/** "a", "a and b", "a, b and c". */
function listed(items, conjunction) {
  if (items.length <= 1) return items.join("");
  return items.slice(0, -1).join(", ") + " " + (conjunction || "and") + " " + items[items.length - 1];
}

function signed(value) {
  return value.toFixed(2).replace("-", "−");
}

function capitalised(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** How strongly two goals trade off, from their goal-adjusted correlation. */
function strength(adjusted) {
  let size = Math.abs(adjusted);
  return size > 0.7 ? " strongly" : size > 0.45 ? "" : " somewhat";
}

function sign(goal) {
  return goal === "min" ? -1 : 1;
}

function withMark(dim, goal) {
  let mark = GOAL_MARKS[goal];
  return displayName(dim) + (mark ? " " + mark.mark : "");
}

/** Each dimension's extent over `rows`, for writing ranges the way the charts do. */
function extentsOf(rows, dims) {
  let out = {};
  dims.forEach((dim) => {
    let lo = Infinity;
    let hi = -Infinity;
    rows.forEach((row) => {
      let v = Number(row[dim]);
      if (row[dim] === "" || row[dim] === null || !isFinite(v)) return;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    });
    out[dim] = lo <= hi ? [lo, hi] : null;
  });
  return out;
}

/** "price 5k – 15k", "year ≥ 2010", as SelectionDescription writes a literal. */
function rangeText(lit, bounds) {
  let name = displayName(lit.dim);
  let span = bounds ? bounds[1] - bounds[0] : lit.hi - lit.lo;
  let magnitude = Math.max(Math.abs(lit.lo), Math.abs(lit.hi));
  let from = formatValue(lit.lo, span, magnitude);
  let to = formatValue(lit.hi, span, magnitude);
  let atLow = bounds && lit.lo <= bounds[0];
  let atHigh = bounds && lit.hi >= bounds[1];
  if (!lit.negated) {
    if (from === to) return name + " = " + from;
    if (atLow && atHigh) return name + " any value";
    if (atLow) return name + " ≤ " + to;
    if (atHigh) return name + " ≥ " + from;
    return name + " " + from + " – " + to;
  }
  if (atLow && atHigh) return name + " missing";
  if (atLow) return name + " > " + to;
  if (atHigh) return name + " < " + from;
  if (from === to) return name + " ≠ " + from;
  return name + " not " + from + " – " + to;
}

function literalText(lit, extents) {
  if (lit.kind === "range") return rangeText(lit, extents[lit.dim]);
  return (lit.negated ? "not " : "") + lit.label;
}

/** How the snapshot's options were narrowed, as one sentence. */
function narrowingSentence(snapshot, rows, dims) {
  let counts = snapshot.counts;
  let scoped = snapshot.shown !== null && counts.shown < counts.total;
  let lead = scoped
    ? "Zoomed in on " + plural(counts.shown, "option") + " of " + counts.total.toLocaleString("en-US") + ". "
    : "";
  if (snapshot.selected === null) {
    return lead + (scoped ? "All of them were considered." : "All " + plural(counts.total, "option") + " were considered.");
  }
  let remain =
    counts.selected.toLocaleString("en-US") +
    " of " +
    (scoped ? counts.shown : counts.total).toLocaleString("en-US") +
    (counts.selected === 1 ? " option remains" : " options remain");

  if (snapshot.mode === "lite") {
    let texts = (snapshot.filters || [])
      .filter((filter) => !isScopeFilter(filter))
      .map((filter) => describeFilter(filter).text);
    if (texts.length === 0) return lead + remain + ".";
    return lead + remain + " after filtering for " + listed(texts) + ".";
  }

  let byId = new Map(rows.map((row) => [String(row._id), row]));
  let d = describeSelection(snapshot.steps || [], { rowOf: (id) => byId.get(String(id)) || null });
  let selected =
    counts.selected.toLocaleString("en-US") +
    " of " +
    (scoped ? counts.shown : counts.total).toLocaleString("en-US") +
    (counts.selected === 1 ? " option is" : " options are");
  if (!d.exact || d.nothing) {
    let n = d.steps.length;
    return lead + selected + " selected" + (n > 0 ? ", in " + plural(n, "step") : "") + ".";
  }
  let extents = extentsOf(rows, dims);
  let parts = d.common.map((lit) => literalText(lit, extents));
  if (d.any.length > 0) {
    let alternatives = d.any.map((term) => term.map((lit) => literalText(lit, extents)).join(" and "));
    parts.push(alternatives.length > 1 ? "either " + listed(alternatives, "or") : alternatives[0]);
  }
  let hand = [];
  if (d.picked.length > 0) hand.push(plural(d.picked.length, "option") + " picked by hand");
  if (d.unpicked.length > 0) hand.push(plural(d.unpicked.length, "option") + " left out by hand");
  let statement = d.everything ? "every option" : listed(parts);
  return (
    lead +
    selected +
    " selected: " +
    statement +
    (hand.length > 0 ? ", with " + listed(hand) : "") +
    "."
  );
}

const GROUP_NAMES = {
  shortlist: "the shortlisted options",
  front: "the best trade-offs",
  top: "the featured options",
  selected: "the featured options",
};

/** What sets the featured options apart from the rest in view. */
function standoutSentence(featured, source, pool, dims) {
  if (featured.length === 0 || featured.length >= pool.length) return "";
  let found = describeGroup(pool, featured.map((row) => row._id), dims).filter(
    (d) => Math.abs(d.effect) >= NOTABLE_EFFECT
  );
  if (found.length === 0) return "";
  let parts = found.slice(0, 2).map(
    (d) =>
      (d.effect > 0 ? "higher " : "lower ") +
      displayName(d.dim) +
      " (" +
      pretty(d.inside) +
      " against " +
      pretty(d.outside) +
      ")"
  );
  let who = GROUP_NAMES[source] || "the featured options";
  return "Compared with the rest, " + who + " have " + listed(parts) + ", by median.";
}

/** The strongest trade-off, or agreement, between goals; "" when none is telling. */
function tradeOffSentence(pool, goalDims, goals, outputDims) {
  if (goalDims.length >= 2) {
    let pairs = correlations(pool, goalDims).map((p) => ({
      a: p.a,
      b: p.b,
      r: p.r,
      adjusted: p.r * sign(goals[p.a]) * sign(goals[p.b]),
    }));
    let trade = pairs.filter((p) => p.adjusted <= TRADE).sort((x, y) => x.adjusted - y.adjusted)[0];
    // No r here: its sign is the values', not the goals', so a trade-off can
    // read as a positive correlation.
    if (trade) {
      return (
        capitalised(withMark(trade.a, goals[trade.a])) +
        " and " +
        withMark(trade.b, goals[trade.b]) +
        " pull against each other" +
        strength(trade.adjusted) +
        ": options better on one tend to be worse on the other."
      );
    }
    let agree = pairs.filter((p) => p.adjusted >= AGREE).sort((x, y) => y.adjusted - x.adjusted)[0];
    if (agree) {
      return (
        capitalised(withMark(agree.a, goals[agree.a])) +
        " and " +
        withMark(agree.b, goals[agree.b]) +
        " mostly improve together: options good on one tend to be good on the other."
      );
    }
    return "";
  }
  let strongest = correlations(pool, outputDims)[0];
  if (!strongest || Math.abs(strongest.r) < AGREE) return "";
  return (
    capitalised(displayName(strongest.a)) +
    " and " +
    displayName(strongest.b) +
    " are " +
    describeRelation(strongest.r) +
    " (r " +
    signed(strongest.r) +
    ")."
  );
}

/**
 * `{ rows, front, caveats }`: the best trade-offs among `pool` over every
 * goal, or null with fewer than two goals.
 */
function frontOf(pool, goalDims, goals, scoped) {
  if (goalDims.length < 2) return null;
  let directions = goalDims.map((dim) => goals[dim]);
  let values = rowsWithValues(pool, goalDims);
  let front = paretoFront(values.rows, goalDims, directions);
  return {
    rows: values.rows,
    front: front,
    caveats: frontCaveats({
      dims: goalDims,
      directions: directions,
      rows: values.rows,
      front: front,
      missing: values.missing,
      scoped: scoped,
    }),
  };
}

/**
 * The front's first warning worth a reader's time. The one about size says
 * "this many goals", which is wrong when a large share, not the count, set
 * it off.
 */
function caveatSentence(caveats, goalDims) {
  return frontWarning(
    caveats.filter((caveat) => caveat.key !== "size" || goalDims.length >= 4)
  );
}

function frontSentence(best, goalDims, goals, featured, source) {
  if (!best || best.front.length === 0) return "";
  let names = listed(goalDims.map((dim) => withMark(dim, goals[dim])));
  let text =
    plural(best.front.length, "option") +
    " of " +
    best.rows.length.toLocaleString("en-US") +
    (best.front.length === 1 ? " is a best trade-off" : " are best trade-offs") +
    " on " +
    names +
    ": no other option beats " +
    (best.front.length === 1 ? "it" : "them") +
    " on every goal.";
  if (source === "shortlist" && featured.length > 0) {
    let onFront = new Set(best.front);
    let k = featured.filter((row) => onFront.has(row)).length;
    text +=
      k === 0
        ? " None of the shortlisted options is among them."
        : k === featured.length
        ? featured.length === 1
          ? " The shortlisted option is one of them."
          : " Every shortlisted option is one of them."
        : " " + k + " of the " + featured.length + " shortlisted options are among them.";
  }
  return text;
}

/**
 * The options the card features, and where they came from: the shortlist,
 * else the best trade-offs among what is selected, else the selection's best
 * on its first goal, else the first of the selection.
 */
function featuredOf(parts, best, goalDims, goals) {
  if (parts.cart.length > 0) {
    return { rows: parts.cart.slice(0, MAX_FEATURED), source: "shortlist", total: parts.cart.length };
  }
  let selected = new Set(parts.selected);
  if (best) {
    let onFront = best.front.filter((row) => selected.has(row));
    if (onFront.length > 0 && onFront.length <= MAX_FEATURED * 3) {
      return { rows: onFront.slice(0, MAX_FEATURED), source: "front", total: onFront.length };
    }
  }
  if (goalDims.length > 0) {
    let dim = goalDims[0];
    let s = sign(goals[dim]);
    let ranked = parts.selected
      .filter((row) => isFinite(Number(row[dim])) && row[dim] !== "" && row[dim] !== null)
      .sort((a, b) => s * (Number(b[dim]) - Number(a[dim])));
    if (ranked.length > 0) {
      return { rows: ranked.slice(0, MAX_FEATURED), source: "top", total: parts.selected.length, by: dim };
    }
  }
  return {
    rows: parts.selected.slice(0, MAX_FEATURED),
    source: "selected",
    total: parts.selected.length,
  };
}

function featuredLabel(featured) {
  switch (featured.source) {
    case "shortlist":
      return featured.total > featured.rows.length
        ? "Shortlist (" + featured.rows.length + " of " + featured.total + ")"
        : "Shortlist";
    case "front":
      return "Best trade-offs";
    case "top":
      return "Best on " + displayName(featured.by);
    default:
      return "Selected options";
  }
}

/**
 * The parallel coordinates' axes: the ones the panel showed, in its order,
 * or else the goals, then the outputs, then the rest.
 */
function parallelDims(shown, numericDims, goals) {
  let usable = numericDims.filter((dim) => dim !== RATING_DIMENSION);
  if (shown && shown.length >= 2) {
    return shown.filter((dim) => numericDims.indexOf(dim) !== -1).slice(0, MAX_AXES);
  }
  let ordered = usable
    .filter((dim) => goals[dim])
    .concat(usable.filter((dim) => !goals[dim] && columnKind(dim) === OUTPUT))
    .concat(usable.filter((dim) => !goals[dim] && columnKind(dim) !== OUTPUT));
  return ordered.slice(0, MAX_AXES);
}

function defaultTitle(snapshot, featured) {
  if (featured.source === "shortlist") {
    return plural(featured.total, "design option") + " worth a closer look";
  }
  return "Summary of " + plural(snapshot.counts.total, "design option");
}

function dateText(time) {
  let date = new Date(time || Date.now());
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Everything the summary card shows, from a snapshot and the whole
 * collection's `rows`. `numericDims` are the numeric dimensions.
 *
 *   { title, subtitle, goals: [{ dim, name, mark, title }],
 *     featured: { label, source, items: [{ id, row, name, image, values, onFront }] },
 *     chart: { x, y, goals, rows, selected: Set, cart: Set, steps } | null,
 *     parallel: { dims, goals, rows, selected: Set, featured: Set } | null,
 *     sentences: [{ id, text }] }
 */
export function summarize(snapshot, rows, numericDims) {
  let parts = snapshotRows(snapshot, rows);
  let goals = snapshot.goals || {};
  let goalDims = numericDims.filter((dim) => goals[dim]);
  let outputDims = numericDims.filter((dim) => columnKind(dim) === OUTPUT);
  let pool = parts.shown;
  let scoped = snapshot.shown !== null || snapshot.selected !== null;
  let best = frontOf(parts.selected, goalDims, goals, scoped);
  let featured = featuredOf(parts, best, goalDims, goals);
  let onFront = new Set(best ? best.front : []);

  let valueDims = (goalDims.length > 0 ? goalDims : [snapshot.view.scatterX, snapshot.view.scatterY])
    .filter(Boolean)
    .slice(0, MAX_VALUES);
  let items = featured.rows.map((row) => ({
    id: String(row._id),
    row: row,
    name: optionName(row),
    image: row.image || null,
    onFront: onFront.has(row),
    values: valueDims.map((dim) => ({
      dim: dim,
      name: displayName(dim),
      mark: GOAL_MARKS[goals[dim]] ? GOAL_MARKS[goals[dim]].mark : "",
      text: row[dim] === "" || row[dim] === null || row[dim] === undefined ? "–" : pretty(Number(row[dim])),
    })),
  }));

  let sentences = [
    { id: "narrowing", text: narrowingSentence(snapshot, rows, numericDims) },
    {
      id: "standout",
      text: standoutSentence(
        featured.rows,
        featured.source,
        pool,
        goalDims.length > 0 ? goalDims.concat(outputDims.filter((d) => !goals[d])) : outputDims.length > 0 ? outputDims : numericDims
      ),
    },
    { id: "front", text: frontSentence(best, goalDims, goals, featured.rows, featured.source) },
    { id: "caveat", text: best ? caveatSentence(best.caveats, goalDims) : "" },
    { id: "tradeoff", text: tradeOffSentence(parts.selected, goalDims, goals, outputDims) },
  ].filter((s) => s.text);

  let x = snapshot.view.scatterX;
  let y = snapshot.view.scatterY;
  let selectedSet = new Set(parts.selected);
  let featuredSet = new Set(featured.source === "shortlist" ? parts.cart : featured.rows);
  let chart = null;
  if (x && y && x !== y) {
    let pairGoals = [goals[x] || null, goals[y] || null];
    let steps = [];
    if (pairGoals[0] && pairGoals[1]) {
      let values = rowsWithValues(parts.selected, [x, y]);
      steps = frontSteps(paretoFront(values.rows, [x, y], pairGoals), [x, y], pairGoals);
    }
    chart = {
      x: x,
      y: y,
      goals: pairGoals,
      rows: pool,
      selected: selectedSet,
      cart: featuredSet,
      steps: steps,
    };
  }

  let axes = parallelDims(snapshot.view.pcpDims, numericDims, goals);
  let parallel =
    axes.length >= 2
      ? { dims: axes, goals: goals, rows: pool, selected: selectedSet, featured: featuredSet }
      : null;

  let counts = snapshot.counts;
  let subtitle = [
    plural(counts.total, "option"),
    snapshot.selected !== null ? counts.selected.toLocaleString("en-US") + " in the result" : null,
    dateText(snapshot.takenAt),
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    title: defaultTitle(snapshot, featured),
    subtitle: subtitle,
    goals: goalDims.map((dim) => ({
      dim: dim,
      name: displayName(dim),
      mark: GOAL_MARKS[goals[dim]].mark,
      title: GOAL_MARKS[goals[dim]].title,
    })),
    featured: { label: featuredLabel(featured), source: featured.source, items: items },
    chart: chart,
    parallel: parallel,
    sentences: sentences,
  };
}
