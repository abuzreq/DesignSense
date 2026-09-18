/**
 * Filters are how Lite mode narrows a collection. A filter is a predicate
 * rather than a snapshot of item IDs, so it can be named in a chip, redrawn on
 * any chart that shows its dimension, and re-evaluated when the data changes.
 *
 *   { key: "range:year", kind: "range", dims: ["year"],
 *     boxes: [{ year: [2004, 2012] }, { year: [1990, 2000] }], bounds: { year: [min, max] } }
 *   { key: "range:price|year", kind: "range", dims: ["price", "year"],
 *     boxes: [{ price: [5e3, 1e4], year: [2004, 2012] }, ...], bounds: {...} }
 *   { key: "set", kind: "members", label: "In Set #1", ids: [...], sourceId: "Set #1" }
 *   { key: "gallery", kind: "exclude", label: "Unselected in gallery", ids: [...] }
 *   { key: "scope:x1", kind: "members", scope: true, label: "Zoomed in", ids: [...], criteria: [...] }
 *
 * A range filter holds one or more boxes over its dimensions, OR-ed: an option
 * matches when it falls inside any box, and a box constrains only the
 * dimensions it names. One box per brush on an axis, one box per rectangle on
 * a scatterplot. Filters are AND-ed with each other.
 *
 * Filters are keyed, and writing a key replaces its filter. That is what makes
 * a brush movable: rewriting a dimension's boxes moves its brushes instead of
 * intersecting with the previous ones.
 *
 * Kept free of Vue and d3 so it can be exercised on its own.
 */

import { displayName } from "@/columns.js";

const RANGE_PREFIX = "range:";
const SCOPE_PREFIX = "scope:";

/** Two ranges closer than this share of the dimension's span are the same brush. */
export const RANGE_TOLERANCE = 1e-4;

export const GALLERY_KEY = "gallery";
const GALLERY_SELECTED_LABEL = "Selected in gallery";
const GALLERY_UNSELECTED_LABEL = "Unselected in gallery";
const COMPACT_UNITS = [
  [1e9, "B"],
  [1e6, "M"],
  [1e3, "k"],
];

function uniqueDims(dims) {
  return Array.from(new Set(Array.isArray(dims) ? dims : [dims]));
}

/** The key of the range filter over one dimension or a pair, whatever their order. */
export function rangeKey(dims) {
  return RANGE_PREFIX + uniqueDims(dims).slice().sort().join("|");
}

/** Returns `filters` itself when an equal filter is already there. */
export function upsertFilter(filters, filter) {
  let index = filters.findIndex((f) => f.key === filter.key);
  if (index < 0) return filters.concat([filter]);
  if (sameFilter(filters[index], filter)) return filters;
  let next = filters.slice();
  next[index] = filter;
  return next;
}

/** Returns `filters` itself when the key is absent, so callers can skip no-ops. */
export function removeFilterByKey(filters, key) {
  if (!filters.some((f) => f.key === key)) return filters;
  return filters.filter((f) => f.key !== key);
}

/**
 * Builds a range filter over `dims` from a list of boxes, each `{ dim: [lo, hi] }`,
 * clamped to the dimensions' `bounds` (`{ dim: [min, max] }`). A range that
 * covers its whole dimension constrains nothing and is dropped from its box,
 * so dragging a brush edge to edge along one axis filters only the other
 * axis; a box left with nothing is dropped, and with no boxes left the result
 * is null, which callers turn into a removal.
 */
export function makeRangeFilter(dims, boxes, bounds) {
  let list = uniqueDims(dims);
  let limits = bounds || {};
  let kept = [];
  boxes.forEach((box) => {
    let clean = {};
    let constrained = false;
    list.forEach((dim) => {
      let range = box[dim];
      if (!range) return;
      let lo = Math.min(range[0], range[1]);
      let hi = Math.max(range[0], range[1]);
      let limit = limits[dim];
      if (limit) {
        if (lo <= limit[0] && hi >= limit[1]) return;
        lo = Math.max(lo, limit[0]);
        hi = Math.min(hi, limit[1]);
      }
      clean[dim] = [lo, hi];
      constrained = true;
    });
    if (!constrained) return;
    if (kept.some((other) => sameBox(other, clean, list, limits))) return;
    kept.push(clean);
  });
  if (kept.length === 0) return null;
  let known = {};
  list.forEach((dim) => (known[dim] = limits[dim] || null));
  return {
    key: rangeKey(list),
    kind: "range",
    dims: list,
    boxes: kept,
    bounds: known,
  };
}

