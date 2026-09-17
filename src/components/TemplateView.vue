

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
    this.chart = this.createChart();
    this.$store.dispatch("createDefaultView", {
      view: this.viewID,
      vueComponent: this,
    });
    if (typeof this.afterChartRebuilt === "function") {
      this.afterChartRebuilt();
    }
  },
  created() {
    this.viewID = "id" + this._uid;

    this.$store.subscribe((mutation, state) => {
      if (MARKING_MUTATIONS.includes(mutation.type)) {
        if (this.hasOwnProperty("markingChangeHandler"))
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
  },
  watch: {
    hovered: function (newValue, oldValue) {
      if (this.hasOwnProperty("hoverHandler")) {
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

