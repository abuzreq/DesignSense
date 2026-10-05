import Vue from "vue";
import Vuex from "vuex";
import views from "@/components/constants.js";
import { operations } from "@/components/operations.js";
import utils from "@/components/utils.js";

import * as d3 from "d3";

import { encodeUrl } from "@/data/shareLink.js";
import {
  DEFAULT_PRESET_ID,
  saveLayouts,
  defaultLayouts,
  loadPresetId,
  presetLayouts,
  savePresetId,
  withPanel,
  withoutPanel,
} from "@/layout.js";
import { UI_MODES, canUse, normalizeMode } from "@/uiModes.js";
import {
  GALLERY_KEY,
  applyFilters,
  compileFilters,
  describeFilter,
  filterTone,
  gallerySelectionTest,
  isScopeFilter,
  makeMembersFilter,
  makeRangeFilter,
  makeScopeFilter,
  narrowingFilters,
  boxesFor,
  rangeKey,
  removeFilterBox,
  removeFilterByKey,
  sameFilterList,
  scopeFilters,
  scopeSignature,
  selectOnlyInGallery as selectOnlyInGalleryFilters,
  setGallerySelected,
  upsertFilter,
} from "./filters.js";
import {
  RATING_BOUNDS,
  RATING_DIMENSION,
  isRated,
  isRating as isRatingDim,
} from "@/ratings.js";
import { NOTE_LIMIT } from "@/optionNotes.js";
import { createDimensionsStore } from "./dimensions.js";
import { createGoalsStore } from "./goals.js";
import { createStoryStore } from "./story.js";
import { STEP_OPS, describeSelection } from "./selectionLogic.js";
import { emptySets, openSession } from "./session.js";
import { addIds, removeIds, uniqueSetName } from "./cart.js";
import { asRows } from "./rows.js";
import { isDerivedAssetKey } from "@/data/assets.js";
import { INPUT, OUTPUT, columnKind } from "@/columns.js";
import {
  loadColorRamp,
  loadColorScheme,
  rampFor,
  saveColorRamp,
  saveColorScheme,
  schemeColorsFor,
} from "@/palettes.js";
// The same count that decides whether a dimension is drawn as a set of bars
// or as a histogram; see colorLevels for why the colours follow it.
import { MAX_LEVELS } from "@/analysis/summary.js";
import Papa from "papaparse";

const UI_MODE_KEY = "designsense-uiMode";
// Undo depth for both the Expert selection and the Lite filters.
const HISTORY_LIMIT = 50;

function readStoredUiMode() {
  try {
    return normalizeMode(localStorage.getItem(UI_MODE_KEY));
  } catch (e) {
    return UI_MODES.LITE;
  }
}

/** A layout the user arranged is no longer one of the presets. */
function forgetPreset(state) {
  if (!state.layoutPreset) return;
  state.layoutPreset = null;
  savePresetId(null);
}

function persistUiMode(mode) {
  try {
    localStorage.setItem(UI_MODE_KEY, mode);
  } catch (e) {
    /* ignore */
  }
}

/*
 * Colour carries a dimension across the views: the lines of the parallel
 * coordinates, and the gallery's cards.
 *
 * Viridis rather than the blue-to-red a lot of these tools use. Blue-to-red
 * diverges, which tells the reader there is a meaningful middle, and these
 * are plain measurements with no such point. Viridis also reads for the
 * colour-blind and rises steadily in lightness, so a dense bundle of
 * half-transparent lines still shows its value rather than only its density.
 */
// A spline through the chosen ordered ramp, the way d3 builds its own.
// Kept by id, since the ramps are twenty colours each and the scale is
// rebuilt whenever the collection or the colour column changes.
const RAMPS = {};
function sequential(id) {
  if (!RAMPS[id]) RAMPS[id] = d3.interpolateRgbBasis(rampFor(id).colors);
  return RAMPS[id];
}
// A value a scale cannot place: the same grey the small plots use.
const NO_COLOR = "#cfd8dc";
// Every option the same, for a collection nothing is coloured by. The first
// of the categorical colours, which is what this used to resolve to.
const DEFAULT_LINE_COLOR = "#4e79a7";

/**
 * What to colour by before anyone says: the first result the file declares.
 * Arbitrary among the results, but a chart in one flat colour tells the
 * reader nothing, and the picker beside it says what the colour means and
 * changes it in a click.
 *
 * A file that declares no results at all -- no "out:" column, and its
 * columns not yet given roles -- falls back to the first number there is,
 * for the same reason.
 */
function defaultColorColumn(allDimensions, numericDimensions) {
  let output = (allDimensions || []).find((dim) => columnKind(dim) === OUTPUT);
  if (output) return output;
  return (numericDimensions || [])[0] || "";
}

const VIEW_TYPE_LABELS = {
  ScatterPlot: "Scatterplot",
  ParallelCoordinatesPlot: "PCP",
  Grid: "Gallery",
  SPLOM: "SPLOM",
};

Vue.use(Vuex);

/**
 * `options.datasetKey` identifies the dataset across visits, for what is saved
 * per dataset; without one nothing is.
 */