/** The boxes of the range filter over exactly these dimensions, or none. */
export function boxesFor(filters, dims) {
  let key = rangeKey(dims);
  let filter = filters.find((f) => f.key === key);
  return filter ? filter.boxes : [];
}

/**
 * Drops one box from a range filter; the filter goes with its last box.
 * Returns `filters` itself when there is no such box.
 */
export function removeFilterBox(filters, key, index) {
  let current = filters.find((f) => f.key === key);
  if (!current || current.kind !== "range") return filters;
  if (index < 0 || index >= current.boxes.length) return filters;
  if (current.boxes.length === 1) return removeFilterByKey(filters, key);
  let boxes = current.boxes.filter((box, i) => i !== index);
  return upsertFilter(filters, Object.assign({}, current, { boxes: boxes }));
}

export function makeMembersFilter(key, label, ids, sourceId) {
  return {
    key: key,
    kind: "members",
    label: label,
    ids: ids.slice(),
    sourceId: sourceId === undefined ? null : sourceId,
  };
}

/** Matches every option except the listed ones. */
export function makeExcludeFilter(key, label, ids) {
  return {
    key: key,
    kind: "exclude",
    label: label,
    ids: ids.map(String),
    sourceId: null,
  };
}

/** One predicate over data items that holds when every filter holds. */
export function compileFilters(filters) {
  let tests = filters.map((f) => {
    if (f.kind === "range") {
      // Each box as [dim, lo, hi] triples; an option is in a box when it is
      // inside every range the box names.
      let boxes = f.boxes.map((box) =>
        f.dims
          .filter((dim) => box[dim])
          .map((dim) => [dim, box[dim][0], box[dim][1]])
      );
      return (d) =>
        boxes.some((triples) =>
          triples.every((t) => d[t[0]] >= t[1] && d[t[0]] <= t[2])
        );
    }
    // Marking keys are strings while `_id` may be a number, so compare as strings.
    let ids = new Set(f.ids.map(String));
    if (f.kind === "exclude") return (d) => !ids.has(String(d._id));
    return (d) => ids.has(String(d._id));
  });
  return (d) => tests.every((test) => test(d));
}

export function applyFilters(filters, data) {
  let matches = compileFilters(filters);
  let ids = [];
  for (let i = 0; i < data.length; i++) {
    if (matches(data[i])) ids.push(data[i]._id);
  }
  return ids;
}

/**
 * `{ text, title }` for a chip, plus `boxes`, one `{ text, title }` per box
 * of a range filter, so the bar can offer each brush its own close button.
 */
export function describeFilter(filter) {
  if (isScopeFilter(filter)) {
    let count = filter.ids.length;
    let options = count + (count === 1 ? " option" : " options");
    let zoom = filter.kind === "members";
    let matching =
      filter.criteria.length > 0
        ? " matching " + filter.criteria.join(", ")
        : "";
    return {
      text: filter.label + " (" + count + ")",
      title:
        (zoom ? "Zoomed in on " : "Excluded ") +
        options +
        matching +
        (zoom ? ". Remove to zoom back out." : ". Remove to bring them back."),
    };
  }
  if (filter.kind !== "range") {
    let count = filter.ids.length;
    let options = count + (count === 1 ? " option" : " options");
    return {
      text: filter.label + " (" + count + ")",
      title:
        filter.label +
        ": " +
        options +
        (filter.kind === "exclude" ? " left out of the results" : ""),
    };
  }

  let boxes = filter.boxes.map((box) => describeBox(filter, box));
  return {
    text: boxes.map((b) => b.text).join(" OR "),
    title: boxes.map((b) => b.title).join(", or "),
    boxes: boxes,
  };
}

/** "year 2004 – 2012 & price 5k – 10k" for one box, in the filter's dimension order. */
function describeBox(filter, box) {
  let parts = filter.dims
    .filter((dim) => box[dim])
    .map((dim) => describeRange(dim, box[dim], filter.bounds[dim]));
  return {
    text: parts.map((p) => p.text).join(" & "),
    title: parts.map((p) => p.title).join(" and "),
  };
}

