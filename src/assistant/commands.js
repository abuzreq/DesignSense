/**
 * What the assistant can actually do.
 *
 * This registry is the spine of the feature, not an accessory to it. One entry
 * per command gives the parser its target vocabulary, the command list its
 * contents, the bar its confirmation text, and every action a single place to
 * be right. Nothing here knows about natural language.
 *
 * Every command goes through an existing store action wherever one exists, so
 * the assistant inherits undo, the filter chips and the history for free. That
 * is what makes a misparse cheap: whatever it did is visible in the chip bar
 * and one Ctrl+Z from gone.
 */

import { GALLERY_KEY, makeMembersFilter, rangeKey } from "@/store/filters.js";
import { isMissingFor } from "@/store/dimensions.js";
import {
  PARETO_FILTER_KEY,
  PARETO_LABEL,
  frontCaveats,
  frontWarning,
  paretoFront,
  rowsWithValues,
} from "@/analysis/pareto.js";
import { operations } from "@/components/operations.js";
import {
  cluster,
  correlations,
  describeGroup,
  describeRelation,
  extreme,
  nearest,
  pretty,
  stat,
  whyExcluded,
} from "./answers.js";

/* ---------------------------------------------------------------- helpers -- */

function bounds(rows, dim) {
  let low = Infinity;
  let high = -Infinity;
  for (let row of rows) {
    let value = Number(row[dim]);
    if (!Number.isFinite(value)) continue;
    if (value < low) low = value;
    if (value > high) high = value;
  }
  return low === Infinity ? null : [low, high];
}

/** A comparator becomes a closed range, because that is what a filter is here. */
function rangeFor(rows, dim, op, value, pair) {
  let span = bounds(rows, dim);
  if (!span) return null;
  if (op === "between") return [Math.min(pair[0], pair[1]), Math.max(pair[0], pair[1])];
  if (op === "gte") return [value, Math.max(span[1], value)];
  if (op === "lte") return [Math.min(span[0], value), value];
  return [value, value];
}

/** Rows the user is currently looking at: the filter result, or everything. */
function resultRows(ctx) {
  if (!ctx.getters.isFilterActive) return ctx.state.data;
  let selected = ctx.getters.selectedInMarking(ctx.state.defaultMarkingID);
  let ids = new Set(Object.keys(selected).filter((id) => selected[id]));
  return ctx.state.data.filter((row) => ids.has(String(row._id)));
}

function label(dim) {
  return String(dim).replace(/^(in|out|min|max|custom|weighted)\s*:\s*/i, "");
}

function count(n, noun) {
  return n + " " + noun + (n === 1 ? "" : "s");
}

/** Custom and weighted dimensions hold values still being decided, so nothing filters by them. */
function isUnfilterable(ctx, dim) {
  return (ctx.schema.unfilterable || []).includes(dim);
}

function refuseFilter(dim) {
  return {
    message:
      label(dim) +
      " is a custom or weighted dimension, so it can't be filtered by. Sort the gallery by it, or plot it, instead.",
  };
}

/** The numeric dimensions an analysis runs on by default: not the custom ones, which are often blank. */
function analysisDims(ctx) {
  return ctx.schema.numeric.filter((dim) => !isUnfilterable(ctx, dim));
}

/** Resolves the several ways an utterance can point at one option. */
function resolveItem(ctx, ref) {
  if (!ref) return null;
  let rows = resultRows(ctx);
  if (ref.by === "inspected") return ctx.state.hovered || ctx.state.lastHovered;
  if (ref.by === "id") {
    return ctx.state.data.find((row) => String(row._id) === String(ref.id)) || null;
  }
  if (ref.by === "ordinal") {
    let index = ref.n < 0 ? rows.length + ref.n : ref.n - 1;
    return rows[index] || null;
  }
  if (ref.by === "extreme") {
    return extreme(rows, ref.dim, ref.direction, 1)[0] || null;
  }
  return null;
}

function members(ctx, key, text, ids) {
  ctx.store.dispatch("applyMembersFilter", { key: key, label: text, ids: ids });
}

/**
 * "The 5 highest by price" as a range: the dimension's brushes narrowed to
 * the side of the value where those rows begin (its whole span when it has
 * no brush). A range draws on the axis and in the chip like any brush,
 * which a list of ids would not; the rows kept are the same, ties aside.
 */
