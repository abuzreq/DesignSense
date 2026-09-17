import Vue from "vue";
import {
  CUSTOM,
  STORAGE_PREFIX,
  WEIGHTED,
  cleanValue,
  coverage,
  dependentsOf,
  fixedBounds,
  holdsFileValues,
  isCustom,
  isNumber,
  isWeighted,
  loadDefinitions,
  makeCustomDimension,
  makeWeightedDimension,
  numericExtents,
  parseStoredDimensions,
  readStored,
  removeStored,
  serializeDimensions,
  termCandidates,
  validateBounds,
  validateName,
  validateTerms,
  weightedValue,
  withoutDimension,
  writeStored,
} from "@/customDimensions.js";
import { columnKind, displayName, prefixedName } from "@/columns.js";
import { RATING_DIMENSION, RATING_STARS } from "@/ratings.js";

const VIEW_SETTINGS_ON_DIMENSIONS = ["sortBy", "scatterX", "scatterY"];
const UNSAVED_MESSAGE =
  "This browser doesn't allow saving, so custom dimensions last until the page is reloaded.";

function browserStorage() {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch (e) {
    return null;
  }
}

function numericColumnsOf(dataTypesMap) {
  return Object.keys(dataTypesMap).filter(
    (dim) => dataTypesMap[dim] === "Float" || dataTypesMap[dim] === "Number"
  );
}

function quoted(name) {
  return "“" + displayName(name) + "”";
}

/** An unrated option has no rating to weigh, rather than a rating of zero. */
export function isMissingFor(dim, value) {
  return !isNumber(value) || (dim === RATING_DIMENSION && !(value > 0));
}

/**
 * The part of the store that holds custom and weighted dimensions (see
 * customDimensions.js), for one dataset. Built before the store itself, so the
 * dimensions it loads are already on the rows when Vue first observes them.
 *
 * Dimensions the data file brings are columns of the data already; only those
 * added in DesignSense are appended to the store's lists of dimensions
 * (`names`). The file's can't be deleted, and resetting restores them as the
 * file has them.
 *
 * Values are written onto rows in place, never by replacing them in `data`,
 * which would rebuild every chart; `dimensionValuesVersion` tells views that
 * draw imperatively that values changed, ratings included.
 * `dimensionStructure` changes only when dimensions are added, removed or
 * drawn over a new range, which is when charts have to rebuild their axes.
 */
