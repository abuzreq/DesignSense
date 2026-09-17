import Vue from "vue";
import Vuex from "vuex";
import views from "@/components/constants.js";
import { operations } from "@/components/operations.js";
import utils from "@/components/utils.js";

import * as d3 from "d3";
import * as d3Chromatic from "d3-scale-chromatic";

import createLogger from "./logger";
import { encodeUrl } from "@/data/shareLink.js";
import { saveLayouts, defaultLayouts } from "@/layout.js";
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
import { RATING_BOUNDS, RATING_DIMENSION, isRated } from "@/ratings.js";

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

function persistUiMode(mode) {
  try {
    localStorage.setItem(UI_MODE_KEY, mode);
  } catch (e) {
    /* ignore */
  }
}

const VIEW_TYPE_LABELS = {
  ScatterPlot: "Scatterplot",
  ParallelCoordinatesPlot: "PCP",
  Grid: "Gallery",
  Sets: "Set",
  SPLOM: "SPLOM",
};

Vue.use(Vuex);

function builder(new_data, dataTypesMap, new_layouts, new_similarity_map) {
  return new Vuex.Store({
    plugins: [createLogger],
    state: {
      // What a brush applies right now: the sticky operation, or a held modifier's.
      currentSelectionOperation: operations.REPLACE,
      // Chosen with the toolbar or number keys; restored when modifiers are released.
      stickySelectionOperation: operations.REPLACE,
      layouts: new_layouts,
      defaultMarkingID: utils.generateID(), //"_lqpkb07gn"
      rawData: new_data,
      data: new_data,
      dataStack: [],
      view2markingIDs: new Map(),
      markingID2views: new Map(),
      markingsMap: {}, // markingID -> marking object. Marking object is {altID -> highlightState}
      // Expert undo/redo, as arrays of selected IDs on the default marking.
      selectionHistory: [],
      selectionFuture: [],
      // Markings are mutated in place, out of Vue's sight. Bumping this lets
      // getters such as selectionCount recompute.
      selectionVersion: 0,
      viewsMap: {},

      setsIDs: [],
      setsMetadataMap: {},
      setsMap: {},
      // The filters each set was saved from, or null for a hand-picked set.
      setsCriteriaMap: {},
      numericDimensions: getNumericDimensions(dataTypesMap),
      nonNumericDimensions: getNonNumericDimensions(dataTypesMap),
      allDimensions: Object.keys(dataTypesMap),
      setsCounter: 0,

      similarity_map: new_similarity_map,

      isEditingMode: false,

      hovered: null,
      lastHovered: null,

      isCtrlKey: false,
      isShiftKey: false,
      isAltKey: false,
      isInspectionMode: false,
      isInspectionPinned: true,

      colorRange: d3Chromatic.schemeTableau10,
      colorColumn: "",

      uiMode: readStoredUiMode(),
      // Lite mode's filters (see store/filters.js) and their undo history.
      filters: [],
      filterHistory: [],
      filterFuture: [],
      // Which zoom and exclude filters `data` currently reflects.
      appliedScopeSignature: "",

      isOpeningDialogOn: true,
      isStudySharable: false,
      shareLink: null,

      isClusteringPanelOpen: true,

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
      },
    },
    getters: {
      colorScale: (state) => d3.scaleOrdinal(state.colorRange),
      colorize: (state, getters) => (dataItem) => {
        return getters.colorScale(dataItem[state.colorColumn]);
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
      inputDimensions: (state) => {
          if(state.data && state.data[0])
          {
              return Object.keys(state.data[0]).filter(x => x.toUpperCase().includes("IN:")).map(x => x.toUpperCase())
          }
          else {return []}
      },
      outputDimensions: (state) => {
        if(state.data && state.data[0])
        {
          return Object.keys(state.data[0]).filter(x => x.toUpperCase().includes("OUT:")).map(x => x.toUpperCase())
        }
        else {return []}
    },
      dataMap: (state) => {
        return createDataMap(state.data);
      },
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
        return criteria ? criteria.map(describeChip) : null;
      },
      hasRatings: (state) => state.rawData.some(isRated),
      selectionCount: (state, getters) => {
        void state.selectionVersion;
        return Object.keys(getters.selectedInMarking(state.defaultMarkingID))
          .length;
      },
      // The gallery ignores its own selection, as crossfilter views do, so
      // unselected options stay in its pool (dimmed) and can be reselected.
      galleryPool: (state) => {
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

      changeColorRange(state, newColorRange) {
        state.colorRange = newColorRange;
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
        state.data = payload.data;
        state.appliedScopeSignature = payload.signature;
      },
      updateLayout(state, payload) {
        let i = state.layouts.findIndex((l) => l.type === payload.type);
        if (i < 0) return;
        Vue.set(state.layouts, i, Object.assign({}, state.layouts[i], payload));
        saveLayouts(state.layouts);
      },
      /** Adds a panel that is not open, at its default place (or a free corner). */
      openLayout(state, payload) {
        if (state.layouts.some((l) => l.type === payload.type)) return;
        let preset = defaultLayouts().find((l) => l.type === payload.type);
        let entry = preset || { type: payload.type, x: 0, y: 0, w: 16, h: 12 };
        state.layouts.push(Object.assign({}, entry));
        saveLayouts(state.layouts);
      },
      closeLayout(state, payload) {
        let i = state.layouts.findIndex((l) => l.type === payload.type);
        if (i < 0) return;
        state.layouts.splice(i, 1);
        saveLayouts(state.layouts);
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
        }
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
      setIsOpeningDialogOn(state, payload) {
        if (payload) {
          state.isOpeningDialogOn = payload.value;
        }
      },

      setData(state, payload) {
        state.data = payload.newData;
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
        if (before) pushSelectionHistory(state, before, []);
        state.selectionVersion += 1;
      },
      createView(state, payload) {
        let viewID = payload.view;
        let vueComponent = payload.vueComponent;
        state.viewsMap[viewID] = vueComponent;
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
          // Only the default marking is user-facing, so only it is undoable.
          let before =
            markingID === state.defaultMarkingID && payload.record !== false
              ? getSelectedIDs(marking)
              : null;
          operate(marking, payload.selection, payload.operation);
          if (before) {
            pushSelectionHistory(state, before, getSelectedIDs(marking));
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
      rateAlt(state, payload) {
        var index = state.data.findIndex((x) => x._id === payload.item._id);
        console.log(state.data, index, payload.item, payload.rating);
        var alt = state.data[index];
        alt.Rating = payload.rating;

        Vue.set(state.data, index, alt);
      },
      popDataStack(state, payload) {
        payload.data = state.dataStack.pop();
      },
      pushDataStack(state, payload) {
        //TODO put a limit on the depth of the stack
        state.dataStack.push(payload.data);
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
        if (payload && payload.setName) {
          ID = payload.setName;
        } else {
          state.setsCounter += 1;
          ID = "Set #" + state.setsCounter; //utils.generateID();
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
        console.log(ID, state.setsMap[ID], setMarking);
        setMarking = operate(setMarking, payload.members, payload.operation);
        console.log(getSelectedIDs(setMarking));
        Vue.set(state.setsMap, ID, getSelectedIDs(setMarking));
        // Edited by hand, so the filters it was saved from no longer describe it.
        Vue.set(state.setsCriteriaMap, ID, null);
      },
      removeSet(state, payload) {
        let ID = payload.setID;

        for (var i = 0; i < state.setsIDs.length; i++) {
          if (state.setsIDs[i] === ID) {
            state.setsIDs.splice(i, 1);
          }
        }
        Vue.delete(state.setsMap, ID);
        Vue.delete(state.setsCriteriaMap, ID);
        Vue.delete(state.setsMetadataMap, ID);
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
        state.rawData = payload.data;
        state.data = payload.data;

        state.dataTypesMap = payload.dataTypesMap;
        (state.numericDimensions = getNumericDimensions(payload.dataTypesMap)),
          (state.nonNumericDimensions = getNonNumericDimensions(
            payload.dataTypesMap
          )),
          (state.allDimensions = Object.keys(payload.dataTypesMap));
      },
    },
    actions: {
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
      clearInspection(context) {
        context.commit("setLastHovered", {
          lastHovered: context.state.hovered,
        });
        context.commit("hover", { hovered: null });
        context.commit("toggleInspectionMode", { value: false });
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
        console.log(context.state.isInspectionPinned);
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
        Object.keys(ranges).forEach((dim) => {
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
      processShareLink(context, payload)
      {
        let shareLink = processShareLinkSup();
        console.log("processShareLink", shareLink)
        //if null then then something went wrong or the dataset is not shared on a cloud service
        context.state.isStudySharable = shareLink?true:false;
        context.state.shareLink = shareLink;
      },
      saveSelectedToFile(context, payload) {
        let dataMapSubset = context.getters.selectedInMarking(
          context.state.defaultMarkingID
        );
        let selection = map2Data(dataMapSubset);

        var data = selection.length > 0 ? selection : context.state.data;
        var blacklist = ["_id", "images", "image", "json"];
        var selectDims = context.state.allDimensions.filter(
          (x) => !blacklist.includes(x)
        );
        var csvContent = "data:attachment/csv;charset=utf-8,";

        csvContent += selectDims.join(",") + "\n"; //add first row
        var dataString = "";
        data.forEach(function(infoArray, index) {
          dataString = context.state.allDimensions
            .map((dim) => infoArray[dim])
            .join(","); //Object.values(infoArray);
          csvContent += index < data.length ? dataString + "\n" : dataString;
        });
        csvContent = encodeURI(csvContent);

        var a = d3
          .select("body")
          .append("a")
          .attr("href", csvContent)
          .attr("target", "_blank")
          .attr("download", "DSense_SelectedResults.csv");

        a.node().click();
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
        console.log("createDefaultView", payload);
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
        console.log("createDetailsView", payload);
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
        });
      },
      resetData(context) {
        if (context.getters.isLite) {
          // Back to the full collection; the filters stay.
          commitFilters(context, narrowingFilters(context.state.filters));
          return;
        }
        //context.commit('resetMarking', { "markingID": context.state.defaultMarkingID });
        context.commit("setData", { newData: context.state.rawData });
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
        } else if (context.getters.isLite) {
          members = context.getters.isFilterActive
            ? Object.keys(
                context.getters.selectedInMarking(
                  context.state.defaultMarkingID
                )
              )
            : context.state.data.map((d) => d._id);
          criteria = context.state.filters;
        } else {
          members = Object.keys(
            context.getters.selectedInMarking(context.state.defaultMarkingID)
          );
        }
        context.commit("addSet", {
          members: members,
          criteria: criteria,
          setName: payload ? payload.setName : null,
          comment: payload ? payload.comment : null,
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
        context.commit("update", {
          markingID: context.state.defaultMarkingID,
          selection: context.state.setsMap[payload.setID],
          operation: payload.operation,
        });
      },
      updateSet(context, payload) {
        let members = Object.keys(
          context.getters.selectedInMarking(context.state.defaultMarkingID)
        );
        context.commit("updateSet", {
          setID: payload.setID,
          members: members,
          operation: payload.operation,
        });
      },
      rateAlt(context, payload) {
        context.commit("rateAlt", payload);
        // A Rating filter has to pick up the new rating.
        if (context.getters.isFilterActive) applyFiltersToMarking(context);
      },
    },
    modules: {},
  });
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

/** Records `before` as an undo step, unless the change did nothing. */
function pushSelectionHistory(state, before, after) {
  if (sameIds(before, after)) return;
  state.selectionHistory.push(before);
  if (state.selectionHistory.length > HISTORY_LIMIT) {
    state.selectionHistory.shift();
  }
  state.selectionFuture = [];
}

function stepSelectionHistory(state, from, to) {
  let marking = state.markingsMap[state.defaultMarkingID];
  if (!marking || from.length === 0) return;
  to.push(getSelectedIDs(marking));
  operate(marking, from.pop(), operations.REPLACE);
  state.selectionVersion += 1;
}

function processShareLinkSup() {
  let _folderInfo = window._folderInfo;
  if(_folderInfo === null || _folderInfo === undefined || !_folderInfo.inLink )
        return null;
  console.log(_folderInfo);
  var studyCaseLink = encodeUrl(_folderInfo.inLink);
  var studyEncodedUrl = "";

  if (studyCaseLink.length === 0) {
    var warningString =
      "There is no static link for you if you are not using online shared folder.";
    //d3.select("#myStudyID").html(warningString);
    //$("#showStillLink").modal();
    console.log(warningString);
    return;
  } else if (_folderInfo.DE_PW.length > 0) {
    // if _folderInfo.DE_PW existed, just return.
    studyEncodedUrl = document.location.origin + "/?ID=" + _folderInfo.DE_PW;
    //d3.select("#myStudyID").html(studyEncodedUrl);
    //$("#showStillLink").modal();

    console.log(studyEncodedUrl, "https://goo.gl/" + _folderInfo.DE_PW);
    return;
  }

  //valid online folder available
  var studyLongUrl = document.location.origin + "/?ID=" + studyCaseLink;
  //d3.select("#welcome").style("display", "none");
  console.log("studyLongUrl", studyLongUrl);
  let UrlId = studyLongUrl;

  _folderInfo.DE_PW = UrlId;

  if (UrlId.length == 6) {
    // google url id

    studyEncodedUrl = document.location.origin + "/?ID=" + _folderInfo.DE_PW;
  } else if (UrlId.startsWith("BL_")) {
    studyEncodedUrl = document.location.origin + "/?ID=" + _folderInfo.DE_PW;
  } else {
    studyEncodedUrl = studyLongUrl;
  }
  return studyEncodedUrl;
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
    for (var alt in marking) {
      marking[alt] = 0;
    }
    for (var alt of selection) {
      marking[alt] = 1;
    }
  } else if (operation == operations.ADD) {
    for (var alt of selection) {
      marking[alt] = 1;
    }
  } else if (operation == operations.TOGGLE) {
    let selected = getSelection(marking, selection);
    let areAllTheSame = allTheSame(selected);
    if (areAllTheSame) {
      for (var alt of selection) {
        marking[alt] = flip(marking[alt]);
      }
    } else {
      for (var alt of selection) {
        marking[alt] = 1;
      }
    }
  } else if (operation == operations.INTERSECT) {
    let selected = getSelection(marking, selection);
    for (var alt in marking) {
      if (marking[alt] == 1 && selected[alt] == 1) {
        marking[alt] = 1;
      } else {
        marking[alt] = 0;
      }
    }
  } else if (operation == operations.SUBTRACT) {
    for (var alt of selection) {
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
  var dataMapCopy = JSON.parse(JSON.stringify(dataMap));
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
