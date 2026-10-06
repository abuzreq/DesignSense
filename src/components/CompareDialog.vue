<template>
  <v-dialog
    v-model="open"
    max-width="1400"
    width="95%"
    scrollable
    @keydown="onDialogKey"
  >
    <!-- Built only while shown: every row reads every compared option, and
         would otherwise be rebuilt as values change anywhere. -->
    <v-card v-if="contentShown" class="cmp-card">
      <v-card-title class="cmp-title">
        <span class="cmp-title-text">Compare</span>
        <span class="cmp-count">{{ countText }}</span>
        <button
          v-if="sortDim"
          type="button"
          class="cmp-sort-chip"
          title="Back to the order they were picked in"
          @click="clearSort()"
        >
          Sorted by {{ sortLabel }}
          <v-icon x-small>{{
            sortDesc ? "mdi-arrow-down" : "mdi-arrow-up"
          }}</v-icon>
          <v-icon x-small>mdi-close</v-icon>
        </button>
        <v-spacer />
        <v-btn icon small class="ml-2" @click="open = false">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>
      <div v-if="overflowText" class="cmp-overflow">{{ overflowText }}</div>
      <v-divider />

      <v-card-text class="cmp-body">
        <div v-if="columns.length === 0" class="cmp-empty">
          <p class="mb-3">No options left to compare.</p>
          <v-btn small depressed color="primary" @click="open = false"
            >Close</v-btn
          >
        </div>

        <div v-else class="cmp-grid" :style="gridStyle">
          <!-- Names, and the two controls that change what the comparison holds -->
          <div class="cmp-label cmp-head cmp-sort-hint">
            <v-icon x-small>mdi-cursor-default-click-outline</v-icon>
            Sort by a row
          </div>
          <div v-for="col in columns" :key="'head-' + col.id" class="cmp-head">
            <div class="cmp-head-line">
              <span class="cmp-name" :title="col.name">{{ col.name }}</span>
              <TipButton
                small
                small-icon
                :icon="
                  isInCart(col.id)
                    ? 'mdi-bookmark-check'
                    : 'mdi-bookmark-plus-outline'
                "
                :tooltip="
                  isInCart(col.id) ? 'On the shortlist' : 'Add to the shortlist'
                "
                @click="toggleCart(col.id)"
              />
              <TipButton
                small
                small-icon
                icon="mdi-close"
                :tooltip="removeTooltip"
                @click="remove(col.id)"
              />
            </div>
          </div>

          <div class="cmp-label"></div>
          <!-- One wrapper per option: the image switcher and the 3D toggle
               attach here once the compare view offers them. -->
          <div
            v-for="col in columns"
            :key="'image-' + col.id"
            class="cmp-cell cmp-image"
          >
            <v-img
              contain
              height="150"
              :src="failedIds[col.id] ? fallbackImage : imageOf(col)"
              :alt="col.name"
              @error="noteImageFailed(col.id)"
            />
            <!-- Each column keeps its own view, so two options can be compared
                 from the same angle. -->
            <ImageSwitcher
              v-if="viewsOf(col).length > 1"
              :images="viewsOf(col)"
              :index="viewIndex(col)"
              @change="setViewIndex(col.id, $event)"
            />
          </div>

          <button
            type="button"
            class="cmp-label cmp-sortable"
            :class="{ 'cmp-sorted': sortDim === ratingDimension }"
            :title="sortTitle('Your rating', ratingDimension)"
            @click="sortBy(ratingDimension)"
          >
            <span class="cmp-label-text">Your rating</span>
            <v-icon x-small class="cmp-sort-mark">{{
              sortMark(ratingDimension)
            }}</v-icon>
          </button>
          <div
            v-for="col in columns"
            :key="'rating-' + col.id"
            class="cmp-cell cmp-rating"
          >
            <StarRating :item="col.row" @onRatingChanged="rate(col.row, $event)" />
          </div>

          <!-- Notes, where options are weighed against each other. -->
          <div class="cmp-label">
            <span class="cmp-label-text">Your note</span>
          </div>
          <div
            v-for="col in columns"
            :key="'note-' + col.id"
            class="cmp-cell cmp-note"
          >
            <OptionNote :item="col.row" show-text />
          </div>

          <template v-for="block in blocks">
            <div :key="block.key + '-block'" class="cmp-block">
              <button
                v-if="block.collapsible"
                type="button"
                class="cmp-block-text cmp-block-toggle"
                @click="toggleBlock(block.key)"
              >
                <v-icon x-small>{{
                  openBlocks[block.key]
                    ? "mdi-chevron-down"
                    : "mdi-chevron-right"
                }}</v-icon>
                {{ block.title }} ({{ block.rows.length }})
              </button>
              <span v-else class="cmp-block-text">{{ block.title }}</span>
            </div>

            <template v-for="row in rowsOf(block)">
              <button
                :key="row.dim + '-label'"
                type="button"
                class="cmp-label cmp-sortable"
                :class="{
                  'cmp-same': row.same,
                  'cmp-sorted': sortDim === row.dim,
                }"
                :title="sortTitle(row.label, row.dim)"
                @click="sortBy(row.dim)"
              >
                <DimensionName
                  class="cmp-label-text"
                  :name="row.dim"
                  :text="row.label"
                  truncate
                />
                <v-icon x-small class="cmp-sort-mark">{{
                  sortMark(row.dim)
                }}</v-icon>
              </button>
              <div
                v-for="(text, i) in row.texts"
                :key="row.dim + '-' + i"
                class="cmp-cell cmp-value"
                :class="{ 'cmp-same': row.same }"
              >
                <span class="cmp-text">{{ text }}</span>
                <v-tooltip v-if="row.summary.maxIndex === i" bottom>
                  <template v-slot:activator="{ on }">
                    <v-icon x-small class="cmp-mark-high" v-on="on"
                      >mdi-arrow-up</v-icon
                    >
                  </template>
                  <span>highest</span>
                </v-tooltip>
                <v-tooltip v-else-if="row.summary.minIndex === i" bottom>
                  <template v-slot:activator="{ on }">
                    <v-icon x-small class="cmp-mark-low" v-on="on"
                      >mdi-arrow-down</v-icon
                    >
                  </template>
                  <span>lowest</span>
                </v-tooltip>
              </div>
            </template>
          </template>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script>
