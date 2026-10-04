<template>
  <span v-if="colorColumn" class="ck" :title="title">
    <svg
      v-if="ramp"
      class="ck-ramp"
      :width="RAMP_WIDTH"
      height="10"
      aria-hidden="true"
    >
      <defs>
        <linearGradient :id="gradientId" x1="0" x2="1" y1="0" y2="0">
          <stop
            v-for="stop in ramp"
            :key="stop.at"
            :offset="stop.at * 100 + '%'"
            :stop-color="stop.color"
          />
        </linearGradient>
      </defs>
      <rect
        :width="RAMP_WIDTH"
        height="10"
        rx="2"
        :fill="'url(#' + gradientId + ')'"
      />
    </svg>
    <template v-if="ramp">
      <span class="ck-end">{{ lowText }}</span>
      <span class="ck-end">{{ highText }}</span>
    </template>
    <span v-else class="ck-swatches">
      <span
        v-for="entry in swatches"
        :key="entry.value"
        class="ck-swatch"
        :style="{ background: entry.color }"
        :title="entry.value"
      />
      <span v-if="moreCount > 0" class="ck-end">+{{ moreCount }}</span>
    </span>
  </span>
</template>

<script>
import * as d3 from "d3";
import { mapGetters, mapState } from "vuex";
import { displayName } from "@/columns.js";
import { axisTickFormat } from "@/components/axisFormat.js";

const RAMP_WIDTH = 72;
// Enough stops that the bar reads as a ramp, few enough to stay cheap.
const STOPS = 8;
// Beyond this many values a categorical key is a list, not a key.
const MAX_SWATCHES = 6;

/**
 * What the colours in the charts mean: a bar between the lowest and highest
 * value for a number, a few swatches for anything else. It reads the store,
 * so it needs no props and agrees with whatever set the colour column.
 */
export default {
  name: "ColorKey",
  data() {
    return { RAMP_WIDTH: RAMP_WIDTH };
  },
  computed: {
    ...mapState({
      colorColumn: (state) => state.colorColumn,
      currentData: (state) => state.data,
    }),
    ...mapGetters(["colorDomain", "colorScale", "colorize"]),
    // Several panels can show a key at once, so the gradient needs its own id.
    gradientId() {
      return "ck-" + this._uid;
    },
    ramp() {
      let domain = this.colorDomain;
      if (!domain) return null;
      let scale = this.colorScale;
      let stops = [];
      for (let i = 0; i < STOPS; i++) {
        let at = i / (STOPS - 1);
        let color = d3.color(scale(domain[0] + at * (domain[1] - domain[0])));
        stops.push({ at: at, color: color ? color.formatHex() : "#ffffff" });
      }
      return stops;
    },
    endText() {
      let domain = this.colorDomain;
      if (!domain) return ["", ""];
      // The same formatting the axes use, so the key and the axis agree.
      let format = axisTickFormat(
        d3.scaleLinear().domain(domain).range([0, RAMP_WIDTH]),
        4
      );
      return [format(domain[0]), format(domain[1])];
    },
    lowText() {
      return this.endText[0];
    },
    highText() {
      return this.endText[1];
    },
    /** The distinct values and how many there are, counted once. */
    categorical() {
      if (this.colorDomain) return { shown: [], more: 0 };
      let shown = [];
      let known = new Set();
      this.currentData.forEach((row) => {
        let value = row[this.colorColumn];
        if (value === undefined || value === null || value === "") return;
        let key = String(value);
        if (known.has(key)) return;
        known.add(key);
        if (shown.length < MAX_SWATCHES) {
          shown.push({ value: key, color: this.colorize(row) });
        }
      });
      return { shown: shown, more: Math.max(0, known.size - MAX_SWATCHES) };
    },
    swatches() {
      return this.categorical.shown;
    },
    moreCount() {
      return this.categorical.more;
    },
    title() {
      return "Colour shows " + displayName(this.colorColumn);
    },
  },
};
</script>

<style scoped>
.ck {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
}
.ck-ramp {
  display: block;
  order: 2;
}
/* The low end before the bar, the high end after it. */
.ck-end {
  order: 1;
  font-size: 10px;
  color: #78909c;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.ck-end + .ck-end {
  order: 3;
}
.ck-swatches {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.ck-swatch {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}
</style>