function describeRange(dim, range, bounds) {
  let lo = range[0];
  let hi = range[1];
  let name = displayName(dim);
  if (lo > hi) {
    return {
      text: name + ": none",
      title: "No " + name + " values fall inside this brush",
    };
  }
  let span = bounds ? bounds[1] - bounds[0] : hi - lo;
  let magnitude = Math.max(Math.abs(lo), Math.abs(hi));
  let from = formatValue(lo, span, magnitude);
  let to = formatValue(hi, span, magnitude);
  if (from === to) {
    return { text: name + " = " + from, title: name + " is exactly " + from };
  }
  let text = from + " – " + to;
  if (bounds && lo <= bounds[0]) text = "≤ " + to;
  else if (bounds && hi >= bounds[1]) text = "≥ " + from;
  return {
    text: name + " " + text,
    title: name + " between " + from + " and " + to,
  };
}

/**
 * Rounds to a precision that suits the dimension's spread, so a brushed year
 * reads 2005.4 rather than 2005.3719, and large values compact (1.25M).
 *
 * `magnitude` is how large the numbers shown alongside this one are. Values
 * read together -- the two ends of a range, the ticks of one axis -- pass the
 * same one, so they are written the same way: "5,000 – 15,000" rather than
 * "5000 – 15,000". Without it, the value is its own measure.
 */
export function formatValue(value, span, magnitude) {
  if (!isFinite(value)) return String(value);
  let abs = Math.abs(value);
  let scale =
    typeof magnitude === "number" && isFinite(magnitude)
      ? Math.abs(magnitude)
      : abs;
  if (scale >= 1e5 && abs >= 1e3) {
    let unit = COMPACT_UNITS.find((u) => abs >= u[0]);
    return Number((value / unit[0]).toPrecision(3)) + unit[1];
  }
  let decimals =
    span > 0
      ? Math.min(4, Math.max(0, Math.ceil(-Math.log10(span / 50))))
      : 2;
  let rounded = Number(value.toFixed(decimals));
  return scale >= 1e4 ? rounded.toLocaleString("en-US") : String(rounded);
}

/*
 * Gallery selection. Every option starts selected, so the gallery owns at most
 * one filter under GALLERY_KEY, in one of two shapes:
 *   - exclude: unselecting single options lists the unselected ids;
 *   - members: dragging a box lists exactly the selected ids. It stays even
 *     when emptied, so unselecting the last option never snaps back to "all".
 */

/** A predicate id -> is that option selected in the gallery. */
export function gallerySelectionTest(filters) {
  let filter = filters.find((f) => f.key === GALLERY_KEY);
  if (!filter) return () => true;
  let ids = new Set(filter.ids.map(String));
  if (filter.kind === "exclude") return (id) => !ids.has(String(id));
  return (id) => ids.has(String(id));
}

export function isSelectedInGallery(filters, id) {
  return gallerySelectionTest(filters)(id);
}

/** Selects or unselects `ids`; returns `filters` itself when nothing changes. */
export function setGallerySelected(filters, ids, selected) {
  let changed = ids.map(String);
  let current = filters.find((f) => f.key === GALLERY_KEY);
  if (!current) {
    if (selected || changed.length === 0) return filters;
    return upsertFilter(
      filters,
      makeExcludeFilter(GALLERY_KEY, GALLERY_UNSELECTED_LABEL, changed)
    );
  }

  // An exclusion lists unselected ids; an inclusion lists selected ones.
  let listed = current.kind === "exclude" ? !selected : selected;
  let next = new Set(current.ids.map(String));
  changed.forEach((id) => (listed ? next.add(id) : next.delete(id)));
  next = Array.from(next);

  if (current.kind === "exclude") {
    if (next.length === 0) return removeFilterByKey(filters, GALLERY_KEY);
    return upsertFilter(
      filters,
      makeExcludeFilter(GALLERY_KEY, GALLERY_UNSELECTED_LABEL, next)
    );
  }
  return upsertFilter(
    filters,
    makeMembersFilter(GALLERY_KEY, GALLERY_SELECTED_LABEL, next)
  );
}