function builder(
  new_data,
  dataTypesMap,
  new_layouts,
  new_similarity_map,
  options
) {
  const session = openSession(new_data, options && options.datasetKey);
  // Custom and weighted dimensions go onto the rows before Vue observes them,
  // the rating among them. Ratings a session saved before the rating was a
  // custom dimension are brought in there.
  const dimensions = createDimensionsStore(
    new_data,
    dataTypesMap,
    Object.assign({}, options, { legacyRatings: session.legacyRatings })
  );
  // Which way is better for each dimension (see store/goals.js).
  const goals = createGoalsStore(options);
  // The summary image and the captured story (see store/story.js).
  const story = createStoryStore(options);
  const store = new Vuex.Store({
    state: {
      // What a brush applies right now: the sticky operation, or a held modifier's.
      currentSelectionOperation: operations.REPLACE,
      // Chosen with the toolbar or number keys; restored when modifiers are released.
      stickySelectionOperation: operations.REPLACE,
      layouts: new_layouts,
      // The preset the layout came from, or null once panels were moved.
      layoutPreset: loadPresetId(),
      defaultMarkingID: utils.generateID(), //"_lqpkb07gn"
      // Frozen arrays, so Vue leaves the rows alone: see store/rows.js.
      rawData: asRows(new_data),
      data: asRows(new_data),
      dataStack: [],
      view2markingIDs: new Map(),
      markingID2views: new Map(),
      markingsMap: {}, // markingID -> marking object. Marking object is {altID -> highlightState}
      // Expert undo/redo, as arrays of selected IDs on the default marking.
      selectionHistory: [],
      selectionFuture: [],
      // How the Expert selection was built since its last Replace, for
      // describing it: `{ op, atom }` steps (see selectionLogic.js). Undo
      // and redo carry them along with the IDs.
      selectionSteps: [],
      // Markings are mutated in place, out of Vue's sight. Bumping this lets
      // getters such as selectionCount recompute.
      selectionVersion: 0,
      viewsMap: {},

      // Sets start as saved for this dataset (see store/session.js).
      setsIDs: session.sets.setsIDs,
      setsMetadataMap: session.sets.setsMetadataMap,
      setsMap: session.sets.setsMap,
      // The filters each set was saved from, or null for a hand-picked set.
      setsCriteriaMap: session.sets.setsCriteriaMap,
      // The set deleted last, so the deletion can be undone.
      lastRemovedSet: null,
      // The shortlist: options picked one at a time and kept aside through
      // filtering, brushing, zooming and mode switches, until they are saved
      // as a set. Ids, resolved against rawData, so a zoom never empties it.
      cart: session.cart,
      // A note on an option, by its id: why it's in or out, what to ask about
      // it. Saved with the session (see optionNotes.js).
      optionNotes: session.notes,
      // What the dataset's saved work is found by (see datasetKey in
      // customDimensions.js); null for the placeholder.
      datasetKey: (options && options.datasetKey) || null,
      // Whether the dialog listing the columns and their roles is open.
      columnsDialog: { open: false },
      // The shortlist before it was cleared or saved, so both can be undone.
      lastCart: null,
      // Which options the compare view is showing, and where they came from.
      compareDialog: { open: false, source: "cart", ids: [], setID: null },
      // Whether the sensitivity reading is open.
      sensitivityDialog: { open: false },
      // A message for the workspace's snackbar: { id, text, action }.
      notice: null,
      numericDimensions: getNumericDimensions(dataTypesMap).concat(
        dimensions.names
      ),
      nonNumericDimensions: getNonNumericDimensions(dataTypesMap),
      allDimensions: Object.keys(dataTypesMap).concat(dimensions.names),
      setsCounter: session.sets.setsCounter,

      similarity_map: new_similarity_map,

      isEditingMode: false,

      hovered: null,
      lastHovered: null,
      // Bumped whenever inspection is stopped on purpose (Esc, cancel, clicking
      // the inspected option again), unlike a hover that merely leaves an option.
      inspectionClears: 0,

      isCtrlKey: false,
      isShiftKey: false,
      isAltKey: false,
      isInspectionMode: false,
      isInspectionPinned: true,

      // Which Tableau palette of each kind the reader has settled on; the
      // kind to use is not theirs to pick, and follows the dimension (see
      // colorLevels). Kept in this browser, not with the dataset.
      colorRamp: loadColorRamp(),
      colorScheme: loadColorScheme(),
      colorColumn: defaultColorColumn(
        Object.keys(dataTypesMap),
        getNumericDimensions(dataTypesMap)
      ),

      uiMode: readStoredUiMode(),
      // Lite mode's filters (see store/filters.js) and their undo history.
      filters: [],
      filterHistory: [],
      filterFuture: [],
      // Which zoom and exclude filters `data` currently reflects.
      appliedScopeSignature: "",

      isOpeningDialogOn: true,
      // The guide, over the workspace (see guide/GuideDialog.vue), and the
      // heading of it to show: "" is its opening.
      guideDialog: { open: false, section: "" },
      isStudySharable: false,
      shareLink: null,

      // The scatterplot's side column holds the matrix or the clusters, not
      // both. The matrix is the way in to picking a plot, so it starts open.
      isMatrixPanelOpen: true,
      isClusteringPanelOpen: false,
      // The saved sets' drawer at the workspace's left edge. Always starts
      // closed. `pinned` is open until closed; unpinned it is open because the
      // pointer went to it or a set was just saved, and closes by itself.
      setsDrawer: { open: false, pinned: false },

      /*
       * Settings that belong to a view but have to be reachable from outside
       * it. The gallery's sort and the scatterplot's axes were component data,
       * which meant nothing else could set them -- not the assistant, not a
       * share link, not a saved layout.
       *
       * null means "the view picks its own default".
       */
      viewSettings: {
        sortBy: null,
        sortDesc: true,
        scatterX: null,
        scatterY: null,
        // The dimensions of the scatterplot matrix, in order.
        matrixDims: null,
      },
      ...dimensions.state,
      ...goals.state,
      ...story.state,
    },
    getters: {
      ...dimensions.getters,
      ...goals.getters,
      ...story.getters,
      /**
       * The values of the colour column when it names rather than measures,
       * in order; null when it measures, and so wants a ramp instead.
       *
       * Two things make a dimension one to name by. The first is that it is
       * not a number at all: "Oak" and "Steel" have no distance between
       * them to put along a ramp. The second is that it is a number taking
       * only a handful of values -- the three or four settings a sweep was
       * run at, or a type written down as 1, 2, 3. Those are labels wearing
       * a number's clothes, and a ramp spends its whole range on four
       * neighbouring shades that no reader can match back to the key, where
       * four hues name them outright.
       *
       * "A handful" is MAX_LEVELS, the count the analysis already uses to
       * decide whether to draw a dimension as a bar per value or as a
       * histogram. One judgement, so what the distribution says a dimension
       * is and what its colour says agree.
       *
       * Counted over `rawData`, not `data`: what a dimension *is* must not
       * change when a zoom leaves eight options on screen and every
       * measurement in them suddenly has few enough values to look like a
       * set of labels.
       */
      colorLevels: (state) => {
        let dim = state.colorColumn;
        if (!dim) return null;
        let numeric = state.numericDimensions.indexOf(dim) !== -1;
        let seen = new Map();
        for (let i = 0; i < state.rawData.length; i++) {
          let value = state.rawData[i][dim];
          if (value === undefined || value === null || value === "") continue;
          let key = String(value);
          if (seen.has(key)) continue;
          seen.set(key, value);
          // Too many for labels: it is a measurement after all.
          if (numeric && seen.size > MAX_LEVELS) return null;
        }
        if (seen.size === 0) return null;
        let values = Array.from(seen.values());
        // Numbers in their own order, so the palette walks the levels the
        // way the data does; text alphabetically, which is arbitrary but at
        // least the same every time.
        return numeric
          ? values.sort((a, b) => Number(a) - Number(b))
          : values.sort((a, b) => String(a).localeCompare(String(b)));
      },
      /**
       * The span the colour ramp covers, or null when what is coloured by is
       * not measured. Read from `data` rather than `rawData`, so zooming in
       * stretches the ramp over what is left and the chart keeps its range.
       */
      colorDomain: (state, getters) => {
        let dim = state.colorColumn;
        if (!dim || state.numericDimensions.indexOf(dim) === -1) return null;
        if (getters.colorLevels) return null;
        let span = d3.extent(state.data, (row) => Number(row[dim]));
        if (span[0] === undefined || isNaN(span[0])) return null;
        // One value, or all the same: put it in the middle of the ramp.
        if (span[0] === span[1]) return [span[0] - 0.5, span[1] + 0.5];
        return span;
      },
      /**
       * Always a function of one value. A set of labels gets Tableau's
       * categorical hues, a measurement its ordered ramp, and with nothing
       * chosen every option is the same.
       */
      colorScale: (state, getters) => {
        let levels = getters.colorLevels;
        if (levels) {
          // An explicit domain, so a value keeps its colour as the
          // collection is filtered rather than taking whichever is next.
          return d3
            .scaleOrdinal()
            .domain(levels)
            .range(schemeColorsFor(state.colorScheme, levels.length));
        }
        let domain = getters.colorDomain;
        if (domain) {
          return d3.scaleSequential(sequential(state.colorRamp)).domain(domain);
        }
        return () => DEFAULT_LINE_COLOR;
      },
      /**
       * An option's colour, always as #rrggbb: the gallery appends two more
       * digits to it for the card's tint, which only works on hex.
       */
      colorize: (state, getters) => (dataItem) => {
        let value = dataItem ? dataItem[state.colorColumn] : undefined;
        if (state.colorColumn && (value === undefined || value === null || value === ""))
          return NO_COLOR;
        let color = d3.color(getters.colorScale(value));
        return color ? color.formatHex() : NO_COLOR;
      },
      getEditingMode: (state) => state.isEditingMode,
      getMarking: (state) => (view) => {
        return findMarkingAffectingView(
          state.markingsMap,
          state.markingID2views,
          view
        );
      },
      data: (state) => {
        return state.data;
      },
      // Input and output parameters, by their "in:" and "out:" prefixes,
      // upper-cased as the parallel coordinates compare them.
      inputDimensions: (state) =>
        state.allDimensions
          .filter((dim) => columnKind(dim) === INPUT)
          .map((dim) => dim.toUpperCase()),
      outputDimensions: (state) =>
        state.allDimensions
          .filter((dim) => columnKind(dim) === OUTPUT)
          .map((dim) => dim.toUpperCase()),
      dataMap: (state) => {
        return createDataMap(state.data);
      },
      /** The selection as a reduced statement; see selectionLogic.js. */
      selectionDescription: (state, getters) => {
        let rows = getters.rawDataMap;
        return describeSelection(state.selectionSteps, {
          rowOf: (id) => rows[id] || null,
        });
      },
      // The whole collection, so the shortlist keeps options a zoom left out.
      rawDataMap: (state) => {
        return createDataMap(state.rawData);
      },
      cartCount: (state) => state.cart.length,
      cartSet: (state) => new Set(state.cart),
      isInCart: (state, getters) => (id) => getters.cartSet.has(String(id)),
      cartItems: (state, getters) =>
        state.cart.map((id) => getters.rawDataMap[id]).filter(Boolean),
      selectedInMarking: (state, getters) => (markingID) => {
        return getSelectedInMarking(
          state.markingsMap[markingID],
          getters.dataMap
        );
      },
      unselectedInMarking: (state, getters) => (markingID) => {
        return getUnselectedInMarking(
          state.markingsMap[markingID],
          getters.dataMap
        );
      },
      selectedInView: (state, getters) => (view) => {
        let marking = findMarkingAffectingView(
          state.markingsMap,
          state.markingID2views,
          view
        );
        return getSelectedInMarking(marking, getters.dataMap);
      },
      unselectedInView: (state, getters) => (view) => {
        let marking = findMarkingAffectingView(
          state.markingsMap,
          state.markingID2views,
          view
        );
        return getUnselectedInMarking(marking, getters.dataMap);
      },
      selectedDataInView: (state, getters) => (view) => {
        var selectedInMarking = getters.selectedInView(view);
        var result = map2Data(selectedInMarking);
        return result;
      },
      markingsDefaultGetter: (state) => {
        return state.markingsMap[state.defaultMarkingID];
      },
      markingsMapGetter: (state) => (markingID) => {
        return state.markingsMap[markingID];
      },
      getHovered: (state) => {
        return state.hovered;
      },
      isHoveringEnabled: (state) => state.isInspectionMode,
      colorColumn: (state) => state.colorColumn,
      isExpert: (state) => state.uiMode !== UI_MODES.LITE,
      isLite: (state) => state.uiMode === UI_MODES.LITE,
      can: (state) => (feature) => canUse(state.uiMode, feature),
      // Hover inspects only while Space is held (or continuous inspection is on).
      isChartHoverEnabled: (state) => state.isInspectionMode,
      // An empty result under active filters means "nothing matches", which
      // views must draw differently from "no filters yet".
      // Zoom and exclude scope the data rather than narrow it, so they don't
      // count here.
      isFilterActive: (state) =>
        state.uiMode === UI_MODES.LITE &&
        narrowingFilters(state.filters).length > 0,
      narrowingFilters: (state) => narrowingFilters(state.filters),
      // Whether the data shown is a zoomed or excluded part of the collection.
      hasScope: (state) =>
        state.uiMode === UI_MODES.LITE
          ? state.filters.some(isScopeFilter)
          : state.data !== state.rawData,
      /** The boxes brushed over exactly these dimensions, for charts that draw them. */
      boxesFor: (state) => (dims) => boxesFor(state.filters, dims),
      filterChips: (state) => state.filters.map(describeChip),
      // Lite: the saved set whose filters are exactly the current ones.
      matchingSetID: (state) => {
        if (state.uiMode !== UI_MODES.LITE) return null;
        let id = state.setsIDs.find((setID) =>
          sameFilterList(setFilters(state, setID), state.filters)
        );
        return id === undefined ? null : id;
      },
      /** Chips for the filters a set was saved from; null for a hand-picked set. */
      setCriteriaChips: (state) => (setID) => {
        let criteria = state.setsCriteriaMap[setID];
        return criteria ? criteria.map(describeSetChip) : null;
      },
      // Rows are not reactive, so the version is what says a rating changed.
      hasRatings: (state, getters) =>
        state.dimensionValuesVersion >= 0 &&
        getters.hasRatingDimension &&
        state.rawData.some(isRated),
      /**
       * The options a set or the shortlist takes: the selected ones still in
       * view, as zooming takes them. Nothing when nothing is selected: in
       * Lite, while no filter narrows the options.
       */
      selectedShown: (state, getters) => {
        void state.selectionVersion;
        if (getters.isLite && !getters.isFilterActive) return [];
        let shown = getters.dataMap;
        return Object.keys(getters.selectedInMarking(state.defaultMarkingID)).filter(
          (id) => !!shown[id]
        );
      },
      selectionCount: (state, getters) => {
        void state.selectionVersion;
        return Object.keys(getters.selectedInMarking(state.defaultMarkingID))
          .length;
      },
      // The gallery ignores its own selection, as crossfilter views do, so
      // unselected options stay in its pool (dimmed) and can be reselected.
      galleryPool: (state) => {
        // A filter on Rating reads a value that changes in place.
        void state.dimensionValuesVersion;
        let others = removeFilterByKey(
          narrowingFilters(state.filters),
          GALLERY_KEY
        );
        if (state.uiMode !== UI_MODES.LITE || others.length === 0) {
          return state.data;
        }
        return state.data.filter(compileFilters(others));
      },
      hasGallerySelection: (state) =>
        state.uiMode === UI_MODES.LITE &&
        state.filters.some((f) => f.key === GALLERY_KEY),
      /** A predicate id -> whether that option is selected in the gallery. */
      isSelectedInGallery: (state) => gallerySelectionTest(state.filters),
      gallerySelectedCount: (state, getters) => {
        let selected = getters.isSelectedInGallery;
        return getters.galleryPool.filter((d) => selected(d._id)).length;
      },
    },
    mutations: {
      ...dimensions.mutations,
      ...goals.mutations,
      ...story.mutations,
      /* setSimilarityMap(state, payload)
             {   
                 state.similarity_map = payload.similarity_map;
             },  */

      changeSelectionOperation(state, newOperation) {
        state.stickySelectionOperation = newOperation;
        state.currentSelectionOperation = newOperation;
      },
      // A held modifier overrides the sticky operation only while it is held.
      setModifierOperation(state, operation) {
        state.currentSelectionOperation =
          operation || state.stickySelectionOperation;
      },
      setViewSetting(state, payload) {
        Vue.set(state.viewSettings, payload.key, payload.value);
      },
      changeColorColumn(state, newColorColumn) {
        state.colorColumn = newColorColumn;
      },

      /** The ordered ramp, for dimensions that measure something. */
      changeColorRamp(state, id) {
        state.colorRamp = rampFor(id).id;
        saveColorRamp(state.colorRamp);
      },
      /** The hue set, for dimensions whose values name things. */
      changeColorScheme(state, id) {
        state.colorScheme = id;
        saveColorScheme(id);
      },
      setUiMode(state, payload) {
        let mode = normalizeMode(payload && payload.value);
        state.uiMode = mode;
        persistUiMode(mode);
        if (mode === UI_MODES.LITE) {
          state.isEditingMode = false;
          state.stickySelectionOperation = operations.REPLACE;
          state.currentSelectionOperation = operations.REPLACE;
        }
      },
      setFilters(state, payload) {
        state.filters = payload.filters;
      },
      recordFilters(state) {
        state.filterHistory.push(state.filters);
        if (state.filterHistory.length > HISTORY_LIMIT) {
          state.filterHistory.shift();
        }
        state.filterFuture = [];
      },
      // Filter arrays are never mutated in place, so history can hold references.
      stepFilterHistory(state, payload) {
        let back = payload.direction < 0;
        let from = back ? state.filterHistory : state.filterFuture;
        let to = back ? state.filterFuture : state.filterHistory;
        if (from.length === 0) return;
        to.push(state.filters);
        state.filters = from.pop();
      },
      clearFilterHistory(state) {
        state.filterHistory = [];
        state.filterFuture = [];
      },
      clearDataStack(state) {
        state.dataStack = [];
      },
      setScopedData(state, payload) {
        state.data = asRows(payload.data);
        state.appliedScopeSignature = payload.signature;
      },
      updateLayout(state, payload) {
        let i = state.layouts.findIndex((l) => l.type === payload.type);
        if (i < 0) return;
        Vue.set(state.layouts, i, Object.assign({}, state.layouts[i], payload));
        saveLayouts(state.layouts);
        forgetPreset(state);
      },
      /**
       * Replaces the whole arrangement. A seam drag commits this on every
       * frame with `persist: false`, then once more when the pointer is let
       * go; `updateLayout` could not be used for that, since it writes to
       * localStorage and forgets the preset on every call. `keepPreset` is
       * for a drag: it changes the panels' proportions, not which panel is
       * where, so the preset stays lit and clicking it again snaps back.
       */
      setLayouts(state, payload) {
        state.layouts = payload.layouts;
        if (payload.persist === false) return;
        saveLayouts(state.layouts);
        if (!payload.keepPreset) forgetPreset(state);
      },
      /**
       * Says which preset the arrangement on screen came from, without
       * rearranging anything. Restoring a remembered arrangement needs
       * both halves put back, and `setLayouts` only carries the panels.
       */
      setLayoutPreset(state, payload) {
        state.layoutPreset = payload.id || null;
        savePresetId(state.layoutPreset);
      },
      /** Arranges the panels as one of the presets in layout.js. */
      applyLayoutPreset(state, payload) {
        let layouts = presetLayouts(payload.id);
        if (!layouts) return;
        state.layouts = layouts;
        saveLayouts(state.layouts);
        state.layoutPreset = payload.id;
        savePresetId(payload.id);
      },
      /** Adds a panel that is not open, taking room from its largest neighbour. */
      openLayout(state, payload) {
        let next = withPanel(state.layouts, payload.type);
        if (next === state.layouts) return;
        state.layouts = next;
        saveLayouts(state.layouts);
        forgetPreset(state);
      },
      /** Puts every panel back where it starts, reopening any that were closed. */
      resetLayouts(state) {
        state.layouts = defaultLayouts();
        saveLayouts(state.layouts);
        state.layoutPreset = DEFAULT_PRESET_ID;
        savePresetId(DEFAULT_PRESET_ID);
      },
      /** Takes a panel off, giving its room to whoever shares an edge with it. */
      closeLayout(state, payload) {
        let next = withoutPanel(state.layouts, payload.type);
        if (next === state.layouts) return;
        state.layouts = next;
        saveLayouts(state.layouts);
        forgetPreset(state);
      },
      toggleEditingMode(state, payload) {
        if (payload) {
          state.isEditingMode = payload.value;
        } else {
          state.isEditingMode = !state.isEditingMode;
        }
      },
      setClusteringPanelOpen(state, payload)
      {
        if (payload) {
          state.isClusteringPanelOpen = payload.value;
          if (payload.value) state.isMatrixPanelOpen = false;
        }
      },
      setMatrixPanelOpen(state, payload) {
        state.isMatrixPanelOpen = payload.value;
        if (payload.value) state.isClusteringPanelOpen = false;
      },
      /** `{ open, pinned }`; closing always unpins. */
      setSetsDrawer(state, payload) {
        let open = !!payload.open;
        state.setsDrawer = { open: open, pinned: open && !!payload.pinned };
      },
      toggleInspectionMode(state, payload) {
        if (payload) {
          state.isInspectionMode = payload.value;
        } else {
          state.isInspectionMode = !state.isInspectionMode;
        }
      },
      togglePinInspection(state, payload) {
        if (payload) {
          state.isInspectionPinned = payload.value;
        } else {
          state.isInspectionPinned = !state.isInspectionPinned;
        }
      },
      setGuideDialog(state, payload) {
        state.guideDialog = Object.assign({}, state.guideDialog, payload);
      },
      setIsOpeningDialogOn(state, payload) {
        if (payload) {
          state.isOpeningDialogOn = payload.value;
        }
      },

      setData(state, payload) {
        state.data = asRows(payload.newData);
      },
      resetMarking(state, payload) {
        let marking = state.markingsMap[payload.markingID];
        if (!marking) return;
        let before =
          payload.markingID === state.defaultMarkingID
            ? getSelectedIDs(marking)
            : null;
        for (var alt in marking) {
          marking[alt] = 0;
        }
        if (before) {
          pushSelectionHistory(state, before, [], state.selectionSteps);
          state.selectionSteps = [];
        }
        state.selectionVersion += 1;
      },
      createView(state, payload) {
        let viewID = payload.view;
        let vueComponent = payload.vueComponent;
        state.viewsMap[viewID] = vueComponent;
      },
      /** A destroyed view lets go of its component, which the map would keep. */
      removeView(state, payload) {
        delete state.viewsMap[payload.view];
      },
      createMarkingEntry(state, args) {
        let ID = "";
        if (Object.entries(state.markingsMap).length == 0) {
          ID = state.defaultMarkingID;
        } else {
          ID = utils.generateID();
        }

        //TODO Uses all the currently available data (i.e. raw data)
        state.markingsMap[ID] = createMarkingObject(state.rawData);

        if (args) {
          args.markingID = ID;
        }
      },
      addMarking(state, payload) {
        let view = payload.view;
        let markingID = "";
        if (!payload.hasOwnProperty("markingID")) {
          markingID = state.defaultMarkingID;
        } else {
          markingID = payload.markingID;
        }
        if (!state.view2markingIDs.has(view)) {
          state.view2markingIDs.set(view, new Set());
        }

        state.view2markingIDs.get(view).add(markingID);
      },
      addView(state, payload) {
        let view = payload.view;
        let markingID = payload.markingID;

        if (!state.markingID2views.has(markingID)) {
          state.markingID2views.set(markingID, new Set());
        }
        state.markingID2views.get(markingID).add(view);
      },
      reverseUpdate(state) {
        stepSelectionHistory(
          state,
          state.selectionHistory,
          state.selectionFuture
        );
      },
      redoUpdate(state) {
        stepSelectionHistory(
          state,
          state.selectionFuture,
          state.selectionHistory
        );
      },
      update(state, payload) {
        let markingIDs = payload.hasOwnProperty("markingID")
          ? [payload.markingID]
          : Array.from(state.view2markingIDs.get(payload.view) || []);
        if (markingIDs.length === 0) {
          console.log("This view does not affect any marking");
          return;
        }
        markingIDs.forEach((markingID) => {
          let marking = state.markingsMap[markingID];
          if (!marking) return;
          // Only the default marking is user-facing, so only it is undoable
          // and described.
          let isDefault = markingID === state.defaultMarkingID;
          let before =
            isDefault && payload.record !== false
              ? getSelectedIDs(marking)
              : null;
          let stepsBefore = state.selectionSteps;
          // Before operating: a toggle is described by what it will do.
          if (isDefault) state.selectionSteps = nextSteps(state, marking, payload);
          operate(marking, payload.selection, payload.operation);
          if (before) {
            pushSelectionHistory(
              state,
              before,
              getSelectedIDs(marking),
              stepsBefore
            );
          }
        });
        state.selectionVersion += 1;
      },
      hover(state, payload) {
        state.hovered = payload.hovered;
      },
      setLastHovered(state, payload) {
        state.lastHovered = payload.lastHovered;
      },
      noteInspectionCleared(state) {
        state.inspectionClears += 1;
      },
      /**
       * Rates in place, as custom values are set: replacing the row in `data`
       * would rebuild every chart. Views that draw ratings imperatively redraw
       * on `dimensionValuesVersion`.
       */
      /** `{ id, text }`; empty text removes the note. */
      setOptionNote(state, payload) {
        let id = String(payload.id);
        let text = (payload.text || "").slice(0, NOTE_LIMIT);
        if (text.trim() === "") Vue.delete(state.optionNotes, id);
        else Vue.set(state.optionNotes, id, text);
      },
      clearOptionNotes(state) {
        state.optionNotes = {};
      },
      setColumnsDialog(state, payload) {
        state.columnsDialog = { open: !!payload.open };
      },
      popDataStack(state, payload) {
        payload.data = state.dataStack.pop();
      },
      pushDataStack(state, payload) {
        //TODO put a limit on the depth of the stack
        state.dataStack.push(asRows(payload.data));
      },

      setSetMetadata(state, payload) {
        let ID = payload.setID;
        let metadata = state.setsMetadataMap[ID];

        let comment = metadata.comment;
        let name = metadata.name;
        if (payload.hasOwnProperty("comment")) {
          comment = payload.comment;
        }
        if (payload.hasOwnProperty("name")) {
          name = payload.name;
        }
        Vue.set(
          state.setsMetadataMap,
          ID,
          Object.assign({}, metadata, { name: name, comment: comment })
        );
      },
      addSet(state, payload) {
        let ID = "";
        // A set's id is its name, so a repeat would overwrite the set that
        // holds it and leave two cards editing one set. Named sets are made
        // unique before they get here (see uniqueSetName); the counter can
        // still land on a name someone typed, so it steps past it.
        if (payload && payload.setName) {
          ID = payload.setName;
        } else {
          do {
            state.setsCounter += 1;
            ID = "Set #" + state.setsCounter;
          } while (
            Object.prototype.hasOwnProperty.call(state.setsMap, ID)
          );
        }
        Vue.set(state.setsMap, ID, payload.members);
        Vue.set(
          state.setsCriteriaMap,
          ID,
          payload.criteria ? payload.criteria.slice() : null
        );
        let comment = payload && payload.comment ? payload.comment : "";
        Vue.set(state.setsMetadataMap, ID, { name: ID, comment: comment });
        state.setsIDs.push(ID);
      },
      updateSet(state, payload) {
        let ID = payload.setID;

        let setMarking = setToMarking(state.setsMap[ID], state.rawData);
        setMarking = operate(setMarking, payload.members, payload.operation);
        Vue.set(state.setsMap, ID, getSelectedIDs(setMarking));
        // Edited by hand, so the filters it was saved from no longer describe it.
        Vue.set(state.setsCriteriaMap, ID, null);
      },
      removeSet(state, payload) {
        let ID = payload.setID;
        let index = state.setsIDs.indexOf(ID);
        if (index === -1) return;
        state.lastRemovedSet = {
          id: ID,
          index: index,
          members: state.setsMap[ID],
          criteria: state.setsCriteriaMap[ID],
          metadata: state.setsMetadataMap[ID],
        };
        state.setsIDs.splice(index, 1);
        Vue.delete(state.setsMap, ID);
        Vue.delete(state.setsCriteriaMap, ID);
        Vue.delete(state.setsMetadataMap, ID);
      },
      restoreRemovedSet(state) {
        let removed = state.lastRemovedSet;
        if (!removed || state.setsIDs.indexOf(removed.id) !== -1) return;
        Vue.set(state.setsMap, removed.id, removed.members);
        Vue.set(state.setsCriteriaMap, removed.id, removed.criteria);
        Vue.set(state.setsMetadataMap, removed.id, removed.metadata);
        state.setsIDs.splice(
          Math.min(removed.index, state.setsIDs.length),
          0,
          removed.id
        );
        state.lastRemovedSet = null;
      },
      clearSets(state) {
        let sets = emptySets();
        state.setsIDs = sets.setsIDs;
        state.setsMap = sets.setsMap;
        state.setsCriteriaMap = sets.setsCriteriaMap;
        state.setsMetadataMap = sets.setsMetadataMap;
        state.setsCounter = sets.setsCounter;
        state.lastRemovedSet = null;
      },
      addToCart(state, payload) {
        state.cart = addIds(state.cart, payload.ids);
      },
      removeFromCart(state, payload) {
        state.cart = removeIds(state.cart, payload.ids);
      },
      /** Replaces the shortlist: used for clearing it and for putting it back. */
      setCart(state, payload) {
        state.cart = (payload.ids || []).slice();
      },
      rememberCart(state, payload) {
        state.lastCart = payload.ids ? payload.ids.slice() : null;
      },
      setCompareDialog(state, payload) {
        state.compareDialog = Object.assign({}, state.compareDialog, payload);
      },
      setSensitivityDialog(state, payload) {
        state.sensitivityDialog = Object.assign(
          {},
          state.sensitivityDialog,
          payload
        );
      },
      /** `{ text, action }`; `action` names what the snackbar's button does. */
      showNotice(state, payload) {
        state.notice = {
          id: (state.notice ? state.notice.id : 0) + 1,
          text: payload.text,
          action: payload.action || null,
        };
      },
      dismissNotice(state) {
        state.notice = null;
      },
      updateCtrlKey(state, payload) {
        state.isCtrlKey = payload.value;
      },
      updateShiftKey(state, payload) {
        state.isShiftKey = payload.value;
      },
      updateAltKey(state, payload) {
        state.isAltKey = payload.value;
      },
      updateData(state, payload) {
        state.rawData = asRows(payload.data);
        state.data = asRows(payload.data);

        state.dataTypesMap = payload.dataTypesMap;
        // The dimensions a user made are numeric too, and are not in the
        // file's type map; without them they drop out of every dimension
        // picker after a load.
        state.numericDimensions = getNumericDimensions(
          payload.dataTypesMap
        ).concat(dimensions.names);
        state.nonNumericDimensions = getNonNumericDimensions(
          payload.dataTypesMap
        );
        state.allDimensions = Object.keys(payload.dataTypesMap).concat(
          dimensions.names
        );
        if (!state.allDimensions.includes(state.colorColumn)) {
          state.colorColumn = defaultColorColumn(
            state.allDimensions,
            state.numericDimensions
          );
        }
      },
    },
    actions: {
      ...dimensions.actions,
      ...goals.actions,
      ...story.actions,
      createMarkingEntry(context, payload) {
        context.commit("createMarkingEntry", payload);
      },
      update(context, payload) {
        if (context.state.uiMode === UI_MODES.LITE && payload.view) {
          // Views that are not filter-aware still report plain ID selections.
          // In Lite each such view owns one filter that its next gesture replaces.
          let key = "picked:" + payload.view;
          let ids = payload.selection || [];
          let next =
            ids.length === 0
              ? removeFilterByKey(context.state.filters, key)
              : upsertFilter(
                  context.state.filters,
                  makeMembersFilter(
                    key,
                    viewLabelForPayload(context, payload) + " picks",
                    ids
                  )
                );
          commitFilters(context, next);
          return;
        }
        context.commit("update", payload);
      },
      undo(context) {
        if (context.state.uiMode === UI_MODES.LITE) {
          if (context.state.filterHistory.length === 0) return;
          context.commit("stepFilterHistory", { direction: -1 });
          applyFiltersToMarking(context);
          return;
        }
        context.commit("reverseUpdate");
      },
      redo(context) {
        if (context.state.uiMode === UI_MODES.LITE) {
          if (context.state.filterFuture.length === 0) return;
          context.commit("stepFilterHistory", { direction: 1 });
          applyFiltersToMarking(context);
          return;
        }
        context.commit("redoUpdate");
      },
      reverseUpdate(context) {
        context.dispatch("undo");
      },
      /**
       * Stops inspecting. `{ keepShown: true }` (releasing Space) leaves the
       * gallery showing the last option; otherwise its inspector closes too.
       */
      clearInspection(context, payload) {
        context.commit("setLastHovered", {
          lastHovered: context.state.hovered,
        });
        context.commit("hover", { hovered: null });
        context.commit("toggleInspectionMode", { value: false });
        if (!(payload && payload.keepShown)) {
          context.commit("noteInspectionCleared");
        }
      },
      /**
       * A click inspects an option. Clicking the inspected option again stops
       * inspecting, continuous inspection included.
       */
      inspectByClick(context, payload) {
        let state = context.state;
        let item = payload.item;
        if (item && state.hovered && state.hovered._id === item._id) {
          context.dispatch("clearInspection");
        } else {
          context.commit("hover", { hovered: item });
        }
      },
      togglePinInspection(context, payload) {
        context.commit("togglePinInspection");
        if (!context.state.isInspectionPinned) {
          context.dispatch("clearInspection");
        }
      },

      toggleInspectionMode(context, payload) {
        context.commit("toggleInspectionMode");
      },
      toggleEditingMode(context, payload) {
        if (!context.getters.can("layoutEditing")) return;
        context.commit("toggleEditingMode", payload);
      },
      setUiMode(context, payload) {
        let state = context.state;
        let mode = normalizeMode(
          payload && payload.value !== undefined ? payload.value : payload
        );
        if (mode === state.uiMode) return;

        if (mode === UI_MODES.EXPERT) {
          // The marking already holds the filter result, so it simply becomes
          // the Expert selection. A zoom stays, one step back from all data.
          context.commit("setUiMode", { value: mode });
          context.commit("setFilters", { filters: [] });
          context.commit("clearFilterHistory");
          context.commit("clearDataStack");
          if (state.data !== state.rawData) {
            context.commit("pushDataStack", { data: state.rawData });
          }
          context.commit("setScopedData", { data: state.data, signature: "" });
          return;
        }

        // Carry Expert state into Lite as filters instead of dropping it
        // silently: a zoomed subset stays zoomed, the selection becomes a filter.
        let carried = [];
        if (state.data !== state.rawData) {
          carried.push(
            makeScopeFilter(
              utils.generateID(),
              "zoom",
              state.data.map((d) => d._id)
            )
          );
        }
        let selectedIDs = Object.keys(
          context.getters.selectedInMarking(state.defaultMarkingID)
        );
        // A selection covering everything shown adds no constraint.
        if (selectedIDs.length > 0 && selectedIDs.length < state.data.length) {
          carried.push(
            makeMembersFilter("carried", "Expert selection", selectedIDs)
          );
        }
        context.commit("clearDataStack");
        context.commit("setUiMode", { value: mode });
        context.commit("clearFilterHistory");
        context.commit("setFilters", { filters: carried });
        // The data already is the zoomed subset, so keep it instead of rebuilding.
        context.commit("setScopedData", {
          data: state.data,
          signature: scopeSignature(carried),
        });
        applyFiltersToMarking(context);
      },
      /**
       * `ranges` maps a dimension to one [lo, hi] or to a list of them (its
       * brushes, OR-ed) and replaces that dimension's own filter; an empty
       * list removes it. `clear` lists dimensions whose every range filter
       * goes, a rectangle over the dimension and another included.
       */
      setRangeFilters(context, payload) {
        let state = context.state;
        let next = state.filters;
        let ranges = payload.ranges || {};
        // Custom and weighted dimensions can't be filtered by.
        Object.keys(ranges)
          .filter((dim) => !context.getters.isUnfilterable(dim))
          .forEach((dim) => {
            next = withAxisRanges(next, state.data, dim, rangeList(ranges[dim]));
          });
        (payload.clear || []).forEach((dim) => {
          next = removeRangeFiltersOn(next, dim);
        });
        commitFilters(context, next);
      },
      /**
       * Everything one axis shows after a gesture on it, in one step: its
       * own brushes as `ranges`, and for each scatterplot rectangle filter
       * with a range on the axis, that filter's boxes as edited there
       * (`pairs: [{ key, boxes }]`; an empty list removes the filter).
       */
      setAxisBrushes(context, payload) {
        let state = context.state;
        if (context.getters.isUnfilterable(payload.dim)) return;
        let next = withAxisRanges(state.filters, state.data, payload.dim, payload.ranges || []);
        (payload.pairs || []).forEach((pair) => {
          let current = next.find((f) => f.key === pair.key);
          if (!current) return;
          let filter =
            pair.boxes.length === 0
              ? null
              : makeRangeFilter(current.dims, pair.boxes, boundsFor(state.data, current.dims));
          next = filter ? upsertFilter(next, filter) : removeFilterByKey(next, pair.key);
        });
        commitFilters(context, next);
      },
      /**
       * The rectangles of a scatterplot, as boxes over its two dimensions
       * (`{ x: [lo, hi], y: [lo, hi] }`); an empty list removes them.
       * `replace` names dimensions whose own filter the plot was drawing as
       * its rectangle (a lone axis brush mirrored there), so that brush moves
       * into the boxes rather than staying behind as a second constraint.
       * Filters the plot does not draw are never touched.
       */
      setBoxFilter(context, payload) {
        let state = context.state;
        let dims = payload.dims;
        if (
          payload.boxes.length > 0 &&
          dims.some((dim) => context.getters.isUnfilterable(dim))
        ) {
          return;
        }
        let next = state.filters;
        (payload.replace || []).forEach((dim) => {
          next = removeFilterByKey(next, rangeKey(dim));
        });
        let filter =
          payload.boxes.length === 0
            ? null
            : makeRangeFilter(dims, payload.boxes, boundsFor(state.data, dims));
        next = filter
          ? upsertFilter(next, filter)
          : removeFilterByKey(next, rangeKey(dims));
        commitFilters(context, next);
      },
      /** Drops one brush of a range filter from its chip. */
      removeFilterBox(context, payload) {
        commitFilters(
          context,
          removeFilterBox(context.state.filters, payload.key, payload.index)
        );
      },
      /**
       * A filter over a list of ids the assistant computed -- a top-k, a
       * percentile band, a Pareto front. Keyed like any other filter, so it
       * appears as a removable chip and joins the undo history rather than
       * being a change the user cannot see or reverse.
       */
      applyMembersFilter(context, payload) {
        if (!payload.ids || payload.ids.length === 0) return;
        commitFilters(
          context,
          upsertFilter(
            context.state.filters,
            makeMembersFilter(payload.key, payload.label, payload.ids)
          )
        );
      },
      removeFilter(context, payload) {
        commitFilters(
          context,
          removeFilterByKey(context.state.filters, payload.key)
        );
      },
      /** Removes every filter but keeps a zoom, as Esc keeps it in Expert. */
      clearFilters(context) {
        if (context.getters.narrowingFilters.length === 0) return;
        commitFilters(context, scopeFilters(context.state.filters));
      },
      toggleGallerySelection(context, payload) {
        if (context.state.uiMode !== UI_MODES.LITE) return;
        let selected = context.getters.isSelectedInGallery(payload.id);
        commitFilters(
          context,
          setGallerySelected(context.state.filters, [payload.id], !selected)
        );
      },
      selectOnlyInGallery(context, payload) {
        if (context.state.uiMode !== UI_MODES.LITE) return;
        commitFilters(
          context,
          selectOnlyInGalleryFilters(context.state.filters, payload.ids)
        );
      },
      selectAllInGallery(context) {
        commitFilters(
          context,
          removeFilterByKey(context.state.filters, GALLERY_KEY)
        );
      },
      /** Opens the guide, at `{ section }` (see guide.js) or where it was left. */
      openGuide(context, payload) {
        let section = payload && typeof payload.section === "string" ? payload.section : null;
        context.commit(
          "setGuideDialog",
          section === null ? { open: true } : { open: true, section: section }
        );
      },
      closeGuide(context) {
        context.commit("setGuideDialog", { open: false });
      },
      processShareLink(context, payload)
      {
        let shareLink = processShareLinkSup();
        // Null for a local file, which has no link to reopen it by.
        context.state.isStudySharable = shareLink ? true : false;
        context.state.shareLink = shareLink;
      },
      saveSelectedToFile(context, payload) {
        let dataMapSubset = context.getters.selectedInMarking(
          context.state.defaultMarkingID
        );
        let selection = map2Data(dataMapSubset);

        // Lite exports what matches the filters, even when that is nothing;
        // with no filters, or in Expert with nothing selected, everything shown.
        let narrowed = context.getters.isLite
          ? context.getters.isFilterActive
          : selection.length > 0;
        var data = narrowed ? selection : context.state.data;
        if (data.length === 0) return;
        var fileName =
          "designsense-" + new Date().toISOString().slice(0, 10) + ".csv";
        // The app's own keys go; the columns that named the pictures and the
        // models stay, so an exported file reloads with its media.
        var selectDims = context.state.allDimensions.filter(
          (x) => x !== "_id" && !isDerivedAssetKey(x)
        );
        // Rows list the header's columns, quoted where needed; a missing
        // value is an empty cell.
        // Notes go out as a column of their own when there are any, named
        // so it can't take the place of one the file already has.
        var notes = context.state.optionNotes;
        var noteColumn = null;
        if (Object.keys(notes).length > 0) {
          noteColumn = "Note";
          while (selectDims.indexOf(noteColumn) !== -1) noteColumn = "DesignSense " + noteColumn;
        }
        var csv = Papa.unparse({
          fields: noteColumn ? selectDims.concat([noteColumn]) : selectDims,
          data: data.map((row) => {
            var cells = selectDims.map((dim) =>
              row[dim] === undefined || row[dim] === null ? "" : row[dim]
            );
            if (noteColumn) cells.push(notes[String(row._id)] || "");
            return cells;
          }),
        });
        var url = URL.createObjectURL(
          new Blob([csv], { type: "text/csv;charset=utf-8" })
        );
        var a = d3
          .select("body")
          .append("a")
          .attr("href", url)
          .attr("download", fileName);
        a.node().click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        context.commit("showNotice", {
          text:
            "Downloaded " +
            data.length +
            (data.length === 1 ? " option" : " options") +
            " as " +
            fileName +
            ".",
        });
      },
      updateCtrlKey(context, payload) {
        context.commit("updateCtrlKey", payload);
      },
      updateShiftKey(context, payload) {
        context.commit("updateShiftKey", payload);
      },
      updateAltKey(context, payload) {
        context.commit("updateAltKey", payload);
      },
      createDefaultView(
        context,
        payload // {commit}, payload
      ) {
        let view = payload.view;
        let vueComponent = payload.vueComponent;
        let markingID = context.state.defaultMarkingID;
        context.commit("addMarking", { view: view, markingID: markingID });
        context.commit("addView", { view: view, markingID: markingID });
        context.commit("createView", {
          view: view,
          vueComponent: vueComponent,
        });
      },
      createDetailsView(
        context,
        payload // {commit}, payload
      ) {
        let master_view = payload.master_view;
        let details_view = payload.details_view;
        //Make sure the details view is not linked to anything else first
        disconnectViewFromMarkings(
          details_view,
          context.state.view2markingIDs,
          context.state.markingID2views,
          context.state.markingsMap
        );

        //Create a new marking that will be affected by master and affecting slave
        let args = { markingID: "" };
        context.commit("createMarkingEntry", args);
        let newMarkingID = args.markingID;

        context.commit("addMarking", {
          view: master_view,
          markingID: newMarkingID,
        });
        context.commit("addView", {
          view: details_view,
          markingID: newMarkingID,
        });
      },
      zoomToSelection(context) {
        if (context.getters.isLite) {
          scopeToResult(context, "zoom");
          return;
        }
        if (!context.getters.can("zoomAndExclude")) return;
        let dataMapSubset = context.getters.selectedInMarking(
          context.state.defaultMarkingID
        );
        let selection = map2Data(dataMapSubset);
        if (selection.length > 0) {
          context.commit("pushDataStack", { data: context.state.data });
          context.commit("setData", { newData: selection });
        }
      },
      excludeSelection(context) {
        if (context.getters.isLite) {
          scopeToResult(context, "exclude");
          return;
        }
        if (!context.getters.can("zoomAndExclude")) return;
        let toFilter = context.getters.selectedInMarking(
          context.state.defaultMarkingID
        );
        let selection = map2Data(filterData(context.getters.dataMap, toFilter));
        context.commit("pushDataStack", { data: context.state.data });
        context.commit("setData", { newData: selection });
      },
      /**
       * Leaves `{ ids, label }` out of the exploration, as Exclude does with
       * a selection, keeping the filters: in Lite a scope with its own chip,
       * in Expert a step that Step back undoes. The analysis dialog's
       * outliers go this way.
       */
      excludeOptions(context, payload) {
        let ids = new Set((payload.ids || []).map(String));
        let data = context.state.data;
        let gone = data.filter((row) => ids.has(String(row._id)));
        if (gone.length === 0 || gone.length === data.length) return;
        if (context.getters.isLite) {
          let scope = makeScopeFilter(
            utils.generateID(),
            "exclude",
            gone.map((row) => row._id),
            []
          );
          if (payload.label) scope.label = payload.label;
          commitFilters(context, context.state.filters.concat([scope]));
          return;
        }
        if (!context.getters.can("zoomAndExclude")) return;
        context.commit("pushDataStack", { data: data });
        context.commit("setData", {
          newData: data.filter((row) => !ids.has(String(row._id))),
        });
      },
      invertSelection(context) {
        if (!context.getters.can("invertSelection")) return;
        if (context.getters.isLite) {
          // Lite has a result set rather than a selection: its inverse is a
          // filter to everything the current filters leave out. Zoom and
          // exclude are scope, not narrowing, so they stay in place.
          if (!context.getters.isFilterActive) return;
          let shown = new Set(
            applyFilters(context.state.filters, context.state.data).map(String)
          );
          let ids = context.state.data
            .filter((row) => !shown.has(String(row._id)))
            .map((row) => row._id);
          let kept = scopeFilters(context.state.filters);
          commitFilters(
            context,
            kept.concat([
              makeMembersFilter("inverted", "Inverted: " + ids.length + " options", ids),
            ])
          );
          return;
        }
        let inverted = Object.keys(
          context.getters.unselectedInMarking(context.state.defaultMarkingID)
        );
        context.commit("update", {
          markingID: context.state.defaultMarkingID,
          selection: inverted,
          operation: operations.REPLACE,
          stepOp: STEP_OPS.INVERT,
        });
      },
      resetData(context) {
        if (context.getters.isLite) {
          // Back to the full collection; the filters stay.
          commitFilters(context, narrowingFilters(context.state.filters));
          return;
        }
        // Back to all data, so there is no zoom left to step out of.
        context.commit("setData", { newData: context.state.rawData });
        context.commit("clearDataStack");
      },
      resetAllMarkings(context) {
        if (context.state.uiMode === UI_MODES.LITE) {
          context.dispatch("clearFilters");
          return;
        }
        for (var markingID in context.state.markingsMap) {
          context.commit("resetMarking", { markingID: markingID });
        }
      },
      undoDataTransformation(context) {
        if (context.getters.isLite) {
          let scopes = scopeFilters(context.state.filters);
          if (scopes.length === 0) return;
          commitFilters(
            context,
            removeFilterByKey(
              context.state.filters,
              scopes[scopes.length - 1].key
            )
          );
          return;
        }
        if (!context.getters.can("zoomAndExclude")) return;
        if (context.state.dataStack.length > 0) {
          let args = { data: "" };
          context.commit("popDataStack", args);
          context.commit("setData", { newData: args.data });
        }
      },
      createSet(context, payload) {
        let members = [];
        // A Lite set is a saved search: it keeps the filters, so restoring it
        // brings them back.
        let criteria = null;
        if (payload && payload.members) {
          members = payload.members;
        } else {
          // Only what is selected and in view: never an option filtered,
          // zoomed or excluded out, and never an empty set.
          members = context.getters.selectedShown;
          if (members.length === 0) {
            context.commit("showNotice", { text: "Select options first: only the selected options in view are saved or shortlisted." });
            return false;
          }
          if (context.getters.isLite) criteria = context.state.filters;
        }
        context.commit("addSet", {
          members: members,
          criteria: criteria,
          setName: payload ? payload.setName : null,
          comment: payload ? payload.comment : null,
        });
        return true;
      },
      /** Every one-option shortlist control goes through here. */
      toggleInCart(context, payload) {
        let id = String(payload.id);
        if (context.getters.isInCart(id)) {
          context.commit("removeFromCart", { ids: [id] });
        } else {
          context.commit("addToCart", { ids: [id] });
        }
      },
      /** Shortlists everything the filters or the selection currently leave. */
      addResultToCart(context) {
        // As a set takes them: the selected options still in view.
        let ids = context.getters.selectedShown;
        if (ids.length === 0) {
          context.commit("showNotice", { text: "Select options first: only the selected options in view are saved or shortlisted." });
          return;
        }
        let before = context.state.cart;
        context.commit("addToCart", { ids: ids });
        let added = context.state.cart.length - before.length;
        if (added === 0) {
          context.commit("showNotice", {
            text: "Those options are already on the shortlist.",
          });
          return;
        }
        context.commit("rememberCart", { ids: before });
        context.commit("showNotice", {
          text:
            "Added " + added + (added === 1 ? " option" : " options") + " to the shortlist.",
          action: "restoreCart",
        });
      },
      /** Puts a saved set's options on the shortlist, beside what is there. */
      putSetOnCart(context, payload) {
        let members = context.state.setsMap[payload.setID] || [];
        let metadata = context.state.setsMetadataMap[payload.setID];
        let name = metadata ? metadata.name : payload.setID;
        let before = context.state.cart;
        context.commit("addToCart", { ids: members });
        let added = context.state.cart.length - before.length;
        if (added === 0) {
          context.commit("showNotice", {
            text: "Every option in " + name + " is already on the shortlist.",
          });
          return;
        }
        context.commit("rememberCart", { ids: before });
        context.commit("showNotice", {
          text:
            "Put " + added + (added === 1 ? " option" : " options") + " from " + name + " on the shortlist.",
          action: "restoreCart",
        });
      },
      clearCart(context) {
        if (context.state.cart.length === 0) return;
        context.commit("rememberCart", { ids: context.state.cart });
        context.commit("setCart", { ids: [] });
        context.commit("showNotice", {
          text: "Cleared the shortlist.",
          action: "restoreCart",
        });
      },
      restoreCart(context) {
        if (!context.state.lastCart) return;
        context.commit("setCart", { ids: context.state.lastCart });
        context.commit("rememberCart", { ids: null });
      },
      /**
       * Turns the shortlist into a set and empties it, so the next shortlist
       * starts clean rather than saving the same options twice.
       */
      saveCartAsSet(context, payload) {
        let members = context.state.cart.slice();
        if (members.length === 0) return;
        let name = uniqueSetName(
          context.state.setsIDs,
          payload ? payload.name : ""
        );
        context.dispatch("createSet", { members: members, setName: name });
        let setID = context.state.setsIDs[context.state.setsIDs.length - 1];
        context.commit("rememberCart", { ids: members });
        context.commit("rememberShortlistSet", { setID: setID });
        context.commit("setCart", { ids: [] });
        context.commit("showNotice", {
          text:
            "Saved " +
            members.length +
            (members.length === 1 ? " option as " : " options as ") +
            setID +
            ".",
          action: "undoSaveCart:" + setID,
        });
      },
      /** Puts a just-saved set back on the shortlist. */
      undoSaveCartAsSet(context, payload) {
        let setID = payload && payload.setID;
        if (setID && context.state.setsMap[setID]) {
          // The mutation, not the action: undoing shouldn't offer its own undo.
          context.commit("removeSet", { setID: setID });
        }
        context.dispatch("restoreCart");
      },
      openCompare(context, payload) {
        let source = (payload && payload.source) || "cart";
        let setID = (payload && payload.setID) || null;
        let ids = [];
        if (source === "set" && setID) {
          ids = (context.state.setsMap[setID] || []).slice();
        } else if (source === "selection") {
          ids = Object.keys(
            context.getters.selectedInMarking(context.state.defaultMarkingID)
          );
          if (context.getters.isLite && !context.getters.isFilterActive) {
            ids = context.state.data.map((row) => row._id);
          }
        } else {
          source = "cart";
          ids = context.state.cart.slice();
        }
        if (ids.length === 0) {
          context.commit("showNotice", {
            text:
              source === "cart"
                ? "The shortlist is empty. Add options to compare them."
                : "Nothing to compare yet.",
          });
          return;
        }
        context.commit("setCompareDialog", {
          open: true,
          source: source,
          ids: ids,
          setID: setID,
        });
      },
      closeCompare(context) {
        context.commit("setCompareDialog", { open: false });
      },
      /** Reading which inputs drive which outputs; Expert's, like clustering. */
      openSensitivity(context) {
        if (!context.getters.can("sensitivity")) return;
        context.commit("setSensitivityDialog", { open: true });
      },
      closeSensitivity(context) {
        context.commit("setSensitivityDialog", { open: false });
      },
      /** Drops one column; from the shortlist it also drops the membership. */
      removeFromCompare(context, payload) {
        let id = String(payload.id);
        let dialog = context.state.compareDialog;
        context.commit("setCompareDialog", {
          ids: dialog.ids.filter((other) => String(other) !== id),
        });
        if (dialog.source === "cart") {
          context.commit("removeFromCart", { ids: [id] });
        }
      },
      /**
       * Brings back a captured view (see story/snapshot.js): its mode, then
       * its filters in Lite, or its zoom and selection in Expert, each one
       * undo step. Goals and the shortlist are the user's saved work, so a
       * capture leaves them as they are.
       */
      restoreView(context, payload) {
        let snapshot = payload.snapshot;
        let state = context.state;
        if (snapshot.mode !== state.uiMode) {
          context.dispatch("setUiMode", { value: snapshot.mode });
        }
        if (snapshot.view) {
          ["scatterX", "scatterY", "sortBy", "sortDesc"].forEach((key) => {
            if (snapshot.view[key] !== undefined && snapshot.view[key] !== null) {
              context.commit("setViewSetting", { key: key, value: snapshot.view[key] });
            }
          });
        }
        if (state.uiMode === UI_MODES.LITE) {
          let next = (snapshot.filters || []).slice();
          if (!sameFilterList(next, state.filters)) commitFilters(context, next);
          return;
        }
        // The captured zoom, one Step back from what was shown before.
        let shown = snapshot.shown ? new Set(snapshot.shown.map(String)) : null;
        let data = shown ? state.rawData.filter((row) => shown.has(String(row._id))) : state.rawData;
        if (data.length !== state.data.length || (shown && state.data.some((row) => !shown.has(String(row._id))))) {
          context.commit("pushDataStack", { data: state.data });
          context.commit("setData", { newData: data });
        }
        context.commit("update", {
          markingID: state.defaultMarkingID,
          selection: snapshot.selected || [],
          operation: operations.REPLACE,
          steps: snapshot.selected ? snapshot.steps || [] : [],
        });
      },
      restoreSet(context, payload) {
        if (context.state.uiMode === UI_MODES.LITE) {
          // The saved filters replace the current ones; undo brings those back.
          let next = setFilters(context.state, payload.setID).slice();
          if (sameFilterList(next, context.state.filters)) return;
          commitFilters(context, next);
          return;
        }
        context.dispatch("resetData"); //Ahmed: in case restoring is called when portions of the data is being zoomed on. Altneratives includes adding only the content of set not present
        let metadata = context.state.setsMetadataMap[payload.setID];
        let members = context.state.setsMap[payload.setID] || [];
        context.commit("update", {
          markingID: context.state.defaultMarkingID,
          selection: members,
          // Callers that give no known operation mean "bring the set back".
          operation: Object.values(operations).includes(payload.operation)
            ? payload.operation
            : operations.REPLACE,
          step: {
            kind: "set",
            label: metadata ? metadata.name : "Saved set",
            ids: members,
          },
        });
      },
      updateSet(context, payload) {
        let members = context.getters.selectedShown;
        if (members.length === 0) {
          context.commit("showNotice", { text: "Select options first: only the selected options in view are saved or shortlisted." });
          return;
        }
        context.commit("updateSet", {
          setID: payload.setID,
          members: members,
          operation: payload.operation,
        });
      },
      /** Deletes a set, and offers to undo that. */
      removeSet(context, payload) {
        let metadata = context.state.setsMetadataMap[payload.setID];
        context.commit("removeSet", payload);
        context.commit("showNotice", {
          text: "Deleted " + (metadata ? metadata.name : payload.setID) + ".",
          action: "undoRemoveSet",
        });
      },
      /**
       * Forgets the sets, notes and ratings saved for this dataset, and clears
       * them from the workspace. Custom dimensions are managed on their own.
       */
      /**
       * Clears the parts of this dataset's work named in `parts`: { sets,
       * shortlist, notes, ratings, values, dimensions, goals, story }, each
       * true to clear it. Nothing can be undone. Returns what was cleared, as
       * words for a notice. Column roles are cleared by the dialog, since
       * they take a fresh start of the workspace (see ClearDataDialog).
       */
      clearData(context, parts) {
        let p = parts || {};
        let done = [];
        if (p.sets) {
          context.commit("clearSets");
          done.push("sets");
        }
        if (p.shortlist) {
          context.commit("setCart", { ids: [] });
          context.commit("rememberCart", { ids: null });
          done.push("shortlist");
        }
        if (p.notes) {
          context.commit("clearOptionNotes");
          done.push("notes");
        }
        if (p.dimensions) {
          context.dispatch("removeAddedDimensions");
          done.push("custom and weighted dimensions");
        }
        if (p.ratings || p.values) {
          let only = context.state.customDimensions
            .filter((def) => (isRatingDim(def.name) ? p.ratings : p.values))
            .map((def) => def.name);
          if (only.length > 0) context.dispatch("clearEnteredValues", { only: only });
          if (p.ratings) done.push("ratings");
          if (p.values) done.push("entered values");
        }
        // Without ratings, or what weighed them, the rating goes.
        context.dispatch("dropRatingIfUnused");
        if (p.goals) {
          context.dispatch("clearGoalChoices");
          done.push("goals");
        }
        if (p.story) {
          context.commit("setPresenting", { index: null });
          context.commit("clearStory");
          done.push("story");
        }
        return done;
      },
      /** Everything, as the clear-data dialog does by default. */
      clearSavedWork(context) {
        let done = context.dispatch("clearData", {
          sets: true,
          shortlist: true,
          notes: true,
          ratings: true,
          values: true,
          dimensions: true,
          goals: true,
          story: true,
        });
        session.clear();
        return done;
      },
      /**
       * `{ item, rating }`: 1-5 stars, or 0 to clear. The rating is a custom
       * dimension that exists only while something is rated: the first
       * rating makes it, and clearing the last lets it go (see
       * dimensions.js). Weighted dimensions that weigh it follow its values.
       */
      rateAlt(context, payload) {
        let stars = payload.rating > 0 ? payload.rating : undefined;
        if (stars !== undefined) context.dispatch("createRatingDimension");
        if (!context.getters.hasRatingDimension) return;
        context.dispatch("setDimensionValue", {
          dim: RATING_DIMENSION,
          id: payload.item._id,
          value: stars,
          final: true,
        });
        if (stars === undefined) context.dispatch("dropRatingIfUnused");
        // A filter on Rating has to pick up the new rating. Other filters
        // select by other values or by ID, so their result stands.
        let byRating = context.getters.narrowingFilters.some(
          (f) => f.kind === "range" && f.dims.includes(RATING_DIMENSION)
        );
        if (context.getters.isFilterActive && byRating) {
          applyFiltersToMarking(context);
        }
      },
    },
    modules: {},
  });
  // Ratings brought in from an old session are saved where ratings live now,
  // before the session, attached next, stops carrying them.
  if (dimensions.migrated) store.dispatch("saveDimensions");
  session.attach(store);
  story.attach(store);
  return store;
}

