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

    <div class="sc-body" :class="{ 'no-featured': !hasFeatured, 'two-charts': twoCharts }">
      <section v-if="hasFeatured" class="sc-featured">
        <div class="sc-label">{{ summary.featured.label }}</div>
        <div class="sc-grid" :class="'n' + items.length">
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
          </div>
        </div>
      </section>

      <section ref="side" class="sc-side">
        <div v-if="showScatter || showParallel" class="sc-charts">
          <SummaryChart
            v-if="showScatter"
            :chart="summary.chart"
            :width="chartSize.width"
            :height="chartSize.scatter"
          />
          <SummaryParallel
            v-if="showParallel"
            :parallel="summary.parallel"
            :width="chartSize.width"
            :height="chartSize.parallel"
          />
          <div class="sc-legend">
            <span><i class="lg rest"></i>Other options</span>
            <span><i class="lg selected"></i>In the result</span>
            <span v-if="hasFeatured"><i class="lg featured"></i>{{ featuredWord }}</span>
            <span v-if="showScatter && summary.chart.steps.length > 1"
              ><i class="lg front"></i>Best trade-offs</span
            >
            <span v-if="showParallel">Parallel axes: better at the top</span>
          </div>
        </div>
        <div
          v-if="show.findings && sentences.length > 0"
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
    // Which sections are shown: { goals, featured, chart, parallel, findings },
    // chart being the scatterplot and parallel the parallel coordinates.
    show: {
      type: Object,
      default: () => ({ goals: true, featured: true, chart: true, parallel: false, findings: true }),
    },
    // Featured options' ids left out by the user.
    hidden: { type: Array, default: () => [] },
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
    items() {
      return this.summary.featured.items.filter((item) => this.hidden.indexOf(item.id) === -1);
    },
    hasFeatured() {
      return this.show.featured && this.items.length > 0;
    },
    featuredWord() {
      return this.summary.featured.source === "shortlist" ? "Shortlisted" : "Featured";
    },
    showScatter() {
      return !!(this.show.chart && this.summary.chart);
    },
    showParallel() {
      return !!(this.show.parallel && this.summary.parallel);
    },
    twoCharts() {
      return this.showScatter && this.showParallel;
    },
    /** The charts' width and each one's height, for the layout in use. */
    chartSize() {
      if (this.twoCharts) {
        return this.hasFeatured
          ? { width: 540, scatter: 290, parallel: 270 }
          : { width: 760, scatter: 300, parallel: 280 };
      }
      return this.hasFeatured
        ? { width: 600, scatter: 340, parallel: 340 }
        : { width: 860, scatter: 540, parallel: 500 };
    },
    // What changes how much room the findings need.
    fitKey() {
      return JSON.stringify([this.sentences.map((s) => s.text), this.show, this.hidden]);
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
  padding: 44px 56px 28px;
  background: #ffffff;
  color: #263238;
  font-family: Roboto, "Segoe UI", Arial, sans-serif;
  overflow: hidden;
}
.sc-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 40px;
  padding-bottom: 20px;
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
  margin-top: 8px;
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
  gap: 40px;
  padding-top: 26px;
  min-height: 0;
}
.sc-featured {
  flex: 1 1 auto;
  min-width: 0;
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
.sc-findings ul {
  margin: 0;
  padding-left: 22px;
}
.sc-findings li {
  margin-bottom: 0.45em;
  line-height: 1.4;
}
.sc-foot {
  padding-top: 10px;
  font-size: 13px;
  color: #90a4ae;
  text-align: right;
}
</style>