export function createDimensionsStore(rows, dataTypesMap, options) {
  const storage = browserStorage();
  const storageKey =
    options && options.datasetKey ? STORAGE_PREFIX + options.datasetKey : null;
  const numericColumns = numericColumnsOf(dataTypesMap);
  const rowById = new Map(rows.map((row) => [String(row._id), row]));

  // Weights scale a column by its range over the whole collection, so zooming
  // in doesn't change them. Custom and weighted columns have ranges of their own.
  const extents = numericExtents(
    rows,
    numericColumns.filter(
      (dim) =>
        dim !== RATING_DIMENSION &&
        columnKind(dim) !== CUSTOM &&
        columnKind(dim) !== WEIGHTED
    )
  );
  const scoringBounds = (defs) => (dim) => {
    let def = defs.find((d) => d.name === dim);
    if (def) return fixedBounds(def);
    if (dim === RATING_DIMENSION) return RATING_STARS;
    return extents[dim] || null;
  };

  const loaded = loadDefinitions({
    rows: rows,
    columns: Object.keys(dataTypesMap),
    numericColumns: numericColumns,
    stored: storageKey
      ? parseStoredDimensions(readStored(storage, storageKey))
      : null,
    boundsFor: scoringBounds,
    isMissing: isMissingFor,
  });
  // The file's own dimensions and values, for saving changes and resetting.
  const file = loaded.file;
  // What loading skipped, written back on every save.
  let preserved = {
    defs: loaded.skipped.defs,
    values: Object.assign({}, loaded.skipped.values, loaded.orphanValues),
  };

  /** What the data file holds for this row, or undefined. */
  function fileValue(name, row) {
    let original = file.values[name] || {};
    return Object.prototype.hasOwnProperty.call(original, row._id)
      ? original[row._id]
      : undefined;
  }

  /** A weighted dimension's values, or the file's where it has no weights. */
  function recomputeWeighted(state, def, row) {
    let apply;
    if (holdsFileValues(def)) {
      apply = (r) => {
        r[def.name] = fileValue(def.name, r);
      };
    } else {
      let boundsOf = scoringBounds(state.customDimensions);
      apply = (r) => {
        r[def.name] = weightedValue(r, def, boundsOf, isMissingFor);
      };
    }
    if (row) apply(row);
    else state.rawData.forEach(apply);
  }

  function dropFromViews(state, removed) {
    VIEW_SETTINGS_ON_DIMENSIONS.forEach((key) => {
      if (removed.includes(state.viewSettings[key])) {
        Vue.set(state.viewSettings, key, null);
      }
    });
    if (removed.includes(state.colorColumn)) state.colorColumn = "";
  }

  function persist(context) {
    if (!storageKey) return;
    let state = context.state;
    let payload = serializeDimensions(
      state.customDimensions,
      state.rawData,
      preserved,
      file
    );
    let error = null;
    if (
      payload.dimensions.length === 0 &&
      Object.keys(payload.values).length === 0
    ) {
      removeStored(storage, storageKey);
    } else {
      error = storage
        ? writeStored(storage, storageKey, payload)
        : UNSAVED_MESSAGE;
    }
    if (error !== state.dimensionStorageError) {
      context.commit("setDimensionStorageError", { error: error });
    }
  }

  function takenNames(state) {
    return state.allDimensions.concat(preserved.defs.map((def) => def.name));
  }

  const state = {
    customDimensions: loaded.defs,
    dimensionValuesVersion: 0,
    dimensionDialog: { open: false, mode: "manage", name: null },
    dimensionStorageError: storageKey && !storage ? UNSAVED_MESSAGE : null,
    skippedDimensions: loaded.skipped.defs.map((def) => def.name),
  };

  const getters = {
    customDimensionNames: (state) =>
      state.customDimensions.filter(isCustom).map((def) => def.name),
    weightedDimensionNames: (state) =>
      state.customDimensions.filter(isWeighted).map((def) => def.name),
    unfilterableDimensions: (state) =>
      state.customDimensions.map((def) => def.name),
    isUnfilterable: (state) => (dim) =>
      state.customDimensions.some((def) => def.name === dim),
    dimensionDef: (state) => (name) =>
      state.customDimensions.find((def) => def.name === name) || null,
    /** The fixed range a custom or weighted dimension is drawn over; null for others. */
    fixedBoundsOf: (state) => (dim) => {
      let def = state.customDimensions.find((d) => d.name === dim);
      return def ? fixedBounds(def) : null;
    },
    /** The range a weighted dimension scales a dimension by. */
    scoringBoundsOf: (state) => (dim) =>
      scoringBounds(state.customDimensions)(dim),
    weightedTermCandidates: (state) => (selfName) =>
      termCandidates(state.numericDimensions, state.customDimensions, selfName),
    dimensionCoverage: (state) => (name) => {
      void state.dimensionValuesVersion;
      let def = state.customDimensions.find((d) => d.name === name);
      return def ? coverage(state.rawData, def, isMissingFor) : null;
    },
    dimensionStructure: (state) =>
      state.customDimensions
        .map((def) => def.kind + ":" + def.name + ":" + fixedBounds(def).join(","))
        .join("|"),
  };

  const mutations = {
    addDimensionDefinition(state, payload) {
      let def = payload.def;
      state.customDimensions = state.customDimensions.concat([def]);
      let boundsOf = scoringBounds(state.customDimensions);
      state.rawData.forEach((row) => {
        Vue.set(
          row,
          def.name,
          isWeighted(def)
            ? weightedValue(row, def, boundsOf, isMissingFor)
            : undefined
        );
      });
      state.numericDimensions = state.numericDimensions.concat([def.name]);
      state.allDimensions = state.allDimensions.concat([def.name]);
      state.dimensionValuesVersion += 1;
    },
    /** A weighted dimension's new terms, or a custom dimension's new bounds. */
    replaceDimensionDefinition(state, payload) {
      let def = payload.def;
      state.customDimensions = state.customDimensions.map((d) =>
        d.name === def.name ? def : d
      );
      let affected = isWeighted(def)
        ? [def]
        : dependentsOf(state.customDimensions, def.name);
      affected.forEach((weighted) => recomputeWeighted(state, weighted));
      state.dimensionValuesVersion += 1;
    },
    removeDimensionDefinition(state, payload) {
      let result = withoutDimension(state.customDimensions, payload.name);
      state.customDimensions = result.defs;
      result.removed.forEach((name) => {
        state.rawData.forEach((row) => Vue.delete(row, name));
      });
      result.changed.forEach((def) => recomputeWeighted(state, def));
      state.numericDimensions = state.numericDimensions.filter(
        (dim) => !result.removed.includes(dim)
      );
      state.allDimensions = state.allDimensions.filter(
        (dim) => !result.removed.includes(dim)
      );
      dropFromViews(state, result.removed);
      state.dimensionValuesVersion += 1;
    },
    /** Removes the dimensions added here and restores the file's as loaded. */
    resetDimensionDefinitions(state) {
      let removed = state.customDimensions
        .filter((def) => !def.fromFile)
        .map((def) => def.name);
      removed.forEach((name) => {
        state.rawData.forEach((row) => Vue.delete(row, name));
      });
      state.customDimensions = file.defs.slice();
      file.defs.forEach((def) => {
        state.rawData.forEach((row) => {
          row[def.name] = fileValue(def.name, row);
        });
      });
      state.numericDimensions = state.numericDimensions.filter(
        (dim) => !removed.includes(dim)
      );
      state.allDimensions = state.allDimensions.filter(
        (dim) => !removed.includes(dim)
      );
      state.skippedDimensions = [];
      dropFromViews(state, removed);
      state.dimensionValuesVersion += 1;
    },
    setDimensionValue(state, payload) {
      let row = rowById.get(String(payload.id));
      if (!row || row[payload.dim] === payload.value) return;
      row[payload.dim] = payload.value;
      dependentsOf(state.customDimensions, payload.dim).forEach((def) =>
        recomputeWeighted(state, def, row)
      );
      state.dimensionValuesVersion += 1;
    },
    clearDimensionValues(state, payload) {
      state.rawData.forEach((row) => {
        row[payload.name] = undefined;
      });
      dependentsOf(state.customDimensions, payload.name).forEach((def) =>
        recomputeWeighted(state, def)
      );
      state.dimensionValuesVersion += 1;
    },
    /** A value outside the custom dimensions changed, such as a rating. */
    refreshDerivedValues(state, payload) {
      let row = rowById.get(String(payload.id));
      let affected = dependentsOf(state.customDimensions, payload.dim);
      if (!row || affected.length === 0) return;
      affected.forEach((def) => recomputeWeighted(state, def, row));
      state.dimensionValuesVersion += 1;
    },
    setDimensionDialog(state, payload) {
      state.dimensionDialog = Object.assign(
        { open: false, mode: "manage", name: null },
        payload
      );
    },
    setDimensionStorageError(state, payload) {
      state.dimensionStorageError = payload.error;
    },
  };

  /*
   * Actions answer `{ ok: true }` or `{ error }`, for dialogs to show. Changes
   * are saved when they are final: a drag or a dialog edit in progress isn't
   * written on every step.
   */
  const actions = {
    openDimensionDialog(context, payload) {
      context.commit(
        "setDimensionDialog",
        Object.assign({ open: true }, payload)
      );
    },
    closeDimensionDialog(context) {
      context.commit("setDimensionDialog", { open: false });
    },
    /** `name` is the name to show; the dimension's column is "custom:" and that name. */
    createCustomDimension(context, payload) {
      let label = validateName(payload.name, takenNames(context.state));
      if (label.error) return { error: label.error };
      let bounds = validateBounds([payload.min, payload.max]);
      if (bounds.error) return { error: bounds.error };
      let name = prefixedName(CUSTOM, label.name);
      context.commit("addDimensionDefinition", {
        def: makeCustomDimension(name, bounds.bounds),
      });
      persist(context);
      return { ok: true, name: name };
    },
    /** `name` is the name to show; the dimension's column is "weighted:" and that name. */
    createWeightedDimension(context, payload) {
      let label = validateName(payload.name, takenNames(context.state));
      if (label.error) return { error: label.error };
      let terms = validateTerms(
        payload.terms,
        context.getters.weightedTermCandidates(null)
      );
      if (terms.error) return { error: terms.error };
      let name = prefixedName(WEIGHTED, label.name);
      context.commit("addDimensionDefinition", {
        def: makeWeightedDimension(name, terms.terms),
      });
      persist(context);
      return { ok: true, name: name };
    },
    /**
     * Weights apply as they are edited; `final` saves them. A weighted
     * dimension from the file may be left without weights, which brings back
     * the file's values.
     */
    updateWeightedDimension(context, payload) {
      let def = context.getters.dimensionDef(payload.name);
      if (!isWeighted(def)) return { error: "That dimension is gone." };
      let terms =
        def.fromFile && (payload.terms || []).length === 0
          ? { terms: [] }
          : validateTerms(
              payload.terms,
              context.getters.weightedTermCandidates(def.name)
            );
      if (terms.error) return { error: terms.error };
      context.commit("replaceDimensionDefinition", {
        def: makeWeightedDimension(def.name, terms.terms, {
          fromFile: def.fromFile,
          bounds: def.bounds,
        }),
      });
      if (payload.final) persist(context);
      return { ok: true };
    },
    /** New bounds must hold every value already entered; values aren't clamped behind the user's back. */
    updateCustomBounds(context, payload) {
      let def = context.getters.dimensionDef(payload.name);
      if (!isCustom(def)) return { error: "That dimension is gone." };
      let bounds = validateBounds(payload.bounds);
      if (bounds.error) return { error: bounds.error };
      let lo = bounds.bounds[0];
      let hi = bounds.bounds[1];
      let outside = context.state.rawData.filter((row) => {
        let value = row[def.name];
        return isNumber(value) && (value < lo || value > hi);
      }).length;
      if (outside > 0) {
        return {
          error:
            outside +
            (outside === 1 ? " value falls" : " values fall") +
            " outside " +
            lo +
            "–" +
            hi +
            ". Change or clear " +
            (outside === 1 ? "it" : "them") +
            " first.",
        };
      }
      context.commit("replaceDimensionDefinition", {
        def: makeCustomDimension(def.name, bounds.bounds, def.fromFile),
      });
      persist(context);
      return { ok: true };
    },
    deleteDimension(context, payload) {
      let def = context.getters.dimensionDef(payload.name);
      if (!def) return { error: "That dimension is gone." };
      if (def.fromFile) {
        return {
          error:
            quoted(def.name) +
            " is a column of the data file, so it can't be deleted. Hide its axis instead.",
        };
      }
      context.commit("removeDimensionDefinition", { name: payload.name });
      persist(context);
      return { ok: true };
    },
    clearDimensionValues(context, payload) {
      if (!isCustom(context.getters.dimensionDef(payload.name))) {
        return { error: "Only custom dimensions hold entered values." };
      }
      context.commit("clearDimensionValues", { name: payload.name });
      persist(context);
      return { ok: true };
    },
    /**
     * Removes every custom and weighted dimension added to this dataset, saved
     * ones included, and returns those of the data file to the file's values.
     */
    resetCustomDimensions(context) {
      context.commit("resetDimensionDefinitions");
      preserved = { defs: [], values: {} };
      removeStored(storage, storageKey);
      context.commit("setDimensionStorageError", { error: null });
      return { ok: true };
    },
    /** `value` is typed or dragged; blank clears it. Only custom dimensions take values. */
    setDimensionValue(context, payload) {
      let def = context.getters.dimensionDef(payload.dim);
      if (!isCustom(def)) return { error: "Only custom dimensions take values." };
      context.commit("setDimensionValue", {
        dim: def.name,
        id: payload.id,
        value: cleanValue(payload.value, def.bounds),
      });
      if (payload.final) persist(context);
      return { ok: true };
    },
    saveDimensions(context) {
      persist(context);
    },
  };

  return {
    names: loaded.defs.filter((def) => !def.fromFile).map((def) => def.name),
    state: state,
    getters: getters,
    mutations: mutations,
    actions: actions,
  };
}