function viewLabelForPayload(context, payload) {
  if (payload.viewType) return payload.viewType;
  if (payload.view && context.state.viewsMap[payload.view]) {
    let component = context.state.viewsMap[payload.view];
    let t =
      (component._props && component._props.type) ||
      (component.$props && component.$props.type);
    return VIEW_TYPE_LABELS[t] || t || "View";
  }
  return "View";
}

function commitFilters(context, next) {
  if (next === context.state.filters) return;
  context.commit("recordFilters");
  context.commit("setFilters", { filters: next });
  applyFiltersToMarking(context);
}

/**
 * Lite keeps the default marking equal to the filter result, so every view
 * that already reads markings follows the filters without knowing about them.
 */
function applyFiltersToMarking(context) {
  let state = context.state;
  syncScopedData(context);
  let narrowing = narrowingFilters(state.filters);
  let ids = narrowing.length > 0 ? applyFilters(narrowing, state.data) : [];
  context.commit("update", {
    markingID: state.defaultMarkingID,
    selection: ids,
    operation: operations.REPLACE,
    record: false,
    // Carried into Expert as the selection's first steps.
    steps: stepsFromFilters(narrowing),
  });
}

/**
 * Filters as selection steps, AND-ed: a range filter is a region (its boxes
 * OR-ed); any other is the options it names, or leaves out.
 */
