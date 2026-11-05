<template>
  <div
    class="matrix-panel"
    :class="{ 'matrix-panel--expanded': expanded }"
    :style="{ height: `${height}px` }"
  >
    <PanelHeader
      icon="mdi-view-grid-outline"
      :title="expanded ? 'Dimension pairs' : 'Overview'"
      :compact="!expanded && width < 300"
    >
      <!-- A pulldown like the scatterplot's axes, so the choice takes one line. -->
      <DimensionPicker
        :value="shownDims"
        :items="dimensionChoices"
        multiple
        count-label="dimensions"
        dense
        outlined
        hide-details
        placeholder="Dimensions"
        aria-label="Dimensions to compare"
        class="ph-select matrix-dims-select"
        @change="onDimsChange"
      />
      <span v-if="expanded" class="ph-meta">{{ expandedHint }}</span>
      <template v-slot:actions>
        <v-tooltip key="matrix-info" bottom max-width="300">
          <template v-slot:activator="{ on }">
            <v-icon v-on="on" small class="matrix-info"
              >mdi-information-outline</v-icon
            >
          </template>
          <span>{{ infoText }}</span>
        </v-tooltip>
        <v-tooltip v-if="!expanded" key="matrix-expand" bottom max-width="280">
          <template v-slot:activator="{ on }">
            <v-btn
              v-on="on"
              icon
              small
              class="ph-btn"
              aria-label="Expand the overview"
              @click="expand"
            >
              <v-icon small>mdi-arrow-expand</v-icon>
            </v-btn>
          </template>
          <span
            >Show the pairs large, with axes, to brush on them and to choose
            and order up to {{ maxExpanded }} dimensions</span
          >
        </v-tooltip>
        <v-btn
          v-else
          key="matrix-close"
          icon
          small
          class="ph-btn"
          aria-label="Close"
          @click="$emit('close')"
        >
          <v-icon small>mdi-close</v-icon>
        </v-btn>
      </template>
    </PanelHeader>

    <p v-if="dims.length < 2" class="matrix-hint">
      Choose at least two dimensions.
    </p>

    <div ref="area" class="matrix-area">
      <div v-show="dims.length >= 2" class="matrix-grid" :style="gridStyle">
        <canvas ref="canvas" class="matrix-canvas" />
        <!-- Expanded: each column's values along the bottom, each row's up
             the left, as the plots in them are drawn. -->
        <svg
          v-if="axes"
          class="matrix-axes"
          :width="geom.size + axisLeft"
          :height="geom.size + axisBottom"
          :style="{ left: -axisLeft + 'px' }"
          aria-hidden="true"
        >
          <g
            v-for="axis in axes.columns"
            :key="'ax' + axis.dim"
            :transform="`translate(${axisLeft + axis.at},${geom.size})`"
          >
            <line class="matrix-axis-line" x1="0" :x2="geom.cell" y1="0.5" y2="0.5" />
            <g
              v-for="tick in axis.ticks"
              :key="tick.at"
              :transform="`translate(${tick.at},0)`"
            >
              <line class="matrix-axis-line" y1="0" y2="4" />
              <text class="matrix-axis-text" y="15" text-anchor="middle">{{
                tick.label
              }}</text>
            </g>
          </g>
          <g
            v-for="axis in axes.rows"
            :key="'ay' + axis.dim"
            :transform="`translate(${axisLeft},${axis.at})`"
          >
            <line class="matrix-axis-line" x1="-0.5" x2="-0.5" y1="0" :y2="geom.cell" />
            <g
              v-for="tick in axis.ticks"
              :key="tick.at"
              :transform="`translate(0,${tick.at})`"
            >
              <line class="matrix-axis-line" x1="-4" x2="0" />
              <text class="matrix-axis-text" x="-6" dy="0.32em" text-anchor="end">{{
                tick.label
              }}</text>
            </g>
          </g>
        </svg>
        <div
          v-for="cell in cells"
          :key="cell.key"
          class="matrix-cell"
          :class="{
            'matrix-cell--diag': cell.diagonal,
            'matrix-cell--current': cell.current,
            'matrix-cell--drop': cell.diagonal && dropDim === cell.dim,
          }"
          :style="cell.style"
          :title="expanded ? null : cell.title"
          @click="onCellClick(cell)"
          @dragover="onDimDragOver(cell, $event)"
          @dragleave="onDimDragLeave(cell)"
          @drop="onDimDrop(cell, $event)"
        >
          <template v-if="cell.diagonal">
            <svg
              class="matrix-dist"
              :width="geom.cell"
              :height="geom.cell"
              aria-hidden="true"
            >
              <rect
                v-for="(bar, i) in cell.bars"
                :key="'b' + i"
                class="matrix-bar"
                :x="bar.x"
                :y="bar.y"
                :width="bar.w"
                :height="bar.h"
              />
              <rect
                v-for="(bar, i) in cell.selBars"
                :key="'sb' + i"
                class="matrix-bar matrix-bar--selected"
                :x="bar.x"
                :y="bar.y"
                :width="bar.w"
                :height="bar.h"
              />
              <template v-for="(stem, i) in cell.stems">
                <line
                  :key="'s' + i"
                  class="matrix-stem"
                  :x1="stem.x"
                  :x2="stem.x"
                  :y1="geom.cell - 2"
                  :y2="stem.y"
                />
                <circle
                  :key="'d' + i"
                  class="matrix-stem-dot"
                  :cx="stem.x"
                  :cy="stem.y"
                  r="2"
                />
              </template>
              <circle
                v-for="(stem, i) in cell.selStems"
                :key="'ss' + i"
                class="matrix-stem-dot matrix-stem-dot--selected"
                :cx="stem.x"
                :cy="stem.y"
                r="2.5"
              />
            </svg>
          </template>
          <div
            v-for="(box, i) in cell.boxes"
            :key="'box' + i"
            class="matrix-box"
            :style="box"
          />
          <div v-if="cell.hover" class="matrix-hover" :style="cell.hover" />
          <!-- Expanded: a brush over every plot and every distribution. -->
          <svg
            v-if="expanded"
            class="matrix-brush"
            :data-key="cell.key"
            :width="geom.cell"
            :height="geom.cell"
            @mousemove="onBrushMove(cell, $event)"
            @mouseleave="binReadout = null"
          />
          <!-- Expanded, Lite: one click to clear what a cell holds, beside
               the click on a range that removes just that one. -->
          <button
            v-if="expanded && isLite && cell.boxes && cell.boxes.length > 0"
            type="button"
            class="matrix-clear"
            :title="clearLabel(cell)"
            :aria-label="clearLabel(cell)"
            @mousedown.stop
            @click.stop="clearCell(cell)"
          >
            <v-icon x-small>mdi-close</v-icon>
          </button>
          <template v-if="cell.diagonal">
            <span
              class="matrix-name"
              :class="{ 'matrix-name--draggable': expanded }"
              :draggable="expanded ? 'true' : null"
              :title="expanded ? 'Drag onto another name to move it there' : null"
              @dragstart="onDimDragStart(cell, $event)"
              @dragend="onDimDragEnd"
              >{{ label(cell.dim) }}</span
            >
            <span
              v-if="expanded && binReadout && binReadout.dim === cell.dim"
              class="matrix-readout"
              >{{ binReadout.text }}</span
            >
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import * as d3 from "d3";
import { mapGetters, mapState } from "vuex";
import TemplateView from "@/components/TemplateView.vue";
import PanelHeader from "@/components/PanelHeader.vue";
import DimensionPicker from "@/components/DimensionPicker.vue";
import { columnKind, dimensionItems, displayName, INPUT, OUTPUT } from "@/columns.js";
import { summarize } from "@/analysis/summary.js";
import { isMissingFor } from "@/store/dimensions.js";
import { SELECTED } from "@/stateColors.js";
import { operations } from "@/components/operations.js";

