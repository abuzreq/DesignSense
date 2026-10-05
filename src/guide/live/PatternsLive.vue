<template>
  <div class="lv lv-patterns">
    <div class="lv-choices" role="group" aria-label="The pattern to show">
      <button
        v-for="pattern in patterns"
        :key="pattern.id"
        type="button"
        class="lv-choice"
        :class="{ 'lv-choice--on': pattern.id === chosen }"
        :aria-pressed="String(pattern.id === chosen)"
        @click="choose(pattern.id)"
      >
        {{ pattern.name }}
      </button>
    </div>

    <svg
      ref="svg"
      class="lv-chart"
      viewBox="0 0 760 300"
      role="img"
      :aria-label="current.name + ': ' + current.reads"
      @pointermove="onMove"
      @pointerup="endBrush"
      @pointerleave="onLeave"
    >
      <!-- Parallel coordinates: an axis for A and one for B, a line for each option. -->
      <text x="14" y="18" class="lv-kicker">IN THE PARALLEL COORDINATES</text>
      <g fill="none" stroke-linecap="round">
        <line
          v-for="line in drawn"
          :key="'line-' + line.i"
          :x1="AXIS_A"
          :y1="line.ya"
          :x2="AXIS_B"
          :y2="line.yb"
          :stroke="line.colour"
          :stroke-width="line.width"
          :stroke-opacity="line.opacity"
        />
      </g>
      <g stroke="#546e7a" stroke-width="1.5">
        <line :x1="AXIS_A" :y1="TOP" :x2="AXIS_A" :y2="FOOT" />
        <line :x1="AXIS_B" :y1="TOP" :x2="AXIS_B" :y2="FOOT" />
      </g>
      <rect
        v-if="brush"
        class="lv-brush"
        :x="(brush.dim === 'a' ? AXIS_A : AXIS_B) - 9"
        :y="yOf(brush.hi)"
        width="18"
        :height="Math.max(2, yOf(brush.lo) - yOf(brush.hi))"
      />
      <text :x="AXIS_A" y="36" class="lv-axis">A</text>
      <text :x="AXIS_B" y="36" class="lv-axis">B</text>
      <text :x="AXIS_A - 14" :y="TOP + 4" class="lv-end">high</text>
      <text :x="AXIS_A - 14" :y="FOOT + 3" class="lv-end">low</text>
      <!-- Where a range is dragged out, over each axis. -->
      <rect
        v-for="dim in ['a', 'b']"
        :key="'grip-' + dim"
        class="lv-grip"
        :x="(dim === 'a' ? AXIS_A : AXIS_B) - 16"
        :y="TOP - 8"
        width="32"
        :height="FOOT - TOP + 16"
        @pointerdown.prevent="startBrush(dim, $event)"
      />

      <!-- The scatterplot: the same options, A across and B up. -->
      <text :x="LEFT - 36" y="18" class="lv-kicker">IN THE SCATTERPLOT</text>
      <g stroke="#546e7a" stroke-width="1.5" fill="none">
        <path :d="'M' + LEFT + ' ' + TOP + 'V' + FOOT + 'H' + RIGHT" />
      </g>
      <text :x="(LEFT + RIGHT) / 2" :y="FOOT + 26" class="lv-axis">A</text>
      <text :x="LEFT - 20" :y="(TOP + FOOT) / 2 + 4" class="lv-axis">B</text>
      <text :x="LEFT" :y="FOOT + 14" class="lv-end lv-end--start">low</text>
      <text :x="RIGHT" :y="FOOT + 14" class="lv-end">high</text>
      <circle
        v-for="dot in drawn"
        :key="'dot-' + dot.i"
        :cx="dot.x"
        :cy="dot.yb"
        :r="dot.r"
        :fill="dot.colour"
        :fill-opacity="dot.dotOpacity"
        @pointerenter="hovered = dot.i"
      />
    </svg>

    <p class="lv-reads">
      <strong>{{ current.name }}.</strong> {{ current.reads }}
    </p>
    <p class="lv-hint">
      <template v-if="brush">
        {{ picked }} of {{ points.length }} options have {{ brush.dim.toUpperCase() }}
        in the range you dragged. The other chart shows where they fall.
        <button type="button" class="lv-clear" @click="brush = null">Clear</button>
      </template>
      <template v-else>
        Drag along an axis on the left to pick a range of options, as a filter
        does. The scatterplot on the right shows where they fall. Point at a
        dot to highlight its line.
      </template>
    </p>
  </div>
</template>

<script>
/*
 * The guide's figure of four patterns, to try: one pattern at a time on sixty
 * made-up options, drawn as the parallel coordinates and the scatterplot draw
 * them. Dragging along an axis picks a range, as a filter does in the app,
 * and both charts mark what it takes in. Stands in for docs/img/patterns.svg
 * (see live/index.js); it leans on nothing of the app's.
 */
import "./live.css";

const COUNT = 60;
const AXIS_A = 70;
const AXIS_B = 290;
const TOP = 52;
const FOOT = 250;
const LEFT = 450;
const RIGHT = 740;
const INK = "#1976d2";
const APART = "#ef6c00";

