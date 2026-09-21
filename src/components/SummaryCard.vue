<template>
  <div class="summary-card" :style="{ width: width + 'px', height: height + 'px' }">
    <header class="sc-head">
      <div class="sc-titles">
        <h1 class="sc-title">{{ title }}</h1>
        <div class="sc-subtitle">{{ subtitle }}</div>
      </div>
      <div v-if="show.goals && summary.goals.length > 0" class="sc-goals">
        <div class="sc-label">What we're after</div>
        <div class="sc-chips">
          <span v-for="goal in summary.goals" :key="goal.dim" class="sc-chip" :title="goal.title">
            <b>{{ goal.mark }}</b> {{ goal.name }}
          </span>
        </div>
      </div>
    </header>

    <div
      class="sc-body"
      :class="{
        'no-featured': !hasFeatured,
        'two-charts': twoCharts,
        'no-findings': !showFindings,
        'no-side': !hasSide,
      }"
    >
      <section v-if="hasFeatured" class="sc-featured">
        <div class="sc-label">{{ featuredLabel }}</div>
        <div class="sc-grid" :class="['n' + items.length, 'size-' + layout.size]" :style="gridStyle">
          <div v-for="item in items" :key="item.id" class="sc-option">
            <div class="sc-image">
              <img v-if="images[item.id]" :src="images[item.id]" alt="" />
              <div v-else class="sc-noimage">{{ item.name }}</div>
              <span v-if="item.onFront" class="sc-badge">Best trade-off</span>
            </div>
            <div class="sc-name">{{ item.name }}</div>
            <div class="sc-values">
              <span v-for="v in item.values" :key="v.dim" class="sc-value">
                <span class="sc-vname">{{ v.name }}{{ v.mark ? " " + v.mark : "" }}</span>
                <span class="sc-vtext">{{ v.text }}</span>
              </span>
            </div>
            <div v-if="noteOf(item)" class="sc-note">“{{ noteOf(item) }}”</div>
          </div>
        </div>
      </section>

      <section v-if="hasSide" ref="side" class="sc-side">
        <div v-if="showScatter || showParallel" class="sc-charts">
          <SummaryChart
            v-if="showScatter"
            :chart="summary.chart"
            :context="showContext"
            :highlight="showHighlight"
            :ringed="ringed"
            :width="chartSize.width"
            :height="chartSize.scatter"
          />
          <SummaryParallel
            v-if="showParallel"
            :parallel="summary.parallel"
            :context="showContext"
            :highlight="showHighlight"
            :ringed="ringed"
            :width="chartSize.width"
            :height="chartSize.parallel"
          />
          <div class="sc-legend">
            <span v-if="showContext"><i class="lg rest"></i>Other options</span>
            <span><i class="lg selected"></i>{{ featuredWord }}</span>
            <span v-if="hasFeatured && showHighlight"><i class="lg featured"></i>On the card</span>
            <span v-if="showScatter && summary.chart.steps.length > 1"
              ><i class="lg front"></i>Best trade-offs</span
            >
            <span v-if="showParallel">Parallel axes: better at the top</span>
          </div>
        </div>
        <div
          v-if="showFindings"
          class="sc-findings"
          :style="{ fontSize: fontSize + 'px' }"
        >
          <div class="sc-label">Key findings</div>
          <ul>
            <li v-for="s in sentences" :key="s.id">{{ s.text }}</li>
          </ul>
        </div>
      </section>
    </div>

    <footer class="sc-foot">{{ footer }}</footer>
  </div>
</template>

<script>
import SummaryChart from "@/components/SummaryChart.vue";
import SummaryParallel from "@/components/SummaryParallel.vue";

export const CARD_WIDTH = 1600;
export const CARD_HEIGHT = 900;
// The findings' text size, shrunk as far as MIN_FONT when a long edit needs it.
const MAX_FONT = 17;
const MIN_FONT = 12;

/**
 * How many options the card has room for: beside the charts and the
 * findings, 6; with the findings left out, 9 beside the charts; with nothing
 * beside them, 12 across the card. The dialog and the report ask it too.
 */
export function cardCapacity(show, summary, findingsCount) {
  return cardLayout(show, summary, findingsCount).capacity;
}

/*
 * Grids for smaller pictures, by how much of the card the options have:
 * "narrow" beside both charts and the findings, "normal" beside the side
 * column, "wide" across the whole card. Each fills the room at its size.
 */
