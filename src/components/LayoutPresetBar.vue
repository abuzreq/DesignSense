<template>
  <div class="lpb">
    <v-tooltip v-for="preset in presets" :key="preset.id" bottom max-width="260">
      <template v-slot:activator="{ on }">
        <button
          v-on="on"
          type="button"
          class="lpb-btn"
          :class="{ 'lpb-btn--on': layoutPreset === preset.id }"
          :aria-pressed="String(layoutPreset === preset.id)"
          :aria-label="preset.name"
          @click="choose(preset.id)"
        >
          <LayoutPresetIcon :preset="preset.id" />
        </button>
      </template>
      <span
        ><strong>{{ preset.name }}</strong
        ><br />{{ preset.description }}</span
      >
    </v-tooltip>

    <v-menu bottom left offset-y :close-on-content-click="false">
      <template v-slot:activator="{ on: menu }">
        <v-tooltip bottom>
          <template v-slot:activator="{ on: tooltip }">
            <v-btn
              icon
              small
              class="lpb-more"
              aria-label="Which panels are shown"
              aria-haspopup="menu"
              v-on="Object.assign({}, tooltip, menu)"
            >
              <v-icon small>mdi-dots-horizontal</v-icon>
            </v-btn>
          </template>
          <span>Which panels are shown</span>
        </v-tooltip>
      </template>
      <v-list dense>
        <v-subheader>Panels</v-subheader>
        <v-list-item
          v-for="panel in panels"
          :key="panel.type"
          :disabled="panel.locked"
          @click="toggle(panel)"
        >
          <v-list-item-icon class="mr-3">
            <v-icon small :color="panel.shown ? 'primary' : undefined">{{
              panel.shown ? "mdi-checkbox-marked" : "mdi-checkbox-blank-outline"
            }}</v-icon>
          </v-list-item-icon>
          <v-list-item-content>
            <v-list-item-title>{{ panel.label }}</v-list-item-title>
            <v-list-item-subtitle v-if="panel.locked">{{
              panel.reason
            }}</v-list-item-subtitle>
          </v-list-item-content>
        </v-list-item>
      </v-list>
    </v-menu>
  </div>
</template>

<script>
import { mapState } from "vuex";
import { LAYOUT_PRESETS, PANEL_LABELS } from "@/layout.js";
import LayoutPresetIcon from "@/components/LayoutPresetIcon.vue";

// In the order they are offered, not the order they happen to be in a layout.
const PANEL_ORDER = ["ParallelCoordinatesPlot", "ScatterPlot", "Grid"];

const PANEL_NAMES = {
  ParallelCoordinatesPlot: "Parallel coordinates",
  ScatterPlot: "Scatterplot",
  Grid: "Gallery",
};

/**
 * Arrangement, on the toolbar: one button per ready-made layout, and behind
 * the ellipsis, which panels are on screen at all. Both were a menu and a
 * dialog away before, which is three clicks for something worth trying.
 */
export default {
  name: "LayoutPresetBar",
  components: { LayoutPresetIcon },
  data() {
    return { presets: LAYOUT_PRESETS };
  },
  computed: {
    ...mapState({
      layouts: (state) => state.layouts,
      layoutPreset: (state) => state.layoutPreset,
    }),
    panels() {
      let shown = {};
      this.layouts.forEach((panel) => (shown[panel.type] = true));
      let count = PANEL_ORDER.filter((type) => shown[type]).length;
      return PANEL_ORDER.map((type) => ({
        type: type,
        label: PANEL_NAMES[type] || PANEL_LABELS[type] || type,
        shown: !!shown[type],
        // The inspector lives inside the gallery, so closing it would leave
        // clicking a point or a line with nowhere to show the option.
        locked:
          (type === "Grid" && shown[type]) || (shown[type] && count <= 1),
        reason:
          type === "Grid"
            ? "The inspected option is shown here"
            : "The last panel stays",
      }));
    },
  },
  methods: {
    choose(id) {
      this.$store.commit("applyLayoutPreset", { id: id });
    },
    toggle(panel) {
      if (panel.locked) return;
      this.$store.commit(panel.shown ? "closeLayout" : "openLayout", {
        type: panel.type,
      });
    },
  },
};
</script>

<style scoped>
.lpb {
  display: flex;
  align-items: center;
  gap: 3px;
}
.lpb-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: rgba(255, 255, 255, 0.72);
  cursor: pointer;
  line-height: 0;
  transition: background 120ms, color 120ms;
}
.lpb-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.12);
}
.lpb-btn--on {
  color: #fff;
  background: rgba(255, 255, 255, 0.24);
}
.lpb-btn:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 1px;
}
.lpb-more.v-btn {
  margin-left: 1px;
}
</style>
