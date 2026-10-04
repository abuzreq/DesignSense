

<template>
  <v-container>
    <div :id="viewID" />
  </v-container>
</template>


<script>
import * as d3 from "d3";
import { mapState, mapGetters } from "vuex";

// Mutations after which a view must re-read its marking.
const MARKING_MUTATIONS = ["update", "reverseUpdate", "redoUpdate", "resetMarking"];

/*
 * Below this there is no chart worth drawing, and the drawing libraries take
 * the panel's size, subtract their own margins and axis room from it, and
 * hand the negative remainder to an svg element, which the browser rejects
 * one complaint at a time. A panel is this small while the workspace is
 * being measured for the first time, and again for a frame when a seam is
 * dragged to an edge. The width and height watchers below rebuild as soon as
 * there is room.
 */
const MIN_CHART_WIDTH = 40;
const MIN_CHART_HEIGHT = 60;

export default {
  props: ["width", "height", "x", "y", "type"],
  data() {
    return {
      chart: null,
      viewID: null,
      _refreshTimer: null,
      _isDestroyed: false,
    };
  },
  computed: {
    /** Whether the panel is big enough to draw into yet. */
    hasRoomToDraw() {
      return (
        Number(this.width) >= MIN_CHART_WIDTH &&
        Number(this.height) >= MIN_CHART_HEIGHT
      );
    },
    ...mapGetters([
      "colorScale",
      "colorize",
      "isHoveringEnabled",
      "isChartHoverEnabled",
      "isFilterActive",
      "isLite",
      "can",
    ]),
    ...mapState({
      currentSelectionOperation: (state) => state.currentSelectionOperation,
      chartData: (state) => state.data,
      numericDimensions: (state) => state.numericDimensions,
      allDimensions: (state) => state.allDimensions,
      hovered: (state) => state.hovered,
      colorColumn: (state) => state.colorColumn,
      uiMode: (state) => state.uiMode,
    }),
  },
  mounted() {
    // The view registers itself either way: its marking and its place in the
    // store do not wait on there being room to draw.
    if (this.hasRoomToDraw) this.chart = this.createChart();
    this.$store.dispatch("createDefaultView", {
      view: this.viewID,
      vueComponent: this,
    });
    if (this.chart && typeof this.afterChartRebuilt === "function") {
      this.afterChartRebuilt();
    }
  },
  created() {
    this.viewID = "id" + this._uid;

    // Kept, so beforeDestroy can unsubscribe: the store outlives a panel
    // that a layout change removes, and would otherwise keep calling it.
    this.unsubscribeStore = this.$store.subscribe((mutation, state) => {
      if (MARKING_MUTATIONS.includes(mutation.type)) {
        if (this.chart && this.hasOwnProperty("markingChangeHandler"))
          this.markingChangeHandler(mutation.type === "resetMarking");
      }
    });
  },
  methods: {
    createChart: function () {
      this.destroyChart();
      const chart = this.Chart();
      return chart;
    },
    destroyChart: function () {
      let node = d3.select("#" + this.viewID)._groups[0][0];
      while (node && node.firstChild) {
        node.removeChild(node.firstChild);
      }
    },
    highlight(selection) {
      if (this.chart && typeof this.chart.highlight === "function") {
        // With filters active, an empty selection means "nothing matches".
        this.chart.highlight(selection, this.isFilterActive);
      }
    },
    refresh: function () {
      // Loading data mounts a new app over the old one without destroying its
      // views, so a rebuild they scheduled finds no element to draw into.
      if (this._isDestroyed || !this.$el.isConnected) return;
      if (!this.hasRoomToDraw) {
        // Leave nothing half-drawn at a size it cannot be drawn at.
        this.destroyChart();
        this.chart = null;
        return;
      }
      this.chart = this.createChart();
      var selection = this.$store.getters.selectedDataInView(this.viewID);
      this.highlight(selection);
      if (typeof this.hoverHandler === "function") {
        this.hoverHandler();
      }
      // Rebuilding drops anything drawn on top of the chart, such as brushes.
      if (typeof this.afterChartRebuilt === "function") {
        this.afterChartRebuilt();
      }
    },
    /**
     * Rebuilding a chart tears down and recreates every element, which is the
     * dominant cost on large collections. Dragging a panel handle emits a
     * resize per frame, so coalesce bursts into a single trailing rebuild.
     */
    scheduleRefresh: function () {
      if (this._isDestroyed) return;
      if (this._refreshTimer !== null) {
        clearTimeout(this._refreshTimer);
      }
      this._refreshTimer = setTimeout(() => {
        this._refreshTimer = null;
        this.refresh();
      }, 120);
    },
  },
  beforeDestroy() {
    this._isDestroyed = true;
    if (this._refreshTimer !== null) {
      clearTimeout(this._refreshTimer);
      this._refreshTimer = null;
    }
    if (this.unsubscribeStore) this.unsubscribeStore();
    this.$store.commit("removeView", { view: this.viewID });
  },
  watch: {
    hovered: function (newValue, oldValue) {
      if (this.chart && this.hasOwnProperty("hoverHandler")) {
        this.hoverHandler();
      }
    },
    width: function (newValue, oldValue) {
      if (newValue === oldValue) return;
      this.scheduleRefresh();
    },
    height: function (newValue, oldValue) {
      if (newValue === oldValue) return;
      this.scheduleRefresh();
    },
    chartData: {
      handler: function (newValue, oldValue) {
        this.scheduleRefresh();
      },
    },

    colorColumn: function (newValue, oldValue) {
      if (newValue === oldValue) return;
      this.scheduleRefresh();
    },
    colorScale: function (newValue, oldValue) {
      this.scheduleRefresh();
    },
    // Modes differ in brush type and in whether filters are drawn as brushes.
    uiMode: function () {
      this.scheduleRefresh();
    },
  },
};
</script>

