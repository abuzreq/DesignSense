/*
 * A snapshot of what the user is looking at: how the collection is narrowed,
 * which way is better for each dimension, the shortlist and the plotted pair.
 * The summary card is drawn from one, and a captured story step is one with
 * a note.
 *
 *   { v: 1, mode: "lite" | "expert", takenAt,
 *     filters: [...],       Lite's filters, as the store holds them
 *     steps: [...],         the Expert selection's steps (selectionLogic.js)
 *     shown: [id] | null,   the options in scope after a zoom or exclude;
 *                           null when every option is
 *     selected: [id] | null the options the filters or selection leave;
 *                           null when nothing narrows them
 *     goals: { dim: "max" | "min" },
 *     cart: [id],
 *     view: { sortBy, sortDesc, scatterX, scatterY, matrixDims },
 *     color: "", counts: { total, shown, selected } }
 *
 * IDs are the rows' `_id`s as strings. Kept free of Vue, so it can be checked
 * on its own.
 */

export const SNAPSHOT_VERSION = 1;

function copy(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

/** A snapshot of the store now. */
export function takeSnapshot(state, getters) {
  let lite = getters.isLite;
  let selectedIds = Object.keys(
    getters.selectedInMarking(state.defaultMarkingID) || {}
  );
  let narrowed = lite ? getters.isFilterActive : selectedIds.length > 0;
  let scoped = getters.hasScope;
  // The goals the user or the file set, as the best trade-offs use them: the
  // rating and weighted dimensions are better higher without anyone saying so.
  let goals = {};
  getters.goalDims.forEach((dim) => {
    let goal = getters.goalOf(dim);
    if (goal) goals[dim] = goal;
  });
  let view = copy(state.viewSettings);
  // What the scatterplot shows when no axis was chosen (see ScatterplotView).
  view.scatterX = view.scatterX || state.numericDimensions[0] || null;
  view.scatterY = view.scatterY || state.numericDimensions[1] || null;
  return {
    v: SNAPSHOT_VERSION,
    mode: state.uiMode,
    takenAt: Date.now(),
    filters: lite ? copy(state.filters) : [],
    steps: lite ? [] : copy(state.selectionSteps || []),
    shown: scoped ? state.data.map((row) => String(row._id)) : null,
    selected: narrowed ? selectedIds.map(String) : null,
    goals: goals,
    cart: state.cart.map(String),
    view: view,
    color: state.colorColumn || "",
    counts: {
      total: state.rawData.length,
      shown: state.data.length,
      selected: narrowed ? selectedIds.length : state.data.length,
    },
  };
}

/**
 * The rows a snapshot names, resolved against `rows` (the whole collection):
 * `{ shown, selected, cart }`, each a list of rows.
 */
export function snapshotRows(snapshot, rows) {
  let byId = new Map(rows.map((row) => [String(row._id), row]));
  let pick = (ids) => ids.map((id) => byId.get(String(id))).filter(Boolean);
  let shown = snapshot.shown ? pick(snapshot.shown) : rows;
  let selected = snapshot.selected ? pick(snapshot.selected) : shown;
  return { shown: shown, selected: selected, cart: pick(snapshot.cart || []) };
}