const SMALLER = {
  narrow: { medium: { cols: 3, rows: 4 }, small: { cols: 4, rows: 5 } },
  normal: { medium: { cols: 5, rows: 4 }, small: { cols: 6, rows: 5 } },
  wide: { medium: { cols: 8, rows: 4 }, small: { cols: 10, rows: 5 } },
};

/**
 * How the card lays out its options: `{ size, area, grid, capacity }`. Large
 * pictures keep the layouts made for them (6 beside the findings, 9 beside
 * the charts alone, 12 across the card); medium and small fill a grid of
 * their own, fitting more at the expense of their size.
 */
export function cardLayout(show, summary, findingsCount) {
  let scatter = !!(show.chart && summary.chart);
  let parallel = !!(show.parallel && summary.parallel);
  let findings = !!show.findings && findingsCount > 0;
  let charts = scatter || parallel;
  let area = !charts && !findings ? "wide" : scatter && parallel && findings ? "narrow" : "normal";
  let size = SMALLER.normal[show.pictures] ? show.pictures : "large";
  if (size === "large") {
    return { size: size, area: area, grid: null, capacity: findings ? 6 : charts ? 9 : 12 };
  }
  let grid = SMALLER[area][size];
  return { size: size, area: area, grid: grid, capacity: grid.cols * grid.rows };
}

/**
 * The options the card pictures: the ones picked, in the order picked, or
 * the first of the candidates; never more than it has room for.
 */
export function cardItems(summary, picked, capacity) {
  let listed = summary.featured.items;
  if (!picked) return listed.slice(0, capacity);
  let byId = new Map(listed.map((item) => [item.id, item]));
  return picked
    .map((id) => byId.get(id))
    .filter(Boolean)
    .slice(0, capacity);
}

/**
 * The one-image summary: a fixed-size card meant to be turned into a PNG and
 * pasted into a slide, an email or a chat. Plain HTML without Vuetify, so
 * what is drawn is exactly what is exported.
 */
export default {
  name: "SummaryCard",
  components: { SummaryChart, SummaryParallel },
  props: {
    // From story/narrate.js's summarize.
    summary: { type: Object, required: true },
    title: { type: String, default: "" },
    // The sentences as shown, after the user's edits: [{ id, text }].
    sentences: { type: Array, default: () => [] },
    // Which sections are shown: { goals, featured, chart, parallel, findings,
    // context, highlight }, chart being the scatterplot, parallel the parallel
    // coordinates, context the other options behind the result in both, and
    // highlight the shortlist or set ringed there (see summarySettings.js).
    show: {
      type: Object,
      default: () => ({ goals: true, featured: true, chart: true, parallel: false, findings: true }),
    },
    // The ids of the options the user picked for the card, in order; null
    // for the first of the shortlist or set.
    picked: { type: Array, default: null },
    // id -> the image as a data URL, or null when it couldn't be read.
    images: { type: Object, default: () => ({}) },
    // A report's page number goes here.
    footer: { type: String, default: "Made with DesignSense" },
    width: { type: Number, default: CARD_WIDTH },
    height: { type: Number, default: CARD_HEIGHT },
  },
  computed: {
    subtitle() {
      return this.summary.subtitle;
    },
    showFindings() {
      return !!this.show.findings && this.sentences.length > 0;
    },
    hasSide() {
      return this.showScatter || this.showParallel || this.showFindings;
    },
    layout() {
      return cardLayout(this.show, this.summary, this.sentences.length);
    },
    capacity() {
      return this.layout.capacity;
    },
    // Smaller pictures set their own columns; large ones keep the classes'.
    gridStyle() {
      let grid = this.layout.grid;
      return grid ? { gridTemplateColumns: "repeat(" + grid.cols + ", minmax(0, 1fr))" } : null;
    },
    items() {
      return cardItems(this.summary, this.picked, this.capacity);
    },
    /** "Shortlist (9 of 14)" when the card pictures only some of them. */
    featuredLabel() {
      let label = this.summary.featured.label;
      let total = this.summary.featured.total || this.items.length;
      return this.items.length < total ? label + " (" + this.items.length + " of " + total + ")" : label;
    },
    showHighlight() {
      return this.show.highlight !== false;
    },
    // The charts mark the options on the card, so they follow what is picked.
    ringed() {
      return this.hasFeatured ? new Set(this.items.map((item) => item.row)) : new Set();
    },
    hasFeatured() {
      return this.show.featured && this.items.length > 0;
    },
    featuredWord() {
      return this.summary.featured.legend;
    },
    showScatter() {
      return !!(this.show.chart && this.summary.chart);
    },
    showContext() {
      return this.show.context !== false;
    },
    showParallel() {
      return !!(this.show.parallel && this.summary.parallel);
    },
    twoCharts() {
      return this.showScatter && this.showParallel;
    },
    /** The charts' width and each one's height, for the layout in use. */
    chartSize() {
      // Each chart keeps its size whether or not the other is shown: the room
      // of one left out goes to the findings, not to stretching the other.
      if (this.hasFeatured && !this.showFindings) {
        return { width: 600, scatter: 340, parallel: 300 };
      }
      if (this.twoCharts) {
        return this.hasFeatured
          ? { width: 540, scatter: 290, parallel: 270 }
          : { width: 760, scatter: 300, parallel: 280 };
      }
      return this.hasFeatured
        ? { width: 600, scatter: 340, parallel: 300 }
        : { width: 860, scatter: 400, parallel: 340 };
    },
    // What changes how much room the findings need.
    fitKey() {
      return JSON.stringify([this.sentences.map((s) => s.text), this.show, this.picked]);
    },
  },
  watch: {
    fitKey() {
      this.fontSize = MAX_FONT;
      this.$nextTick(() => this.fit());
    },
  },
  data() {
    return { fontSize: MAX_FONT };
  },
  mounted() {
    this.$nextTick(() => this.fit());
  },
  methods: {
    /** The user's note on a featured option (see optionNotes.js), or "". */
    noteOf(item) {
      let notes = this.$store && this.$store.state.optionNotes;
      return (notes && notes[String(item.id)]) || "";
    },
    /** Shrinks the findings a step at a time until the column holds them. */
    fit() {
      let side = this.$refs.side;
      if (!side || this.fontSize <= MIN_FONT) return;
      if (side.scrollHeight > side.clientHeight + 1 || side.scrollWidth > side.clientWidth + 1) {
        this.fontSize -= 1;
        this.$nextTick(() => this.fit());
      }
    },
  },
};
</script>

