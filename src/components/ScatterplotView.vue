<template>
  <div class="scatter-view" :style="{ height: `${height}px` }">
    <PanelHeader
      icon="mdi-chart-scatter-plot"
      title="Scatterplot"
      :compact="compactHeader"
    >
      <span class="ph-label">X</span>
      <DimensionPicker
        :value="xColumn"
        :items="axisItems"
        dense
        outlined
        hide-details
        class="ph-select"
        @change="onXChange"
      />
      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-btn
            v-on="on"
            icon
            small
            class="ph-btn"
            aria-label="Reverse the X axis"
            @click="isXAxisIncremental = !isXAxisIncremental"
          >
            <v-icon small>{{
              isXAxisIncremental ? "mdi-arrow-left" : "mdi-arrow-right"
            }}</v-icon>
          </v-btn>
        </template>
        <span>{{
          isXAxisIncremental
            ? "Values increase to the left. Click to reverse."
            : "Values increase to the right. Click to reverse."
        }}</span>
      </v-tooltip>
      <!-- Between the two pickers, where what it exchanges is either side
           of it. The matrix draws each pair only one way round, so this is
           how the other way is reached. -->
      <v-tooltip bottom max-width="280">
        <template v-slot:activator="{ on }">
          <v-btn
            v-on="on"
            icon
            small
            class="ph-btn ph-btn--gap"
            aria-label="Swap the axes"
            @click="swapAxes"
          >
            <v-icon small>mdi-swap-horizontal</v-icon>
          </v-btn>
        </template>
        <span
          >Put {{ label(yColumn) }} across and {{ label(xColumn) }} up. Which
          way each axis runs comes with it.</span
        >
      </v-tooltip>
      <span class="ph-label ph-label--gap">Y</span>
      <DimensionPicker
        :value="yColumn"
        :items="axisItems"
        dense
        outlined
        hide-details
        class="ph-select"
        @change="onYChange"
      />
      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-btn
            v-on="on"
            icon
            small
            class="ph-btn"
            aria-label="Reverse the Y axis"
            @click="isYAxisIncremental = !isYAxisIncremental"
          >
            <v-icon small>{{
              isYAxisIncremental ? "mdi-arrow-down" : "mdi-arrow-up"
            }}</v-icon>
          </v-btn>
        </template>
        <span>{{
          isYAxisIncremental
            ? "Values increase downward. Click to reverse."
            : "Values increase upward. Click to reverse."
        }}</span>
      </v-tooltip>
      <v-tooltip v-if="lockedAxes.length > 0" bottom max-width="300">
        <template v-slot:activator="{ on }">
          <span v-on="on" class="ph-meta ph-label--gap">No brushing</span>
        </template>
        <span
          >{{ lockedAxes.map(label).join(" and ") }}
          {{
            lockedAxes.length === 1
              ? "is a custom or weighted dimension"
              : "are custom or weighted dimensions"
          }}, which can't be filtered or brushed. Click points to inspect
          them.</span
        >
      </v-tooltip>

      <template v-slot:actions>
        <!-- Only when both axes have a goal: then the plot has a front. -->
        <v-tooltip v-if="frontGoals" bottom max-width="320">
          <template v-slot:activator="{ on }">
            <v-btn
              v-on="on"
              icon
              small
              class="ph-btn"
              :class="{ 'ph-btn--on': showFront }"
              aria-label="Best trade-offs"
              :aria-pressed="String(showFront)"
              @click="showFront = !showFront"
            >
              <v-icon small>mdi-vector-polyline</v-icon>
            </v-btn>
          </template>
          <span>{{ frontTip }}</span>
        </v-tooltip>
        <v-tooltip v-if="can('lassoBrush')" bottom>
          <template v-slot:activator="{ on }">
            <!-- A disabled button swallows pointer events, so the tooltip
                 listens on a wrapper instead. -->
            <span
              v-on="on"
              class="d-inline-block"
              @focusin="on.focus"
              @focusout="on.blur"
            >
              <v-btn
                icon
                small
                class="ph-btn"
                :class="{ 'ph-btn--on': useLassoBrush && !lassoUnavailable }"
                :disabled="lassoUnavailable"
                aria-label="Lasso selection"
                :aria-pressed="String(useLassoBrush && !lassoUnavailable)"
                @click="useLassoBrush = !useLassoBrush"
              >
                <v-icon small>mdi-lasso</v-icon>
              </v-btn>
            </span>
          </template>
          <span>{{
            lassoUnavailable
              ? "The lasso isn't available above 2,000 points; drag a rectangle instead."
              : useLassoBrush
              ? "Lasso selection is on. Click for rectangular selection."
              : "Select with a free-form lasso"
          }}</span>
        </v-tooltip>
        <v-tooltip bottom max-width="300">
          <template v-slot:activator="{ on }">
            <span
              v-on="on"
              class="d-inline-block"
              @focusin="on.focus"
              @focusout="on.blur"
            >
              <v-btn
                icon
                small
                class="ph-btn"
                :class="{ 'ph-btn--on': sidePanel === 'matrix' }"
                :disabled="!hasSideRoom"
                aria-label="Overview of dimension pairs"
                :aria-pressed="String(sidePanel === 'matrix')"
                @click="toggleMatrix"
              >
                <v-icon small>mdi-view-grid-outline</v-icon>
              </v-btn>
            </span>
          </template>
          <span>{{
            !hasSideRoom
              ? "Widen the panel to show the overview of dimension pairs."
              : sidePanel === "matrix"
              ? "Hide the overview."
              : "Show an overview of dimension pairs, and pick the plot from it."
          }}</span>
        </v-tooltip>
        <v-tooltip v-if="can('clustering')" bottom max-width="300">
          <template v-slot:activator="{ on }">
            <v-btn
              v-on="on"
              icon
              small
              class="ph-btn"
              :class="{ 'ph-btn--on': sidePanel === 'clusters' }"
              aria-label="Clusters"
              :aria-pressed="String(sidePanel === 'clusters')"
              @click="toggleClustering"
            >
              <ClusterIcon class="ph-svg-icon" />
            </v-btn>
          </template>
          <span
            >{{ sidePanel === "clusters" ? "Hide clusters" : "Show clusters" }}.
            Clustering groups options that are similar on the chosen
            dimensions, starting with the plotted ones.</span
          >
        </v-tooltip>
      </template>
    </PanelHeader>
    <div class="scatter-body">
      <div
        :id="viewID"
        ref="scatter"
        class="scatter-plot"
        :style="{ width: `${plotWidth}px`, height: `${plotDrawHeight}px` }"
      />
      <div
        v-if="sidePanel === 'matrix'"
        class="side-view"
        :style="{ width: `${sideWidth}px`, height: `${plotHeight}px` }"
      >
        <ScatterMatrix
          :width="sideWidth"
          :height="plotHeight"
          :x-column="xColumn"
          :y-column="yColumn"
        />
      </div>
      <div
        v-if="can('clustering')"
        v-show="sidePanel === 'clusters'"
        class="cluster-view"
        :style="{ width: `${sideWidth}px`, height: `${plotHeight}px` }"
      >
        <ClusterView
          :width="sideWidth"
          :height="plotHeight"
          :defaultEnableContext="true"
          :x="x"
          :y="y"
          :type="type"
          :showMultiselect="true"
          :parentDimensions="[xColumn, yColumn]"
          :sortByVar="xColumn"
          :sort-desc="isXAxisIncremental"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>

