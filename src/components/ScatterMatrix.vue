<template>
  <div class="matrix-panel" :style="{ height: `${height}px` }">
    <PanelHeader
      icon="mdi-view-grid-outline"
      title="Overview"
      :compact="width < 300"
    >
      <!-- A pulldown like the scatterplot's axes, so the choice takes one line. -->
      <DimensionPicker
        :value="dims"
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
      <template v-slot:actions>
        <v-tooltip bottom max-width="300">
          <template v-slot:activator="{ on }">
            <v-icon v-on="on" small class="matrix-info"
              >mdi-information-outline</v-icon
            >
          </template>
          <span
            >Every chosen dimension against every other. Click a plot to show
            it large; the one on show is outlined. The diagonal shows how each
            dimension's values are spread.</span
          >
        </v-tooltip>
      </template>
    </PanelHeader>

    <p v-if="dims.length < 2" class="matrix-hint">
      Choose at least two dimensions.
    </p>

    <div ref="area" class="matrix-area">
      <div
        v-show="dims.length >= 2"
        class="matrix-grid"
        :style="{ width: `${geom.size}px`, height: `${geom.size}px` }"
      >
        <canvas ref="canvas" class="matrix-canvas" />
        <div
          v-for="cell in cells"
          :key="cell.key"
          class="matrix-cell"
          :class="{
            'matrix-cell--diag': cell.diagonal,
            'matrix-cell--current': cell.current,
          }"
          :style="cell.style"
          :title="cell.title"
          @click="pick(cell)"
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
            </svg>
            <span class="matrix-name">{{ label(cell.dim) }}</span>
          </template>
          <template v-else>
            <div
              v-for="(box, i) in cell.boxes"
              :key="'box' + i"
              class="matrix-box"
              :style="box"
            />
            <div
              v-if="cell.hover"
              class="matrix-hover"
              :style="cell.hover"
            />
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters, mapState } from "vuex";
import TemplateView from "@/components/TemplateView.vue";
import PanelHeader from "@/components/PanelHeader.vue";
import DimensionPicker from "@/components/DimensionPicker.vue";
import { columnKind, dimensionItems, displayName, INPUT, OUTPUT } from "@/columns.js";
import { summarize } from "@/analysis/summary.js";
import { isMissingFor } from "@/store/dimensions.js";

// Past this many dimensions the cells get too small to read in a side column.
export const MAX_MATRIX_DIMS = 6;
const DEFAULT_MATRIX_DIMS = 4;
// Space between cells, and between a cell's edge and its outermost points.
const GAP = 3;
const INSET = 4;
const SELECTED_STROKE = "rgb(33, 119, 180)";

/**
 * A scatterplot matrix of a few chosen dimensions, for picking the pair the
 * scatterplot shows. It only reads the selection and the filters; brushing
 * stays in the full-size views.
 *
 * Points go on one canvas for the whole grid: k² cells of every option is
 * too many DOM nodes for SVG. What sits on top -- names, distributions, the
 * outline of the plot on show, filter boxes, the hovered option -- is plain
 * DOM driven by the store, so it follows changes without a redraw.
 */
export default {
  mixins: [TemplateView],
  name: "ScatterMatrix",
  components: { PanelHeader, DimensionPicker },
  props: {
    // The pair the scatterplot shows, outlined here.
    xColumn: { type: String, default: null },
    yColumn: { type: String, default: null },
  },
  data() {
    return {
      // Set by each rebuild: the grid's size, and each dimension's domain.
      geom: { k: 0, cell: 0, size: 0, dims: [] },
      domains: {},
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
    dimensionChoices() {
      let full = this.dims.length >= MAX_MATRIX_DIMS;
      return dimensionItems(this.numericDimensions).map((item) =>
        Object.assign(item, {
          disabled: full && !this.dims.includes(item.value),
        })
      );
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
            current: xDim === this.xColumn && yDim === this.yColumn,
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
      this.$store.commit("setViewSetting", {
        key: "matrixDims",
        value: value.slice(0, MAX_MATRIX_DIMS),
      });
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
      } else {
        this.chart.highlight(
          this.$store.getters.selectedDataInView(this.viewID),
          this.isFilterActive
        );
      }
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
      let result = { bars: [], stems: [] };
      if (!summary || !summary.n || !summary.peak) return result;
      let clampX = (x) => Math.max(0, Math.min(cell, x));
      if (summary.levels) {
        result.stems = summary.levels.map((level) => ({
          x: clampX(this.px(dim, level.value)),
          y: cell - 2 - (level.count / summary.peak) * usable,
        }));
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
      let dims = this.dims.slice(0, MAX_MATRIX_DIMS);
      let k = dims.length;
      let side = area ? Math.min(area.clientWidth, area.clientHeight) : 0;
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
          ctx.strokeStyle = SELECTED_STROKE;
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
          for (let col = 0; col < k; col++) {
            if (row === col) continue;
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
.matrix-hover {
  position: absolute;
  width: 9px;
  height: 9px;
  margin: -5px 0 0 -5px;
  border: 2px solid #263238;
  border-radius: 50%;
  pointer-events: none;
}
</style>