<style scoped>
.summary-card {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  padding: 26px 36px 14px;
  background: #ffffff;
  color: #263238;
  font-family: Roboto, "Segoe UI", Arial, sans-serif;
  overflow: hidden;
}
.sc-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 32px;
  padding-bottom: 12px;
  border-bottom: 3px solid #263238;
}
.sc-title {
  margin: 0;
  font-size: 40px;
  line-height: 1.15;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.sc-subtitle {
  margin-top: 2px;
  font-size: 18px;
  color: #607d8b;
}
.sc-goals {
  flex: 0 1 560px;
  text-align: right;
}
.sc-chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}
.sc-chip {
  padding: 5px 14px;
  border-radius: 16px;
  background: #eceff1;
  font-size: 17px;
  white-space: nowrap;
}
.sc-label {
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #78909c;
}
.sc-body {
  flex: 1;
  display: flex;
  gap: 28px;
  padding-top: 16px;
  min-height: 0;
}
.sc-featured {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
}
/* Two lines at most: the card has no room to grow. */
.sc-note {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-top: 3px;
  font-size: 14px;
  font-style: italic;
  line-height: 1.3;
  color: #5d4037;
}
.sc-side {
  flex: 0 0 600px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 0;
  overflow: hidden;
}
.no-featured .sc-side,
.two-charts .sc-side {
  flex: 1 1 auto;
  flex-direction: row;
  gap: 28px;
}
.two-charts:not(.no-featured) .sc-side {
  flex: 0 0 940px;
}
.no-featured .sc-findings,
.two-charts .sc-findings {
  flex: 1;
  min-width: 0;
}
.sc-charts {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
/* Beside two charts the options take two columns, in wide pictures. */
.two-charts:not(.no-featured) .sc-grid {
  grid-template-columns: repeat(2, 1fr);
}
.two-charts:not(.no-featured) .sc-image {
  aspect-ratio: 16 / 9;
}
/* Three rows of them need shorter pictures to fit. */
.two-charts:not(.no-featured) .sc-grid.n5 .sc-image,
.two-charts:not(.no-featured) .sc-grid.n6 .sc-image {
  aspect-ratio: 9 / 4;
}
/* Without the findings, the charts stack in the side column. */
.no-findings:not(.no-featured) .sc-side,
.two-charts.no-findings:not(.no-featured) .sc-side {
  flex: 0 0 600px;
  flex-direction: column;
}
.no-side .sc-featured {
  flex: 1 1 100%;
}
/* Seven to nine beside the charts: three across, in wide pictures. */
.sc-grid.n7 .sc-image,
.sc-grid.n8 .sc-image,
.sc-grid.n9 .sc-image {
  aspect-ratio: 16 / 9;
}
/* Across the whole card: four across, then six for more than eight. */
.no-side .sc-grid {
  grid-template-columns: repeat(4, 1fr);
}
.no-side .sc-grid.n1,
.no-side .sc-grid.n2,
.no-side .sc-grid.n3 {
  grid-template-columns: repeat(3, 1fr);
}
.no-side .sc-grid.n9,
.no-side .sc-grid.n10,
.no-side .sc-grid.n11,
.no-side .sc-grid.n12 {
  grid-template-columns: repeat(6, 1fr);
}
.no-side .sc-grid .sc-image {
  aspect-ratio: 4 / 3;
}
.sc-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
}
.sc-grid.n1,
.sc-grid.n2,
.sc-grid.n4 {
  grid-template-columns: repeat(2, 1fr);
}
.sc-grid.n1 .sc-option {
  grid-column: span 1;
}
.sc-option {
  min-width: 0;
}
.sc-image {
  position: relative;
  aspect-ratio: 4 / 3;
  border-radius: 6px;
  overflow: hidden;
  background: #f5f7f8;
  border: 1px solid #e0e6e9;
}
.sc-grid.n4 .sc-image,
.sc-grid.n2 .sc-image,
.sc-grid.n1 .sc-image {
  aspect-ratio: 16 / 9;
}
.sc-image img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}
.sc-noimage {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 16px;
  color: #90a4ae;
}
.sc-badge {
  position: absolute;
  left: 8px;
  top: 8px;
  padding: 3px 10px;
  border-radius: 12px;
  background: #263238;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
}
.sc-name {
  margin-top: 8px;
  font-size: 17px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sc-values {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 14px;
  margin-top: 2px;
  font-size: 15px;
}
.sc-vname {
  color: #78909c;
  margin-right: 5px;
}
.sc-vtext {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.sc-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin: 4px 0 0 64px;
  font-size: 13px;
  color: #607d8b;
}
.lg {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 6px;
  border-radius: 50%;
  vertical-align: -1px;
}
.lg.rest {
  background: #cfd8dc;
}
.lg.selected {
  background: #4e79a7;
}
.lg.featured {
  border: 2.5px solid #ef6c00;
  box-sizing: border-box;
}
.lg.front {
  width: 18px;
  height: 0;
  border-radius: 0;
  border-top: 2px dashed #263238;
  vertical-align: 3px;
}
/* Both charts but no findings: the charts stack, so the options keep three
   across as beside one chart. */
.two-charts.no-findings:not(.no-featured) .sc-grid {
  grid-template-columns: repeat(3, 1fr);
}
.two-charts.no-findings:not(.no-featured) .sc-grid .sc-image {
  aspect-ratio: 16 / 9;
}
/* Smaller pictures: wide, with smaller text and gaps. Specific enough to
   win over the large layouts' rules above, which they replace. */
.summary-card .sc-body .sc-grid.size-medium,
.summary-card .sc-body .sc-grid.size-small {
  gap: 12px;
}
.summary-card .sc-body .sc-grid.size-small {
  gap: 10px 8px;
}
.summary-card .sc-body .sc-grid.size-medium .sc-image,
.summary-card .sc-body .sc-grid.size-small .sc-image {
  aspect-ratio: 16 / 9;
}
.size-medium .sc-name {
  margin-top: 5px;
  font-size: 15px;
}
.size-medium .sc-values {
  gap: 0 10px;
  font-size: 13px;
}
.size-medium .sc-note {
  -webkit-line-clamp: 1;
  font-size: 13px;
}
.size-small .sc-name {
  margin-top: 4px;
  font-size: 13px;
}
.size-small .sc-values {
  gap: 0 8px;
  font-size: 11px;
}
.size-small .sc-note {
  display: none;
}
.size-medium .sc-badge,
.size-small .sc-badge {
  left: 4px;
  top: 4px;
  padding: 1px 6px;
  font-size: 11px;
}
.size-small .sc-noimage {
  font-size: 12px;
}
.sc-findings ul {
  margin: 0;
  padding-left: 22px;
}
.sc-findings li {
  margin-bottom: 0.45em;
  line-height: 1.4;
}
.sc-foot {
  padding-top: 4px;
  font-size: 13px;
  color: #90a4ae;
  text-align: right;
}
</style>