function stepsFromFilters(filters) {
  let steps = [];
  filters.forEach((filter) => {
    let first = steps.length === 0;
    if (filter.kind === "range") {
      steps.push({
        op: first ? STEP_OPS.REPLACE : STEP_OPS.INTERSECT,
        atom: { kind: "region", boxes: filter.boxes },
      });
      return;
    }
    let atom = {
      kind: "set",
      label: filter.label,
      title: describeFilter(filter).title,
      ids: filter.ids,
    };
    if (filter.kind === "exclude") {
      // Everything but these: start from everything when it comes first.
      if (first) steps.push({ op: STEP_OPS.INVERT });
      steps.push({ op: STEP_OPS.SUBTRACT, atom: atom });
      return;
    }
    steps.push({ op: first ? STEP_OPS.REPLACE : STEP_OPS.INTERSECT, atom: atom });
  });
  return steps;
}

/**
 * The described steps after an update: `payload.steps` replaces them
 * outright; otherwise the update is one more step, its condition
 * `payload.step` or, when the view gave none, the options it named.
 */
function nextSteps(state, marking, payload) {
  if (payload.steps) return freezeSteps(payload.steps);
  if (payload.stepOp === STEP_OPS.INVERT) {
    return state.selectionSteps.concat(freezeSteps([{ op: STEP_OPS.INVERT }]));
  }
  let ids = payload.selection || [];
  let op;
  switch (payload.operation) {
    case operations.REPLACE:
      // Replacing with nothing is clearing.
      if (ids.length === 0) return [];
      op = STEP_OPS.REPLACE;
      break;
    case operations.ADD:
      op = STEP_OPS.ADD;
      break;
    case operations.SUBTRACT:
      op = STEP_OPS.SUBTRACT;
      break;
    case operations.INTERSECT:
      op = STEP_OPS.INTERSECT;
      break;
    case operations.TOGGLE: {
      // operate() flips the options only when they all agree, so a toggle
      // of options all selected removes them and any other adds them.
      let states = ids.map((id) => marking[id]);
      op =
        states.length > 0 && states.every((v) => v == 1)
          ? STEP_OPS.SUBTRACT
          : STEP_OPS.ADD;
      break;
    }
    default:
      return state.selectionSteps;
  }
  let atom = payload.step || {
    kind: "set",
    label: viewLabelForPayload({ state: state }, payload) + " selection",
    ids: ids,
  };
  let step = { op: op, atom: atom };
  return op === STEP_OPS.REPLACE
    ? freezeSteps([step])
    : state.selectionSteps.concat(freezeSteps([step]));
}

