<template>
  <svg
    class="summary-parallel"
    :width="width"
    :height="height"
    :viewBox="'0 0 ' + width + ' ' + height"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g :transform="'translate(' + margin.left + ',' + margin.top + ')'">
      <!-- Lines: the rest, then the result, then the featured on top -->
      <path v-for="line in lines.rest" :key="'r' + line.id" :d="line.d" v-bind="style.rest" />
      <path v-for="line in lines.selected" :key="'s' + line.id" :d="line.d" v-bind="style.selected" />
      <path v-for="line in lines.featured" :key="'f' + line.id" :d="line.d" v-bind="style.featured" />

      <g v-for="axis in axes" :key="axis.dim" :transform="'translate(' + axis.x + ',0)'">
        <line :x1="0" :x2="0" :y1="0" :y2="innerHeight" v-bind="style.axis" />
        <text :x="0" :y="-10" text-anchor="middle" v-bind="style.name">{{ axis.name }}{{ axis.mark ? " " + axis.mark : "" }}</text>
        <text :x="4" :y="8" v-bind="style.tick">{{ axis.top }}</text>
        <text :x="4" :y="innerHeight" v-bind="style.tick">{{ axis.bottom }}</text>
      </g>
    </g>
  </svg>
</template>

<script>
import * as d3 from "d3";
import { GOAL_MARKS, displayName } from "@/columns.js";
import { formatValue } from "@/store/filters.js";

const FONT = "Roboto, 'Segoe UI', Arial, sans-serif";
// Presentation attributes rather than CSS, as in SummaryChart: scoped styles
// don't reach SVG shapes once the card is turned into an image.
const STYLE = {
  rest: { fill: "none", stroke: "#cfd8dc", "stroke-width": 1, "stroke-opacity": 0.7 },
  selected: { fill: "none", stroke: "#4e79a7", "stroke-width": 1.2, "stroke-opacity": 0.7 },
  featured: { fill: "none", stroke: "#ef6c00", "stroke-width": 2.5 },
  axis: { stroke: "#78909c", "stroke-width": 1 },
  name: { "font-size": 13, "font-weight": 600, fill: "#37474f", "font-family": FONT },
  tick: { "font-size": 11, fill: "#90a4ae", "font-family": FONT },
};
// Past this many, the other options are thinned to an even sample: the
// shape of the cloud survives and the picture stays quick to make.
const MAX_REST_LINES = 1500;

/**
 * The summary card's parallel coordinates: one axis per dimension the panel
 * shows, better at the top as there, every option in view in grey, the group
 * in colour and the options on the card in orange.
 */
export default {
  name: "SummaryParallel",
  props: {
    // `parallel` from story/narrate.js's summarize.
    parallel: { type: Object, required: true },
    width: { type: Number, default: 600 },
    height: { type: Number, default: 300 },
    // The context of the options: every other option, in grey. Without it,
    // only the group in colour is drawn (see narrate.js), and the axes fit it.
    context: { type: Boolean, default: true },
    // The options on the card ringed; without it, not ringed.
    highlight: { type: Boolean, default: true },
    // The options on the card; the whole group when not given.
    ringed: { type: Set, default: null },
  },
  data() {
    return { margin: { top: 24, right: 36, bottom: 10, left: 34 }, style: STYLE };
  },
  computed: {
    innerWidth() {
      return this.width - this.margin.left - this.margin.right;
    },
    innerHeight() {
      return this.height - this.margin.top - this.margin.bottom;
    },
    onCard() {
      return this.ringed || this.parallel.featured;
    },
    // The options in colour: the whole group, pictured or not.
    group() {
      return this.parallel.group || this.parallel.selected;
    },
    /** The options to draw in orange; none when they aren't highlighted. */
    featured() {
      return this.highlight ? this.onCard : new Set();
    },
    /** The options drawn: every one in view, or only the group. */
    rows() {
      let rows = this.parallel.rows;
      let group = this.group;
      let onCard = this.onCard;
      if (this.context) return rows;
      let shown = rows.filter((row) => group.has(row) || onCard.has(row));
      return shown.length > 0 ? shown : rows;
    },
    scales() {
      let { dims, goals } = this.parallel;
      let rows = this.rows;
      let out = {};
      dims.forEach((dim) => {
        let extent = d3.extent(rows, (row) => this.num(row[dim]));
        if (extent[0] === undefined) extent = [0, 1];
        if (extent[0] === extent[1]) extent = [extent[0] - 1, extent[1] + 1];
        // Better at the top: lower-is-better axes run the other way.
        let range = goals[dim] === "min" ? [0, this.innerHeight] : [this.innerHeight, 0];
        out[dim] = d3.scaleLinear().domain(extent).range(range);
      });
      return out;
    },
    axes() {
      let dims = this.parallel.dims;
      let step = dims.length > 1 ? this.innerWidth / (dims.length - 1) : 0;
      return dims.map((dim, i) => {
        let scale = this.scales[dim];
        let domain = scale.domain();
        let span = domain[1] - domain[0];
        let magnitude = Math.max(Math.abs(domain[0]), Math.abs(domain[1]));
        let atTop = scale.invert(0);
        let atBottom = scale.invert(this.innerHeight);
        let mark = GOAL_MARKS[this.parallel.goals[dim]];
        return {
          dim: dim,
          x: i * step,
          name: this.shorten(displayName(dim), Math.max(6, Math.floor(step / 8) - 2)),
          mark: mark ? mark.mark : "",
          top: formatValue(atTop, span, magnitude),
          bottom: formatValue(atBottom, span, magnitude),
        };
      });
    },
    lines() {
      let selected = this.group;
      let featured = this.featured;
      let rows = this.rows;
      let out = { rest: [], selected: [], featured: [] };
      let rest = rows.filter((row) => !selected.has(row));
      let every = Math.max(1, Math.ceil(rest.length / MAX_REST_LINES));
      rest.forEach((row, i) => {
        if (i % every === 0) this.push(out.rest, row);
      });
      rows.forEach((row) => {
        if (selected.has(row)) this.push(out.selected, row);
      });
      rows.forEach((row) => {
        if (featured.has(row)) this.push(out.featured, row);
      });
      return out;
    },
  },
  methods: {
    num(value) {
      return value === "" || value === null || value === undefined ? NaN : Number(value);
    },
    push(list, row) {
      let d = "";
      let pen = false;
      this.axes.forEach((axis) => {
        let value = this.num(row[axis.dim]);
        // A missing value breaks the line rather than dropping it to an end.
        if (!isFinite(value)) {
          pen = false;
          return;
        }
        let y = this.scales[axis.dim](value);
        d += (pen ? "L" : "M") + axis.x.toFixed(1) + "," + y.toFixed(1);
        pen = true;
      });
      if (d) list.push({ id: row._id, d: d });
    },
    shorten(text, max) {
      return text.length > max ? text.slice(0, max - 1) + "…" : text;
    },
  },
};
</script>

<style scoped>
.summary-parallel {
  display: block;
}
</style>