import { mapGetters, mapState } from "vuex";
import StarRating from "@/components/StarRating.vue";
import OptionNote from "@/components/OptionNote.vue";
import TipButton from "@/components/TipButton.vue";
import ImageSwitcher from "@/components/ImageSwitcher.vue";
import DimensionName from "@/components/DimensionName.vue";
import { FALLBACK_IMAGE } from "@/components/constants.js";
import {
  CUSTOM,
  INPUT,
  OUTPUT,
  WEIGHTED,
  columnKind,
  displayName,
  optionName,
} from "@/columns.js";
import { formatValue } from "@/store/filters.js";
import {
  COMPARE_LIMIT,
  DETAIL_BLACKLIST,
  compareValues,
  isLinkColumn,
  isMissingValue,
  rowSummary,
} from "@/store/compare.js";
import { RATING_DIMENSION } from "@/ratings.js";

/** Dimensions the user built here, rather than columns the file carried. */
function isDerived(kind) {
  return kind === CUSTOM || kind === WEIGHTED;
}

// A little longer than the dialog's fade-out.
const CLOSE_TRANSITION_MS = 400;

/**
 * Several options side by side, a column each: picture, then the outputs, then
 * the inputs. The workspace shows one option at a time, so choosing between a
 * handful of them otherwise means remembering the ones already looked at.
 *
 * Opened through the store's `compareDialog`, over ids resolved when it opened:
 * filtering or zooming underneath never changes what is being compared.
 */