// Past this many dimensions the cells get too small to read in a side column.
export const MAX_MATRIX_DIMS = 6;
// Expanded over most of the window, the cells stay readable up to this many.
// The overview shows the first MAX_MATRIX_DIMS of the same list.
export const MAX_EXPANDED_DIMS = 10;
// Expanded: room for the values along the bottom and up the left.
const AXIS_LEFT = 44;
const AXIS_BOTTOM = 22;
// A drag shorter than this either way is a click, not a brush.
const CLICK_SLOP = 3;
const DEFAULT_MATRIX_DIMS = 4;
// Space between cells, and between a cell's edge and its outermost points.
const GAP = 3;
const INSET = 4;

/**
 * A scatterplot matrix of a few chosen dimensions, for picking the pair the
 * scatterplot shows. In the scatterplot's side column it only reads the
 * selection and the filters.
 *
 * Expanded (MatrixDialog), the same matrix is large: axes on every row and
 * column, more dimensions, names that drag to reorder them, and a brush on
 * every plot and every distribution. A brush filters in Lite, as the
 * scatterplot's does, and selects in Expert under the current operation;
 * a click still picks the pair for the scatterplot. Both share the stored
 * choice of dimensions and their order, so either shows what the other set.
 *
 * Only the half below the diagonal is drawn. The half above holds the same
 * pairs with the axes swapped, which is the same cloud reflected: twice the
 * plots to read, each of them half the size, for nothing. The scatterplot's
 * own swap button is where a pair gets turned round.
 *
 * Points go on one canvas for the whole grid: k² cells of every option is
 * too many DOM nodes for SVG. What sits on top -- names, distributions, the
 * outline of the plot on show, filter boxes, the hovered option -- is plain
 * DOM driven by the store, so it follows changes without a redraw.
 */
/** Tick labels that read as the values do: 2010 as 2010, 40000 as 40k past five digits. */
function tickFormat(domain) {
  let big = domain && Math.max(Math.abs(domain[0]), Math.abs(domain[1])) >= 1e5;
  return d3.format(big ? "~s" : "~g");
}

