<template>
  <!-- A picture, not a control: nothing here answers the pointer. -->
  <figure class="ms" role="img" :aria-label="ariaLabel">
    <div ref="frame" class="ms-frame" :style="{ height: height + 'px' }">
      <canvas ref="canvas" class="ms-canvas" :style="frameStyle" />
      <svg class="ms-svg" :width="width" :height="height">
        <g :transform="'translate(' + MARGIN.left + ',' + MARGIN.top + ')'">
          <rect class="ms-plot" :width="innerWidth" :height="innerHeight" />
          <!-- The fences: beyond these a value is far out. -->
          <line
            v-for="(at, i) in xFences"
            :key="'fx' + i"
            class="ms-fence"
            :x1="at"
            :x2="at"
            y1="0"
            :y2="innerHeight"
          />
          <line
            v-for="(at, i) in yFences"
            :key="'fy' + i"
            class="ms-fence"
            x1="0"
            :x2="innerWidth"
            :y1="at"
            :y2="at"
          />
          <path v-if="stepPath" class="ms-steps" :d="stepPath" />
          <g class="ms-axis" :transform="'translate(0,' + innerHeight + ')'">
            <line :x2="innerWidth" />
            <g
              v-for="tick in xTicks"
              :key="'x' + tick.value"
              :transform="'translate(' + tick.at + ',0)'"
            >
              <line y2="4" />
              <text y="14" text-anchor="middle">{{ tick.text }}</text>
            </g>
            <text
              class="ms-title"
              :x="innerWidth / 2"
              y="28"
              text-anchor="middle"
              >{{ axisTitle(x) }}</text
            >
          </g>
          <g class="ms-axis">
            <line :y2="innerHeight" />
            <g
              v-for="tick in yTicks"
              :key="'y' + tick.value"
              :transform="'translate(0,' + tick.at + ')'"
            >
              <line x2="-4" />
              <text x="-6" dy="0.32em" text-anchor="end">{{ tick.text }}</text>
            </g>
            <text
              class="ms-title"
              :transform="'translate(' + (8 - MARGIN.left) + ',' + innerHeight / 2 + ') rotate(-90)'"
              text-anchor="middle"
              >{{ axisTitle(y) }}</text
            >
          </g>
        </g>
      </svg>
    </div>
    <figcaption class="ms-legend">
      <span v-for="entry in legend" :key="entry.key" class="ms-key">
        <span
          class="ms-dot"
          :class="{ 'ms-dot--hollow': entry.hollow }"
          :style="{ borderColor: entry.color, background: entry.hollow ? 'transparent' : entry.color }"
        />{{ entry.label }} <span class="ms-count">{{ entry.count.toLocaleString() }}</span>
      </span>
    </figcaption>
  </figure>
</template>

<script>
import * as d3 from "d3";
import { mapGetters } from "vuex";
import { GOAL_MARKS, displayName } from "@/columns.js";
import { axisTickFormat } from "@/components/axisFormat.js";

const MARGIN = { top: 8, right: 10, bottom: 34, left: 46 };
const BASE_COLOR = "#cfd8dc";
const TICKS = 4;
// Room left beyond the values at each end of an axis, as a share of it.
const PAD = 0.04;

function defaultIsMissing(dim, value) {
  return value === "" || value === null || value === undefined || !isFinite(Number(value));
}

/**
 * A small scatterplot to look at, beside the analysis dialog's outliers and
 * trade-offs: which options a method picks, among the rest. Points go on a
 * canvas, so a large collection costs nothing to draw; axes, fences and a
 * front's steps on SVG over it.
 *
 * `layerOf(row)` names the layer a row is drawn in, or null for the rest;
 * `layers` are `{ key, label, color, hollow }`, drawn in order over the
 * rest, so the last is on top. `fences` are `{ x, y }`, each `[lo, hi]` or
 * null; `steps` are `[[x, y]]` in data units, as frontSteps gives them.
 */