/** Steps hold ID lists that Vue has no need to watch. */
function freezeSteps(steps) {
  return steps.map((step) => {
    if (step.atom) Object.freeze(step.atom);
    return Object.freeze(step);
  });
}

/**
 * Zoom and exclude filters apply to `data` itself, so charts rescale to them.
 * Recomputed only when those filters change, since new data rebuilds every chart.
 */
function syncScopedData(context) {
  let state = context.state;
  let signature = scopeSignature(state.filters);
  if (signature === state.appliedScopeSignature) return;
  let scopes = scopeFilters(state.filters);
  context.commit("setScopedData", {
    data:
      scopes.length > 0
        ? state.rawData.filter(compileFilters(scopes))
        : state.rawData,
    signature: signature,
  });
}

/**
 * Lite zoom and exclude turn the current result into a scope. The filters that
 * found it are cleared, since inside a zoom they would match everything and
 * after an exclusion nothing; the scope keeps their descriptions for its chip.
 */
function scopeToResult(context, action) {
  let state = context.state;
  let narrowing = narrowingFilters(state.filters);
  if (narrowing.length === 0) return;
  let ids = applyFilters(narrowing, state.data);
  if (ids.length === 0 || ids.length === state.data.length) return;
  let scope = makeScopeFilter(
    utils.generateID(),
    action,
    ids,
    narrowing.map((f) => describeFilter(f).text)
  );
  commitFilters(context, scopeFilters(state.filters).concat([scope]));
}

