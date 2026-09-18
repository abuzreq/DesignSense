<template >
    <vdr
      :type="type"
      class="v-card v-card--outlined v-sheet theme--light"
      style="border: 1px #80808047 solid;"
      :minWidth="minPanelWidth"
      :minHeight="minPanelHeight"
      :w="panelWidth"
      :h="this.height"
      @activated="onActivated"
      @dragging="onDrag"
      @dragstop="onDragstop"
      @resizing="onResize"
      @resizestop="onResizestop"
      :parent="true"
      :is-conflict-check="false"
      :snap="true"
      v-bind:handles="this.currentEditingMode ? ['br', 'tr', 'tl', 'bl'] : []"
      :draggable="this.currentEditingMode"
      :resizable="this.currentEditingMode"
      ref="panel"
      v-bind:grid="currentEditingMode ? [unitW, unitH] : [1, 1]"
      :x="this.x"
      :y="this.y"
    >
      

      <ScatterplotView
        v-if="type == 'ScatterPlot'"
        :width="panelWidth"
        :height="this.height"
        :x="this.x"
        :y="this.y"
        :type="type"
      />
      <ParCoordsView
        v-if="type == 'ParallelCoordinatesPlot'"
        :width="this.width"
        :height="this.height"
        :x="this.x"
        :y="this.y"
        :type="type"
      />
      <AugmentedGridView
        v-if="type == 'Grid'"
        :width="this.width"
        :height="this.height"
        :defaultEnableContext="true"
        :x="this.x"
        :y="this.y"
        :type="type"
      />
      <SetsView
        v-if="type == 'Sets'"
        :width="this.width"
        :height="this.height"
        :x="this.x"
        :y="this.y"
        :type="type"
      />
      <SPLOMView
        v-if="type == 'SPLOM'"
        :width="this.width"
        :height="this.height"
        :x="this.x"
        :y="this.y"
        :type="type"
      />
    
    </vdr>
</template>
<style scoped>


/* .v-tour--active .card-panel {
  height: 100%;
  width: 100%;
  position: absolute;
} */
.top-card {
  z-index: 25 !important;
}
</style>
<script>
import vdr from "vue-draggable-resizable-gorkys";
import { mapState, mapGetters } from "vuex";

import ParCoordsView from "@/components/ParCoordsView.vue";
import AugmentedGridView from "@/components/AugmentedGridView.vue";

import SPLOMView from "@/components/SPLOMView.vue";

import ScatterplotView from "@/components/ScatterplotView.vue";

import SetsView from "@/components/SetsView.vue";
import { PANEL_HEADER_HEIGHT } from "@/layout.js";

// Room the scatterplot header needs for its two dimension pickers.
const SCATTER_MIN_WIDTH = 400;