export default {
  mixins: [TemplateView],
  name: "ScatterMatrix",
  components: { PanelHeader, DimensionPicker },
  props: {
    // The pair the scatterplot shows, outlined here.
    xColumn: { type: String, default: null },
    yColumn: { type: String, default: null },
    // Large, in its dialog, with axes and brushes (see above).
    expanded: { type: Boolean, default: false },
  },
  data() {
    return {
      // Set by each rebuild: the grid's size, and each dimension's domain.
      geom: { k: 0, cell: 0, size: 0, dims: [] },
      domains: {},
      // Expanded: the selected options, drawn over each distribution.
      selectedRows: [],
      // Expanded: the bin under the pointer, read out in its cell.
      binReadout: null,
      // Expanded: the name being dragged to a new place, and where it would go.
      dragDim: null,
      dropDim: null,
      maxExpanded: MAX_EXPANDED_DIMS,
    };
  },
  computed: {
    ...mapState({
      storedDims: (state) => state.viewSettings.matrixDims,
      dimensionValuesVersion: (state) => state.dimensionValuesVersion,
    }),
    ...mapGetters(["dimensionStructure", "fixedBoundsOf", "boxesFor"]),
    /** The stored choice, less any dimension the data no longer has. */
    dims() {
      let numeric = this.numericDimensions;
      return (this.storedDims || []).filter((dim) => numeric.includes(dim));
    },
    maxDims() {
      return this.expanded ? MAX_EXPANDED_DIMS : MAX_MATRIX_DIMS;
    },
    /** As many of the stored dimensions as fit here, in their order. */
    shownDims() {
      return this.dims.slice(0, this.maxDims);
    },
    dimensionChoices() {
      let shown = this.shownDims;
      let full = shown.length >= this.maxDims;
      return dimensionItems(this.numericDimensions).map((item) =>
        Object.assign(item, {
          disabled: full && !shown.includes(item.value),
        })
      );
    },
    axisLeft() {
      return this.expanded ? AXIS_LEFT : 0;
    },
    axisBottom() {
      return this.expanded ? AXIS_BOTTOM : 0;
    },
    gridStyle() {
      let style = {
        width: `${this.geom.size}px`,
        height: `${this.geom.size}px`,
      };
      if (this.expanded) {
        style.marginLeft = `${AXIS_LEFT}px`;
        style.marginBottom = `${AXIS_BOTTOM}px`;
      }
      return style;
    },
    infoText() {
      if (!this.expanded) {
        return "Every pair of the chosen dimensions, once: a plot above the diagonal would be the one below it with the axes swapped. Click a plot to show it large; the one on show is outlined, whichever way round it is drawn there. The diagonal shows how each dimension's values are spread. Expand it to brush on it.";
      }
      return (
        "Every pair of the chosen dimensions, once, with how each one's values are spread on the diagonal. " +
        (this.isLite
          ? "Drag over a plot or a distribution to filter, and again for another range (OR); click inside a range to remove it, or the × in a corner to clear them all. "
          : "Drag over a plot or a distribution to select, combined with the current selection by the chosen operation. ") +
        "Click a plot to show it in the scatterplot. Drag a name on the diagonal onto another to reorder the dimensions; the overview keeps the first " +
        MAX_MATRIX_DIMS +
        "."
      );
    },
    expandedHint() {
      return this.isLite
        ? "Drag to filter · × clears a plot · click a plot to show it in the scatterplot · drag a name to reorder"
        : "Drag to select · click a plot to show it in the scatterplot · drag a name to reorder";
    },
    /** Expanded: the ticks along each column's foot and up each row's side. */
    axes() {
      if (!this.expanded) return null;
      let { k, cell, dims } = this.geom;
      if (k < 2 || cell <= 0) return null;
      let count = Math.max(2, Math.floor(cell / 55));
      let ticksFor = (dim, flip) => {
        let domain = this.domains[dim];
        if (!domain) return [];
        let scale = d3
          .scaleLinear()
          .domain(domain)
          .range([INSET, cell - INSET]);
        let format = tickFormat(domain);
        return scale.ticks(count).map((value) => ({
          at: flip ? cell - scale(value) : scale(value),
          label: format(value),
        }));
      };
      return {
        columns: dims.map((dim, col) => ({
          dim: dim,
          at: col * (cell + GAP),
          ticks: ticksFor(dim, false),
        })),
        // The first row holds only a distribution, whose height is a count.
        rows: dims.slice(1).map((dim, i) => ({
          dim: dim,
          at: (i + 1) * (cell + GAP),
          ticks: ticksFor(dim, true),
        })),
      };
    },
    summaries() {
      void this.dimensionValuesVersion;
      let rows = this.chartData || [];
      let map = {};
      summarize(rows, this.dims, { isMissing: isMissingFor }).forEach(
        (summary) => (map[summary.dim] = summary)
      );
      return map;
    },
    /** One entry per cell, row by row: what the overlay draws in it. */
    cells() {
      // The dimensions of the last rebuild, which the domains are for; a new
      // choice shows once the canvas is redrawn for it.
      let { k, cell, dims } = this.geom;
      if (k < 2 || cell <= 0) return [];
      let hovered = this.hovered;
      let result = [];
      dims.forEach((yDim, row) => {
        dims.forEach((xDim, col) => {
          // The upper half is the lower half reflected; see above.
          if (row < col) return;
          let style = {
            left: `${col * (cell + GAP)}px`,
            top: `${row * (cell + GAP)}px`,
            width: `${cell}px`,
            height: `${cell}px`,
          };
          if (row === col) {
            result.push(
              Object.assign(
                {
                  key: "d:" + xDim,
                  diagonal: true,
                  dim: xDim,
                  style: style,
                  title: displayName(xDim),
                  // Expanded, a dimension's own ranges show on its distribution.
                  boxes: this.expanded ? this.rangesOn(xDim) : [],
                },
                this.distribution(xDim)
              )
            );
            return;
          }
          result.push({
            key: xDim + "|" + yDim,
            diagonal: false,
            x: xDim,
            y: yDim,
            style: style,
            // The pair is the pair whichever axis each dimension is on,
            // and only one of the two cells for it is drawn.
            current:
              (xDim === this.xColumn && yDim === this.yColumn) ||
              (xDim === this.yColumn && yDim === this.xColumn),
            title: `${displayName(xDim)} (across) vs ${displayName(yDim)} (up)`,
            boxes: this.boxesIn(xDim, yDim),
            hover: this.hoverMark(hovered, xDim, yDim),
          });
        });
      });
      return result;
    },
  },
  watch: {
    // A rebuild reads the dimensions and the area, not the store directly.
    dims: function(newValue, oldValue) {
      if (String(newValue) === String(oldValue)) return;
      this.scheduleRefresh();
    },
    dimensionStructure: function() {
      this.scheduleRefresh();
    },
    dimensionValuesVersion: function() {
      this.scheduleRefresh();
    },
    numericDimensions: function() {
      this.ensureDims();
    },
    // Expanded: the brushes follow the cells they sit in.
    cells: function(newValue, oldValue) {
      if (!this.expanded) return;
      let keys = (list) => list.map((cell) => cell.key).join(",");
      if (keys(newValue) !== keys(oldValue)) this.setupBrushes();
    },
  },
  created() {
    this.ensureDims();
  },
  mounted() {
    // The first build shows no selection; the mixin only applies it on refresh.
    this.markingChangeHandler(false);
    // The area is what is left of the panel below its header and hint;
    // measuring it beats working it out.
    if (typeof ResizeObserver !== "undefined") {
      this.areaObserver = new ResizeObserver(() => this.scheduleRefresh());
      this.areaObserver.observe(this.$refs.area);
    }
  },
  beforeDestroy() {
    if (this.areaObserver) this.areaObserver.disconnect();
  },
  methods: {
    label: displayName,
    /**
     * The first time, or once too few of the stored dimensions are left,
     * store a default: the plotted pair, then outputs, then inputs. Stored
     * rather than derived, so that clicking a plot doesn't reorder the grid.
     */
    ensureDims() {
      if (this.storedDims && this.dims.length >= 2) return;
      let numeric = this.numericDimensions;
      let rows = this.chartData || [];
      let varies = (dim) => {
        let first;
        for (let i = 0; i < rows.length; i++) {
          let value = rows[i][dim];
          if (!Number.isFinite(value)) continue;
          if (first === undefined) first = value;
          else if (value !== first) return true;
        }
        return false;
      };
      let picked = [];
      let add = (dim) => {
        if (picked.length >= DEFAULT_MATRIX_DIMS) return;
        if (!dim || picked.includes(dim) || !numeric.includes(dim)) return;
        if (varies(dim)) picked.push(dim);
      };
      add(this.xColumn);
      add(this.yColumn);
      numeric.filter((dim) => columnKind(dim) === OUTPUT).forEach(add);
      numeric.filter((dim) => columnKind(dim) === INPUT).forEach(add);
      numeric.forEach(add);
      this.$store.commit("setViewSetting", { key: "matrixDims", value: picked });
    },
    onDimsChange(value) {
      let next = value.slice(0, this.maxDims);
      // The overview shows only the first few; those it doesn't show stay
      // chosen, after the ones it does.
      if (!this.expanded) {
        let rest = this.dims
          .slice(MAX_MATRIX_DIMS)
          .filter((dim) => !next.includes(dim));
        next = next.concat(rest);
      }
      this.$store.commit("setViewSetting", {
        key: "matrixDims",
        value: next.slice(0, MAX_EXPANDED_DIMS),
      });
    },
    expand() {
      this.$store.commit("setMatrixDialog", { open: true });
    },
    onCellClick(cell) {
      // Expanded, a click is the brush's to read: it may be on a range.
      if (!this.expanded) this.pick(cell);
    },
    pick(cell) {
      if (cell.diagonal) return;
      this.$store.commit("setViewSetting", { key: "scatterX", value: cell.x });
      this.$store.commit("setViewSetting", { key: "scatterY", value: cell.y });
    },
    markingChangeHandler(reset) {
      if (!this.chart) return;
      if (reset) {
        this.chart.unhighlightAll();
        this.selectedRows = [];
      } else {
        let selection = this.$store.getters.selectedDataInView(this.viewID);
        this.chart.highlight(selection, this.isFilterActive);
        if (this.expanded) this.selectedRows = selection || [];
      }
    },
    afterChartRebuilt() {
      this.setupBrushes();
    },

    // Pixel positions within a cell, from the domains of the last rebuild.
    px(dim, value) {
      let domain = this.domains[dim];
      let cell = this.geom.cell;
      if (!domain) return null;
      return INSET + ((value - domain[0]) / (domain[1] - domain[0])) * (cell - 2 * INSET);
    },
    py(dim, value) {
      let x = this.px(dim, value);
      return x === null ? null : this.geom.cell - x;
    },
    /** A dimension's spread for its diagonal cell, lined up with its column. */
    distribution(dim) {
      let summary = this.summaries[dim];
      let cell = this.geom.cell;
      // Leave room at the top for the name.
      let top = Math.min(18, cell * 0.3);
      let usable = cell - top - 2;
      let result = { bars: [], stems: [], selBars: [], selStems: [] };
      if (!summary || !summary.n || !summary.peak) return result;
      // Expanded: the selected options' share of each bin, over the whole.
      let selected = this.selectedCounts(dim, summary);
      let clampX = (x) => Math.max(0, Math.min(cell, x));
      if (summary.levels) {
        result.stems = summary.levels.map((level) => ({
          x: clampX(this.px(dim, level.value)),
          y: cell - 2 - (level.count / summary.peak) * usable,
        }));
        if (selected) {
          summary.levels.forEach((level) => {
            let count = selected.get(level.value) || 0;
            if (!count) return;
            result.selStems.push({
              x: clampX(this.px(dim, level.value)),
              y: cell - 2 - (count / summary.peak) * usable,
            });
          });
        }
      } else if (summary.bins) {
        let width = (summary.hi - summary.lo) / summary.bins.length;
        summary.bins.forEach((count, i) => {
          if (!count) return;
          let x0 = clampX(this.px(dim, summary.lo + i * width));
          let x1 = clampX(this.px(dim, summary.lo + (i + 1) * width));
          let h = (count / summary.peak) * usable;
          result.bars.push({
            x: x0 + 0.5,
            y: cell - 2 - h,
            w: Math.max(0.5, x1 - x0 - 1),
            h: h,
          });
          let mine = selected ? selected[i] : 0;
          if (mine) {
            let hs = (mine / summary.peak) * usable;
            result.selBars.push({
              x: x0 + 0.5,
              y: cell - 2 - hs,
              w: Math.max(0.5, x1 - x0 - 1),
              h: hs,
            });
          }
        });
      }
      return result;
    },
    /**
     * The filter boxes over this pair, as the scatterplot draws them: its own
     * boxes, or else each brush on x crossed with each brush on y.
     */
    boxesIn(xDim, yDim) {
      let boxes = this.boxesFor([xDim, yDim]);
      if (boxes.length === 0) {
        let xs = this.boxesFor([xDim]);
        let ys = this.boxesFor([yDim]);
        if (xs.length + ys.length === 0) return [];
        boxes = [];
        (xs.length ? xs : [{}]).forEach((bx) => {
          (ys.length ? ys : [{}]).forEach((by) => {
            boxes.push(Object.assign({}, bx, by));
          });
        });
      }
      let cell = this.geom.cell;
      let clamp = (v) => Math.max(0, Math.min(cell, v));
      return boxes.map((box) => {
        let x0 = box[xDim] ? clamp(this.px(xDim, box[xDim][0])) : 0;
        let x1 = box[xDim] ? clamp(this.px(xDim, box[xDim][1])) : cell;
        let y0 = box[yDim] ? clamp(this.py(yDim, box[yDim][1])) : 0;
        let y1 = box[yDim] ? clamp(this.py(yDim, box[yDim][0])) : cell;
        return {
          left: `${Math.min(x0, x1)}px`,
          top: `${Math.min(y0, y1)}px`,
          width: `${Math.abs(x1 - x0)}px`,
          height: `${Math.abs(y1 - y0)}px`,
        };
      });
    },
    /**
     * Expanded: how many selected options fall in each of the summary's bins
     * (or at each of its levels), or null when a selection would add nothing:
     * none, or all of them.
     */
    selectedCounts(dim, summary) {
      if (!this.expanded) return null;
      let rows = this.selectedRows;
      let total = (this.chartData || []).length;
      if (!rows || rows.length === 0 || rows.length >= total) return null;
      if (summary.levels) {
        let counts = new Map();
        rows.forEach((row) => {
          let value = row[dim];
          if (Number.isFinite(value)) counts.set(value, (counts.get(value) || 0) + 1);
        });
        return counts;
      }
      if (!summary.bins) return null;
      let bins = summary.bins.length;
      let width = (summary.hi - summary.lo) / bins;
      let counts = new Array(bins).fill(0);
      rows.forEach((row) => {
        let value = row[dim];
        if (!Number.isFinite(value) || !(width > 0)) return;
        let i = Math.floor((value - summary.lo) / width);
        counts[Math.max(0, Math.min(bins - 1, i))]++;
      });
      return counts;
    },
    /** Expanded: a dimension's own ranges, across its distribution. */
    rangesOn(dim) {
      let cell = this.geom.cell;
      let clamp = (v) => Math.max(0, Math.min(cell, v));
      return this.boxesFor([dim]).map((box) => {
        let x0 = clamp(this.px(dim, box[dim][0]));
        let x1 = clamp(this.px(dim, box[dim][1]));
        return {
          left: `${Math.min(x0, x1)}px`,
          top: "0px",
          width: `${Math.abs(x1 - x0)}px`,
          height: `${cell}px`,
        };
      });
    },
    // Values back from pixel positions within a cell (see px and py).
    valueAt(dim, x) {
      let domain = this.domains[dim];
      let span = this.geom.cell - 2 * INSET;
      return domain[0] + ((x - INSET) / span) * (domain[1] - domain[0]);
    },
    valueAtY(dim, y) {
      return this.valueAt(dim, this.geom.cell - y);
    },
    /**
     * Expanded: a d3 brush on every cell, bound again whenever the cells are
     * laid out again. The brush only draws the gesture; once let go it is
     * cleared, and what the gesture did -- a filter's ranges, a selection --
     * is what stays drawn.
     */
    setupBrushes() {
      if (!this.expanded) return;
      this.$nextTick(() => {
        let cell = this.geom.cell;
        if (!cell || !this.$el) return;
        let byKey = {};
        this.cells.forEach((c) => (byKey[c.key] = c));
        let vm = this;
        this.$el.querySelectorAll(".matrix-brush").forEach((node) => {
          let target = byKey[node.getAttribute("data-key")];
          if (!target) return;
          let brush = target.diagonal
            ? d3.brushX().extent([
                [0, 0],
                [cell, cell],
              ])
            : d3.brush().extent([
                [0, 0],
                [cell, cell],
              ]);
          brush
            .on("start", function() {
              if (!d3.event.sourceEvent) return;
              vm.brushStart = d3.mouse(this);
            })
            .on("end", function() {
              if (!d3.event.sourceEvent) return;
              let selection = d3.event.selection;
              if (selection) d3.select(this).call(brush.move, null);
              vm.onBrushEnd(target, selection);
            });
          d3.select(node).call(brush);
        });
      });
    },
    onBrushEnd(cell, selection) {
      let start = this.brushStart;
      this.brushStart = null;
      let small = (a, b) => Math.abs(b - a) < CLICK_SLOP;
      let isClick =
        !selection ||
        (cell.diagonal
          ? small(selection[0], selection[1])
          : small(selection[0][0], selection[1][0]) &&
            small(selection[0][1], selection[1][1]));
      if (isClick) {
        if (start) this.onBrushClick(cell, start);
        return;
      }
      if (cell.diagonal) {
        let dim = cell.dim;
        let range = [this.valueAt(dim, selection[0]), this.valueAt(dim, selection[1])];
        this.applyBrush(cell, [dim], { [dim]: range.sort((a, b) => a - b) });
        return;
      }
      let [[x0, y0], [x1, y1]] = selection;
      this.applyBrush(cell, [cell.x, cell.y], {
        [cell.x]: [this.valueAt(cell.x, x0), this.valueAt(cell.x, x1)],
        [cell.y]: [this.valueAtY(cell.y, y1), this.valueAtY(cell.y, y0)],
      });
    },
    /**
     * The ranges a cell shows in Lite, in data units, and whether they are
     * its own filter or the crossing of each dimension's own brushes (see
     * boxesIn): only its own can be added to or removed one by one here.
     */
    rangesIn(cell) {
      if (cell.diagonal) return { boxes: this.boxesFor([cell.dim]), own: true };
      let x = cell.x;
      let y = cell.y;
      let own = this.boxesFor([x, y]);
      if (own.length > 0) return { boxes: own, own: true };
      let xs = this.boxesFor([x]);
      let ys = this.boxesFor([y]);
      if (xs.length + ys.length === 0) return { boxes: [], own: true };
      let boxes = [];
      (xs.length ? xs : [{ [x]: this.domains[x] }]).forEach((bx) => {
        (ys.length ? ys : [{ [y]: this.domains[y] }]).forEach((by) => {
          boxes.push(Object.assign({}, bx, by));
        });
      });
      return { boxes: boxes, own: false };
    },
    /**
     * A finished drag. Lite adds the range to what the cell already holds
     * (OR), as brushing again does in the scatterplot; a cell showing each
     * dimension's own brushes crossed takes them over as its own. Expert
     * selects what is inside, under the current operation.
     */
    applyBrush(cell, dims, box) {
      if (this.isLite) {
        let held = this.rangesIn(cell);
        this.$store.dispatch("setBoxFilter", {
          dims: dims,
          boxes: held.boxes.concat([box]),
          replace: held.own ? [] : dims,
        });
        return;
      }
      let ids = (this.chartData || [])
        .filter((row) =>
          dims.every((dim) => {
            let value = row[dim];
            return Number.isFinite(value) && value >= box[dim][0] && value <= box[dim][1];
          })
        )
        .map((row) => row._id);
      let operation = this.currentSelectionOperation;
      // As in the scatterplot: an empty brush clears only under Replace.
      if (ids.length === 0 && operation !== operations.REPLACE) return;
      this.$store.dispatch("update", {
        view: this.viewID,
        selection: ids,
        operation: operation,
        step: { kind: "region", boxes: [box] },
      });
    },
    /**
     * A click: in Lite, inside one of the ranges the cell shows, removes it
     * (one crossed from axis brushes too: the rest become the plot's own);
     * anywhere else on a plot, shows that pair in the scatterplot.
     */
    onBrushClick(cell, point) {
      if (this.isLite) {
        let held = this.rangesIn(cell);
        if (held.boxes.length > 0) {
          let dims = cell.diagonal ? [cell.dim] : [cell.x, cell.y];
          let at = cell.diagonal
            ? { [cell.dim]: this.valueAt(cell.dim, point[0]) }
            : {
                [cell.x]: this.valueAt(cell.x, point[0]),
                [cell.y]: this.valueAtY(cell.y, point[1]),
              };
          let inside = (box) =>
            dims.every((dim) => {
              let range = box[dim];
              return !range || (at[dim] >= range[0] && at[dim] <= range[1]);
            });
          let index = held.boxes.findIndex(inside);
          if (index >= 0) {
            this.$store.dispatch("setBoxFilter", {
              dims: dims,
              boxes: held.boxes.filter((box, i) => i !== index),
              replace: held.own ? [] : dims,
            });
            return;
          }
        }
      }
      if (!cell.diagonal) this.pick(cell);
    },
    /**
     * Every range a cell shows, gone: a plot's own filter and the axis
     * brushes it shows crossed, or a distribution's ranges.
     */
    clearCell(cell) {
      let dims = cell.diagonal ? [cell.dim] : [cell.x, cell.y];
      this.$store.dispatch("setBoxFilter", { dims: dims, boxes: [], replace: dims });
    },
    clearLabel(cell) {
      return cell.diagonal
        ? "Clear the ranges on " + displayName(cell.dim)
        : "Clear this plot's ranges";
    },
    /** Expanded: over a distribution, the bin under the pointer read out. */
    onBrushMove(cell, event) {
      if (!cell.diagonal) return;
      let summary = this.summaries[cell.dim];
      if (!summary || !summary.n) {
        this.binReadout = null;
        return;
      }
      let rect = event.currentTarget.getBoundingClientRect();
      let value = this.valueAt(cell.dim, event.clientX - rect.left);
      let format = tickFormat(this.domains[cell.dim]);
      let selected = this.selectedCounts(cell.dim, summary);
      let text = null;
      if (summary.levels) {
        let nearest = null;
        summary.levels.forEach((level) => {
          if (nearest === null || Math.abs(level.value - value) < Math.abs(nearest.value - value)) {
            nearest = level;
          }
        });
        if (nearest) {
          text = format(nearest.value) + ": " + nearest.count;
          if (selected) text += " (" + (selected.get(nearest.value) || 0) + " selected)";
        }
      } else if (summary.bins) {
        let bins = summary.bins.length;
        let width = (summary.hi - summary.lo) / bins;
        let i = Math.max(0, Math.min(bins - 1, Math.floor((value - summary.lo) / width)));
        let lo = summary.lo + i * width;
        text = format(lo) + "\u2013" + format(lo + width) + ": " + summary.bins[i];
        if (selected) text += " (" + selected[i] + " selected)";
      }
      this.binReadout = text ? { dim: cell.dim, text: text } : null;
    },
    // Reordering, expanded: a name on the diagonal dragged onto another.
    onDimDragStart(cell, event) {
      if (!this.expanded) return;
      this.dragDim = cell.dim;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", cell.dim);
    },
    onDimDragOver(cell, event) {
      if (!this.dragDim || !cell.diagonal || cell.dim === this.dragDim) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      this.dropDim = cell.dim;
    },
    onDimDragLeave(cell) {
      if (this.dropDim === cell.dim) this.dropDim = null;
    },
    onDimDrop(cell, event) {
      if (!this.dragDim || !cell.diagonal) return;
      event.preventDefault();
      let next = this.dims.filter((dim) => dim !== this.dragDim);
      next.splice(next.indexOf(cell.dim) + (this.dims.indexOf(this.dragDim) < this.dims.indexOf(cell.dim) ? 1 : 0), 0, this.dragDim);
      this.onDimDragEnd();
      this.$store.commit("setViewSetting", { key: "matrixDims", value: next });
    },
    onDimDragEnd() {
      this.dragDim = null;
      this.dropDim = null;
    },
    hoverMark(item, xDim, yDim) {
      if (!item) return null;
      let x = item[xDim];
      let y = item[yDim];
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      return {
        left: `${this.px(xDim, x)}px`,
        top: `${this.py(yDim, y)}px`,
      };
    },

    Chart() {
      let area = this.$refs.area;
      let canvas = this.$refs.canvas;
      let dims = this.shownDims;
      let k = dims.length;
      let side = area
        ? Math.min(area.clientWidth - this.axisLeft, area.clientHeight - this.axisBottom)
        : 0;
      let cell = k > 0 ? Math.floor((side - GAP * (k - 1)) / k) : 0;
      if (k < 2 || cell < 12 || !canvas) {
        this.geom = { k: 0, cell: 0, size: 0, dims: [] };
        return { highlight() {}, unhighlightAll() {}, mark() {} };
      }
      let size = cell * k + GAP * (k - 1);
      let data = this.chartData || [];
      let n = data.length;

      // Domains as the scatterplot has them: a custom dimension's fixed
      // range, otherwise the data's extent.
      let domains = {};
      dims.forEach((dim) => {
        let fixed = this.fixedBoundsOf(dim);
        let lo = Infinity;
        let hi = -Infinity;
        if (fixed) {
          lo = fixed[0];
          hi = fixed[1];
        } else {
          for (let i = 0; i < n; i++) {
            let v = data[i][dim];
            if (!Number.isFinite(v)) continue;
            if (v < lo) lo = v;
            if (v > hi) hi = v;
          }
        }
        if (!(hi > lo)) {
          lo = Number.isFinite(lo) ? lo - 0.5 : 0;
          hi = lo + 1;
        }
        domains[dim] = [lo, hi];
      });
      this.domains = domains;
      this.geom = { k: k, cell: cell, size: size, dims: dims };

      // Each dimension's position within a cell, worked out once per point.
      let span = cell - 2 * INSET;
      let positions = dims.map((dim) => {
        let [lo, hi] = domains[dim];
        let out = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          let v = data[i][dim];
          out[i] = Number.isFinite(v) ? INSET + ((v - lo) / (hi - lo)) * span : NaN;
        }
        return out;
      });
      let colorColumn = this.colorColumn;
      let colors = data.map((d) => this.colorScale(d[colorColumn]));

      let ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(size * ratio);
      canvas.height = Math.round(size * ratio);
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      let ctx = canvas.getContext("2d");
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

      let dot = Math.max(1.5, Math.min(3, cell / 50));
      let half = dot / 2;
      let selected = new Uint8Array(n);
      let dimOthers = false;

      function drawCell(row, col) {
        let ox = col * (cell + GAP);
        let oy = row * (cell + GAP);
        let xs = positions[col];
        let ys = positions[row];
        ctx.fillStyle = "#fafbfc";
        ctx.fillRect(ox, oy, cell, cell);
        let pass = (wantSelected, alpha) => {
          ctx.globalAlpha = alpha;
          let fill = null;
          for (let i = 0; i < n; i++) {
            if (dimOthers && !!selected[i] !== wantSelected) continue;
            let x = xs[i];
            let y = ys[i];
            if (x !== x || y !== y) continue;
            if (colors[i] !== fill) {
              fill = colors[i];
              ctx.fillStyle = fill;
            }
            ctx.fillRect(ox + x - half, oy + cell - y - half, dot, dot);
          }
        };
        if (dimOthers) {
          pass(false, 0.25);
          // Selected points on top, with the scatterplot's blue edge.
          ctx.globalAlpha = 1;
          ctx.strokeStyle = SELECTED;
          ctx.lineWidth = 1;
          for (let i = 0; i < n; i++) {
            if (!selected[i]) continue;
            let x = xs[i];
            let y = ys[i];
            if (x !== x || y !== y) continue;
            ctx.strokeRect(ox + x - half - 0.5, oy + cell - y - half - 0.5, dot + 1, dot + 1);
          }
          pass(true, 1);
        } else {
          pass(false, 0.7);
        }
        ctx.globalAlpha = 1;
      }

      function draw() {
        ctx.clearRect(0, 0, size, size);
        for (let row = 0; row < k; row++) {
          // The diagonal is drawn as a distribution by the overlay, and the
          // half above it would only mirror the half below.
          for (let col = 0; col < row; col++) {
            drawCell(row, col);
          }
        }
      }

      let indexOf = new Map();
      for (let i = 0; i < n; i++) indexOf.set(data[i]._id, i);

      draw();
      return {
        highlight(selection, dimWhenEmpty) {
          selected.fill(0);
          (selection || []).forEach((d) => {
            let i = indexOf.get(d._id);
            if (i !== undefined) selected[i] = 1;
          });
          // An empty marking is "nothing selected", unless filters match nothing.
          dimOthers = (selection && selection.length > 0) || !!dimWhenEmpty;
          draw();
        },
        unhighlightAll() {
          selected.fill(0);
          dimOthers = false;
          draw();
        },
        // The hovered option is marked by the overlay, which follows the store.
        mark() {},
      };
    },
  },
};
</script>