/**
 * A saved set's filter as its card shows it. An exclusion reads as what the
 * set leaves out: "Excluded (5)" on a set looked like the five were in it.
 */
function describeSetChip(filter) {
  let chip = describeChip(filter);
  if (isScopeFilter(filter) && filter.kind === "exclude") {
    let n = (filter.ids || []).length;
    chip.text = "Leaves out " + n + (n === 1 ? " option" : " options");
  }
  return chip;
}

function describeChip(filter) {
  return Object.assign(
    { key: filter.key, kind: filter.kind, tone: filterTone(filter) },
    describeFilter(filter)
  );
}

/** The filters that restore a set: the ones it was saved from, or its members. */
function setFilters(state, setID) {
  let criteria = state.setsCriteriaMap[setID];
  if (criteria) return criteria;
  let metadata = state.setsMetadataMap[setID];
  return [
    makeMembersFilter(
      "set",
      "In " + (metadata ? metadata.name : setID),
      state.setsMap[setID] || [],
      setID
    ),
  ];
}

function dimensionBounds(data, dim) {
  // Ratings keep their whole scale, so a brush up to 5 stars stays open-ended.
  if (dim === RATING_DIMENSION) return RATING_BOUNDS;
  let extent = d3.extent(data, (d) => d[dim]);
  return extent[0] === undefined ? null : extent;
}

