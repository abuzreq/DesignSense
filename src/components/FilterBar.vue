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
      Brush a chart or drag over images; brush again for OR. Click a point, line or image to inspect.
    </span>

    <!-- As many chips as fit whole, then "+N" for the rest, which lists them
         all. A row that scrolled sideways put a scrollbar inside the bar. -->
    <div
      ref="chips"
      class="filter-chips"
      :class="{ 'filter-chips--on': filterChips.length > 0 }"
    >
      <span
        v-for="(chip, chipIndex) in filterChips"
        :key="chip.key"
        class="filter-piece"
        :class="{ 'filter-piece--over': isOver(chipIndex) }"
      >
        <!-- Several brushes on one dimension: one chip each, OR-ed, each with its own close. -->
        <span
          v-if="chip.boxes && chip.boxes.length > 1"
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
        <v-tooltip v-else bottom max-width="360">
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
      </span>

      <v-menu v-if="hiddenChips.length > 0" bottom offset-y max-width="460">
        <template v-slot:activator="{ on }">
          <span
            v-on="on"
            class="filter-more"
            role="button"
            tabindex="0"
            aria-haspopup="true"
            :title="hiddenChips.map((chip) => chip.text).join(' · ')"
            >{{
              fitCount === 0
                ? hiddenChips.length + (hiddenChips.length === 1 ? " filter" : " filters")
                : "+" + hiddenChips.length
            }}</span
          >
        </template>
        <v-card class="filter-more-panel">
          <div class="filter-more-head">
            {{ fitCount === 0 ? "Your filters" : "More filters" }}
          </div>
          <div class="filter-more-chips">
            <template v-for="chip in hiddenChips">
              <template v-if="chip.boxes && chip.boxes.length > 1">
                <v-chip
                  v-for="(box, index) in chip.boxes"
                  :key="chip.key + '-' + index"
                  small
                  close
                  :color="chipColor(chip)"
                  text-color="white"
                  :title="box.title"
                  @click:close="removeFilterBox(chip.key, index)"
                  >{{ index > 0 ? "OR " : "" }}{{ box.text }}</v-chip
                >
              </template>
              <v-chip
                v-else
                :key="chip.key"
                small
                close
                :color="chipColor(chip)"
                text-color="white"
                :title="chip.title"
                @click:close="removeFilter(chip.key)"
              >
                <v-icon v-if="chipIcon(chip)" left small>{{ chipIcon(chip) }}</v-icon>
                {{ chip.text }}
              </v-chip>
            </template>
          </div>
        </v-card>
      </v-menu>
    </div>

    <span v-if="hasNoMatches" class="filter-hint filter-hint--warn">
      No matches. Remove a filter.
    </span>
    <!-- Undo, redo and clear follow in the toolbar, in the same place as
         Expert's, so switching modes doesn't move them. -->
  </div>
</template>

<script>
import { mapGetters, mapState } from "vuex";

// Between chips, and the room kept for a "+N" before it has been drawn.
const GAP = 4;
const PILL_WIDTH = 30;

const CHIP_COLORS = {
  range: "blue darken-2",
  gallery: "green darken-3",
  scope: "blue-grey darken-1",
  members: "deep-orange darken-3",
};

export default {
  name: "FilterBar",
  data() {
    // How many chips fit whole; null while they all do.
    return { fitCount: null };
  },
  mounted() {
    if (typeof ResizeObserver === "undefined") return;
    // A frame later: working out the fit in the observer's own callback
    // would change the row in the frame it reported, a ResizeObserver loop.
    this.resizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(this.measureFrame);
      this.measureFrame = requestAnimationFrame(() => this.measure());
    });
    this.resizeObserver.observe(this.$refs.chips);
    this.measure();
  },
  updated() {
    this.measure();
  },
  beforeDestroy() {
    if (this.resizeObserver) this.resizeObserver.disconnect();
    cancelAnimationFrame(this.measureFrame);
  },
  computed: {
    ...mapState({
      data: (state) => state.data,
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
    hiddenChips() {
      return this.fitCount === null ? [] : this.filterChips.slice(this.fitCount);
    },
    matchingSetName() {
      if (this.matchingSetID === null) return null;
      let metadata = this.setsMetadataMap[this.matchingSetID];
      return metadata ? metadata.name : this.matchingSetID;
    },
  },
  methods: {
    /**
     * How many chips fit whole in the row. Those that don't are taken out of
     * the flow but keep their width, so they measure the same shown or not,
     * and the row's own width doesn't depend on them: this can't loop.
     */
    measure() {
      let el = this.$refs.chips;
      if (!el) return;
      let pieces = Array.from(el.querySelectorAll(".filter-piece"));
      let pill = el.querySelector(".filter-more");
      let pillWidth = pill ? pill.getBoundingClientRect().width : 0;
      let available = el.clientWidth - 1;
      let widths = pieces.map((piece) => piece.getBoundingClientRect().width);
      // Only a change is worked out again.
      let key = available + "|" + pillWidth + "|" + widths.join(",");
      if (key === this.measuredKey) return;
      this.measuredKey = key;
      let total = widths.reduce((sum, w) => sum + w + GAP, -GAP);
      let fit = null;
      if (total > available) {
        // While nothing fits the pill reads "N filters", too wide to go by.
        let plus = pill && this.fitCount !== 0 ? pillWidth : PILL_WIDTH;
        let room = available - plus - GAP;
        let used = -GAP;
        fit = 0;
        while (fit < widths.length && used + GAP + widths[fit] <= room) {
          used += GAP + widths[fit];
          fit += 1;
        }
      }
      if (fit !== this.fitCount) this.fitCount = fit;
    },
    isOver(index) {
      return this.fitCount !== null && index >= this.fitCount;
    },
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
/* With chips, the row takes the bar's spare room whatever they need, so
   which of them fit never changes its size. A fixed height for the same
   reason. */
.filter-chips {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 0;
  min-width: 0;
  height: 26px;
  overflow: hidden;
}
.filter-chips--on {
  flex: 1 1 0;
}
.filter-piece {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
}
/* Left out of the row, yet still measured at its own width. */
.filter-piece--over {
  position: absolute !important;
  width: max-content;
  visibility: hidden;
  pointer-events: none;
}
.filter-more {
  flex: 0 0 auto;
  padding: 0 7px;
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-radius: 10px;
  font-size: 11px;
  line-height: 16px;
  white-space: nowrap;
  cursor: pointer;
}
.filter-more-panel {
  padding: 10px 12px;
}
.filter-more-head {
  margin-bottom: 8px;
  font-size: 13px;
}
.filter-more-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
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
