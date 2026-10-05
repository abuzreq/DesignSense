<template>
  <div class="lv lv-weights">
    <div class="lv-choices" role="group" aria-label="A weighting to start from">
      <button
        v-for="view in views"
        :key="view.id"
        type="button"
        class="lv-choice"
        :class="{ 'lv-choice--on': isView(view) }"
        :aria-pressed="String(isView(view))"
        @click="take(view)"
      >
        {{ view.name }}
      </button>
    </div>

    <div class="lv-sliders">
      <label v-for="(goal, g) in goals" :key="goal.dim" class="lv-slider">
        <span class="lv-slider-name">
          {{ goal.name }}
          <small>{{ goal.says }}</small>
        </span>
        <input
          v-model.number="weights[g]"
          type="range"
          min="0"
          max="10"
          step="1"
          :aria-label="'Weight of ' + goal.name"
        />
        <span class="lv-share">{{ Math.round(shares[g] * 100) }}%</span>
      </label>
    </div>

    <div class="lv-table" role="table" aria-label="The options, best score first">
      <div class="lv-row lv-row--head" role="row">
        <span role="columnheader">#</span>
        <span role="columnheader">Option</span>
        <span v-for="goal in goals" :key="goal.dim" role="columnheader" class="lv-num">
          {{ goal.name }}
        </span>
        <span role="columnheader">Score</span>
      </div>
      <transition-group name="lv-rank" tag="div">
        <div
          v-for="(row, place) in ranked"
          :key="row.name"
          class="lv-row"
          :class="{ 'lv-row--top': place === 0 && row.score !== undefined }"
          role="row"
        >
          <span role="cell" class="lv-place">{{ row.score === undefined ? "–" : place + 1 }}</span>
          <span role="cell" class="lv-option">{{ row.name }}</span>
          <span v-for="goal in goals" :key="goal.dim" role="cell" class="lv-num">
            {{ row[goal.dim].toLocaleString() }}<small>{{ goal.unit }}</small>
          </span>
          <span role="cell" class="lv-score">
            <span class="lv-bar"><span :style="{ width: barOf(row) }"></span></span>
            <span class="lv-score-value">{{ row.score === undefined ? "–" : row.score.toFixed(2) }}</span>
          </span>
        </div>
      </transition-group>
    </div>

    <p class="lv-reads">
      <template v-if="best">
        <strong>{{ best.name }}</strong> scores highest under these weights.
      </template>
      <template v-else>Every weight is zero, so nothing is scored.</template>
      Best under each view:
      <span v-for="(view, v) in stakeholderViews" :key="view.id">
        {{ view.name.toLowerCase() }}, <strong>{{ bestUnder(view).name }}</strong
        >{{ v === stakeholderViews.length - 1 ? "." : ";" }}
      </span>
    </p>
    <p class="lv-hint">
      Move a weight and watch the ranking change. Looks is a judgement,
      entered by hand for each option, and it takes a weight just like the
      three measured criteria. An option that stays near the top under every
      view is a robust choice. Where the views disagree, discuss why.
    </p>
  </div>
</template>

<script>
/*
 * A weighted score to try: six made-up options, a weight for each of three
 * measured goals and for one judged by hand, as a custom dimension is. The
 * scores are the app's own (customDimensions.js), so what moves here is what
 * moves in a weighted dimension there. Stands in for docs/img/weights.svg
 * (see live/index.js).
 */
import "./live.css";
import { weightShares, weightedValue } from "@/customDimensions.js";

// `bounds` is the range a judged criterion was given when it was made: it
// is scaled by that, where a measured one is scaled by the values found.
const GOALS = [
  { dim: "daylight", name: "Daylight", unit: "%", lowerIsBetter: false, says: "higher is better" },
  { dim: "cooling", name: "Cooling", unit: " kWh", lowerIsBetter: true, says: "lower is better" },
  { dim: "cost", name: "Cost", unit: "k", lowerIsBetter: true, says: "lower is better" },
  { dim: "looks", name: "Looks", unit: "/10", lowerIsBetter: false, says: "judged by hand", bounds: [0, 10] },
];

// docs/img/weights.svg draws these same options; change both together.
const OPTIONS = [
  { name: "Option A", daylight: 72, cooling: 2400, cost: 310, looks: 8 },
  { name: "Option B", daylight: 58, cooling: 1850, cost: 280, looks: 5 },
  { name: "Option C", daylight: 44, cooling: 1500, cost: 240, looks: 3 },
  { name: "Option D", daylight: 66, cooling: 2100, cost: 360, looks: 9 },
  { name: "Option E", daylight: 51, cooling: 1650, cost: 330, looks: 4 },
  { name: "Option F", daylight: 62, cooling: 1950, cost: 250, looks: 6 },
];

const VIEWS = [
  { id: "equal", name: "Equal weights", weights: [5, 5, 5, 5] },
  { id: "daylight", name: "Daylight first", weights: [8, 2, 2, 2] },
  { id: "energy", name: "Energy first", weights: [2, 8, 2, 2] },
  { id: "cost", name: "Cost first", weights: [2, 2, 8, 2] },
  { id: "looks", name: "Looks first", weights: [2, 2, 2, 8] },
];

// A measured goal is scaled between its lowest and highest value among the
// options, as a weighted dimension scales a column over the whole study.
const BOUNDS = {};
GOALS.forEach((goal) => {
  let values = OPTIONS.map((option) => option[goal.dim]);
  BOUNDS[goal.dim] =
    goal.bounds || [Math.min.apply(null, values), Math.max.apply(null, values)];
});

function scored(weights) {
  let def = {
    terms: GOALS.map((goal, g) => ({
      dim: goal.dim,
      weight: weights[g],
      lowerIsBetter: goal.lowerIsBetter,
    })),
  };
  return OPTIONS.map((option) =>
    Object.assign({}, option, {
      score: weightedValue(option, def, (dim) => BOUNDS[dim], () => false),
    })
  ).sort((one, other) => {
    if (one.score === undefined || other.score === undefined) return 0;
    return other.score - one.score;
  });
}

export default {
  name: "WeightsLive",
  data() {
    return {
      goals: GOALS,
      views: VIEWS,
      weights: VIEWS[0].weights.slice(),
    };
  },
  computed: {
    shares() {
      return weightShares(this.weights.map((weight) => ({ weight: weight })));
    },
    ranked() {
      return scored(this.weights);
    },
    best() {
      return this.ranked[0].score === undefined ? null : this.ranked[0];
    },
    /** The views that put one goal first: the ones that can disagree. */
    stakeholderViews() {
      return this.views.filter((view) => view.id !== "equal");
    },
  },
  methods: {
    take(view) {
      this.weights = view.weights.slice();
    },
    isView(view) {
      return view.weights.every((weight, g) => weight === this.weights[g]);
    },
    bestUnder(view) {
      return scored(view.weights)[0];
    },
    barOf(row) {
      return (row.score === undefined ? 0 : Math.round(row.score * 100)) + "%";
    },
  },
};
</script>