function narrowToExtreme(ctx, dim, direction, count) {
  let values = resultRows(ctx)
    .map((row) => Number(row[dim]))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (values.length === 0) return { message: "No numbers in " + label(dim) + "." };
  let n = Math.max(1, Math.min(count, values.length));
  let threshold = direction === "min" ? values[n - 1] : values[values.length - n];
  let own = ctx.getters.boxesFor([dim]).map((box) => box[dim]);
  if (own.length === 0) {
    let span = bounds(ctx.state.data, dim);
    if (!span) return { message: "No numbers in " + label(dim) + "." };
    own = [span];
  }
  let ranges = own
    .map((r) =>
      direction === "min"
        ? [r[0], Math.min(r[1], threshold)]
        : [Math.max(r[0], threshold), r[1]]
    )
    .filter((r) => r[0] <= r[1]);
  if (ranges.length === 0) return { message: "Nothing in the results to keep." };
  ctx.store.dispatch("setRangeFilters", { ranges: { [dim]: ranges } });
}

/** Whether one row satisfies a `where` clause of ask.count. */
function holds(row, clause) {
  if (clause.op === "in" || clause.op === "not_in") {
    let value = String(row[clause.dim]).toLowerCase();
    let inside = (clause.values || []).some((v) => String(v).toLowerCase() === value);
    return clause.op === "in" ? inside : !inside;
  }
  let v = Number(row[clause.dim]);
  if (!Number.isFinite(v)) return false;
  if (clause.op === "gte") return v >= clause.value;
  if (clause.op === "lte") return v <= clause.value;
  if (clause.op === "eq") return v === Number(clause.value);
  if (clause.op === "ne") return v !== Number(clause.value);
  if (clause.op === "between") return v >= clause.range[0] && v <= clause.range[1];
  return false;
}

export function describeClause(clause) {
  let name = label(clause.dim);
  if (clause.op === "in") return name + " " + (clause.values || []).join(" or ");
  if (clause.op === "not_in") return name + " not " + (clause.values || []).join(" or ");
  if (clause.op === "between") return name + " " + clause.range[0] + "–" + clause.range[1];
  return name + " " + ({ gte: "≥", lte: "≤", eq: "=", ne: "≠" }[clause.op] || clause.op) + " " + clause.value;
}

/* --------------------------------------------------------------- registry -- */

/**
 * `run` returns `{ message }` to say something, or nothing when the chips and
 * the charts already show what happened.
 */
