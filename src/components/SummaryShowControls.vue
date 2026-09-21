<template>
  <div class="ssc" :class="{ 'ssc--row': row, 'ssc--one': only === 'data' }">
    <template v-if="only !== 'data'">
    <v-checkbox
      v-for="part in parts"
      :key="part.key"
      :input-value="part.value"
      :label="part.label"
      :disabled="part.disabled"
      dense
      hide-details
      @change="set(part.key, $event)"
    />
    </template>
    <div class="ssc-context">
      <v-checkbox
        v-if="only !== 'data'"
        :input-value="settings.highlight"
        :disabled="!hasChart"
        dense
        hide-details
        @change="set('highlight', $event)"
      >
        <template v-slot:label>
          <span>
            Highlight the shortlisted options
            <span class="ssc-hint">{{
              settings.highlight
                ? "the options on the card, ringed in orange in the charts"
                : "drawn in the charts like the rest"
            }}</span>
          </span>
        </template>
      </v-checkbox>
      <v-checkbox
        v-if="only !== 'views'"
        :input-value="settings.context"
        :disabled="!hasChart"
        dense
        hide-details
        @change="set('context', $event)"
      >
        <template v-slot:label>
          <span>
            Show the context of the options
            <span class="ssc-hint">{{
              settings.context
                ? "every other option, in grey, in the charts"
                : "the charts draw only the options on the card, and the result if the view was narrowed"
            }}</span>
          </span>
        </template>
      </v-checkbox>
      <!-- Smaller pictures, more of them: the card fills its room either way. -->
      <div v-if="only !== 'views'" class="ssc-size">
        <span class="ssc-size-label">Picture size</span>
        <v-btn-toggle
          :value="settings.pictures"
          mandatory
          dense
          color="primary"
          class="ssc-size-toggle"
          @change="setSize"
        >
          <v-btn x-small value="large" :disabled="!settings.featured">Large</v-btn>
          <v-btn x-small value="medium" :disabled="!settings.featured">Medium</v-btn>
          <v-btn x-small value="small" :disabled="!settings.featured">Small</v-btn>
        </v-btn-toggle>
        <span class="ssc-hint">{{ sizeHint }}</span>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * The summary settings' checkboxes (see story/summarySettings.js), the same
 * in the summary image and the story report: a change in either is a change
 * in both, and is kept for next time.
 */
export default {
  name: "SummaryShowControls",
  props: {
    // The one summary shown, to grey out a chart it has nothing for; the
    // report, with a summary per page, leaves it out.
    summary: { type: Object, default: null },
    // Laid out in one row, for above the report's pages.
    row: { type: Boolean, default: false },
    // Which checkboxes: "views", what the card shows; "data", which options
    // its charts draw (the context); or "all", both, as the report has them.
    only: { type: String, default: "all" },
  },
  computed: {
    settings() {
      return this.$store.state.summarySettings;
    },
    parts() {
      let s = this.settings;
      let summary = this.summary;
      return [
        { key: "goals", label: "Goals", value: s.goals },
        { key: "featured", label: "Option pictures", value: s.featured },
        { key: "chart", label: "Scatterplot", value: s.chart, disabled: !!summary && !summary.chart },
        {
          key: "parallel",
          label: "Parallel coordinates",
          value: s.parallel,
          disabled: !!summary && !summary.parallel,
        },
        { key: "findings", label: "Findings", value: s.findings },
      ];
    },
    sizeHint() {
      return {
        large: "6 to 12 options, by what else the card shows",
        medium: "more options, in smaller pictures",
        small: "the most options, in the smallest pictures; their notes are left out",
      }[this.settings.pictures];
    },
    hasChart() {
      let s = this.settings;
      let summary = this.summary;
      let chart = s.chart && (!summary || summary.chart);
      let parallel = s.parallel && (!summary || summary.parallel);
      return !!(chart || parallel);
    },
  },
  methods: {
    setSize(size) {
      if (size) this.$store.dispatch("changeSummarySettings", { pictures: size });
    },
    set(key, value) {
      this.$store.dispatch("changeSummarySettings", { [key]: !!value });
    },
  },
};
</script>

<style scoped>
.ssc {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 12px;
}
.ssc-context {
  grid-column: 1 / -1;
  margin-top: 2px;
}
.ssc-hint {
  display: block;
  font-size: 12px;
  line-height: 1.3;
  color: rgba(0, 0, 0, 0.55);
}
.ssc--one {
  display: block;
}
.ssc--one .ssc-context {
  margin-top: 0;
}
.ssc-size {
  margin-top: 6px;
}
.ssc-size-label {
  display: block;
  margin-bottom: 3px;
  font-size: 13px;
  color: rgba(0, 0, 0, 0.7);
}
.ssc-size-toggle .v-btn {
  text-transform: none;
  letter-spacing: 0;
}
.ssc-size .ssc-hint {
  margin-top: 3px;
}
.ssc--row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 0 18px;
}
.ssc--row .ssc-context {
  flex: 1 1 100%;
}
.ssc ::v-deep .v-input--selection-controls {
  margin-top: 4px;
}
</style>