/** `{ dim: [min, max] }` for the dimensions a range filter spans. */
function boundsFor(data, dims) {
  let bounds = {};
  dims.forEach((dim) => (bounds[dim] = dimensionBounds(data, dim)));
  return bounds;
}

/** The filters with `dim`'s own range filter replaced by these ranges (none removes it). */
function withAxisRanges(filters, data, dim, list) {
  let filter =
    list.length === 0
      ? null
      : makeRangeFilter(
          [dim],
          list.map((range) => ({ [dim]: range })),
          boundsFor(data, [dim])
        );
  return filter
    ? upsertFilter(filters, filter)
    : removeFilterByKey(filters, rangeKey(dim));
}

/** One range or a list of ranges, as a list. */
function rangeList(value) {
  if (!value || value.length === 0) return [];
  return Array.isArray(value[0]) ? value : [value];
}

/** Removes every range filter that constrains `dim`, alone or with another. */
function removeRangeFiltersOn(filters, dim) {
  if (!filters.some((f) => f.kind === "range" && f.dims.includes(dim))) {
    return filters;
  }
  return filters.filter((f) => !(f.kind === "range" && f.dims.includes(dim)));
}

function sameIds(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Records `before` as an undo step, with the steps that described it, unless
 * the change did nothing.
 */
function pushSelectionHistory(state, before, after, steps) {
  if (sameIds(before, after)) return;
  state.selectionHistory.push({ ids: before, steps: steps || [] });
  if (state.selectionHistory.length > HISTORY_LIMIT) {
    state.selectionHistory.shift();
  }
  state.selectionFuture = [];
}

function stepSelectionHistory(state, from, to) {
  let marking = state.markingsMap[state.defaultMarkingID];
  if (!marking || from.length === 0) return;
  to.push({ ids: getSelectedIDs(marking), steps: state.selectionSteps });
  let entry = from.pop();
  operate(marking, entry.ids, operations.REPLACE);
  state.selectionSteps = entry.steps;
  state.selectionVersion += 1;
}

/**
 * A link that reopens the current dataset, or null when it has none (a local
 * file). It keeps the page's path, so it works wherever the app is hosted.
 */
function processShareLinkSup() {
  let info = window._folderInfo;
  if (!info || !info.inLink) return null;
  let page = document.location.origin + document.location.pathname;
  return page + "?ID=" + encodeURIComponent(encodeUrl(info.inLink));
}

function prepare_map(data) {
  let map = {};
  data.forEach((element) => {
    map[element._id] = 0;
  });
  //let mask = new Array(len).fill(0);
  return map;
}

function createDataMap(data) {
  let map = {};
  data.forEach((element) => {
    map[element._id] = element;
  });
  return map;
}

function reset_map(map) {
  for (var key in map) {
    map[key] = 0;
  }
  return map;
}
function getSelection(marking, selection) {
  var selected = {};
  for (var alt of selection) {
    selected[alt] = marking[alt];
  }
  return selected;
}

function getSelectedIDs(marking) {
  var selectedIDs = [];
  for (var alt in marking) {
    if (marking[alt] == 1) {
      selectedIDs.push(alt);
    }
  }
  return selectedIDs;
}

function setToMarking(IDs, data) {
  var marking = {};
  data.forEach((element) => {
    marking[element._id] = 0;
  });
  for (var alt of IDs) {
    marking[alt] = 1;
  }
  return marking;
}

function getSelectedInMarking(marking, dataMap) {
  var selected = {};
  for (var alt in marking) {
    if (marking[alt] == 1) {
      if (dataMap[alt]) {
        // To make sure only the data elements being used will have their marking returned
        selected[alt] = dataMap[alt];
      }
    }
  }
  return selected;
}
function getUnselectedInMarking(marking, dataMap) {
  var unselected = {};
  for (var alt in marking) {
    if (marking[alt] == 0) {
      if (dataMap[alt]) {
        // To make sure only the data elements being used will have their marking returned
        unselected[alt] = dataMap[alt];
      }
    }
  }
  return unselected;
}
function allTheSame(selected) {
  var atleastOneIsDifferent = false;
  var tmp = -1;
  var old = -1;
  for (var alt in selected) {
    if (tmp == -1) {
      old = selected[alt];
    } else {
      old = tmp;
    }
    tmp = selected[alt];

    if (old != tmp) {
      atleastOneIsDifferent = true;
      break;
    }
  }
  return !atleastOneIsDifferent;
}
function flip(value) {
  return value == 1 ? 0 : 1;
}

function operate(marking, selection, operation) {
  if (operation == operations.REPLACE) {
    for (let alt in marking) {
      marking[alt] = 0;
    }
    for (let alt of selection) {
      marking[alt] = 1;
    }
  } else if (operation == operations.ADD) {
    for (let alt of selection) {
      marking[alt] = 1;
    }
  } else if (operation == operations.TOGGLE) {
    let selected = getSelection(marking, selection);
    let areAllTheSame = allTheSame(selected);
    if (areAllTheSame) {
      for (let alt of selection) {
        marking[alt] = flip(marking[alt]);
      }
    } else {
      for (let alt of selection) {
        marking[alt] = 1;
      }
    }
  } else if (operation == operations.INTERSECT) {
    let selected = getSelection(marking, selection);
    for (let alt in marking) {
      if (marking[alt] == 1 && selected[alt] == 1) {
        marking[alt] = 1;
      } else {
        marking[alt] = 0;
      }
    }
  } else if (operation == operations.SUBTRACT) {
    for (let alt of selection) {
      marking[alt] = 0;
    }
  } else {
    console.error("Unknown Selection Operation");
  }
  return marking;
}
function createMarkingObject(data) {
  let marking = {};
  for (var alt of data) {
    //console.log(alt._id)
    marking[alt._id] = 0;
  }
  return marking;
}
/**
 * Finds the marking that affects the passed view
 * @param {*} markingID2views
 * @param {*} view
 */
function findMarkingAffectingView(markingsMap, markingID2views, view) {
  return markingsMap[findMarkingIDForView(markingID2views, view)];
}

/**
 * Finds markingID of the marking that affects the passed view
 * @param {*} markingID2views
 * @param {*} view
 */
function findMarkingIDForView(markingID2views, view) {
  let targetMarkingID = null;
  markingID2views.forEach((viewsSet, markingID) => {
    if (viewsSet.has(view)) {
      targetMarkingID = markingID;
    }
  });
  if (targetMarkingID == null) {
    console.error("No Marking affecting this view was found");
    return null;
  } else {
    return targetMarkingID;
  }
}
/**
 *
 * @param {*} view
 * @param {*} view2markingIDs
 * @param {*} markingID2views
 */
function disconnectViewFromMarkings(
  view,
  view2markingIDs,
  markingID2views,
  markingsMap
) {
  view2markingIDs.delete(view);

  markingID2views.forEach((viewsSet, markingID) => {
    if (viewsSet.has(view)) {
      viewsSet.delete(view);
    }
  });
  trimEmptyMarkings(markingID2views, view2markingIDs, markingsMap);
}

function trimEmptyMarkings(markingID2views, view2markingIDs, markingsMap) {
  let emptyMarkings = [];
  markingID2views.forEach((viewsSet, markingID) => {
    if (viewsSet.size == 0) {
      emptyMarkings.push(markingID);
    }
  });

  emptyMarkings.forEach((markingID) => {
    delete markingsMap[markingID];
    markingID2views.delete(markingID);
    view2markingIDs.forEach((markingsSet, view) => {
      if (markingsSet.has(markingID)) {
        markingsSet.delete(markingID);
      }
    });
  });
}

function map2Data(map) {
  var result = [];
  for (var key in map) {
    if (map[key]) result.push(map[key]);
  }
  return result;
}
function filterData(dataMap, toFilter) {
  // A shallow copy: the rows stay the collection's own, so edits to them
  // (ratings, custom values) reach rawData and keys holding undefined survive.
  var dataMapCopy = Object.assign({}, dataMap);
  for (var altID in toFilter) {
    delete dataMapCopy[altID];
  }
  return dataMapCopy;
}
function getNonNumericDimensions(typesMap) {
  var nonnumeric = [];
  for (var dim in typesMap) {
    if (typesMap[dim] != "Float" && typesMap[dim] != "Number") {
      nonnumeric.push(dim);
    }
  }
  return nonnumeric;
}

function getNumericDimensions(typesMap) {
  var numeric = [];
  for (var dim in typesMap) {
    if (typesMap[dim] == "Float" || typesMap[dim] == "Number") {
      numeric.push(dim);
    }
  }
  return numeric;
}

//ref: https://stackoverflow.com/questions/41572974/how-to-load-all-server-side-data-on-initial-vue-js-vue-router-load
export default builder;