export const COMMANDS = {
  /* ---- narrowing --------------------------------------------------------- */
  "filter.range": {
    title: "Filter by a range",
    group: "Filter",
    run(ctx, args) {
      if (isUnfilterable(ctx, args.dim)) return refuseFilter(args.dim);
      // "not equal" is two ranges, which the range filter cannot hold; it is
      // a members filter over everything else instead.
      if (args.op === "ne") {
        let ids = ctx.state.data
          .filter((row) => Number(row[args.dim]) !== Number(args.value))
          .map((row) => row._id);
        members(ctx, "assistant:" + args.dim, label(args.dim) + " ≠ " + args.value, ids);
        return;
      }
      if (args.op === "any") {
        // "under 5000 or over 20000": one brush per clause, OR-ed on the dimension.
        if (args.clauses.some((c) => c.op === "ne")) {
          return { message: "I can combine ranges with or, but not a ≠." };
        }
        let spans = args.clauses.map((c) => rangeFor(ctx.state.data, args.dim, c.op, c.value, c.range));
        if (spans.some((s) => !s)) return { message: "I could not read any numbers in " + label(args.dim) + "." };
        ctx.store.dispatch("setRangeFilters", { ranges: { [args.dim]: spans } });
        return;
      }
      let span = rangeFor(ctx.state.data, args.dim, args.op, args.value, args.range);
      if (!span) return { message: "I could not read any numbers in " + label(args.dim) + "." };
      ctx.store.dispatch("setRangeFilters", { ranges: { [args.dim]: span } });
    },
  },
  "filter.topk": {
    title: "Keep the best few",
    group: "Filter",
    run(ctx, args) {
      if (isUnfilterable(ctx, args.dim)) return refuseFilter(args.dim);
      return narrowToExtreme(ctx, args.dim, args.direction, args.k);
    },
  },
  "filter.percentile": {
    title: "Keep a percentile band",
    group: "Filter",
    run(ctx, args) {
      if (isUnfilterable(ctx, args.dim)) return refuseFilter(args.dim);
      let rows = resultRows(ctx);
      let count = Math.max(1, Math.round((rows.length * args.percent) / 100));
      return narrowToExtreme(ctx, args.dim, args.direction === "bottom" ? "min" : "max", count);
    },
  },
  "filter.categorical": {
    title: "Filter by a category",
    group: "Filter",
    run(ctx, args) {
      let wanted = new Set(args.values.map((v) => String(v).toLowerCase()));
      let keep = args.op !== "not_in";
      let ids = ctx.state.data
        .filter((row) => wanted.has(String(row[args.dim]).toLowerCase()) === keep)
        .map((row) => row._id);
      let text = (keep ? "" : "not ") + args.values.join(", ");
      members(ctx, "assistant:" + args.dim, label(args.dim) + " " + text, ids);
    },
  },
  "filter.clear": {
    title: "Remove filters",
    group: "Filter",
    run(ctx, args) {
      if (!args.dim) {
        ctx.store.dispatch("clearFilters");
        return;
      }
      // Every brush on the dimension goes, a scatterplot rectangle over it too.
      ctx.store.dispatch("setRangeFilters", { clear: [args.dim] });
      ctx.store.dispatch("removeFilter", { key: "assistant:" + args.dim });
    },
  },
  "scope.zoom": { title: "Zoom in on the results", group: "Filter", run: (ctx) => ctx.store.dispatch("zoomToSelection") },
  "scope.exclude": { title: "Exclude the results", group: "Filter", run: (ctx) => ctx.store.dispatch("excludeSelection") },
  "scope.reset": { title: "Back to the full collection", group: "Filter", run: (ctx) => ctx.store.dispatch("resetData") },
  "scope.out": { title: "Zoom back out one step", group: "Filter", run: (ctx) => ctx.store.dispatch("undoDataTransformation") },
  "select.invert": {
    title: "Invert the selection",
    group: "Filter",
    run(ctx) {
      // The store inverts the selection in Expert and the filter result in Lite.
      if (ctx.getters.isLite && !ctx.getters.isFilterActive) {
        return { message: "Everything is shown; narrow it first, then invert." };
      }
      ctx.store.dispatch("invertSelection");
    },
  },
  "select.all": { title: "Select everything", group: "Filter", run: (ctx) => ctx.store.dispatch("selectAllInGallery") },

  /* ---- answering --------------------------------------------------------- */
  "ask.count": {
    title: "How many match",
    group: "Ask",
    run(ctx, args) {
      let rows = resultRows(ctx);
      let all = ctx.state.data.length;
      let where = (args && args.where) || [];
      if (where.length > 0) {
        // "how many match depth = 9": a count under a condition, not a filter.
        let matching = rows.filter((row) => where.every((clause) => holds(row, clause)));
        let said = where.map(describeClause).join(" and ");
        return {
          message: count(matching.length, "option") + " of " + rows.length + " have " + said + ".",
        };
      }
      return {
        message:
          rows.length === all
            ? count(all, "option") + " in the collection."
            : count(rows.length, "option") + " of " + all + " match your filters.",
      };
    },
  },
  "ask.stats": {
    title: "A statistic of one dimension",
    group: "Ask",
    run(ctx, args) {
      let rows = args.scope === "result" ? resultRows(ctx) : ctx.state.data;
      let value = stat(rows, args.dim, args.stat);
      if (value === null) return { message: "No numbers in " + label(args.dim) + "." };
      let text = Array.isArray(value)
        ? pretty(value[0]) + " to " + pretty(value[1])
        : pretty(value);
      return {
        message: args.stat + " " + label(args.dim) + " is " + text +
          " over " + count(rows.length, "option") + ".",
      };
    },
  },
  "ask.extreme": {
    title: "Which option is highest or lowest",
    group: "Ask",
    run(ctx, args) {
      let rows = extreme(resultRows(ctx), args.dim, args.direction, args.n || 1);
      if (rows.length === 0) return { message: "Nothing to compare." };
      ctx.store.dispatch("inspectByClick", { item: rows[0] });
      let word = args.direction === "min" ? "lowest" : "highest";
      return {
        message: word + " " + label(args.dim) + " is " +
          pretty(Number(rows[0][args.dim])) + ", now inspected.",
      };
    },
  },
  "ask.compare_selection": {
    title: "What the results have in common",
    group: "Ask",
    run(ctx) {
      let rows = resultRows(ctx);
      if (rows.length === ctx.state.data.length) {
        return { message: "Narrow the collection first, then I can say what stands out." };
      }
      let traits = describeGroup(ctx.state.data, rows.map((r) => r._id), analysisDims(ctx));
      if (traits.length === 0) return { message: "Nothing stands out numerically." };
      let parts = traits.map(
        (t) =>
          (t.effect > 0 ? "high " : "low ") + label(t.dim) +
          " (" + pretty(t.inside) + " against " + pretty(t.outside) + ")"
      );
      return { message: "These " + rows.length + " are mostly " + parts.join(", ") + "." };
    },
  },
  "ask.compare_sets": {
    title: "What separates two sets",
    group: "Ask",
    run(ctx, args) {
      let setsMap = ctx.state.setsMap || {};
      let a = setsMap[args.a];
      if (!a) return { message: "There is no set called " + args.a + "." };
      let inA = new Set(a.map(String));
      let b = args.b === "rest"
        ? ctx.state.data.filter((row) => !inA.has(String(row._id))).map((row) => row._id)
        : setsMap[args.b];
      if (!b) return { message: "There is no set called " + args.b + "." };
      let inB = new Set(b.map(String));
      let shared = a.filter((id) => inB.has(String(id))).length;
      let pool = ctx.state.data.filter((row) => inA.has(String(row._id)) || inB.has(String(row._id)));
      let traits = describeGroup(pool, a, analysisDims(ctx));
      let nameB = args.b === "rest" ? "the rest" : args.b;
      let head = args.a + " has " + a.length + ", " + nameB + " has " + b.length +
        (shared ? ", " + shared + " in both" : "") + ". ";
      if (traits.length === 0) return { message: head + "Nothing separates them numerically." };
      let parts = traits.slice(0, 3).map(
        (t) => (t.effect > 0 ? "higher " : "lower ") + label(t.dim) +
          " (" + pretty(t.inside) + " against " + pretty(t.outside) + ")"
      );
      return { message: head + args.a + " has " + parts.join(", ") + "." };
    },
  },
  "ask.correlation": {
    title: "What trades off against what",
    group: "Ask",
    run(ctx, args) {
      let dims = args.dims && args.dims.length >= 2 ? args.dims : analysisDims(ctx);
      let pairs = correlations(ctx.state.data, dims).slice(0, 3);
      if (pairs.length === 0) return { message: "No strong relationships between those." };
      return {
        message: pairs
          .map((p) => label(p.a) + " and " + label(p.b) + " are " + describeRelation(p.r) +
            " (r " + p.r.toFixed(2) + ")")
          .join("; ") + ".",
      };
    },
  },
  "ask.explain_exclusion": {
    title: "Why an option is missing",
    group: "Ask",
    run(ctx, args) {
      let item = resolveItem(ctx, args.item);
      if (!item) return { message: "Inspect an option first, then ask again." };
      let reasons = whyExcluded(ctx.getters.narrowingFilters, item);
      return {
        message: reasons.length === 0
          ? "That one does match your filters."
          : "It is held out by " + reasons.join(" and ") + ".",
      };
    },
  },
  "ask.capabilities": {
    title: "What the assistant can do",
    group: "Ask",
    run: () => ({ showHelp: true }),
  },

  /* ---- analysis ---------------------------------------------------------- */
  "analysis.pareto": {
    title: "Best trade-offs",
    group: "Analyse",
    run(ctx, args) {
      // The front becomes a filter chip, which custom values would outdate.
      let locked = args.dims.find((dim) => isUnfilterable(ctx, dim));
      if (locked) return refuseFilter(locked);
      // The current result, less a front kept before, so asking again
      // doesn't look only inside the last answer.
      let all = ctx.getters.tradeOffRows;
      let values = rowsWithValues(all, args.dims, isMissingFor);
      let front = paretoFront(values.rows, args.dims, args.directions);
      if (front.length === 0) {
        return { message: "No options have a value for all of those." };
      }
      members(ctx, PARETO_FILTER_KEY, PARETO_LABEL, front.map((r) => r._id));
      let goals = ctx.schema.goals || {};
      let caveats = frontCaveats({
        dims: args.dims,
        directions: args.directions,
        rows: values.rows,
        front: front,
        missing: values.missing,
        scoped: all.length < ctx.state.rawData.length,
        unset: args.dims.filter((dim) => !goals[dim]),
      });
      let message =
        count(front.length, "option") +
        (front.length === 1 ? " is" : " are") +
        (args.dims.length === 2 ? " not beaten on both." : " not beaten on every goal.");
      let warning = frontWarning(caveats);
      return { message: warning ? message + " " + warning : message };
    },
  },
  "analysis.cluster": {
    title: "Group into clusters",
    group: "Analyse",
    run(ctx, args) {
      let dims = args.dims && args.dims.length ? args.dims : analysisDims(ctx);
      let k = args.k || 4;
      let rows = resultRows(ctx);
      let groups = cluster(rows, dims, k);
      if (groups.length < 2) return { message: "Not enough complete rows to group on " + dims.map(label).join(", ") + "." };
      // Groups become sets, which is how the app already holds a named list.
      // Old cluster sets from a previous request are replaced, not stacked.
      Object.keys(ctx.state.setsMap || {})
        .filter((id) => /^Cluster \d+$/.test(id))
        .forEach((id) => ctx.store.commit("removeSet", { setID: id }));
      groups.forEach((group, i) => {
        ctx.store.dispatch("createSet", {
          members: group.ids,
          setName: "Cluster " + (i + 1),
          comment: "k-means on " + dims.map(label).join(", "),
        });
      });
      return {
        message: groups.length + " groups on " + dims.map(label).join(", ") + ", sizes " +
          groups.map((g) => g.ids.length).join(", ") + ", saved as sets Cluster 1–" + groups.length + ".",
      };
    },
  },
  "analysis.similar": {
    title: "Options like this one",
    group: "Analyse",
    run(ctx, args) {
      let item = resolveItem(ctx, args.item);
      if (!item) return { message: "Inspect an option first, then ask for similar ones." };
      let n = args.n || 5;
      let dims = analysisDims(ctx);
      let like = nearest(resultRows(ctx), dims, item, n);
      if (like.length === 0) return { message: "Nothing else has values on every dimension." };
      members(ctx, "assistant:similar", count(like.length, "option") + " like " + item._id, like.map((r) => r._id).concat([item._id]));
      return { message: "The " + like.length + " nearest on " + dims.length + " dimensions, plus the one you inspected." };
    },
  },
  "analysis.representatives": {
    title: "A spread of typical options",
    group: "Analyse",
    run(ctx, args) {
      let rows = resultRows(ctx);
      let step = Math.max(1, rows.length / args.n);
      let ids = [];
      for (let i = 0; i < args.n && Math.floor(i * step) < rows.length; i++) {
        ids.push(rows[Math.floor(i * step)]._id);
      }
      members(ctx, "assistant:representatives", count(ids.length, "example"), ids);
    },
  },

  /* ---- the workspace ----------------------------------------------------- */
  "view.sort": {
    title: "Sort the gallery",
    group: "View",
    run(ctx, args) {
      ctx.store.commit("setViewSetting", { key: "sortBy", value: args.dim });
      if (args.desc !== undefined) {
        ctx.store.commit("setViewSetting", { key: "sortDesc", value: args.desc });
      }
    },
  },
  "view.color": {
    title: "Colour by a dimension",
    group: "View",
    run: (ctx, args) => ctx.store.commit("changeColorColumn", args.dim),
  },
  "view.axes": {
    title: "Set the scatterplot axes",
    group: "View",
    run(ctx, args) {
      if (args.x) ctx.store.commit("setViewSetting", { key: "scatterX", value: args.x });
      if (args.y) ctx.store.commit("setViewSetting", { key: "scatterY", value: args.y });
    },
  },
  "view.open": {
    title: "Open a panel",
    group: "View",
    run(ctx, args) {
      if (args.view === "Clusters") {
        if (!ctx.getters.can("clustering")) return { message: "The clusters panel is an Expert-mode feature; say \"switch to expert mode\" first." };
        ctx.store.commit("setClusteringPanelOpen", { value: true });
        return;
      }
      // Not a panel but a reading over the whole collection, so it opens as
      // its own view rather than joining the layout.
      if (args.view === "Sensitivity") {
        if (!ctx.getters.can("sensitivity")) return { message: "The analysis panel is an Expert-mode feature; say \"switch to expert mode\" first." };
        ctx.store.dispatch("openSensitivity");
        return;
      }
      // The saved sets live in a drawer at the left edge; asked for, it stays.
      if (args.view === "Sets") {
        ctx.store.commit("setSetsDrawer", { open: true, pinned: true });
        return;
      }
      // Only the panels this app offers; the old SPLOM is not one of them.
      if (["Grid", "ScatterPlot", "ParallelCoordinatesPlot"].indexOf(args.view) < 0) {
        return { message: "I can open the gallery, scatterplot, parallel coordinates or clusters panel, the saved sets, or the analysis panel." };
      }
      ctx.store.commit("openLayout", { type: args.view });
    },
  },
  "view.close": {
    title: "Close a panel",
    group: "View",
    run(ctx, args) {
      if (args.view === "Clusters") {
        ctx.store.commit("setClusteringPanelOpen", { value: false });
        return;
      }
      if (args.view === "Sets") {
        ctx.store.commit("setSetsDrawer", { open: false });
        return;
      }
      ctx.store.commit("closeLayout", { type: args.view });
    },
  },
  "mode.set": {
    title: "Switch between Lite and Expert",
    group: "View",
    // The action takes the mode itself; an object would normalise to Lite.
    run: (ctx, args) => ctx.store.dispatch("setUiMode", args.mode),
  },

  /* ---- sets and session -------------------------------------------------- */
  "set.create": {
    title: "Save the results as a set",
    group: "Sets",
    run(ctx, args) {
      ctx.store.dispatch("createSet", { setName: args.name || null });
      return { message: "Saved" + (args.name ? " as " + args.name : "") + "." };
    },
  },
  "set.restore": {
    title: "Bring a set back",
    group: "Sets",
    run(ctx, args) {
      if (!ctx.state.setsMap[args.set]) return { message: "There is no set called " + args.set + "." };
      ctx.store.dispatch("restoreSet", { setID: args.set, operation: 0 });
    },
  },
  "set.update": {
    title: "Add to or remove from a set",
    group: "Sets",
    run(ctx, args) {
      if (!ctx.state.setsMap[args.set]) return { message: "There is no set called " + args.set + "." };
      // What "these" are: the selection in Expert, the result set in Lite.
      let ids = ctx.getters.isLite
        ? resultRows(ctx).map((row) => row._id)
        : Object.keys(ctx.getters.selectedInMarking(ctx.state.defaultMarkingID));
      if (ids.length === 0) return { message: "Nothing is selected to " + (args.operation === "add" ? "add." : "remove.") };
      ctx.store.commit("updateSet", {
        setID: args.set,
        members: ids,
        operation: args.operation === "subtract" ? operations.SUBTRACT : operations.ADD,
      });
      return {
        message: count(ids.length, "option") + (args.operation === "subtract" ? " removed from " : " added to ") +
          args.set + ", now " + ctx.state.setsMap[args.set].length + ".",
      };
    },
  },
  "set.clear": {
    title: "Delete every set",
    group: "Sets",
    run(ctx) {
      let ids = Object.keys(ctx.state.setsMap || {});
      if (ids.length === 0) return { message: "There are no sets." };
      ids.forEach((id) => ctx.store.commit("removeSet", { setID: id }));
      return { message: count(ids.length, "set") + " deleted." };
    },
  },
  "set.delete": {
    title: "Delete a set",
    group: "Sets",
    run(ctx, args) {
      if (!ctx.state.setsMap[args.set]) return { message: "There is no set called " + args.set + "." };
      ctx.store.commit("removeSet", { setID: args.set });
    },
  },
  "history.undo": { title: "Undo", group: "Session", run: (ctx) => ctx.store.dispatch("undo") },
  "history.redo": { title: "Redo", group: "Session", run: (ctx) => ctx.store.dispatch("redo") },
  "inspect.item": {
    title: "Inspect one option",
    group: "Session",
    run(ctx, args) {
      let item = resolveItem(ctx, args.item);
      if (!item) return { message: "I could not find that one." };
      ctx.store.dispatch("inspectByClick", { item: item });
    },
  },
  "inspect.clear": { title: "Stop inspecting", group: "Session", run: (ctx) => ctx.store.dispatch("clearInspection") },
  "export.csv": { title: "Download the results", group: "Session", run: (ctx) => ctx.store.dispatch("saveSelectedToFile") },
};

/** Grouped titles, for the help panel and the empty-input hint. */
export function catalogue() {
  let groups = {};
  Object.keys(COMMANDS).forEach((id) => {
    let entry = COMMANDS[id];
    (groups[entry.group] = groups[entry.group] || []).push(entry.title);
  });
  return groups;
}

/**
 * Runs one command, or a sequence of them. Returns whatever the app should
 * say; an empty message means the chips and charts already show it.
 */
export function runCommand(ctx, result) {
  if (result.command === "sequence") {
    let messages = [];
    for (let step of result.args.steps) {
      let said = runCommand(ctx, step);
      if (said && said.message) messages.push(said.message);
    }
    return { message: messages.join(" ") };
  }
  let entry = COMMANDS[result.command];
  if (!entry) return { message: "I do not have a command for that yet." };
  return entry.run(ctx, result.args || {}) || {};
}
