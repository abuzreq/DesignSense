<template>
  <svg
    class="summary-chart"
    :width="width"
    :height="height"
    :viewBox="'0 0 ' + width + ' ' + height"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g :transform="'translate(' + margin.left + ',' + margin.top + ')'">
      <!-- Grid and ticks -->
      <g v-for="t in xTicks" :key="'x' + t.value">
        <line :x1="t.pos" :x2="t.pos" :y1="0" :y2="innerHeight" v-bind="style.grid" />
        <text :x="t.pos" :y="innerHeight + 18" v-bind="style.tick" text-anchor="middle">{{ t.text }}</text>
      </g>
      <g v-for="t in yTicks" :key="'y' + t.value">
        <line :x1="0" :x2="innerWidth" :y1="t.pos" :y2="t.pos" v-bind="style.grid" />
        <text :x="-8" :y="t.pos + 4" v-bind="style.tick" text-anchor="end">{{ t.text }}</text>
      </g>
      <rect :width="innerWidth" :height="innerHeight" v-bind="style.frame" />

      <!-- Options: the rest, then the result, then the featured on top -->
      <circle
        v-for="p in points.rest"
        :key="'r' + p.id"
        :cx="p.x"
        :cy="p.y"
        :r="radius"
        v-bind="style.rest"
      />
      <circle
        v-for="p in points.selected"
        :key="'s' + p.id"
        :cx="p.x"
        :cy="p.y"
        :r="radius"
        v-bind="style.selected"
      />
      <path v-if="frontPath" :d="frontPath" v-bind="style.front" />
      <circle
        v-for="p in points.featured"
        :key="'f' + p.id"
        :cx="p.x"
        :cy="p.y"
        :r="radius + 4"
        v-bind="style.featured"
      />

      <!-- Axis names, with the goal's arrow -->
      <text :x="innerWidth / 2" :y="innerHeight + 42" v-bind="style.axis" text-anchor="middle">
        {{ xLabel }}
      </text>
      <text
        :transform="'translate(' + -52 + ',' + innerHeight / 2 + ') rotate(-90)'"
        v-bind="style.axis"
        text-anchor="middle"
      >
        {{ yLabel }}
      </text>
    </g>
  </svg>
</template>

<script>
import * as d3 from "d3";
import { GOAL_MARKS, displayName } from "@/columns.js";
import { formatValue } from "@/store/filters.js";

const FONT = "Roboto, 'Segoe UI', Arial, sans-serif";
// Presentation attributes rather than CSS: turning the card into an image
// loses the component's scoped styles on SVG shapes, and they draw black.
const STYLE = {
  grid: { stroke: "#eceff1", "stroke-width": 1 },
  frame: { fill: "none", stroke: "#cfd8dc" },
  tick: { "font-size": 12, fill: "#78909c", "font-family": FONT },
  axis: { "font-size": 14, "font-weight": 500, fill: "#37474f", "font-family": FONT },
  rest: { fill: "#cfd8dc" },
  selected: { fill: "#4e79a7", "fill-opacity": 0.75 },
  featured: { fill: "none", stroke: "#ef6c00", "stroke-width": 2.5 },
  front: { fill: "none", stroke: "#263238", "stroke-width": 1.5, "stroke-dasharray": "5 3" },
};

/**
 * The summary card's scatterplot of the plotted pair: every option in view in
 * grey, the group in colour, the options on the card ringed, and the pair's
 * best trade-offs as a step line when both have goals. Plain SVG drawn by the
 * template, so it turns into an image like the rest of the card.
 */
export default {
  name: "SummaryChart",
  props: {
    // `chart` from story/narrate.js's summarize.
    chart: { type: Object, required: true },
    width: { type: Number, default: 640 },
    height: { type: Number, default: 420 },
    // The context of the options: every other option, in grey. Without it,
    // only the group in colour is drawn (see narrate.js), and the axes fit it.
    context: { type: Boolean, default: true },
    // The options on the card ringed; without it, not ringed.
    highlight: { type: Boolean, default: true },
    // The options on the card; the whole group when not given.
    ringed: { type: Set, default: null },
  },
  data() {
    return { margin: { top: 12, right: 16, bottom: 52, left: 64 }, style: STYLE };
  },
  computed: {
    innerWidth() {
      return this.width - this.margin.left - this.margin.right;
    },
    innerHeight() {
      return this.height - this.margin.top - this.margin.bottom;
    },
    onCard() {
      return this.ringed || this.chart.cart;
    },
    // The options in colour: the whole group, pictured or not.
    group() {
      return this.chart.group || this.chart.selected;
    },
    /** The options to ring; none when they aren't highlighted. */
    featured() {
      return this.highlight ? this.onCard : new Set();
    },
    usable() {
      let { x, y } = this.chart;
      let group = this.group;
      let onCard = this.onCard;
      let rows = this.chart.rows.filter((row) => isFinite(this.num(row[x])) && isFinite(this.num(row[y])));
      if (this.context) return rows;
      let shown = rows.filter((row) => group.has(row) || onCard.has(row));
      // Nothing to show on its own: better the whole cloud than an empty frame.
      return shown.length > 0 ? shown : rows;
    },
    // Many points get smaller dots, so the cloud still reads as one.
    radius() {
      let n = this.usable.length;
      return n > 2000 ? 1.8 : n > 500 ? 2.6 : 3.6;
    },
    xScale() {
      return this.scaleFor(this.chart.x, [0, this.innerWidth]);
    },
    yScale() {
      return this.scaleFor(this.chart.y, [this.innerHeight, 0]);
    },
    xTicks() {
      return this.ticksFor(this.xScale, 6);
    },
    yTicks() {
      return this.ticksFor(this.yScale, 5);
    },
    points() {
      let { x, y } = this.chart;
      let group = this.group;
      let cart = this.featured;
      let out = { rest: [], selected: [], featured: [] };
      this.usable.forEach((row) => {
        let p = { id: row._id, x: this.xScale(this.num(row[x])), y: this.yScale(this.num(row[y])) };
        if (group.has(row)) out.selected.push(p);
        else out.rest.push(p);
        if (cart.has(row)) out.featured.push(p);
      });
      return out;
    },
    frontPath() {
      let steps = this.chart.steps || [];
      if (steps.length < 2) return null;
      return d3.line()(steps.map((s) => [this.xScale(s[0]), this.yScale(s[1])]));
    },
    xLabel() {
      return this.label(this.chart.x, this.chart.goals[0]);
    },
    yLabel() {
      return this.label(this.chart.y, this.chart.goals[1]);
    },
  },
  methods: {
    num(value) {
      return value === "" || value === null || value === undefined ? NaN : Number(value);
    },
    scaleFor(dim, range) {
      let values = this.usable.map((row) => this.num(row[dim]));
      let extent = d3.extent(values);
      if (extent[0] === undefined) extent = [0, 1];
      if (extent[0] === extent[1]) extent = [extent[0] - 1, extent[1] + 1];
      return d3.scaleLinear().domain(extent).range(range).nice();
    },
    ticksFor(scale, count) {
      let domain = scale.domain();
      let span = domain[1] - domain[0];
      let magnitude = Math.max(Math.abs(domain[0]), Math.abs(domain[1]));
      return scale.ticks(count).map((value) => ({
        value: value,
        pos: scale(value),
        text: formatValue(value, span, magnitude),
      }));
    },
    label(dim, goal) {
      let mark = GOAL_MARKS[goal];
      return displayName(dim) + (mark ? "  " + mark.mark + " " + mark.title.toLowerCase() : "");
    },
  },
};
</script>

<style scoped>
.summary-chart {
  display: block;
}
</style>
