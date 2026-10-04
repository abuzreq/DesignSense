<template>
  <v-menu v-if="colorColumn" offset-y left max-height="420">
    <template v-slot:activator="{ on: menu }">
      <v-tooltip bottom max-width="260">
        <template v-slot:activator="{ on: tooltip }">
          <v-btn
            icon
            small
            class="ph-btn pm-btn"
            aria-label="Choose the colours"
            v-on="Object.assign({}, tooltip, menu)"
          >
            <v-icon small>mdi-palette</v-icon>
          </v-btn>
        </template>
        <span>{{ tip }}</span>
      </v-tooltip>
    </template>
    <v-list dense class="pm-list">
      <v-subheader class="pm-head">{{ heading }}</v-subheader>
      <v-list-item
        v-for="option in options"
        :key="option.id"
        :class="{ 'pm-item--on': option.id === current }"
        @click="choose(option.id)"
      >
        <v-list-item-icon class="mr-2 pm-tick">
          <v-icon v-if="option.id === current" small color="primary"
            >mdi-check</v-icon
          >
        </v-list-item-icon>
        <v-list-item-content>
          <v-list-item-title class="pm-name">
            <span class="pm-swatches">
              <span
                v-for="(color, i) in preview(option)"
                :key="i"
                class="pm-swatch"
                :style="{ background: color }"
              />
            </span>
            {{ option.name }}
          </v-list-item-title>
          <v-list-item-subtitle class="pm-note">{{
            option.note
          }}</v-list-item-subtitle>
        </v-list-item-content>
      </v-list-item>
      <v-divider />
      <div class="pm-foot">{{ foot }}</div>
    </v-list>
  </v-menu>
</template>

<script>
import { mapGetters, mapState } from "vuex";
import { COLOR_RAMPS, COLOR_SCHEMES } from "@/palettes.js";

// How many of a palette's colours the row shows beside its name.
const PREVIEW = 8;

/**
 * Which Tableau palette the charts are coloured by.
 *
 * Only the kind that applies is offered, because the other kind would do
 * nothing: a dimension that measures something is drawn along an ordered
 * ramp and one whose values name things is drawn in separate hues, and
 * which it is, is decided from the data rather than here (see colorLevels
 * in the store). Colour by something else and the menu offers the other
 * kind.
 *
 * In both modes. The reasons to want a different palette -- not being able
 * to tell the colours apart, or sending the chart somewhere that will
 * flatten them -- belong to the reader, not to how much of the tool they
 * have learned.
 */
export default {
  name: "PaletteMenu",
  computed: {
    ...mapState({
      colorColumn: (state) => state.colorColumn,
      colorRamp: (state) => state.colorRamp,
      colorScheme: (state) => state.colorScheme,
    }),
    ...mapGetters(["colorLevels"]),
    /** Ordered for a measurement, separate hues for a set of names. */
    naming() {
      return !!this.colorLevels;
    },
    options() {
      return this.naming ? COLOR_SCHEMES : COLOR_RAMPS;
    },
    current() {
      return this.naming ? this.colorScheme : this.colorRamp;
    },
    heading() {
      return this.naming ? "Hues for each value" : "Ordered colours";
    },
    foot() {
      return this.naming
        ? "These values name things, so each gets a colour of its own."
        : "These values measure something, so they run along a ramp.";
    },
    tip() {
      let chosen = this.options.find((item) => item.id === this.current);
      return "Colours: " + (chosen ? chosen.name : "choose") + ". Click to change.";
    },
  },
  methods: {
    /** A few colours of the palette, spread across it for a ramp. */
    preview(option) {
      let colors = option.colors;
      if (colors.length <= PREVIEW) return colors;
      let out = [];
      for (let i = 0; i < PREVIEW; i++) {
        out.push(colors[Math.round((i * (colors.length - 1)) / (PREVIEW - 1))]);
      }
      return out;
    },
    choose(id) {
      this.$store.commit(
        this.naming ? "changeColorScheme" : "changeColorRamp",
        id
      );
    },
  },
};
</script>

<style scoped>
.pm-btn {
  flex: 0 0 auto;
}
.pm-list {
  max-width: 300px;
}
.pm-head {
  height: 28px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #78909c;
}
/* Narrower than a list icon's default, which is sized for an icon. */
.pm-tick {
  min-width: 18px;
  width: 18px;
}
.pm-name {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
}
.pm-note {
  font-size: 11.5px;
  white-space: normal;
  line-height: 1.3;
}
.pm-swatches {
  display: inline-flex;
  flex: 0 0 auto;
  border-radius: 2px;
  overflow: hidden;
}
.pm-swatch {
  width: 9px;
  height: 11px;
}
.pm-foot {
  padding: 8px 12px 4px;
  font-size: 11.5px;
  line-height: 1.35;
  color: #78909c;
}
</style>
