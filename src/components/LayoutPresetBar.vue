<template>
  <div class="lpb">
    <v-tooltip v-for="preset in presets" :key="preset.id" right max-width="240">
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
  </div>
</template>

<script>
import { mapState } from "vuex";
import { LAYOUT_PRESETS } from "@/layout.js";
import LayoutPresetIcon from "@/components/LayoutPresetIcon.vue";

/**
 * The ready-made arrangements as a row of small drawings, one click each,
 * with the current one marked. It sits at the head of the layout menu, so
 * switching is a click without a dialog in the way; the dialog behind it is
 * for the choices that need more room than a menu has.
 */
export default {
  name: "LayoutPresetBar",
  components: { LayoutPresetIcon },
  data() {
    return { presets: LAYOUT_PRESETS };
  },
  computed: {
    ...mapState({
      layoutPreset: (state) => state.layoutPreset,
    }),
  },
  methods: {
    choose(id) {
      this.$store.commit("applyLayoutPreset", { id: id });
    },
  },
};
</script>

<style scoped>
.lpb {
  display: flex;
  align-items: center;
  gap: 4px;
}
/* On the menu's own white, not the dark toolbar it used to sit on. */
.lpb-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #607d8b;
  cursor: pointer;
  line-height: 0;
  transition: background 120ms, color 120ms;
}
.lpb-btn:hover {
  color: #37474f;
  background: #eceff1;
}
.lpb-btn--on {
  color: #1565c0;
  background: rgba(21, 101, 192, 0.12);
}
.lpb-btn:focus-visible {
  outline: 2px solid #1565c0;
  outline-offset: 1px;
}
</style>