export default {
  name: "CompareDialog",
  components: { DimensionName, ImageSwitcher, OptionNote, StarRating, TipButton },
  data() {
    return {
      // Whether the dialog's content exists: while open, and through the
      // closing transition.
      contentShown: false,
      // Which collapsible blocks are open: the leftovers and the dimensions
      // the user built are the rarer question, so they start folded away.
      openBlocks: { other: false, derived: false },
      // Ids whose picture failed to load, so only those fall back.
      failedIds: {},
      // Which view each column shows, by option id.
      viewIndexById: {},
      // Which dimension orders the columns, and which way. Null is the order
      // the options were picked in, which is what the comparison opens on.
      sortDim: null,
      sortDesc: false,
      ratingDimension: RATING_DIMENSION,
      fallbackImage: FALLBACK_IMAGE,
    };
  },
  beforeDestroy() {
    clearTimeout(this.hideContentTimer);
  },
  computed: {
    ...mapState({
      dialogState: (state) => state.compareDialog,
      allDimensions: (state) => state.allDimensions,
      dimensionValuesVersion: (state) => state.dimensionValuesVersion,
    }),
    ...mapGetters(["rawDataMap", "isInCart", "fixedBoundsOf"]),
    open: {
      get() {
        return this.dialogState.open;
      },
      set(value) {
        if (!value) this.$store.dispatch("closeCompare");
      },
    },
    /** The compared options, over the whole collection so a zoom keeps them. */
    resolved() {
      let map = this.rawDataMap;
      let rows = [];
      this.dialogState.ids.forEach((id) => {
        let row = map[id];
        // An id saved against another dataset has no row; it drops out quietly.
        if (row) rows.push(row);
      });
      return rows;
    },
    /**
     * The columns, in the order they are drawn. Sorting rearranges the options
     * already here rather than reaching past the limit for others: which
     * options are compared is decided by what was picked, and by removing a
     * column to let the next one in.
     */
    columns() {
      // A rating sorted on is a value that changes while the dialog is open.
      void this.dimensionValuesVersion;
      let columns = this.resolved.slice(0, COMPARE_LIMIT).map((row) => ({
        id: String(row._id),
        row: row,
        name: optionName(row),
      }));
      let dim = this.sortDim;
      if (!dim) return columns;
      let direction = this.sortDesc ? -1 : 1;
      // A rating of 0 is an option nobody has rated, not an option rated zero,
      // so it belongs with the blanks rather than at the bottom of the scale.
      let unratedIsMissing = dim === RATING_DIMENSION;
      let missing = (value) =>
        isMissingValue(value) || (unratedIsMissing && !(value > 0));
      return columns
        .map((column, index) => ({ column: column, index: index }))
        .sort((a, b) => {
          let left = a.column.row[dim];
          let right = b.column.row[dim];
          let leftMissing = missing(left);
          let rightMissing = missing(right);
          // An option with no value there sits at the end either way: it is
          // not the smallest, it is unknown.
          if (leftMissing || rightMissing) {
            if (leftMissing && rightMissing) return a.index - b.index;
            return leftMissing ? 1 : -1;
          }
          let order = compareValues(left, right) * direction;
          // Ties keep the order they came in, so sorting never shuffles.
          return order !== 0 ? order : a.index - b.index;
        })
        .map((entry) => entry.column);
    },
    /** What the title bar calls the dimension the columns are ordered by. */
    sortLabel() {
      if (!this.sortDim) return "";
      return this.sortDim === RATING_DIMENSION
        ? "your rating"
        : displayName(this.sortDim);
    },
    gridStyle() {
      return {
        gridTemplateColumns:
          "160px repeat(" + this.columns.length + ", 220px)",
      };
    },
    countText() {
      let count = this.columns.length;
      return count === 1 ? "1 option" : count + " options";
    },
    overflowText() {
      let total = this.resolved.length;
      if (total <= COMPARE_LIMIT) return "";
      return (
        "Showing the first " +
        COMPARE_LIMIT +
        " of " +
        total +
        ". Remove a column to bring in the next."
      );
    },
    removeTooltip() {
      return this.dialogState.source === "cart"
        ? "Remove from the shortlist"
        : "Remove from this comparison";
    },
    /** One row a dimension, with its values already read and formatted. */
    rows() {
      // A rating given in this dialog moves the weighted dimensions it feeds.
      void this.dimensionValuesVersion;
      let columns = this.columns;
      return this.allDimensions
        .filter((dim) => DETAIL_BLACKLIST.indexOf(dim) === -1)
        .filter(
          (dim) => !isLinkColumn(dim, columns.map((col) => col.row[dim]))
        )
        .map((dim) => {
          let summary = rowSummary(columns.map((col) => col.row[dim]));
          return {
            dim: dim,
            kind: columnKind(dim),
            label: displayName(dim),
            texts: columns.map((col) => this.formatParam(col.row, dim)),
            summary: summary,
            // One column agrees with itself; there is nothing to play down.
            same: columns.length > 1 && summary.allEqual,
          };
        });
    },
    /**
     * Outputs first, since they are what an option is judged on, then the
     * inputs that produced them. Anything unprefixed falls to "Other", so a
     * file without in:/out: columns still compares.
     */
    blocks() {
      let rows = this.rows;
      let blocks = [
        {
          key: "derived",
          title: "Custom & weighted",
          // The dimensions the user built are the ones they came to weigh up,
          // so they sit first; folded away until asked for, since most
          // comparisons are about the file's own columns.
          rows: rows.filter((row) => isDerived(row.kind)),
          collapsible: true,
        },
        {
          key: "outputs",
          title: "Outputs",
          rows: rows.filter((row) => row.kind === OUTPUT),
          collapsible: false,
        },
        {
          key: "inputs",
          title: "Inputs",
          rows: rows.filter((row) => row.kind === INPUT),
          collapsible: false,
        },
        {
          key: "other",
          title: "Other",
          rows: rows.filter(
            (row) =>
              row.kind !== OUTPUT && row.kind !== INPUT && !isDerived(row.kind)
          ),
          // Collapsed only when it is the sideshow. A file without "in:" and
          // "out:" columns has nothing else, so folding it away would leave
          // the comparison blank.
          collapsible: rows.some(
            (row) => row.kind === OUTPUT || row.kind === INPUT
          ),
        },
      ];
      return blocks.filter((block) => block.rows.length > 0);
    },
  },
  watch: {
    dialogState(next, previous) {
      let wasOpen = !!previous && previous.open;
      clearTimeout(this.hideContentTimer);
      if (next.open) {
        this.contentShown = true;
        if (!wasOpen) {
          this.failedIds = {};
          this.viewIndexById = {};
          this.sortDim = null;
          this.sortDesc = false;
        }
      } else if (wasOpen) {
        this.hideContentTimer = setTimeout(() => {
          if (!this.dialogState.open) this.contentShown = false;
        }, CLOSE_TRANSITION_MS);
      }
    },
  },
  methods: {
    onDialogKey(e) {
      // The dialog handles Escape itself; keep keys from workspace shortcuts.
      e.stopPropagation();
    },
    rowsOf(block) {
      if (!block.collapsible) return block.rows;
      return this.openBlocks[block.key] ? block.rows : [];
    },
    toggleBlock(key) {
      this.$set(this.openBlocks, key, !this.openBlocks[key]);
    },
    /**
     * Clicking a row orders the columns by it: first smallest, then largest,
     * then back to the order they were picked in -- so the same handle that
     * sorts also undoes it.
     */
    sortBy(dim) {
      if (this.sortDim !== dim) {
        this.sortDim = dim;
        this.sortDesc = false;
      } else if (!this.sortDesc) {
        this.sortDesc = true;
      } else {
        this.clearSort();
      }
    },
    clearSort() {
      this.sortDim = null;
      this.sortDesc = false;
    },
    /**
     * Every row carries the mark, faint until it is the one sorting: a handle
     * nobody can see is a handle nobody uses.
     */
    sortMark(dim) {
      if (this.sortDim !== dim) return "mdi-unfold-more-horizontal";
      return this.sortDesc ? "mdi-arrow-down" : "mdi-arrow-up";
    },
    sortTitle(label, dim) {
      if (this.sortDim !== dim) return "Sort the options by " + label;
      return this.sortDesc
        ? "Back to the order they were picked in"
        : "Sort by " + label + ", largest first";
    },
    /** A value as the gallery's details list shows it; custom and weighted values are rounded. */
    formatParam(item, param) {
      let value = item ? item[param] : undefined;
      let bounds = this.fixedBoundsOf(param);
      if (bounds) {
        return typeof value === "number" && isFinite(value)
          ? formatValue(value, bounds[1] - bounds[0])
          : "—";
      }
      return value;
    },
    viewsOf(col) {
      return col.row.images || [];
    },
    viewIndex(col) {
      let index = this.viewIndexById[col.id] || 0;
      return Math.min(index, Math.max(0, this.viewsOf(col).length - 1));
    },
    imageOf(col) {
      return this.viewsOf(col)[this.viewIndex(col)] || col.row.image;
    },
    setViewIndex(id, index) {
      this.$set(this.viewIndexById, id, index);
      // The new view gets a fresh try at loading.
      this.$set(this.failedIds, id, false);
    },
    noteImageFailed(id) {
      this.$set(this.failedIds, id, true);
    },
    toggleCart(id) {
      this.$store.dispatch("toggleInCart", { id: id });
    },
    remove(id) {
      this.$store.dispatch("removeFromCompare", { id: id });
    },
    rate(row, rating) {
      this.$store.dispatch("rateAlt", { item: row, rating: rating });
    },
  },
};
</script>