export default {
  components: {
    ParCoordsView,
    AugmentedGridView,
    SPLOMView,
    ScatterplotView,
    SetsView,
  },
  // initX..initH are grid cells; unitW and unitH are a cell's size in pixels.
  props: ["initX", "initY", "initW", "initH", "unitW", "unitH", "type"],
  data: function () {
    return {
      width: 800,
      height: 400,
      x: 0,
      y: 0,
    };
  },
  computed: {
    /*computedHandles() {
      let val = this.currentEditingMode ? ["br", "tr", "tl", "bl"] : [];
      console.log(val)
      return val;
    }*/
    ...mapGetters({ currentEditingMode: "getEditingMode", can: "can" }),
    ...mapState({
      isClusteringPanelOpen: (state) => state.isClusteringPanelOpen,
    }),
    panelWidth() {
      return this.fitWidth(this.width, this.height);
    },
    // Minimum sizes only guard resizing by hand. Otherwise they would push a
    // panel over its neighbour whenever the screen gives it less room.
    minPanelWidth() {
      if (!this.currentEditingMode) return 1;
      return (
        { Grid: 500, ScatterPlot: 400, ParallelCoordinatesPlot: 600 }[
          this.type
        ] || 300
      );
    },
    minPanelHeight() {
      if (!this.currentEditingMode) return 1;
      return this.type == "Grid" ? 600 : 300;
    },
  },
  watch: {
    // A resized window or a saved layout change moves the panel.
    unitW: "applyLayout",
    unitH: "applyLayout",
    initX: "applyLayout",
    initY: "applyLayout",
    initW: "applyLayout",
    initH: "applyLayout",
  },
  created() {
    this.applyLayout();
  },
  methods: {
    onResize: function (x, y, width, height) {
      if (this.currentEditingMode) {
        if (
          this.x !== x ||
          this.y !== y ||
          this.width !== width ||
          this.height !== height
        ) {
          this.assignTopCard(this.$el);
          this.x = x;
          this.y = y;
          this.width = width;
          this.height = height;
        }
      }
    },
    onDrag: function (x, y) {
      if (this.currentEditingMode) {
        if (this.x !== x || this.y !== y) {
          this.assignTopCard(this.$el);
          this.x = x;
          this.y = y;
        }
      }
    },
    onDragstop: function (x, y) {
      this.assignTopCard(this.$el);
      this.x = x;
      this.y = y;
      this.persistLayout();
    },
    onResizestop: function (x, y, width, height) {
      if (typeof width === "number") this.width = width;
      if (typeof height === "number") this.height = height;
      this.x = x;
      this.y = y;
      this.persistLayout();
    },
    /** Maps grid cells to pixels. Edges are rounded, so neighbours meet exactly. */
    applyLayout: function () {
      let left = Math.round(this.initX * this.unitW);
      let top = Math.round(this.initY * this.unitH);
      this.x = left;
      this.y = top;
      let width = Math.round((this.initX + this.initW) * this.unitW) - left;
      let height = Math.round((this.initY + this.initH) * this.unitH) - top;
      this.width = width;
      this.height = height;

      // The panel clamps each changed prop against its old size and position,
      // which misplaces it when the window shrinks. Setting its geometry first
      // leaves those prop updates nothing to clamp.
      let panel = this.$refs.panel;
      if (!panel || !this.$el.parentNode) return;
      let parentWidth = this.$el.parentNode.clientWidth;
      let parentHeight = this.$el.parentNode.clientHeight;
      let shownWidth = this.fitWidth(width, height);
      Object.assign(panel, {
        parentWidth: parentWidth,
        parentHeight: parentHeight,
        left: left,
        top: top,
        width: shownWidth,
        height: height,
        right: parentWidth - shownWidth - left,
        bottom: parentHeight - height - top,
      });
    },
    /**
     * Without clusters beside it the scatterplot is a square, so its panel
     * narrows to fit instead of leaving an empty strip. Editing shows the saved
     * width, so resizing never stores the narrowed one.
     */
    fitWidth: function (width, height) {
      let hasClusters = this.can("clustering") && this.isClusteringPanelOpen;
      if (this.type !== "ScatterPlot" || hasClusters || this.currentEditingMode) {
        return width;
      }
      // The plot's side is the height below the header; 2px for the border.
      return Math.min(
        width,
        Math.max(height - PANEL_HEADER_HEIGHT + 2, SCATTER_MIN_WIDTH)
      );
    },
    persistLayout: function () {
      this.$store.commit("updateLayout", {
        type: this.type,
        x: Math.round(this.x / this.unitW),
        y: Math.round(this.y / this.unitH),
        w: Math.max(1, Math.round(this.width / this.unitW)),
        h: Math.max(1, Math.round(this.height / this.unitH)),
      });
    },
    onActivated: function () {
      //  console.log('ahaa', this.$el)
      //    this.assignTopCard(this.$el);
    },
    assignTopCard: function (el) {
      var currentTopCard = document.getElementsByClassName("top-card");
      if (currentTopCard.length > 0) {
        if (!el.isEqualNode(currentTopCard[0])) {
          currentTopCard[0].classList.remove("top-card");
        }
      }
      el.classList.add("top-card");
    },
  },
};
</script>