/** Makes exactly `ids` selected. An empty list changes nothing. */
export function selectOnlyInGallery(filters, ids) {
  if (ids.length === 0) return filters;
  let unique = Array.from(new Set(ids.map(String)));
  return upsertFilter(
    filters,
    makeMembersFilter(GALLERY_KEY, GALLERY_SELECTED_LABEL, unique)
  );
}

export function clearGallerySelection(filters) {
  return removeFilterByKey(filters, GALLERY_KEY);
}

/*
 * Zoom and exclude. A scope filter narrows the data itself rather than the
 * result, so charts rescale to it and the other filters apply inside it.
 * Scopes are id sets, so they commute and any one can be removed on its own.
 */

/**
 * `action` is "zoom" (keep only `ids`) or "exclude" (drop `ids`). `criteria`
 * describes the filters that picked the ids, to explain the chip.
 */
export function makeScopeFilter(id, action, ids, criteria) {
  let zoom = action === "zoom";
  return {
    key: SCOPE_PREFIX + id,
    kind: zoom ? "members" : "exclude",
    scope: true,
    label: zoom ? "Zoomed in" : "Excluded",
    ids: ids.map(String),
    sourceId: null,
    criteria: (criteria || []).slice(),
  };
}

export function isScopeFilter(filter) {
  return filter.scope === true;
}

export function scopeFilters(filters) {
  return filters.filter(isScopeFilter);
}

/** The filters that narrow the result. Returns `filters` itself when there are no scopes. */
export function narrowingFilters(filters) {
  if (!filters.some(isScopeFilter)) return filters;
  return filters.filter((f) => !isScopeFilter(f));
}

/** Names the scopes in `filters`, to tell when the data must be recomputed. */
export function scopeSignature(filters) {
  return scopeFilters(filters)
    .map((f) => f.key)
    .join("|");
}

/** "scope", "range", "gallery" or "members", which decides a chip's color. */
export function filterTone(filter) {
  if (isScopeFilter(filter)) return "scope";
  if (filter.kind === "range") return "range";
  if (filter.key === GALLERY_KEY) return "gallery";
  return "members";
}

/** Whether two filter lists filter the same way, in any order. */
export function sameFilterList(a, b) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((f) => {
    let other = b.find((g) => g.key === f.key);
    return other !== undefined && sameFilter(f, other);
  });
}

/**
 * Whether two ranges are the same brush: within RANGE_TOLERANCE of `span`
 * (the dimension's spread) at both ends. Brushes are read back from pixels,
 * which never land on the exact stored value.
 */
export function sameRange(a, b, span) {
  let tolerance = Math.abs(span || 0) * RANGE_TOLERANCE;
  return (
    Math.abs(Math.min(a[0], a[1]) - Math.min(b[0], b[1])) <= tolerance &&
    Math.abs(Math.max(a[0], a[1]) - Math.max(b[0], b[1])) <= tolerance
  );
}

/** Whether two lists of ranges hold the same brushes, in any order. */
export function sameRangeList(a, b, span) {
  if (a.length !== b.length) return false;
  let left = b.slice();
  return a.every((range) => {
    let at = left.findIndex((other) => sameRange(range, other, span));
    if (at < 0) return false;
    left.splice(at, 1);
    return true;
  });
}

function spanOf(bounds, dim) {
  let limit = bounds && bounds[dim];
  return limit ? limit[1] - limit[0] : 0;
}

function sameBox(a, b, dims, bounds) {
  return dims.every((dim) => {
    if (!a[dim] && !b[dim]) return true;
    if (!a[dim] || !b[dim]) return false;
    return sameRange(a[dim], b[dim], spanOf(bounds, dim));
  });
}

function sameFilter(a, b) {
  if (a.kind !== b.kind || a.label !== b.label || a.sourceId !== b.sourceId) {
    return false;
  }
  if (a.kind === "range") {
    if (a.dims.length !== b.dims.length) return false;
    if (!a.dims.every((dim, i) => dim === b.dims[i])) return false;
    if (a.boxes.length !== b.boxes.length) return false;
    return a.boxes.every((box, i) => sameBox(box, b.boxes[i], a.dims, a.bounds));
  }
  if (a.ids.length !== b.ids.length) return false;
  for (let i = 0; i < a.ids.length; i++) {
    if (a.ids[i] !== b.ids[i]) return false;
  }
  return true;
}