<style scoped>
.cmp-title {
  flex-wrap: nowrap;
  padding: 8px 12px 8px 16px !important;
}
.cmp-title-text {
  font-size: 18px;
  font-weight: 500;
}
.cmp-count {
  margin-left: 10px;
  font-size: 13px;
  font-weight: 400;
  color: #546e7a;
}
.cmp-overflow {
  padding: 0 16px 8px;
  font-size: 12px;
  color: #546e7a;
}
/* The columns scroll sideways in here, never the workspace behind. */
.cmp-body {
  max-height: 78vh;
  padding: 0 !important;
  overflow-x: auto;
  overflow-y: auto;
}
.cmp-empty {
  padding: 48px 16px;
  text-align: center;
  color: #546e7a;
}

.cmp-grid {
  display: grid;
  /* Fixed columns, so the grid is wider than the card and scrolls. */
  width: max-content;
  min-width: 100%;
  font-size: 13px;
}
/* The names stay put while the options scroll past them. */
/* A label is a button when it sorts, so it has to give back the look of the
   text it replaced. */
.cmp-sortable {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  text-align: left;
  font: inherit;
  cursor: pointer;
  border-radius: 0;
}
.cmp-sortable:hover {
  background: #f4f7fa;
  color: #37474f;
}
.cmp-sortable:focus-visible {
  outline: 2px solid var(--ds-focus);
  outline-offset: -2px;
}
/* Visible on every row, quiet until it matters. */
.cmp-sort-mark {
  margin-left: auto;
  flex: 0 0 auto;
  opacity: 0.32;
  transition: opacity 120ms ease;
}
.cmp-sortable:hover .cmp-sort-mark {
  opacity: 0.75;
}
.cmp-sorted .cmp-sort-mark {
  opacity: 1;
}
/* Heads the column of row names, so the rows read as handles. */
.cmp-sort-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #90a4ae;
}
.cmp-sort-hint .v-icon {
  color: #b0bec5;
}
.cmp-label-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cmp-sorted {
  color: #1565c0;
  font-weight: 500;
}
.cmp-sorted .v-icon {
  color: #1565c0;
}
/* Says what the order is, and clears it. */
.cmp-sort-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-left: 12px;
  padding: 2px 8px;
  border: 1px solid #cfd8dc;
  border-radius: 12px;
  background: #f5f8fa;
  font-size: 12px;
  color: #546e7a;
  cursor: pointer;
}
.cmp-sort-chip:hover {
  border-color: #90a4ae;
  color: #37474f;
}
.cmp-label {
  position: sticky;
  left: 0;
  z-index: 2;
  background: #fff;
  padding: 6px 10px;
  font-size: 12px;
  color: #546e7a;
  border-right: 1px solid #e3e8ee;
  border-bottom: 1px solid #eceff1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cmp-cell {
  padding: 6px 10px;
  border-bottom: 1px solid #eceff1;
  border-left: 1px solid #eceff1;
}
.cmp-value {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  font-variant-numeric: tabular-nums;
}
.cmp-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* Nothing to choose between on this row, so it recedes. */
.cmp-same {
  opacity: 0.45;
}
/* Which direction is good is the reader's to decide, so neither is coloured. */
.cmp-mark-high {
  color: #546e7a;
}
.cmp-mark-low {
  color: #b0bec5;
}

.cmp-head {
  padding: 6px 4px 6px 10px;
  background: #fff;
  border-bottom: 1px solid #e3e8ee;
}
.cmp-head-line {
  display: flex;
  align-items: center;
  gap: 2px;
}
.cmp-name {
  flex: 1 1 auto;
  min-width: 0;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cmp-image {
  padding: 4px;
  background: #fafbfc;
}
.cmp-rating {
  display: flex;
  justify-content: center;
}
.cmp-note {
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.cmp-block {
  grid-column: 1 / -1;
  padding: 4px 10px;
  background: #f5f7f8;
  border-top: 1px solid #e3e8ee;
  border-bottom: 1px solid #e3e8ee;
}
.cmp-block-text {
  position: sticky;
  left: 0;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #546e7a;
}
.cmp-block-toggle {
  cursor: pointer;
}
</style>
