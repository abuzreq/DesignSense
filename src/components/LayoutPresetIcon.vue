<template>
  <svg
    class="lpi"
    :width="width"
    :height="height"
    :viewBox="'0 0 ' + BOX.w + ' ' + BOX.h"
    aria-hidden="true"
    focusable="false"
  >
    <g
      fill="none"
      stroke="currentColor"
      :stroke-width="BOX.stroke"
      stroke-linecap="round"
    >
      <rect
        :x="BOX.inset"
        :y="BOX.inset"
        :width="BOX.w - BOX.inset * 2"
        :height="BOX.h - BOX.inset * 2"
        rx="1.4"
      />
      <path v-if="dividers" :d="dividers" />
    </g>
  </svg>
</template>

<script>
import { LAYOUT_COLUMNS, LAYOUT_ROWS, presetLayouts } from "@/layout.js";

// Half as tall as it is wide, like the workspace. The inset is half the
// stroke, so the frame's own line sits inside the box and the dividers meet
// it exactly rather than crossing it.
const BOX = { w: 20, h: 12, inset: 0.6, stroke: 1.1 };

function round(value) {
  return Math.round(value * 100) / 100;
}

/**
 * An arrangement as one outlined frame with the lines that divide it, the
 * size of a toolbar button. The scale drawing in LayoutPresetFigure says
 * more and is what the dialog and the welcome screen show; at 20 pixels its
 * panel borders double up against the frame's and the whole thing turns to
 * mush, so the frame is drawn once and only the splits go inside it.
 */
export default {
  name: "LayoutPresetIcon",
  props: {
    preset: { type: String, default: null },
    layouts: { type: Array, default: null },
    width: { type: Number, default: 20 },
    height: { type: Number, default: 12 },
  },
  data() {
    return { BOX: BOX };
  },
  computed: {
    panels() {
      return this.layouts || presetLayouts(this.preset) || [];
    },
    /**
     * Every edge between two panels: a panel's right or bottom side, unless
     * it is the workspace's own. Drawn as one path, since a shared edge is
     * reported by the panels on both sides of it.
     */
    dividers() {
      let x = (c) => round(BOX.inset + (c / LAYOUT_COLUMNS) * (BOX.w - BOX.inset * 2));
      let y = (r) => round(BOX.inset + (r / LAYOUT_ROWS) * (BOX.h - BOX.inset * 2));
      let seen = {};
      let parts = [];
      let add = (d) => {
        if (seen[d]) return;
        seen[d] = true;
        parts.push(d);
      };
      this.panels.forEach((p) => {
        if (p.x + p.w < LAYOUT_COLUMNS) {
          add("M" + x(p.x + p.w) + " " + y(p.y) + "V" + y(p.y + p.h));
        }
        if (p.y + p.h < LAYOUT_ROWS) {
          add("M" + x(p.x) + " " + y(p.y + p.h) + "H" + x(p.x + p.w));
        }
      });
      return parts.join("");
    },
  },
};
</script>

<style scoped>
.lpi {
  display: block;
}
</style>
