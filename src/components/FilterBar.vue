<template>
  <div class="filter-bar">
    <v-tooltip bottom>
      <template v-slot:activator="{ on }">
        <div
          v-on="on"
          class="filter-count"
          :class="{ 'filter-count--none': hasNoMatches }"
        >
          <strong>{{ matchCount.toLocaleString() }}</strong>
          of {{ totalCount.toLocaleString() }} options
        </div>
      </template>
      <span>{{ countTooltip }}</span>
    </v-tooltip>

    <v-tooltip v-if="matchingSetName" bottom>
      <template v-slot:activator="{ on }">
        <div v-on="on" class="filter-set">
          <v-icon small color="green lighten-2">mdi-bookmark-check</v-icon>
          <span class="filter-set-name">{{ matchingSetName }}</span>
        </div>
      </template>
      <span>These are the filters saved in {{ matchingSetName }}</span>
    </v-tooltip>

    <span v-if="filterChips.length === 0" class="filter-hint">
      Brush a chart or drag over images; brush again for OR. Click a point to inspect.
    </span>

    <div class="filter-chips">
      <template v-for="chip in filterChips">
        <!-- Several brushes on one dimension: one chip each, OR-ed, each with its own close. -->
        <span
          v-if="chip.boxes && chip.boxes.length > 1"
          :key="chip.key"
          class="filter-chip-group"
        >
          <template v-for="(box, index) in chip.boxes">
            <span v-if="index > 0" :key="chip.key + '-or-' + index" class="filter-chip-or">OR</span>
            <v-tooltip :key="chip.key + '-' + index" bottom max-width="360">
              <template v-slot:activator="{ on }">
                <v-chip
                  v-on="on"
                  small
                  close
                  class="filter-chip"
                  :color="chipColor(chip)"
                  text-color="white"
                  @click:close="removeFilterBox(chip.key, index)"
                >
                  <span class="filter-chip-text">{{ box.text }}</span>
                </v-chip>
              </template>
              <span>{{ box.title }}. Remove to drop this brush only.</span>
            </v-tooltip>
          </template>
        </span>
        <v-tooltip v-else :key="chip.key" bottom max-width="360">
          <template v-slot:activator="{ on }">
            <v-chip
              v-on="on"
              small
              close
              class="filter-chip"
              :color="chipColor(chip)"
              text-color="white"
              @click:close="removeFilter(chip.key)"
            >
              <v-icon v-if="chipIcon(chip)" left small>{{ chipIcon(chip) }}</v-icon>
              <span class="filter-chip-text">{{ chip.text }}</span>
            </v-chip>
          </template>
          <span>{{ chip.title }}</span>
        </v-tooltip>
      </template>
    </div>

    <span v-if="hasNoMatches" class="filter-hint filter-hint--warn">
      No matches. Remove a filter.
    </span>

    <v-tooltip bottom>
      <template v-slot:activator="{ on }">
        <!-- A disabled button swallows pointer events, so the span carries the tooltip. -->
        <span v-on="on">
          <v-btn
            icon
            small
            :disabled="filterHistory.length === 0"
            @click="$store.dispatch('undo')"
          >
            <v-icon small>mdi-undo</v-icon>
          </v-btn>
        </span>
      </template>
      <span>Undo the last filter change [Ctrl+Z]</span>
    </v-tooltip>
    <v-tooltip bottom>
      <template v-slot:activator="{ on }">
        <span v-on="on">
          <v-btn
            icon
            small
            :disabled="filterFuture.length === 0"
            @click="$store.dispatch('redo')"
          >
            <v-icon small>mdi-redo</v-icon>
          </v-btn>
        </span>
      </template>
      <span>Redo [Ctrl+Y]</span>
    </v-tooltip>
    <v-tooltip v-if="isFilterActive" bottom>
      <template v-slot:activator="{ on }">
        <v-btn v-on="on" small text @click="$store.dispatch('clearFilters')">
          Clear filters
        </v-btn>
      </template>
      <span
        >Remove every filter [Esc]{{
          hasScope ? ". The zoom stays; Reset shows the full collection." : ""
        }}</span
      >
    </v-tooltip>
  </div>
</template>

<script>
import { mapGetters, mapState } from "vuex";

const CHIP_COLORS = {
  range: "blue darken-2",
  gallery: "green darken-2",
  scope: "blue-grey darken-1",
  members: "deep-orange darken-2",
};

export default {
  name: "FilterBar",
  computed: {
    ...mapState({
      data: (state) => state.data,
      filterHistory: (state) => state.filterHistory,
      filterFuture: (state) => state.filterFuture,
      setsMetadataMap: (state) => state.setsMetadataMap,
    }),
    ...mapGetters([
      "filterChips",
      "hasScope",
      "isFilterActive",
      "matchingSetID",
      "selectionCount",
    ]),
    totalCount() {
      return this.data ? this.data.length : 0;
    },
    matchCount() {
      return this.isFilterActive ? this.selectionCount : this.totalCount;
    },
    hasNoMatches() {
      return this.isFilterActive && this.matchCount === 0;
    },
    countTooltip() {
      return this.hasScope
        ? "Options matching your filters, out of those you zoomed in on"
        : "Options matching your filters, out of the whole collection";
    },
    matchingSetName() {
      if (this.matchingSetID === null) return null;
      let metadata = this.setsMetadataMap[this.matchingSetID];
      return metadata ? metadata.name : this.matchingSetID;
    },
  },
  methods: {
    chipColor(chip) {
      return CHIP_COLORS[chip.tone];
    },
    chipIcon(chip) {
      if (chip.tone !== "scope") return null;
      return chip.kind === "members"
        ? "mdi-magnify-plus-outline"
        : "mdi-filter-remove-outline";
    },
    removeFilter(key) {
      this.$store.dispatch("removeFilter", { key: key });
    },
    removeFilterBox(key, index) {
      this.$store.dispatch("removeFilterBox", { key: key, index: index });
    },
  },
};
</script>

<style scoped>
.filter-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 0;
  width: 100%;
}
.filter-count {
  font-size: 13px;
  white-space: nowrap;
}
.filter-count--none strong {
  color: #ffab91;
}
.filter-set {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 12px;
  white-space: nowrap;
}
.filter-set-name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.filter-hint {
  font-size: 12px;
  opacity: 0.75;
  white-space: nowrap;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.filter-hint--warn {
  color: #ffab91;
  opacity: 1;
}
.filter-chips {
  display: flex;
  gap: 4px;
  min-width: 0;
  overflow-x: auto;
}
.filter-chip {
  flex: 0 0 auto;
}
/* Brushes OR-ed on one dimension read as one unit: a bordered pill of chips. */
.filter-chip-group {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 2px;
  padding: 1px 2px;
  border: 1px solid rgba(255, 255, 255, 0.45);
  border-radius: 16px;
}
.filter-chip-or {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  opacity: 0.85;
  padding: 0 1px;
}
.filter-chip-text {
  display: inline-block;
  max-width: 190px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