<style scoped>
.matrix-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
  border-left: 1px solid #e3e8ee;
  user-select: none;
}
.matrix-info.v-icon {
  margin: 0 4px 0 2px;
  color: #78909c;
  cursor: help;
}
.matrix-dims-select {
  flex: 1 1 150px !important;
  max-width: 180px;
}
/* One line: typing to search goes after the count, not below it. */
.matrix-dims-select ::v-deep .v-select__selections {
  flex-wrap: nowrap;
}
.matrix-hint {
  flex: 0 0 auto;
  margin: 6px 10px 4px;
  font-size: 12px;
  color: #546e7a;
}
.matrix-area {
  flex: 1 1 0;
  min-height: 0;
  margin: 8px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  overflow: hidden;
}
.matrix-grid {
  position: relative;
  flex: 0 0 auto;
}
.matrix-canvas {
  position: absolute;
  left: 0;
  top: 0;
  pointer-events: none;
}
.matrix-cell {
  position: absolute;
  box-sizing: border-box;
  border: 1px solid #e3e8ee;
  cursor: pointer;
  overflow: hidden;
}
.matrix-cell:not(.matrix-cell--diag):hover {
  border-color: #90a4ae;
}
.matrix-cell--current,
.matrix-cell--current:hover {
  /* Not --ds-selected: this says which pair the scatterplot is
     showing, and sharing that blue's value is a coincidence. */
  border: 2px solid rgb(33, 119, 180) !important;
}
.matrix-cell--diag {
  cursor: default;
  background: #f3f6f9;
}
.matrix-dist {
  position: absolute;
  left: -1px;
  top: -1px;
}
.matrix-bar {
  fill: #b0bec5;
}
.matrix-stem {
  stroke: #90a4ae;
  stroke-width: 1.5;
}
.matrix-stem-dot {
  fill: #78909c;
}
.matrix-name {
  position: absolute;
  left: 4px;
  right: 4px;
  top: 2px;
  font-size: 11px;
  font-weight: 600;
  color: #37474f;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.matrix-box {
  position: absolute;
  box-sizing: border-box;
  border: 1px dashed #546e7a;
  background: rgba(0, 0, 0, 0.04);
  pointer-events: none;
}
.matrix-panel--expanded {
  border-left: none;
}
.matrix-panel--expanded .matrix-area {
  margin: 12px 16px 8px;
}
.matrix-panel--expanded .matrix-dims-select {
  max-width: 260px;
}
.matrix-axes {
  position: absolute;
  top: 0;
  overflow: visible;
  pointer-events: none;
}
.matrix-axis-line {
  stroke: #90a4ae;
  stroke-width: 1;
}
.matrix-axis-text {
  font-size: 10px;
  fill: #546e7a;
}
.matrix-bar--selected {
  fill: #5c8fc4;
}
.matrix-stem-dot--selected {
  fill: #1f5fa8;
}
/* Over the points and the ranges, under the name, which drags. */
.matrix-brush {
  position: absolute;
  left: -1px;
  top: -1px;
  cursor: crosshair;
}
.matrix-brush ::v-deep .selection {
  fill: rgba(33, 119, 180, 0.12);
  stroke: rgb(33, 119, 180);
}
.matrix-name--draggable {
  z-index: 1;
  right: auto;
  max-width: calc(100% - 8px);
  padding: 0 4px;
  margin-left: -4px;
  border-radius: 3px;
  background: rgba(243, 246, 249, 0.9);
  cursor: grab;
}
.matrix-name--draggable:hover {
  background: #e1e8ee;
}
.matrix-cell--drop {
  border: 2px dashed #1565c0 !important;
}
.matrix-clear {
  position: absolute;
  z-index: 2;
  top: 2px;
  right: 2px;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #b0bec5;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.92);
  cursor: pointer;
}
.matrix-clear:hover,
.matrix-clear:focus-visible {
  border-color: #455a64;
  background: #fff;
}
.matrix-readout {
  position: absolute;
  z-index: 1;
  right: 4px;
  top: 22px;
  padding: 0 4px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.9);
  font-size: 11px;
  color: #263238;
  white-space: nowrap;
  pointer-events: none;
}
.matrix-hover {
  position: absolute;
  width: 9px;
  height: 9px;
  margin: -5px 0 0 -5px;
  border: 2px solid var(--ds-inspected);
  border-radius: 50%;
  pointer-events: none;
}
</style>