const PATTERNS = [
  {
    id: "rising",
    name: "Rising together",
    reads:
      "The lines run roughly level between the axes, and the dots climb from left to right. Where A is high, B is high too.",
  },
  {
    id: "trade",
    name: "A trade-off",
    reads:
      "The lines cross between the axes, and the dots fall from left to right. As A goes up, B goes down.",
  },
  {
    id: "none",
    name: "No relationship",
    reads:
      "The lines go in every direction, and the dots fill the plot. Knowing A tells you nothing about B.",
  },
  {
    id: "outliers",
    name: "Outliers",
    reads:
      "A few lines leave the bundle, and a few dots sit apart from the rest. Check these options. They may be mistakes in the data, or designs that really are unlike the others.",
  },
];

/** The same numbers every time, so the figure doesn't change between visits. */
function random(seed) {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value) {
  return Math.max(0.02, Math.min(0.98, value));
}

function pointsFor(id) {
  let next = random({ rising: 11, trade: 23, none: 37, outliers: 53 }[id]);
  let noise = (spread) => (next() + next() + next() - 1.5) * spread;
  let points = [];
  for (let i = 0; i < COUNT; i++) {
    let a = 0.05 + next() * 0.9;
    let b;
    if (id === "rising") b = a + noise(0.22);
    else if (id === "trade") b = 1 - a + noise(0.22);
    else if (id === "none") b = 0.05 + next() * 0.9;
    else b = a + noise(0.12);
    points.push({ i: i, a: clamp(a), b: clamp(b), apart: false });
  }
  if (id === "outliers") {
    [
      [0.86, 0.12],
      [0.78, 0.2],
      [0.15, 0.88],
      [0.24, 0.8],
    ].forEach((pair, n) => {
      points[n * 13 + 3] = { i: n * 13 + 3, a: pair[0], b: pair[1], apart: true };
    });
  }
  return points;
}

export default {
  name: "PatternsLive",
  data() {
    return {
      patterns: PATTERNS,
      chosen: "rising",
      // { dim: "a" | "b", lo, hi } while a range is picked; `from` is where
      // the drag began, while it is still going.
      brush: null,
      dragging: null,
      hovered: null,
      AXIS_A: AXIS_A,
      AXIS_B: AXIS_B,
      TOP: TOP,
      FOOT: FOOT,
      LEFT: LEFT,
      RIGHT: RIGHT,
    };
  },
  computed: {
    current() {
      return this.patterns.find((pattern) => pattern.id === this.chosen);
    },
    points() {
      return pointsFor(this.chosen);
    },
    picked() {
      return this.points.filter(this.isPicked).length;
    },
    /** Each option as both charts draw it; what stands out is drawn last, on top. */
    drawn() {
      let marks = this.points.map((point) => {
        let picked = this.isPicked(point);
        let hovered = point.i === this.hovered;
        let quiet = this.brush && !picked;
        let colour = hovered ? "#263238" : quiet ? "#b0bec5" : point.apart ? APART : INK;
        return {
          i: point.i,
          ya: this.yOf(point.a),
          yb: this.yOf(point.b),
          x: LEFT + point.a * (RIGHT - LEFT),
          colour: colour,
          width: hovered ? 2.6 : point.apart && !quiet ? 1.8 : 1.2,
          opacity: hovered ? 1 : quiet ? 0.3 : point.apart ? 0.95 : 0.5,
          dotOpacity: hovered ? 1 : quiet ? 0.35 : 0.8,
          r: hovered ? 6 : 4,
          rank: hovered ? 3 : quiet ? 0 : point.apart ? 2 : 1,
        };
      });
      return marks.sort((one, other) => one.rank - other.rank);
    },
  },
  methods: {
    choose(id) {
      this.chosen = id;
      this.brush = null;
      this.hovered = null;
    },
    yOf(value) {
      return FOOT - value * (FOOT - TOP);
    },
    isPicked(point) {
      let brush = this.brush;
      if (!brush) return true;
      let value = point[brush.dim];
      return value >= brush.lo && value <= brush.hi;
    },
    /** The value, 0 to 1, at the height of a pointer over the chart. */
    valueAt(event) {
      let box = this.$refs.svg.getBoundingClientRect();
      let y = ((event.clientY - box.top) / box.height) * 300;
      return Math.max(0, Math.min(1, (FOOT - y) / (FOOT - TOP)));
    },
    startBrush(dim, event) {
      let value = this.valueAt(event);
      this.dragging = { dim: dim, from: value, moved: false };
      this.hovered = null;
      if (this.$refs.svg.setPointerCapture) {
        this.$refs.svg.setPointerCapture(event.pointerId);
      }
    },
    onMove(event) {
      let drag = this.dragging;
      if (!drag) return;
      let value = this.valueAt(event);
      if (Math.abs(value - drag.from) > 0.02) drag.moved = true;
      if (!drag.moved) return;
      this.brush = {
        dim: drag.dim,
        lo: Math.min(drag.from, value),
        hi: Math.max(drag.from, value),
      };
    },
    endBrush() {
      // A click that goes nowhere takes the range away, as it does in the app.
      if (this.dragging && !this.dragging.moved) this.brush = null;
      this.dragging = null;
    },
    onLeave() {
      this.hovered = null;
    },
  },
};
</script>
