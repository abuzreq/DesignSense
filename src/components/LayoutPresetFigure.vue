<template>
  <span class="lpf" :style="frameStyle">
    <span
      v-for="panel in panels"
      :key="panel.type"
      class="lpf-panel"
      :style="panel.style"
      >{{ labelled ? panel.label : "" }}</span
    >
  </span>
</template>

<script>
import {
  LAYOUT_COLUMNS,
  LAYOUT_ROWS,
  PANEL_LABELS,
  presetLayouts,
} from "@/layout.js";

/**
 * A scale drawing of an arrangement, on the same 48x24 grid as the workspace.
 * Shown at reading size in the layout dialog and the welcome screen, and small
 * enough to be a button's face on the toolbar.
 */
export default {
  name: "LayoutPresetFigure",
  props: {
    // Either a preset id, or the panels themselves.
    preset: { type: String, default: null },
    layouts: { type: Array, default: null },
    // The drawing's width in px; null fills whatever holds it.
    width: { type: Number, default: null },
    labelled: { type: Boolean, default: false },
  },
  computed: {
    frameStyle() {
      return this.width === null ? {} : { width: this.width + "px" };
    },
    panels() {
      let layouts = this.layouts || presetLayouts(this.preset) || [];
      return layouts.map((panel) => ({
        type: panel.type,
        label: PANEL_LABELS[panel.type] || panel.type,
        style: {
          left: (panel.x / LAYOUT_COLUMNS) * 100 + "%",
          top: (panel.y / LAYOUT_ROWS) * 100 + "%",
          width: (panel.w / LAYOUT_COLUMNS) * 100 + "%",
          height: (panel.h / LAYOUT_ROWS) * 100 + "%",
        },
      }));
    },
  },
};
</script>

<style scoped>
/* Half as tall as it is wide, like the 48x24 grid it draws. */
.lpf {
  position: relative;
  display: block;
  width: 100%;
  padding-top: 50%;
  background: #eceff1;
  border-radius: 4px;
  overflow: hidden;
}
.lpf-panel {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1px;
  font-size: 10px;
  line-height: 1;
  color: #37474f;
  text-align: center;
  background: #fff;
  border: 1px solid #b0bec5;
  overflow: hidden;
}
</style>