.scatter-view {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
/* The plot is centred in whatever it does not take; the side panels are
   given the full height and so are unaffected by it. */
.scatter-body {
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  min-height: 0;
}
.scatter-plot {
  flex: 0 0 auto;
  position: relative;
}
.cluster-view,
.side-view {
  flex: 0 0 auto;
  overflow: hidden;
}
.ph-svg-icon {
  width: 18px;
  height: 18px;
  fill: currentColor;
}
::v-deep .axis .tick text {
  font-size: 11px;
}

div ::v-deep .axis line {
  stroke: #ddd;
}

/* The best trade-offs of the plotted pair, when both axes have a goal. */
div ::v-deep .front-line {
  fill: none;
  stroke: #263238;
  stroke-width: 1.5px;
  stroke-dasharray: 5 3;
  pointer-events: none;
}
div ::v-deep .front-point {
  fill: none;
  stroke: #263238;
  stroke-width: 1.5px;
  pointer-events: none;
}

div ::v-deep .axis path {
  display: none;
}

div ::v-deep .cell text {
  font-weight: bold;
  text-transform: capitalize;
}

div ::v-deep .frame {
  fill: none;
  stroke: #aaa;
}

div ::v-deep circle {
  fill-opacity: 1;
}

div ::v-deep circle.hidden:not(.mark-circle) {
  opacity: 0.35;
}

div ::v-deep g.has-selection circle.point:not(.hidden) {
  stroke: rgb(33, 119, 180);
  stroke-width: 1.5px;
}

div ::v-deep canvas.points-canvas {
  position: absolute;
  pointer-events: none;
  z-index: 0;
}

div ::v-deep svg.scatter-svg {
  position: relative;
  z-index: 1;
}

/*
 * d3's brush lays a rect over the whole plot and gives it a crosshair. A
 * crosshair is a hairline that Windows draws at its own size whatever the
 * pointer is set to, so over the plot -- most of the panel -- the pointer
 * appears to vanish. The ordinary arrow instead: the grips of a drawn
 * rectangle keep their resize cursors, which says enough about dragging.
 */
div ::v-deep svg.scatter-svg .overlay {
  cursor: default;
}

/* Click-to-inspect: d3 sets a cursor on the brush rects, so target them. */
div ::v-deep svg.scatter-svg.near-point .overlay,
div ::v-deep svg.scatter-svg.near-point .selection {
  cursor: pointer;
}

div ::v-deep .extent {
  fill: #000;
  fill-opacity: 0.125;
  stroke: #fff;
}

::v-deep .lasso path {
  stroke: rgb(80, 80, 80);
  stroke-width: 2px;
}

/* The lasso listens on a rect beneath the points and its own path, so let the
   pointer pass through both: lassos can start on a point and keep the cursor. */
div ::v-deep svg.scatter-svg.lasso-mode circle.point,
::v-deep .lasso path {
  pointer-events: none;
}

::v-deep .lasso .drawn {
  fill-opacity: 0.05;
}

::v-deep .lasso .loop_close {
  fill: none;
  stroke-dasharray: 4, 4;
}

::v-deep .lasso .origin {
  fill: #3399ff;
  fill-opacity: 0.5;
}
</style>
<script>
import * as d3 from "d3";
// Called as `lasso()`, not `d3.lasso()`: a module namespace is sealed, so the
// old line that hung it on d3 fails silently under a bundler that keeps them
// as real modules.
import { lasso } from "d3-lasso";

//import ScatterPlot from "@/components/Scatterplot.js";
import { mapGetters, mapState } from "vuex";
import { operations } from "@/components/operations.js";
import TemplateView from "@/components/TemplateView.vue";
import PanelHeader from "@/components/PanelHeader.vue";
import { PANEL_HEADER_HEIGHT } from "@/layout.js";

// Below this a square plot is too small to read, so a narrow panel keeps
// the height it has rather than matching its width.
const MIN_PLOT_HEIGHT = 220;
import { formatValue } from "@/store/filters.js";
import { axisTickFormat } from "@/components/axisFormat.js";
import { GOAL_MARKS, dimensionItems, displayName } from "@/columns.js";
import {
  frontCaveats,
  frontSteps,
  frontWarning,
  paretoFront,
  rowsWithValues,
} from "@/analysis/pareto.js";
import { isMissingFor } from "@/store/dimensions.js";
import { RATING_DIMENSION } from "@/ratings.js";
import ClusterIcon from "@/assets/cluster_icon.svg?component";
import ClusterView from "@/components/ClusterView.vue";
import ScatterMatrix from "@/components/ScatterMatrix.vue";
import DimensionPicker from "@/components/DimensionPicker.vue";

// SVG circles become the bottleneck past a couple thousand points: each is a
// DOM node, and highlight() re-sorts the lot. Above this many plotted points
// the chart draws on a canvas instead, which also rules out the lasso.
const CANVAS_THRESHOLD = 2000;
// Roughly how much room each tick label gets along each axis.
const X_TICK_SPACING = 70;
const Y_TICK_SPACING = 45;
// Below this panel width the matrix stays closed.
const MIN_SIDE_PANEL_WIDTH = 520;

export default {
  mixins: [TemplateView],
  name: "ScatterplotView",
  components: {
    PanelHeader,
    ClusterIcon,
    ClusterView,
    ScatterMatrix,
    DimensionPicker,
  },
  data: function() {
    return {
      // Only the defaults; the axes themselves live in the store so that the
      // assistant and share links can set them.
      xFallback: "",
      yFallback: "",
      isXAxisIncremental: false,
      isYAxisIncremental: false,
      useLassoBrush: false,
      // Lite: whether the drawn rectangle is a lone axis brush mirrored here
      // rather than one of the plot's own boxes.
      mirrored: false,
      // Whether the front of the plotted pair is drawn, when both have goals.
      showFront: true,
      // `{ count, of, caveats }` for the front last drawn, for its tooltip.
      frontInfo: null,
      headerHeight: PANEL_HEADER_HEIGHT,
    };
  },
  computed: {
    xColumn: {
      get() {
        return this.$store.state.viewSettings.scatterX || this.xFallback;
      },
      set(value) {
        this.$store.commit("setViewSetting", { key: "scatterX", value: value });
      },
    },
    yColumn: {
      get() {
        return this.$store.state.viewSettings.scatterY || this.yFallback;
      },
      set(value) {
        this.$store.commit("setViewSetting", { key: "scatterY", value: value });
      },
    },
    // Too narrow a panel leaves neither the plot nor the matrix readable.
    hasSideRoom() {
      return this.width >= MIN_SIDE_PANEL_WIDTH;
    },
    /**
     * What the side column shows: the matrix of dimension pairs, the
     * clusters (an Expert tool), or nothing. It takes 40% of the width.
     */
    sidePanel() {
      if (this.isMatrixPanelOpen) return this.hasSideRoom ? "matrix" : null;
      if (this.can("clustering") && this.isClusteringPanelOpen) return "clusters";
      return null;
    },
    sideWidth() {
      return Math.round(this.width * 0.4);
    },
    // Without a side column the plot takes the whole panel; the axes add
    // ticks as they get longer.
    // Never below zero: a panel is briefly unmeasured while it mounts, and
    // a negative size reaches the plot's svg as an invalid attribute.
    plotWidth() {
      if (this.sidePanel) return Math.max(0, this.width - this.sideWidth);
      return Math.max(0, this.width);
    },
    /** The room below the header, which the side panels take all of. */
    plotHeight() {
      return Math.max(0, this.height - this.headerHeight);
    },
    /**
     * How tall the plot itself is drawn. Two axes of a pair deserve the same
     * room, so it is never taller than it is wide: a panel left tall by
     * closing the one beside it would otherwise stretch the cloud into a
     * column and make distances along one axis look larger than the other.
     */
    plotDrawHeight() {
      let tallest = Math.max(MIN_PLOT_HEIGHT, this.plotWidth);
      return Math.min(this.plotHeight, tallest);
    },
    compactHeader() {
      return this.width < 640;
    },
    ...mapState({
      isClusteringPanelOpen: (state) => state.isClusteringPanelOpen,
      isMatrixPanelOpen: (state) => state.isMatrixPanelOpen,
      dimensionValuesVersion: (state) => state.dimensionValuesVersion,
    }),
    ...mapGetters([
      "dimensionStructure",
      "unfilterableDimensions",
      "goalOf",
      "goalSignature",
    ]),
    /** The plotted pair's goals when both have one, else null: no front to draw. */
    frontGoals() {
      if (this.xColumn === this.yColumn) return null;
      let goals = [this.goalOf(this.xColumn), this.goalOf(this.yColumn)];
      return goals[0] && goals[1] ? goals : null;
    },
    frontTip() {
      if (!this.frontGoals) return "";
      let pair =
        this.axisLabel(this.xColumn) + " and " + this.axisLabel(this.yColumn);
      if (!this.showFront) {
        return "Show the best trade-offs of " + pair + ".";
      }
      let info = this.frontInfo;
      let text = "The line marks the best trade-offs of " + pair;
      if (info) {
        text += ": " + info.count + " of " + info.of + " options no other beats on both.";
        let warning = frontWarning(info.caveats);
        let trade = info.caveats.find((caveat) => caveat.key === "trade");
        if (warning) text += " " + warning;
        else if (trade) text += " " + trade.detail[0];
      } else {
        text += ".";
      }
      return text + " Click to hide.";
    },
    axisItems() {
      return dimensionItems(this.numericDimensions);
    },
    /**
     * Past CANVAS_THRESHOLD plotted points the chart draws on a canvas and
     * falls back to a rectangle brush, so the lasso toggle would do nothing.
     */
    lassoUnavailable() {
      let x = this.xColumn;
      let y = this.yColumn;
      let plotted = 0;
      for (let d of this.chartData || []) {
        if (Number.isFinite(d[x]) && Number.isFinite(d[y])) plotted++;
        if (plotted > CANVAS_THRESHOLD) return true;
      }
      return false;
    },
    /** The plotted custom and weighted dimensions, which can't be brushed. */
    lockedAxes() {
      let dims = this.xColumn === this.yColumn ? [this.xColumn] : [this.xColumn, this.yColumn];
      return dims.filter((dim) => this.unfilterableDimensions.includes(dim));
    },
  },
  watch: {
    // Opening, closing or switching the side column resizes the plot.
    sidePanel: function() {
      this.scheduleRefresh();
    },
    // Custom values or ratings changed in place; redraw if this plot shows them.
    dimensionValuesVersion: function() {
      let shown = [this.xColumn, this.yColumn, this.colorColumn];
      if (
        shown.some(
          (dim) =>
            dim === RATING_DIMENSION || this.unfilterableDimensions.includes(dim)
        )
      ) {
        this.scheduleRefresh();
      }
    },
    // Custom dimensions were added, removed or given a new range.
    dimensionStructure: function() {
      this.scheduleRefresh();
    },
    // A goal changed: the axis titles' marks, and whether there is a front.
    goalSignature: function() {
      this.scheduleRefresh();
    },
    showFront: function() {
      this.drawFront();
    },
    // Set from outside (the assistant), not only through the dropdowns.
    xColumn: function() {
      this.scheduleRefresh();
    },
    yColumn: function() {
      this.scheduleRefresh();
    },
    useLassoBrush: {
      handler: function() {
        this.scheduleRefresh();
      },
    },
    isXAxisIncremental: {
      handler: function() {
        this.scheduleRefresh();
      },
    },
    isYAxisIncremental: {
      handler: function() {
        this.scheduleRefresh();
      },
    },
  },
  created() {
    //To give access to d3-lasso to the d3 object
    window["d3"] = d3;

    this.xFallback = this.numericDimensions[0];
    this.yFallback = this.numericDimensions.includes("out:Percent Planar")
      ? "out:Percent Planar"
      : this.numericDimensions[1];
  },
  methods: {
    label: displayName,
    toggleMatrix: function() {
      this.$store.commit("setMatrixPanelOpen", {
        value: !this.isMatrixPanelOpen,
      });
    },
    toggleClustering: function() {
      this.$store.commit("setClusteringPanelOpen", {
        value: !this.isClusteringPanelOpen,
      });
    },
    /** An axis's title: its name, and ↑ or ↓ when it has a goal. */
    axisLabel: function(dim) {
      let mark = GOAL_MARKS[this.goalOf(dim)];
      return displayName(dim) + (mark ? " " + mark.mark : "");
    },
    /**
     * Draws the front of the plotted pair over the current result (see the
     * store's tradeOffRows), or takes it away when either axis has no goal
     * or it is hidden.
     */
    drawFront: function() {
      if (!this.chart || typeof this.chart.showFront !== "function") return;
      let goals = this.frontGoals;
      if (!goals || !this.showFront) {
        this.chart.showFront(null);
        this.frontInfo = null;
        return;
      }
      let dims = [this.xColumn, this.yColumn];
      let values = rowsWithValues(
        this.$store.getters.tradeOffRows,
        dims,
        isMissingFor
      );
      let front = paretoFront(values.rows, dims, goals);
      this.chart.showFront({
        steps: frontSteps(front, dims, goals),
        points: front.map((row) => [row[dims[0]], row[dims[1]]]),
      });
      this.frontInfo = {
        count: front.length,
        of: values.rows.length,
        caveats: frontCaveats({
          dims: dims,
          directions: goals,
          rows: values.rows,
          front: front,
        }),
      };
    },

    /**
     * The pair the other way round. The direction of each axis travels with
     * its dimension, so the plot is the same cloud reflected about the
     * diagonal rather than a differently arranged one.
     */
    swapAxes: function() {
      let x = this.xColumn;
      let y = this.yColumn;
      let xWasIncremental = this.isXAxisIncremental;
      this.xColumn = y;
      this.yColumn = x;
      this.isXAxisIncremental = this.isYAxisIncremental;
      this.isYAxisIncremental = xWasIncremental;
      // Not refresh(): the two flags above each schedule one of their own,
      // and this way the three changes cost a single rebuild.
      this.scheduleRefresh();
    },
    onXChange: function(newXColumn) {
      this.xColumn = newXColumn;
      this.refresh();
    },
    onYChange: function(newYColumn) {
      this.yColumn = newYColumn;
      this.refresh();
    },
    markingChangeHandler: function(reset) {
      if (reset) {
        this.chart.unhighlightAll();
      } else {
        var result = this.$store.getters.selectedDataInView(this.viewID);
        this.chart.highlight(result, this.isFilterActive);
        this.syncLiteBrush();
      }
      // The front is of the current result, which a filter changes.
      this.drawFront();
    },
    afterChartRebuilt: function() {
      this.syncLiteBrush();
      this.drawFront();
    },
    /** The dimensions this plot's rectangles constrain: the pair, or one plotted against itself. */
    plotDims: function() {
      return this.xColumn === this.yColumn
        ? [this.xColumn]
        : [this.xColumn, this.yColumn];
    },
    /**
     * Lite mode: the rectangles become one filter over both plotted
     * dimensions, OR-ed, and clicking empty space clears them. Only what
     * this plot draws is touched: its own rectangles, and a lone axis brush
     * it was mirroring as a rectangle. Every other filter stays.
     */
    onLiteBrush: function(rects) {
      let x = this.xColumn;
      let y = this.yColumn;
      // Custom dimensions can't be filtered by; take the rectangle back.
      if (this.lockedAxes.length > 0) {
        if (rects && rects.length > 0) this.clearDrawnBrush();
        return;
      }
      let boxes = (rects || []).map((rect) => {
        // A dimension plotted against itself gives two readings of one range.
        if (x === y) {
          return {
            [x]: [Math.max(rect.x[0], rect.y[0]), Math.min(rect.x[1], rect.y[1])],
          };
        }
        return { [x]: rect.x, [y]: rect.y };
      });
      this.$store.dispatch("setBoxFilter", {
        dims: this.plotDims(),
        boxes: boxes,
        replace: this.mirrored ? [x, y] : [],
      });
    },
    /**
     * Draws this plot's boxes as its rectangles. With none of its own, the
     * brushes on the plotted dimensions (axis brushes, assistant filters)
     * show as the rectangles they imply: each brush on x crossed with each
     * brush on y, a dimension with no brush spanning its whole axis. Those
     * rectangles can be dragged here, which moves the brushes into the
     * plot's own filter. `mirrored` remembers which case is drawn, since only
     * a drawn brush may be moved or cleared from here.
     */
    syncLiteBrush: function() {
      if (!this.isLite || !this.chart || !this.chart.showBrush) return;
      let x = this.xColumn;
      let y = this.yColumn;
      this.mirrored = false;
      if (this.lockedAxes.length > 0) {
        this.chart.showBrush([]);
        return;
      }
      let boxes = this.$store.getters.boxesFor(this.plotDims());
      if (boxes.length === 0 && x !== y) {
        let xs = this.$store.getters.boxesFor([x]);
        let ys = this.$store.getters.boxesFor([y]);
        if (xs.length + ys.length > 0) {
          boxes = [];
          (xs.length ? xs : [{}]).forEach((bx) => {
            (ys.length ? ys : [{}]).forEach((by) => {
              boxes.push(Object.assign({}, bx, by));
            });
          });
          this.mirrored = true;
        }
      }
      this.chart.showBrush(
        boxes.map((box) => ({ x: box[x] || null, y: box[y] || null }))
      );
    },
    /**
     * Lite mode: clicking a point inspects it without touching the filters.
     * Clicking empty space outside the brush clears this plot's filters;
     * inside the brush it changes nothing.
     */
    onLiteClick: function(item, pressedOnOverlay) {
      if (item) {
        this.$store.dispatch("inspectByClick", { item: item });
        // A press on the overlay nulled the drawn brush; redraw it from the filters.
        this.syncLiteBrush();
        return;
      }
      if (pressedOnOverlay) {
        this.onLiteBrush(null);
      } else {
        this.syncLiteBrush();
      }
    },
    /**
     * A click that barely moved. On a point it inspects it, or stops
     * inspecting the inspected one. Elsewhere, Lite clears or keeps its
     * filters (see onLiteClick), and Expert lets the click act as a brush by
     * returning false, which under Replace clears the selection.
     */
    onChartClick: function(item, pressedOnOverlay) {
      if (this.isLite) {
        this.onLiteClick(item, pressedOnOverlay);
        return true;
      }
      if (item) {
        this.$store.dispatch("inspectByClick", { item: item });
        return true;
      }
      return false;
    },
    /**
     * What an Expert brush selected, for describing the selection: its
     * rectangles as ranges on the plotted dimensions, or, for a lasso, the
     * options it drew around.
     */
    brushStep: function(brushedIDs, rects) {
      let x = this.xColumn;
      let y = this.yColumn;
      if (!rects || rects.length === 0) {
        return {
          kind: "set",
          label: "Lasso on " + displayName(x) + " × " + displayName(y),
          ids: brushedIDs,
        };
      }
      return {
        kind: "region",
        boxes: rects.map((rect) => {
          // A dimension plotted against itself gives two readings of one range.
          if (x === y) {
            return {
              [x]: [Math.max(rect.x[0], rect.y[0]), Math.min(rect.x[1], rect.y[1])],
            };
          }
          return { [x]: rect.x, [y]: rect.y };
        }),
      };
    },
    /** Removes a rectangle just drawn, once the brush has finished its gesture. */
    clearDrawnBrush: function() {
      setTimeout(() => {
        if (this.chart && this.chart.showBrush) this.chart.showBrush([]);
      }, 0);
    },
    hoverHandler: function() {
      //this.chart.cleanTooltip();

      // A chart built before its panel had room drew nothing, and has no mark.
      if (!this.chart || typeof this.chart.mark !== "function") return;
      let hovered = this.$store.getters.getHovered;
      this.chart.mark(hovered);

      //this.chart.createTooltip(hovered);
    },
    Chart: function() {
      var scatterPlot = new ScatterPlot();
      // The left margin fits a compact tick label (up to ~5 characters at
      // 11px) plus the rotated y title beyond it; the bottom one fits a row of
      // tick labels with the x title below.
      var margin = { left: 54, top: 10, right: 12, bottom: 45 };
      var innerWidth = this.plotWidth - margin.left - margin.right;
      // The drawn height, not the room there is: the plot keeps its shape
      // and sits in the middle of a panel taller than it needs.
      var innerHeight = this.plotDrawHeight - margin.top - margin.bottom;
      scatterPlot
        .outerWidth(this.plotWidth)
        .outerHeight(this.plotDrawHeight)
        .margin(margin)
        .xColumn(this.xColumn)
        .xAxisLabel(this.axisLabel(this.xColumn))
        .xAxisLabelOffset(36)
        // One tick per ~70px across and ~45px up; d3 rounds to nice steps, so
        // these are upper bounds more than exact counts.
        .xTicks(Math.max(2, Math.floor(innerWidth / X_TICK_SPACING)))
        .yColumn(this.yColumn)
        .yAxisLabel(this.axisLabel(this.yColumn))
        .yAxisLabelOffset(42)
        .yTicks(Math.max(2, Math.floor(innerHeight / Y_TICK_SPACING)))
        .isXAxisIncremental(this.isXAxisIncremental)
        .isYAxisIncremental(this.isYAxisIncremental)
        .useLassoBrush(this.useLassoBrush && this.can("lassoBrush"))
        .multiBrush(this.can("multiBrush"))
        .hoverHint(this.can("clickToInspect"))
        .onClicked((item, pressedOnOverlay) =>
          this.onChartClick(item, pressedOnOverlay)
        )
        .colorColumn(this.colorColumn)
        .colorScale(this.colorScale)
        // Custom and weighted axes span their fixed range.
        .xDomain(this.$store.getters.fixedBoundsOf(this.xColumn))
        .yDomain(this.$store.getters.fixedBoundsOf(this.yColumn))
        .onBrushed((brushedIDs, extent) => {
          if (this.isLite) {
            this.onLiteBrush(extent);
            return;
          }
          // Brushing custom dimensions would select by values still being
          // decided; an empty brush still clears the selection.
          if (this.lockedAxes.length > 0 && brushedIDs.length > 0) {
            this.clearDrawnBrush();
            return;
          }
          // An empty brush (clicking empty space, or clearing the brush) clears
          // the selection. Only under Replace though -- emptying the selection
          // while Add/Subtract/Intersect is active would be destructive.
          if (
            brushedIDs.length === 0 &&
            this.currentSelectionOperation !== operations.REPLACE
          ) {
            return;
          }
          this.$store.dispatch("update", {
            view: this.viewID,
            selection: brushedIDs,
            operation: this.currentSelectionOperation,
            step: this.brushStep(brushedIDs, extent),
          });
        })
        .onHovered((hovered) => {
          if (!this.isChartHoverEnabled || hovered === this.hovered) return;
          this.$store.commit("hover", { hovered: hovered });
        })
        .keyFunc((d) => d._id); //TODO make the dimension name (i.e. _id) global

      d3.select("#" + this.viewID)
        .datum(this.chartData)
        .call(scatterPlot);

      return scatterPlot;
    },
  },
};
/** An extent with no values in it becomes 0-1, so the axes still draw. */
function fallbackDomain(extent) {
  return extent[0] === undefined ? [0, 1] : extent;
}

class ScatterPlot {
  constructor() {
    var outerWidth = 0;
    var outerHeight = 0;

    var margin = { left: 0, top: 0, right: 0, bottom: 0 };

    var circlesRadius = 3;
    var markCircleRadius = 9;

    var xColumn = "No X column configured";
    var yColumn = "No Y column configured";
    var colorColumn = "No color column configured";

    var xAxisLabel = "No X axis label configured";
    var xAxisLabelOffset = 40;
    var isXAxisIncremental = true;

    var yAxisLabel = "No Y axis label configured";
    var yAxisLabelOffset = 30;
    var isYAxisIncremental = true;

    var xScale = d3.scaleLinear();
    var yScale = d3.scaleLinear();
    // Fixed domains, or null to span the plotted values.
    var xDomain = null;
    var yDomain = null;
    var colorScale = d3.scaleOrdinal();

    var xAxis = d3
      .axisBottom()
      .ticks(6)
      .tickFormat(d3.format("s"));
    var xTicks = 6;

    var yAxis = d3
      .axisLeft()
      .ticks(6)
      .tickFormat(d3.format("s"));
    var yTicks = 6;
    let thisG = null;

    var useLassoBrush;
    var onBrushed;
    var onHovered;
    // Called for a click (a brush gesture that barely moved) with the point
    // under the pointer, or null. Returning false, or leaving it unset, lets
    // the click act as a brush.
    var onClicked = null;
    var hoverHint = false;
    // Several rectangles at once, OR-ed (Lite). Off, the plot holds one brush.
    var multiBrush = false;
    var CLICK_RADIUS = 7;
    var CLICK_SLOP = 3;

    var keyFunc;
    // Past CANVAS_THRESHOLD (module level, shared with the lasso toggle) the
    // points go on a canvas, drawn in one pass; axes, brush, and the
    // inspection ring stay in SVG.
    function chart(selection) {
      // A panel still being laid out has no room yet; drawing then would set
      // negative SVG sizes, which the browser rejects.
      if (outerWidth <= 0 || outerHeight <= 0) return;
      var innerWidth = Math.max(0, outerWidth - margin.left - margin.right);
      var innerHeight = Math.max(0, outerHeight - margin.top - margin.bottom);
      var offset = 15;
      xScale.range(
        isXAxisIncremental
          ? [innerWidth - offset, offset]
          : [offset, innerWidth - offset]
      );
      yScale.range(
        isYAxisIncremental
          ? [offset, innerHeight - offset]
          : [innerHeight - offset, offset]
      );

      selection.each(function(allData) {
        // An option missing either plotted value has no place on the plot.
        var data = allData.filter(
          (d) => Number.isFinite(d[xColumn]) && Number.isFinite(d[yColumn])
        );
        var useCanvas = data.length > CANVAS_THRESHOLD;
        var selectedIds = new Set();
        // Dim unselected points even when nothing is selected, for Lite
        // filters that match nothing.
        var dimOthers = false;
        // Set while the brush is moved programmatically, so its events are ignored.
        var syncingBrush = false;
        // Where the current brush gesture began, to tell clicks from drags.
        var press = null;
        // Multi-brush: one entry per rectangle, the last one always empty and
        // waiting for the next drag (its overlay is the only one that takes
        // events).
        var brushes = [];
        var brushLayer = null;
        var nextBrushId = 0;
        var div = d3.select(this);
        div.style("position", "relative");

        xScale.domain(
          xDomain ||
            fallbackDomain(
              d3.extent(data, function(d) {
                return d[xColumn];
              })
            )
        );
        yScale.domain(
          yDomain ||
            fallbackDomain(
              d3.extent(data, function(d) {
                return d[yColumn];
              })
            )
        );

        var canvasSel = div.select("canvas.points-canvas");
        var ctx = null;
        if (useCanvas) {
          if (canvasSel.empty()) {
            canvasSel = div.append("canvas").attr("class", "points-canvas");
          }
          var dpr = window.devicePixelRatio || 1;
          canvasSel
            .attr("width", innerWidth * dpr)
            .attr("height", innerHeight * dpr)
            .style("width", innerWidth + "px")
            .style("height", innerHeight + "px")
            .style("left", margin.left + "px")
            .style("top", margin.top + "px");
          ctx = canvasSel.node().getContext("2d");
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        } else {
          canvasSel.remove();
        }

        var svg = div.select("svg.scatter-svg");
        if (svg.empty()) {
          svg = div.append("svg").attr("class", "scatter-svg");
        } else {
          svg.selectAll("*").remove();
        }

        svg.attr("width", outerWidth).attr("height", outerHeight);
        svg.attr("viewBox", [0, 0, outerWidth, outerHeight]);

        var g = svg.append("g");

        var circles = g.selectAll("circle.point");
        if (!useCanvas) {
          circles = circles
            .data(data, keyFunc)
            .enter()
            .append("circle")
            .attr("class", "point");
        }

        g.append("g")
          .attr("class", "x axis")
          .append("text")
          .attr("class", "label x_label")
          .style("text-anchor", "middle");

        g.append("g")
          .attr("class", "y axis")
          .append("text")
          .attr("class", "label y_label")
          .style("text-anchor", "middle");

        // Lasso needs SVG circle nodes. On a canvas plot we keep the cheaper
        // rectangular brush so a large collection cannot stall the page.
        var rectBrush, lassoBrush;
        var useRect = !useLassoBrush || useCanvas;
        function makeRectBrush() {
          var b = d3
            .brush()
            .extent([
              [0, 0],
              [innerWidth, innerHeight],
            ])
            .on("start", brushstart)
            .on("brush", brushmove)
            .on("end", brushend)
            .filter((x) => {
              return !d3.event.button;
            });
          //ref: https://github.com/d3/d3-brush/issues/20
          b.keyModifiers(false);
          return b;
        }
        if (useRect) {
          if (!multiBrush) rectBrush = makeRectBrush();
        } else {
          var lasso_area = g
            .insert("rect", ":first-child")
            .attr("class", "lasso-area")
            .attr("width", innerWidth)
            .attr("height", innerHeight)
            .style("opacity", 0);

          lassoBrush = lasso()
            .closePathDistance(120)
            .closePathSelect(true)
            .hoverSelect(false)
            .targetArea(lasso_area)
            .on("start", brushstart)
            .on("brush", brushmove)
            .on("end", brushend);

          lassoBrush.items(circles);
        }
        svg.classed("lasso-mode", !!lassoBrush);

        g.attr(
          "transform",
          "translate(" + margin.left + "," + margin.top + ")"
        );

        g.select(".x.axis")
          .attr("transform", "translate(0," + innerHeight + ")")
          .call(
            d3
              .axisBottom(xScale)
              .ticks(xTicks)
              .tickFormat(axisTickFormat(xScale, xTicks))
          )
          // The title was appended before the ticks, so it is the first text.
          .select("text")
          .attr("x", innerWidth / 2)
          .attr("y", xAxisLabelOffset)
          .attr("fill", "black")
          .text(xAxisLabel)
          .style("font-size", "12px");
        g.select(".y.axis")
          .call(
            d3
              .axisLeft(yScale)
              .ticks(yTicks)
              .tickFormat(axisTickFormat(yScale, yTicks))
          )
          .select("text")
          .attr(
            "transform",
            "translate(-" +
              yAxisLabelOffset +
              "," +
              innerHeight / 2 +
              ") rotate(-90)"
          )
          .text(yAxisLabel)
          .attr("fill", "black")
          .style("font-size", "12px");

        if (!useCanvas) {
          circles
            .attr("cx", function(d) {
              return xScale(d[xColumn]);
            })
            .attr("cy", function(d) {
              return yScale(d[yColumn]);
            })
            .attr("r", function(d) {
              return circlesRadius;
            })
            .attr("fill", function(d) {
              return colorScale(d[colorColumn]);
            });
        }

        var markCircle = g
          .append("circle")
          .attr("class", "mark-circle")
          .attr("r", markCircleRadius)
          .attr("stroke", "#ff0000")
          .attr("stroke-width", "2")
          .attr("fill", "none");
        markCircle.attr("opacity", 0);

        // Click-to-inspect affordance: a light ring on the point under the pointer.
        var hintCircle = g
          .append("circle")
          .attr("class", "hint-circle")
          .attr("r", CLICK_RADIUS)
          .attr("fill", "none")
          .attr("stroke", "#555")
          .attr("stroke-opacity", 0.6)
          .attr("stroke-width", 1.5)
          .style("pointer-events", "none")
          .attr("opacity", 0);

        // The ranges a rectangle covers, read out beside it while it is drawn
        // or moved: one label above for x, one to the side for y.
        var brushLabel = g
          .append("g")
          .attr("class", "brush-label")
          .style("pointer-events", "none")
          .attr("opacity", 0);
        ["x", "y"].forEach((axis) => {
          brushLabel
            .append("text")
            .attr("class", axis)
            .attr("font-size", 11)
            .attr("fill", "#1e3a5f")
            .attr("stroke", "white")
            .attr("stroke-width", 3)
            .attr("paint-order", "stroke")
            .attr("dominant-baseline", "middle");
        });

        function rangeText(column, range, scale) {
          var domain = scale.domain();
          var span = Math.abs(domain[1] - domain[0]);
          // Both ends share a magnitude, so they are written alike.
          var magnitude = Math.max(Math.abs(range[0]), Math.abs(range[1]));
          return (
            displayName(column) +
            " " +
            formatValue(range[0], span, magnitude) +
            " – " +
            formatValue(range[1], span, magnitude)
          );
        }

        function showBrushLabel(rect) {
          if (!rect) {
            brushLabel.attr("opacity", 0);
            return;
          }
          var ranges = extentToRanges(rect);
          var left = Math.min(rect[0][0], rect[1][0]);
          var right = Math.max(rect[0][0], rect[1][0]);
          var top = Math.min(rect[0][1], rect[1][1]);
          var bottom = Math.max(rect[0][1], rect[1][1]);
          brushLabel.attr("opacity", 1);
          brushLabel
            .select("text.x")
            .attr("x", (left + right) / 2)
            .attr("y", top >= 16 ? top - 9 : bottom + 10)
            .attr("text-anchor", "middle")
            .text(rangeText(xColumn, ranges.x, xScale));
          var roomLeft = left >= 110;
          brushLabel
            .select("text.y")
            .attr("x", roomLeft ? left - 6 : right + 6)
            .attr("y", (top + bottom) / 2)
            .attr("text-anchor", roomLeft ? "end" : "start")
            .text(rangeText(yColumn, ranges.y, yScale));
        }

        function showHint(item) {
          if (item) {
            hintCircle
              .attr("cx", xScale(item[xColumn]))
              .attr("cy", yScale(item[yColumn]))
              .attr("opacity", 1);
          } else {
            hintCircle.attr("opacity", 0);
          }
          svg.classed("near-point", !!item);
        }

        function drawCanvas() {
          if (!ctx) return;
          ctx.clearRect(0, 0, innerWidth, innerHeight);
          var hasSel = dimOthers;
          var r = circlesRadius;
          ctx.globalAlpha = hasSel ? 0.35 : 0.75;
          for (var i = 0; i < data.length; i++) {
            var d = data[i];
            if (hasSel && selectedIds.has(keyFunc(d))) continue;
            ctx.beginPath();
            ctx.fillStyle = colorScale(d[colorColumn]);
            ctx.arc(xScale(d[xColumn]), yScale(d[yColumn]), r, 0, Math.PI * 2);
            ctx.fill();
          }
          if (hasSel) {
            ctx.globalAlpha = 1;
            for (var j = 0; j < data.length; j++) {
              var s = data[j];
              if (!selectedIds.has(keyFunc(s))) continue;
              ctx.beginPath();
              ctx.fillStyle = colorScale(s[colorColumn]);
              ctx.arc(xScale(s[xColumn]), yScale(s[yColumn]), r, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = "rgb(33, 119, 180)";
              ctx.lineWidth = 1.5;
              ctx.stroke();
            }
          }
        }

        // d3 v5 brushes have no `clear`, and each plot has a single brush, so
        // starting a new brush needs no cleanup. Record where the gesture began
        // so brushend can tell a click from a drag.
        function brushstart() {
          if (syncingBrush || !d3.event.sourceEvent) return;
          var target = d3.event.sourceEvent.target;
          press = {
            point: d3.mouse(g.node()),
            onOverlay: !!(
              target &&
              target.__data__ &&
              target.__data__.type === "overlay"
            ),
          };
          showHint(null);
        }

        function idsInRect(extent) {
          var ids = [];
          for (var i = 0; i < data.length; i++) {
            var d = data[i];
            var cx = xScale(d[xColumn]);
            var cy = yScale(d[yColumn]);
            if (
              !(
                extent[0][0] > cx ||
                cx > extent[1][0] ||
                extent[0][1] > cy ||
                cy > extent[1][1]
              )
            ) {
              ids.push(keyFunc(d));
            }
          }
          return ids;
        }

        /** Pixel brush extent -> { x: [lo, hi], y: [lo, hi] } in data units. */
        function extentToRanges(extent) {
          var xs = [extent[0][0], extent[1][0]].map(xScale.invert);
          var ys = [extent[0][1], extent[1][1]].map(yScale.invert);
          return {
            x: [Math.min(xs[0], xs[1]), Math.max(xs[0], xs[1])],
            y: [Math.min(ys[0], ys[1]), Math.max(ys[0], ys[1])],
          };
        }

        function brushend() {
          if (syncingBrush) return;
          if (useRect) showBrushLabel(null);
          var pressed = press;
          press = null;
          // d3 keeps an unmoved brush's selection (and nulls it on the overlay),
          // so a click is recognised by how little the pointer moved, on the
          // lasso as on the rectangle.
          if (onClicked && pressed && d3.event.sourceEvent) {
            var p = d3.mouse(g.node());
            var moved = Math.hypot(
              p[0] - pressed.point[0],
              p[1] - pressed.point[1]
            );
            if (
              moved < CLICK_SLOP &&
              onClicked(
                findNearest(p[0], p[1], CLICK_RADIUS),
                pressed.onOverlay
              ) !== false
            ) {
              return;
            }
          }
          let brushedIDs = [];
          // The rectangles in data units, one per brush; empty when nothing is brushed.
          let ranges = [];
          if (multiBrush && useRect) {
            reconcileBrushes(this);
            var rects = currentRects();
            var seen = new Set();
            rects.forEach((rect) => {
              idsInRect(rect).forEach((id) => {
                if (!seen.has(id)) {
                  seen.add(id);
                  brushedIDs.push(id);
                }
              });
            });
            ranges = rects.map(extentToRanges);
          } else if (rectBrush) {
            if (d3.event.selection !== null) {
              brushedIDs = idsInRect(d3.event.selection);
              ranges = [extentToRanges(d3.event.selection)];
            }
          } else if (lassoBrush) {
            var selected = lassoBrush.selectedItems();
            selected.each((d) => {
              brushedIDs.push(keyFunc(d));
            });
          }
          onBrushed(brushedIDs, ranges);
        }

        function brushmove() {
          if (syncingBrush || !useRect) return;
          showBrushLabel(d3.event.selection);
        }

        /* ---- several rectangles, after Bostock's multiple-brush pattern ---- */

        function addBrush() {
          brushes.push({ id: nextBrushId++, brush: makeRectBrush() });
        }

        function brushNodeOf(entry) {
          return brushLayer
            .selectAll("g.brush")
            .filter((d) => d === entry)
            .node();
        }

        function emptyRect(rect) {
          return rect[0][0] === rect[1][0] || rect[0][1] === rect[1][1];
        }

        /**
         * Binds the brushes to groups. A new group goes beneath the others,
         * so a drawn rectangle stays above the fresh full-plot overlay and can
         * still be dragged; only the last (empty) brush's overlay takes events,
         * so drawing starts a rectangle and never restarts an old one.
         */
        function drawBrushes() {
          var groups = brushLayer.selectAll("g.brush").data(brushes, (d) => d.id);
          groups
            .enter()
            .insert("g", ":first-child")
            .attr("class", "brush")
            .each(function(d) {
              d3.select(this).call(d.brush);
            });
          groups.exit().remove();
          var last = brushes[brushes.length - 1];
          brushLayer.selectAll("g.brush").each(function(d) {
            d3.select(this)
              .selectAll(".overlay")
              .style("pointer-events", d === last ? "all" : "none");
          });
        }

        /**
         * After a gesture on one brush: a drawn rectangle on the empty brush
         * calls for a new empty one; a rectangle dragged down to nothing (d3
         * nulls a collapsed selection) is dropped.
         */
        function reconcileBrushes(node) {
          var entry = d3.select(node).datum();
          var selection = d3.brushSelection(node);
          var live = selection && !emptyRect(selection);
          if (entry === brushes[brushes.length - 1]) {
            if (live) addBrush();
          } else if (!live) {
            brushes = brushes.filter((b) => b !== entry);
          }
          drawBrushes();
        }

        /** The drawn rectangles in pixels, oldest first. */
        function currentRects() {
          var rects = [];
          brushes.forEach((entry) => {
            var node = brushNodeOf(entry);
            var selection = node ? d3.brushSelection(node) : null;
            if (selection && !emptyRect(selection)) rects.push(selection);
          });
          return rects;
        }

        var highlight = function(selection, dimWhenEmpty) {
          selectedIds = new Set(selection.map(keyFunc));
          dimOthers = selectedIds.size > 0 || !!dimWhenEmpty;
          // An empty marking is "nothing selected", not "everything dimmed",
          // unless filters are active and simply match nothing.
          if (!dimOthers) {
            if (useCanvas) {
              drawCanvas();
            } else if (thisG) {
              thisG.classed("has-selection", false);
              thisG.selectAll("circle.point").classed("hidden", false);
            }
            return;
          }
          if (useCanvas) {
            drawCanvas();
            return;
          }
          thisG
            .classed("has-selection", true)
            .selectAll("circle.point")
            .classed("hidden", (d) => !selectedIds.has(keyFunc(d)))
            .sort((a, b) => {
              let aIn = selectedIds.has(keyFunc(a));
              let bIn = selectedIds.has(keyFunc(b));
              if (aIn == bIn) return 0;
              return aIn ? 1 : -1;
            });
        };

        var unhighlightAll = function() {
          selectedIds = new Set();
          dimOthers = false;
          if (useCanvas) {
            drawCanvas();
          } else if (thisG) {
            thisG.classed("has-selection", false);
            thisG.selectAll("circle.point").classed("hidden", false);
          }
          markCircle.attr("opacity", 0);
        };

        var cleanTooltip = () => {
          svg.selectAll(".tooltip").remove();
        };

        var createTooltip = (item) => {
          if (!item) return;

          const specs = [
            xScale(item[xColumn]),
            yScale(item[yColumn]),
            "(" + item[xColumn] + "," + item[yColumn] + ")",
          ];
          var fontSize = 14;
          var padding = 2;
          var rectHeight = fontSize + 2 * padding;
          var rectWidth = specs[2].length * 10;
          svg
            .selectAll("rect[class='tooltip']")
            .data([specs])
            .enter()
            .append("rect")
            .attr("x", function() {
              return specs[0] + specs[2].length * 5;
            })
            .attr("y", function() {
              return specs[1] - rectHeight + 2 * padding;
            })
            .attr("rx", "2")
            .attr("ry", "2")
            .attr("class", "tooltip")
            .attr("fill", "grey")
            .attr("opacity", 1)
            .attr("width", function() {
              return rectWidth;
            })
            .attr("height", rectHeight);

          svg
            .selectAll("text[class='tooltip']")
            .data([specs])
            .enter()
            .append("text")
            .attr("x", function() {
              return specs[0] + rectWidth;
            })
            .attr("y", function() {
              return specs[1];
            })
            .attr("class", "tooltip")
            .attr("fill", "white")
            .attr("text-anchor", "middle")
            .attr("font-size", fontSize)
            .text(function() {
              return specs[2];
            });
        };

        var mark = function(item) {
          if (
            item &&
            Number.isFinite(item[xColumn]) &&
            Number.isFinite(item[yColumn])
          ) {
            markCircle
              .attr("stroke", colorScale(item[colorColumn]))
              .attr("opacity", 1)
              .attr("cx", xScale(item[xColumn]))
              .attr("cy", yScale(item[yColumn]));
          } else {
            markCircle.attr("opacity", 0);
          }
        };

        /** A box `{ x: [lo, hi] | null, y: [lo, hi] | null }` in data units as a pixel rectangle. */
        function boxToRect(box) {
          var xs = box.x ? box.x.map(xScale) : [0, innerWidth];
          var ys = box.y ? box.y.map(yScale) : [0, innerHeight];
          return [
            [Math.min(xs[0], xs[1]), Math.min(ys[0], ys[1])],
            [Math.max(xs[0], xs[1]), Math.max(ys[0], ys[1])],
          ];
        }

        /**
         * Lite mode draws range filters back onto the plot, so a filter set
         * elsewhere or restored by undo is visible and draggable here. Takes
         * a list of boxes; a missing side spans that whole axis.
         */
        var showBrush = function(boxes) {
          if (!useRect) return;
          var wanted = (boxes || []).map(boxToRect);
          if (!multiBrush) {
            var rect = wanted[0] || null;
            if (sameRect(d3.brushSelection(g.node()), rect)) return;
            syncingBrush = true;
            try {
              g.call(rectBrush.move, rect);
            } finally {
              syncingBrush = false;
            }
            return;
          }
          var current = currentRects();
          if (
            current.length === wanted.length &&
            wanted.every((rect, i) => sameRect(current[i], rect))
          ) {
            return;
          }
          syncingBrush = true;
          try {
            // One brush per rectangle, plus the empty one for the next drag.
            while (brushes.length > wanted.length + 1) brushes.shift();
            while (brushes.length < wanted.length + 1) addBrush();
            drawBrushes();
            brushes.forEach((entry, i) => {
              d3.select(brushNodeOf(entry)).call(
                entry.brush.move,
                i < wanted.length ? wanted[i] : null
              );
            });
          } finally {
            syncingBrush = false;
          }
        };

        chart.highlight = highlight;
        chart.showBrush = showBrush;
        chart.unhighlightAll = unhighlightAll;
        chart.mark = mark;
        chart.createTooltip = createTooltip;
        chart.cleanTooltip = cleanTooltip;
        // The front of the plotted pair, `{ steps, points }` in data units
        // (see frontSteps): a stepped line and a ring on each option on it,
        // over the points and letting the pointer through. Null clears it.
        chart.showFront = function(front) {
          let line = g
            .selectAll("path.front-line")
            .data(front && front.steps.length > 1 ? [front.steps] : []);
          line.exit().remove();
          line
            .enter()
            .append("path")
            .attr("class", "front-line")
            .merge(line)
            .attr(
              "d",
              d3
                .line()
                .x((p) => xScale(p[0]))
                .y((p) => yScale(p[1]))
            );
          let rings = g
            .selectAll("circle.front-point")
            .data(front ? front.points : []);
          rings.exit().remove();
          rings
            .enter()
            .append("circle")
            .attr("class", "front-point")
            .attr("r", 5)
            .merge(rings)
            .attr("cx", (p) => xScale(p[0]))
            .attr("cy", (p) => yScale(p[1]));
        };

        if (multiBrush && useRect) {
          brushLayer = g.append("g").attr("class", "brushes");
          addBrush();
          drawBrushes();
        } else if (rectBrush) {
          g.call(rectBrush);
        }
        if (lassoBrush) {
          g.call(lassoBrush);
        }

        var hoverRadius = innerWidth / 10;
        var findNearest;
        if (useCanvas) {
          var tree = d3
            .quadtree()
            .x((d) => xScale(d[xColumn]))
            .y((d) => yScale(d[yColumn]))
            .addAll(data);
          findNearest = function(mx, my, radius) {
            return (
              tree.find(mx, my, radius === undefined ? hoverRadius : radius) ||
              null
            );
          };
        } else {
          var voronoiDiagram = d3
            .voronoi()
            .x((d) => xScale(d[xColumn]))
            .y((d) => yScale(d[yColumn]))
            .size([innerWidth, innerHeight])(data);
          findNearest = function(mx, my, radius) {
            var site = voronoiDiagram.find(
              mx,
              my,
              radius === undefined ? hoverRadius : radius
            );
            return site ? site.data : null;
          };
        }

        g.on("mousemove", function() {
          const [mx, my] = d3.mouse(this);
          onHovered(findNearest(mx, my));
          if (hoverHint) showHint(findNearest(mx, my, CLICK_RADIUS));
        }).on("mouseleave", function() {
          showHint(null);
        });

        if (useCanvas) drawCanvas();

        thisG = g;
      });
    }

    chart.onBrushed = function(_) {
      if (!arguments.length) return onBrushed;
      onBrushed = _;
      return chart;
    };
    chart.xDomain = function(_) {
      if (!arguments.length) return xDomain;
      xDomain = _;
      return chart;
    };
    chart.yDomain = function(_) {
      if (!arguments.length) return yDomain;
      yDomain = _;
      return chart;
    };
    chart.onHovered = function(_) {
      if (!arguments.length) return onHovered;
      onHovered = _;
      return chart;
    };
    chart.onClicked = function(_) {
      if (!arguments.length) return onClicked;
      onClicked = _;
      return chart;
    };
    chart.hoverHint = function(_) {
      if (!arguments.length) return hoverHint;
      hoverHint = _;
      return chart;
    };

    chart.keyFunc = function(_) {
      if (!arguments.length) return keyFunc;
      keyFunc = _;
      return chart;
    };
    chart.outerWidth = function(_) {
      if (!arguments.length) return outerWidth;
      outerWidth = _;
      return chart;
    };

    chart.outerHeight = function(_) {
      if (!arguments.length) return outerHeight;
      outerHeight = _;
      return chart;
    };

    chart.xColumn = function(_) {
      if (!arguments.length) return xColumn;
      xColumn = _;
      return chart;
    };

    chart.yColumn = function(_) {
      if (!arguments.length) return yColumn;
      yColumn = _;
      return chart;
    };

    chart.xScale = function(_) {
      if (!arguments.length) return xScale;
      xScale = _;
      return chart;
    };

    chart.yScale = function(_) {
      if (!arguments.length) return yScale;
      yScale = _;
      return chart;
    };

    chart.colorScale = function(_) {
      if (!arguments.length) return colorScale;
      colorScale = _;
      return chart;
    };

    chart.colorColumn = function(_) {
      if (!arguments.length) return colorColumn;
      colorColumn = _;
      return chart;
    };

    chart.xAxisLabel = function(_) {
      if (!arguments.length) return xAxisLabel;
      xAxisLabel = _;
      return chart;
    };

    chart.yAxisLabel = function(_) {
      if (!arguments.length) return yAxisLabel;
      yAxisLabel = _;
      return chart;
    };

    chart.isXAxisIncremental = function(_) {
      if (!arguments.length) return isXAxisIncremental;
      isXAxisIncremental = _;
      return chart;
    };
    chart.isYAxisIncremental = function(_) {
      if (!arguments.length) return isYAxisIncremental;
      isYAxisIncremental = _;
      return chart;
    };

    chart.xAxisLabelOffset = function(_) {
      if (!arguments.length) return xAxisLabelOffset;
      xAxisLabelOffset = _;
      return chart;
    };

    chart.yAxisLabelOffset = function(_) {
      if (!arguments.length) return yAxisLabelOffset;
      yAxisLabelOffset = _;
      return chart;
    };

    chart.xTicks = function(_) {
      if (!arguments.length) return xTicks;
      xTicks = _;
      return chart;
    };

    chart.yTicks = function(_) {
      if (!arguments.length) return yTicks;
      yTicks = _;
      return chart;
    };

    chart.margin = function(_) {
      if (!arguments.length) return margin;
      margin = _;
      return chart;
    };
    chart.useLassoBrush = function(_) {
      if (!arguments.length) return useLassoBrush;
      useLassoBrush = _;
      return chart;
    };
    chart.multiBrush = function(_) {
      if (!arguments.length) return multiBrush;
      multiBrush = !!_;
      return chart;
    };

    return chart;
  }
}

function sameRect(a, b) {
  if (!a || !b) return a === b;
  return [0, 1].every(
    (i) =>
      Math.abs(a[i][0] - b[i][0]) < 0.5 && Math.abs(a[i][1] - b[i][1]) < 0.5
  );
}
</script>