export default {
  name: "MiniScatter",
  props: {
    rows: { type: Array, default: () => [] },
    x: { type: String, default: null },
    y: { type: String, default: null },
    layerOf: { type: Function, default: () => null },
    layers: { type: Array, default: () => [] },
    baseLabel: { type: String, default: "Others" },
    fences: { type: Object, default: () => ({}) },
    steps: { type: Array, default: null },
    height: { type: Number, default: 220 },
    isMissing: { type: Function, default: defaultIsMissing },
  },
  data() {
    return { MARGIN: MARGIN, width: 320 };
  },
  mounted() {
    this.measure();
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.measure());
      this.resizeObserver.observe(this.$refs.frame);
    }
    this.draw();
  },
  beforeDestroy() {
    if (this.resizeObserver) this.resizeObserver.disconnect();
  },
  computed: {
    ...mapGetters(["goalOf"]),
    innerWidth() {
      return Math.max(10, this.width - MARGIN.left - MARGIN.right);
    },
    innerHeight() {
      return Math.max(10, this.height - MARGIN.top - MARGIN.bottom);
    },
    frameStyle() {
      return { width: this.width + "px", height: this.height + "px" };
    },
    /** The rows with a value on both axes. */
    points() {
      if (!this.x || !this.y) return [];
      return this.rows.filter(
        (row) => !this.isMissing(this.x, row[this.x]) && !this.isMissing(this.y, row[this.y])
      );
    },
    xScale() {
      return this.scaleFor(this.x, [0, this.innerWidth]);
    },
    yScale() {
      return this.scaleFor(this.y, [this.innerHeight, 0]);
    },
    xTicks() {
      return this.ticksOf(this.xScale);
    },
    yTicks() {
      return this.ticksOf(this.yScale);
    },
    xFences() {
      return this.fencePositions(this.fences && this.fences.x, this.xScale);
    },
    yFences() {
      return this.fencePositions(this.fences && this.fences.y, this.yScale);
    },
    stepPath() {
      if (!this.steps || this.steps.length < 2) return null;
      return d3
        .line()
        .x((p) => this.xScale(p[0]))
        .y((p) => this.yScale(p[1]))(this.steps);
    },
    /** Each layer's rows, in drawing order, and the rest first. */
    grouped() {
      let groups = { null: [] };
      this.layers.forEach((layer) => (groups[layer.key] = []));
      this.points.forEach((row) => {
        let key = this.layerOf(row);
        (groups[key] || groups.null).push(row);
      });
      return groups;
    },
    legend() {
      let entries = this.layers
        .filter((layer) => this.grouped[layer.key].length > 0)
        .map((layer) => ({
          key: layer.key,
          label: layer.label,
          color: layer.color,
          hollow: layer.hollow,
          count: this.grouped[layer.key].length,
        }))
        .reverse();
      entries.push({
        key: "rest",
        label: this.baseLabel,
        color: BASE_COLOR,
        count: this.grouped.null.length,
      });
      return entries;
    },
    ariaLabel() {
      return (
        this.axisTitle(this.y) +
        " against " +
        this.axisTitle(this.x) +
        ": " +
        this.legend.map((entry) => entry.count + " " + entry.label).join(", ")
      );
    },
    drawSignature() {
      // Everything a redraw depends on, read so the watcher follows it.
      return [this.grouped, this.xScale, this.yScale, this.width, this.height];
    },
  },
  watch: {
    drawSignature() {
      this.$nextTick(this.draw);
    },
  },
  methods: {
    measure() {
      let frame = this.$refs.frame;
      if (frame && frame.clientWidth > 0 && frame.clientWidth !== this.width) {
        this.width = frame.clientWidth;
      }
    },
    axisTitle(dim) {
      if (!dim) return "";
      let mark = GOAL_MARKS[this.goalOf(dim)];
      return displayName(dim) + (mark ? " " + mark.mark : "");
    },
    /**
     * The values' own extent and a little over, not rounded out to whole
     * ticks: 851 to 3,070 rounded to 0 to 4,000 would leave a quarter of a
     * small plot empty.
     */
    scaleFor(dim, range) {
      let values = this.points.map((row) => Number(row[dim]));
      let lo = d3.min(values);
      let hi = d3.max(values);
      if (lo === undefined) {
        lo = 0;
        hi = 1;
      } else if (lo === hi) {
        lo -= 1;
        hi += 1;
      }
      let pad = (hi - lo) * PAD;
      return d3.scaleLinear().domain([lo - pad, hi + pad]).range(range);
    },
    ticksOf(scale) {
      let format = axisTickFormat(scale, TICKS);
      return scale.ticks(TICKS).map((value) => ({
        value: value,
        at: scale(value),
        text: format(value),
      }));
    },
    /** Where the fences fall, those inside the axis only. */
    fencePositions(fence, scale) {
      if (!fence) return [];
      let domain = scale.domain();
      return fence
        .filter((value) => value > domain[0] && value < domain[1])
        .map((value) => scale(value));
    },
    draw() {
      let canvas = this.$refs.canvas;
      if (!canvas) return;
      let ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(this.width * ratio);
      canvas.height = Math.round(this.height * ratio);
      let ctx = canvas.getContext("2d");
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, this.width, this.height);
      ctx.save();
      ctx.beginPath();
      ctx.rect(MARGIN.left, MARGIN.top, this.innerWidth, this.innerHeight);
      ctx.clip();
      let x = this.xScale;
      let y = this.yScale;
      let dot = (row, radius) => {
        ctx.moveTo(MARGIN.left + x(Number(row[this.x])) + radius, MARGIN.top + y(Number(row[this.y])));
        ctx.arc(
          MARGIN.left + x(Number(row[this.x])),
          MARGIN.top + y(Number(row[this.y])),
          radius,
          0,
          2 * Math.PI
        );
      };
      ctx.beginPath();
      this.grouped.null.forEach((row) => dot(row, 2));
      ctx.fillStyle = BASE_COLOR;
      ctx.fill();
      this.layers.forEach((layer) => {
        let rows = this.grouped[layer.key];
        if (rows.length === 0) return;
        ctx.beginPath();
        rows.forEach((row) => dot(row, 3));
        if (layer.hollow) {
          ctx.lineWidth = 1.3;
          ctx.strokeStyle = layer.color;
          ctx.stroke();
        } else {
          ctx.fillStyle = layer.color;
          ctx.fill();
        }
      });
      ctx.restore();
    },
  },
};
</script>

<style scoped>
.ms {
  margin: 0;
  min-width: 0;
}
.ms-frame {
  position: relative;
  width: 100%;
  pointer-events: none;
}
.ms-canvas,
.ms-svg {
  position: absolute;
  top: 0;
  left: 0;
}
.ms-svg {
  overflow: visible;
}
.ms-plot {
  fill: none;
  stroke: #eceff1;
}
.ms-axis line {
  stroke: #b0bec5;
}
.ms-axis text {
  fill: #78909c;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}
.ms-axis .ms-title {
  fill: #455a64;
  font-size: 11px;
  font-weight: 600;
}
.ms-fence {
  stroke: #e65100;
  stroke-width: 1;
  stroke-dasharray: 4 3;
  opacity: 0.7;
}
.ms-steps {
  fill: none;
  stroke: #0d47a1;
  stroke-width: 1.5;
  stroke-dasharray: 5 3;
}
.ms-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 12px;
  margin-top: 4px;
  font-size: 11px;
  color: #546e7a;
}
.ms-key {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}
.ms-dot {
  width: 8px;
  height: 8px;
  border: 1.5px solid;
  border-radius: 50%;
}
.ms-count {
  color: #90a4ae;
  font-variant-numeric: tabular-nums;
}
</style>
