<template>
  <!-- Most of the window, so the charts have room to be read. -->
  <v-dialog
    v-model="open"
    width="96vw"
    max-width="none"
    content-class="sx-dialog"
    scrollable
    @keydown="onDialogKey"
  >
    <!-- Built only while shown: the reading walks every row of the whole
         collection, and would otherwise recompute as values change anywhere. -->
    <v-card v-if="contentShown" class="sx-card">
      <v-toolbar flat dense class="sx-bar">
        <span class="sx-title">Analysis</span>
        <span class="sx-meta" :title="denominatorText">{{ denominatorText }}</span>
        <v-spacer />
        <v-btn icon small class="ml-1" aria-label="Close" @click="open = false">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-toolbar>

      <v-card-text class="sx-body">
        <!-- Each dimension on its own, before any pair of them: where its
             values sit and how far they spread. Two rows of tiles, and the
             rest on request, so the sensitivity reading stays in view. -->
        <section class="ax-section">
          <div class="ax-head">
            <span class="ax-head-title">Dimensions</span>
            <span class="ax-head-meta"
              >Average, standard deviation and how the values spread; the band
              is one standard deviation either side of the average.</span
            >
          </div>
          <div v-if="summary.length === 0" class="sx-guide-line">
            This collection has no numeric dimensions.
          </div>
          <div
            v-else
            ref="dims"
            class="ax-dims"
            :class="{ 'ax-dims--collapsed': !showAllDims }"
          >
            <div
              v-for="dim in summary"
              :key="dim.dim"
              class="ax-dim"
              :class="'ax-dim--' + (kindOf(dim.dim) || 'other')"
              :title="dimTitle(dim)"
            >
              <div class="ax-dim-head">
                <DimensionName class="ax-dim-name" :name="dim.dim" truncate />
                <span
                  v-if="kindOf(dim.dim)"
                  class="ax-kind"
                  :class="'ax-kind--' + kindOf(dim.dim)"
                  >{{ kindOf(dim.dim) }}</span
                >
              </div>
              <div v-if="dim.n === 0" class="ax-hist ax-hist--empty">
                no values
              </div>
              <div
                v-else
                class="ax-hist"
                :class="{ 'ax-hist--levels': dim.levels }"
              >
                <div class="ax-band" :style="bandStyle(dim)"></div>
                <!-- Few distinct values: a stem at each one's own place, so
                     uneven levels stay uneven, with its count on top when
                     there is room and on hover always. -->
                <div v-if="dim.levels" class="ax-stems">
                  <div
                    v-for="level in dim.levels"
                    :key="level.value"
                    class="ax-stem"
                    :style="{ left: histPosition(dim, level.value) + '%' }"
                    :title="levelTitle(dim, level)"
                  >
                    <div
                      class="ax-stem-bar"
                      :style="{ height: barHeight(dim, level.count) }"
                    >
                      <span v-if="showsCounts(dim)" class="ax-stem-count">{{
                        level.count.toLocaleString()
                      }}</span>
                    </div>
                  </div>
                </div>
                <template v-else>
                  <div
                    v-for="(count, i) in dim.bins"
                    :key="i"
                    class="ax-bin"
                    :style="{ height: barHeight(dim, count) }"
                    :title="binTitle(dim, i, count)"
                  ></div>
                </template>
                <div class="ax-mean" :style="meanStyle(dim)"></div>
              </div>
              <div v-if="dim.n > 0" class="ax-axis">
                <span
                  v-for="(tick, i) in axisTicks(dim)"
                  :key="i"
                  class="ax-tick"
                  :style="tick.style"
                  >{{ tick.text }}</span
                >
              </div>
              <div v-if="dim.n > 0" class="ax-dim-stats">
                <span
                  >avg <strong>{{ statText(dim, dim.mean) }}</strong></span
                >
                <span
                  >std <strong>{{ statText(dim, dim.std) }}</strong></span
                >
                <span v-if="farOutCount(dim.dim) > 0" class="ax-far">{{
                  farOutCount(dim.dim) +
                    (leaveOutOutliers ? " left out" : " far out")
                }}</span>
              </div>
            </div>
          </div>
          <button
            v-if="dimsOverflow || showAllDims"
            type="button"
            class="ax-more"
            @click="showAllDims = !showAllDims"
          >
            {{
              showAllDims
                ? "Show fewer"
                : "Show all " + summary.length + " dimensions"
            }}
          </button>
        </section>

        <!-- Values far outside the rest, which a front or a correlation can
             lean on: found here, then looked at, left out of this reading,
             or excluded from the exploration. -->
        <section class="ax-section">
          <div class="ax-head">
            <span class="ax-head-title">Outliers</span>
            <v-tooltip bottom max-width="380">
              <template v-slot:activator="{ on }">
                <v-icon v-on="on" small class="sx-info"
                  >mdi-information-outline</v-icon
                >
              </template>
              <span class="sx-tip">
                <span class="sx-tip-line"
                  >A value is far out when it lies more than three
                  interquartile ranges below the lower quartile or above the
                  upper one, on its own dimension. Quartiles aren't pulled
                  along by the very values being judged, as an average
                  is.</span
                >
                <span class="sx-tip-line"
                  >Dimensions with only a few levels, such as a sweep's
                  inputs, can't be judged this way and are passed over.</span
                >
                <span class="sx-tip-line"
                  >An outlier can be the best design or a failed run. Look
                  before leaving it out.</span
                >
              </span>
            </v-tooltip>
            <span class="ax-head-meta">{{ outlierSummary }}</span>
            <v-spacer />
            <v-checkbox
              v-if="hasPrefixes"
              v-model="outlierInputs"
              label="Include inputs"
              dense
              hide-details
              class="ax-check"
            />
          </div>
          <div v-if="outlierDims.length === 0" class="sx-guide-line">
            No outputs to check. Include the inputs to look at them.
          </div>
          <div v-else class="ax-split">
            <div class="ax-split-main">
              <!-- A row for each dimension with any; the plot shows the one
                   picked here. -->
              <div v-if="outlierRows.length > 0" class="ax-orows">
                <button
                  v-for="row in outlierRows"
                  :key="row.dim"
                  type="button"
                  class="ax-orow"
                  :class="{ 'ax-orow--on': row.dim === outlierPlotX }"
                  :title="row.title"
                  :aria-pressed="String(row.dim === outlierPlotX)"
                  @click="plotOutliersOf(row.dim)"
                >
                  <DimensionName class="ax-orow-name" :name="row.dim" truncate />
                  <span class="ax-orow-count">{{ row.countText }}</span>
                  <span class="ax-orow-fence">{{ row.fenceText }}</span>
                </button>
              </div>
              <p v-else class="ax-quiet">
                No option stands far outside the rest.
              </p>
              <div v-if="outliers.ids.size > 0" class="ax-actions">
                <v-switch
                  v-model="leaveOutOutliers"
                  inset
                  dense
                  hide-details
                  label="Leave out of the analysis"
                  class="ax-switch"
                />
                <v-spacer />
                <v-btn
                  small
                  text
                  color="primary"
                  :disabled="outliersInData.length === 0"
                  @click="selectOutliers"
                  >Select them</v-btn
                >
                <v-tooltip bottom max-width="320">
                  <template v-slot:activator="{ on }">
                    <v-btn
                      v-on="on"
                      small
                      text
                      :disabled="outliersInData.length === 0"
                      @click="excludeOutliers"
                      >Exclude from exploration</v-btn
                    >
                  </template>
                  <span
                    >Takes them out of every panel, as Exclude does with a
                    selection. Step back, in the toolbar, brings them
                    back.</span
                  >
                </v-tooltip>
              </div>
              <p v-if="outliersExcluded > 0" class="ax-note">
                {{ optionCount(outliersExcluded) }}
                {{ outliersExcluded === 1 ? "is" : "are" }} out of the
                exploration too. Step back, in the toolbar, brings them back.
              </p>
            </div>
            <div class="ax-split-plot">
              <MiniScatter
                :rows="rawData"
                :x="outlierPlotX"
                :y="outlierPlotY"
                :layer-of="outlierLayerOf"
                :layers="outlierLayers"
                :fences="outlierFences"
                :is-missing="isMissing"
              />
              <div class="ax-plot-axes">
                <span class="ax-plot-label">Against</span>
                <DimensionPicker
                  :value="outlierPlotY"
                  :items="outlierYItems"
                  dense
                  outlined
                  hide-details
                  class="sx-select ax-plot-picker"
                  @input="outlierY = $event"
                />
              </div>
            </div>
          </div>
        </section>

        <!-- The options no other beats on every goal, and those just behind
             them, kept as a filter. The goals themselves are set under
             Dimensions. -->
        <section class="ax-section">
          <div class="ax-head">
            <span class="ax-head-title">Best trade-offs</span>
            <span v-if="tradeOffMeta" class="ax-head-meta">{{
              tradeOffMeta
            }}</span>
            <v-btn small text color="primary" class="ax-link" @click="setGoals"
              >Set goals</v-btn
            >
            <v-spacer />
            <v-btn-toggle
              v-if="hasTradeOffs"
              v-model="keepFronts"
              mandatory
              dense
              class="ax-measures"
            >
              <v-tooltip
                v-for="choice in frontChoices"
                :key="choice.value"
                bottom
                max-width="320"
              >
                <template v-slot:activator="{ on }">
                  <v-btn v-on="on" small :value="choice.value">{{
                    choice.text
                  }}</v-btn>
                </template>
                <span>{{ choice.note }}</span>
              </v-tooltip>
            </v-btn-toggle>
          </div>
          <div v-if="!hasTradeOffs" class="sx-guide-line">
            Set goals on two or more outputs under Dimensions to keep the
            options no other option beats on all of them.
          </div>
          <div v-else class="ax-split">
            <div class="ax-split-main">
              <p class="ax-lead">{{ tradeOffPreview }}</p>
              <CaveatChips :caveats="tradeOffCaveats" />
              <div class="ax-actions">
                <v-btn
                  small
                  depressed
                  color="primary"
                  :disabled="best.kept.length === 0"
                  @click="keepTradeOffs"
                  >Keep the best trade-offs</v-btn
                >
              </div>
            </div>
            <div class="ax-split-plot">
              <MiniScatter
                :rows="best.rows"
                :x="tradePlotX"
                :y="tradePlotY"
                :layer-of="tradeLayerOf"
                :layers="tradeLayers"
                base-label="Not kept"
                :steps="tradeSteps"
                :is-missing="isMissing"
              />
              <!-- More goals than axes: which two are shown. -->
              <div v-if="tradeOffGoals.dims.length > 2" class="ax-plot-axes">
                <DimensionPicker
                  :value="tradePlotX"
                  :items="tradeXItems"
                  dense
                  outlined
                  hide-details
                  class="sx-select ax-plot-picker"
                  @input="pickTradeX"
                />
                <span class="ax-plot-label">and</span>
                <DimensionPicker
                  :value="tradePlotY"
                  :items="tradeYItems"
                  dense
                  outlined
                  hide-details
                  class="sx-select ax-plot-picker"
                  @input="tradeY = $event"
                />
              </div>
              <p v-if="tradeOffGoals.dims.length > 2" class="ax-note">
                Two of {{ tradeOffGoals.dims.length }} goals: a kept option can
                sit inside the cloud here, being better on another.
              </p>
            </div>
          </div>
        </section>

        <section class="ax-section">
          <div class="ax-head">
            <span class="ax-head-title">Sensitivity</span>
            <v-tooltip bottom max-width="420">
              <template v-slot:activator="{ on }">
                <v-icon v-on="on" small class="sx-info"
                  >mdi-information-outline</v-icon
                >
              </template>
              <span class="sx-tip">
                <span class="sx-tip-line"
                  >Linear r is how closely two dimensions move together in a
                  straight line, from -1 to 1. Rank ρ is the same on rank
                  order, so it also catches relationships that bend. Influence
                  β is how much an output goes up per input, with the other
                  inputs held still. R² is how much of an output all the chosen
                  inputs explain together.</span
                >
                <span class="sx-tip-line"
                  >All three run from -1 to 1, and the sign says which way the
                  output goes. Influence weighs the chosen inputs together,
                  while rank and linear read one pair at a time: where
                  influence is small but linear is large, another input is
                  carrying that relationship, and where rank beats linear, the
                  relationship is steady but not straight.</span
                >
                <span class="sx-tip-line"
                  >These are patterns in the options you loaded, not proof of
                  cause. An input can look influential only because it moves
                  with another one.</span
                >
                <span class="sx-tip-line"
                  >They also assume the options sample the design space: a
                  full, space-filling or otherwise sound design of experiments.
                  Nothing in the numbers can tell an even sweep from a lopsided
                  one, so how the options were generated decides what these
                  mean.</span
                >
                <span class="sx-tip-line"
                  >If the options came from an optimiser, the inputs are
                  already related to each other, and these numbers reflect that
                  search as much as the design.</span
                >
              </span>
            </v-tooltip>
            <span class="ax-head-meta">Which inputs move which outputs</span>
            <v-spacer />
            <!-- The three measures, each explained in its tooltip. -->
            <v-btn-toggle
              v-model="measure"
              mandatory
              dense
              class="ax-measures"
            >
              <v-tooltip
                v-for="choice in measureChoices"
                :key="choice.value"
                bottom
                max-width="320"
              >
                <template v-slot:activator="{ on }">
                  <v-btn v-on="on" small :value="choice.value">{{
                    choice.text
                  }}</v-btn>
                </template>
                <span>{{ choice.note }}</span>
              </v-tooltip>
            </v-btn-toggle>
            <v-tooltip bottom>
              <template v-slot:activator="{ on }">
                <v-btn
                  icon
                  small
                  v-on="on"
                  class="sx-btn ml-1"
                  :disabled="!result"
                  aria-label="Download the sensitivity numbers as CSV"
                  @click="download"
                >
                  <v-icon small>mdi-download</v-icon>
                </v-btn>
              </template>
              <span>Download the sensitivity numbers as CSV</span>
            </v-tooltip>
          </div>

        <div class="sx-pickers">
          <DimensionPicker
            v-model="inputs"
            :items="dimensionChoices"
            label="Inputs"
            multiple
            small-chips
            deletable-chips
            dense
            outlined
            hide-details
            class="sx-picker"
          />
          <DimensionPicker
            v-model="outputs"
            :items="dimensionChoices"
            label="Outputs"
            multiple
            small-chips
            deletable-chips
            dense
            outlined
            hide-details
            class="sx-picker"
          />
        </div>

        <!-- What a reading rests on and what to doubt in it. -->
        <CaveatChips class="sx-caveats" :caveats="caveats" />

        <!-- Nothing to read yet: the file never said which columns are which,
             or a picker was emptied. -->
        <div v-if="!hasPair" class="sx-guide">
          <p class="sx-guide-line">
            <template v-if="!hasPrefixes"
              >This file doesn't say which columns are inputs and which are
              outputs. </template
            >Pick the design parameters on the left and the results on the
            right.
          </p>
          <p v-if="!hasPrefixes" class="sx-guide-quiet">
            Naming columns <code>in:width</code> and <code>out:cost</code> in
            the CSV sets this up for every panel.
          </p>
        </div>

        <template v-else-if="result">
          <div v-if="allInputsConstant" class="sx-guide">
            <p class="sx-guide-line">
              None of the chosen inputs varies. Pick parameters that differ
              between options.
            </p>
          </div>

          <template v-else>
            <!-- Both readings at once: the grid answers "what moves what"
                 across every pair, the bars rank one output's inputs. Plain
                 DOM rather than SVG -- a hundred cells of text that stay
                 selectable, and no resize lifecycle to manage. -->
            <div class="sx-views">
              <div class="sx-view sx-view--matrix">
                <div class="sx-scroll">
                  <div class="sx-matrix" :style="matrixStyle">
                    <div class="sx-corner"></div>
                    <div
                      v-for="output in result.outputs"
                      :key="'head-' + output"
                      class="sx-colhead"
                      :title="output"
                    >
                      <DimensionName class="sx-colname" :name="output" />
                      <div class="sx-r2">{{ r2Text(output) }}</div>
                      <div v-if="modelNote(output)" class="sx-colwarn">
                        {{ modelNote(output) }}
                      </div>
                    </div>

                    <template v-for="input in shownInputs">
                      <div
                        :key="'row-' + input"
                        class="sx-rowhead"
                        :title="rowTitle(input)"
                      >
                        <DimensionName class="sx-rowname" :name="input" truncate />
                        <span v-if="isFewValues(input)" class="sx-few">few</span>
                      </div>
                      <div
                        v-for="output in result.outputs"
                        :key="'cell-' + input + '-' + output"
                        class="sx-cell"
                        :class="cellClass(input, output)"
                        :style="cellStyle(input, output)"
                        :title="cellTitle(input, output)"
                        @click="pickPair(input, output)"
                      >
                        {{ cellText(input, output) }}
                      </div>
                    </template>
                  </div>
                </div>
              </div>

              <!-- One output at a time, its inputs sorted by magnitude. -->
              <div class="sx-view sx-view--bars">
                <div class="sx-bars-head">
                  <span class="sx-bars-label">Output</span>
                  <DimensionPicker
                    v-model="focusOutput"
                    :items="outputChoices"
                    dense
                    outlined
                    hide-details
                    class="sx-select"
                  />
                  <span v-if="modelNote(focusOutput)" class="sx-colwarn ml-3">{{
                    modelNote(focusOutput)
                  }}</span>
                  <span v-else class="sx-r2 ml-3">{{ r2Text(focusOutput) }}</span>
                </div>
                <div v-if="bars.length === 0" class="sx-guide-line">
                  Nothing readable for this output yet.
                </div>
                <div
                  v-for="bar in bars"
                  :key="'bar-' + bar.input"
                  class="sx-bar-row"
                  :class="{ 'sx-thin': bar.thin }"
                  :title="cellTitle(bar.input, focusOutput)"
                  @click="pickPair(bar.input, focusOutput)"
                >
                  <DimensionName
                    class="sx-bar-label"
                    :name="bar.input"
                    :title="bar.input"
                    truncate
                  />
                  <div class="sx-bar-track">
                    <div class="sx-bar-zero"></div>
                    <div class="sx-bar-fill" :style="barStyle(bar)"></div>
                  </div>
                  <div class="sx-bar-value">{{ fmt(bar.value) }}</div>
                  <div class="sx-bar-effect">{{ effectWord(bar.input, focusOutput) }}</div>
                </div>
              </div>
            </div>
          </template>
        </template>
        </section>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script>
import { mapGetters, mapState } from "vuex";
import { interpolateRdBu } from "d3-scale-chromatic";
import { sensitivity, sensitivityCsv } from "@/analysis/sensitivity.js";
import { summarize } from "@/analysis/summary.js";
import { findOutliers } from "@/analysis/outliers.js";
import { frontSteps, tradeOffs } from "@/analysis/pareto.js";
import { operations } from "@/components/operations.js";
import {
  GOAL_MARKS,
  INPUT,
  MIN,
  OUTPUT,
  columnKind,
  dimensionItems,
  displayName,
  optionName,
} from "@/columns.js";
import { isMissingFor } from "@/store/dimensions.js";
import { formatValue } from "@/store/filters.js";
import { RATING_DIMENSION } from "@/ratings.js";
import CaveatChips from "@/components/CaveatChips.vue";
import DimensionName from "@/components/DimensionName.vue";
import DimensionPicker from "@/components/DimensionPicker.vue";
import MiniScatter from "@/components/MiniScatter.vue";

// A little longer than the dialog's fade-out.
const CLOSE_TRANSITION_MS = 400;
// Bursts of picker changes coalesce into one trailing reading.
const COMPUTE_DELAY_MS = 120;
// Every Nth row past this, so a huge collection still answers at once.
const MAX_ROWS = 20000;
// Past this the regression is guesswork; the correlations still stand.
const MAX_INPUTS = 20;
// More rows than the matrix can show at a glance are trimmed to the strongest.
const MAX_SHOWN_INPUTS = 25;
// Below this a correlation is a coincidence waiting to be believed.
// Two thresholds, because design studies are often small on purpose: below
// the first a number is noise and is dimmed, between the two it is worth
// reading but worth doubting, and the tooltip says so.
const MIN_TRUSTED = 12;
const FEW_OPTIONS = 30;
// Above this magnitude a cell's fill is dark enough to need light text.
const LIGHT_TEXT_ON = 0.6;
// Below this magnitude an input barely moves an output, so it is said to
// neither improve nor worsen it.
const NEGLIGIBLE = 0.05;
// The panel this dialog plots a pair in.
const SCATTER_TYPE = "ScatterPlot";
// How far in from each edge, in percent, a dimension's lowest and highest
// levels stand.
const LEVEL_INSET = 8;
// Up to this many levels, each stem carries its count and each level is
// labelled; past it, only the ends are, and the counts are on hover.
const COUNT_LABEL_LEVELS = 8;
const TICK_LEVELS = 6;
// A far-out chip's tooltip names this many options on each side, then counts.
const NAMED_OUTLIERS = 10;

// How many fronts "Keep the best trade-offs" keeps (see paretoFronts).
const FRONTS = [
  {
    text: "Front only",
    value: 1,
    note: "Only the options no other option beats on every goal.",
  },
  {
    text: "+ next front",
    value: 2,
    note:
      "Also the options beaten only by the front. Small differences decide " +
      "the front, so with simulation noise these could be as good.",
  },
  {
    text: "+ two more",
    value: 3,
    note: "The front and the two behind it, for a wider shortlist.",
  },
];

const MEASURES = [
  {
    text: "Influence (β)",
    value: "beta",
    note:
      "How far an output moves when this input moves, with the other chosen " +
      "inputs held still. It reads them together, so two inputs that move " +
      "as one share the credit instead of each taking it whole.",
  },
  {
    text: "Rank (ρ)",
    value: "rho",
    note:
      "How steadily the two rise and fall together in rank order, one pair " +
      "at a time. A relationship that bends but never turns back still " +
      "reads 1.",
  },
  {
    text: "Linear (r)",
    value: "r",
    note:
      "How close the pair sits to a straight line, one pair at a time. It " +
      "knows nothing of the other inputs, so anything they share is counted " +
      "in full here.",
  },
];

function fixed(value) {
  return value === null || value === undefined ? "" : value.toFixed(2);
}

/**
 * The analysis dialog: every dimension on its own, the options far outside
 * the rest, the best trade-offs over the goals, then which inputs move which
 * outputs.
 *
 * Deliberately reads `rawData` rather than `data`: the question is what the
 * design space does, not what the current zoom happens to hold, and a
 * correlation over a brushed corner of the space is a different claim. Less
 * the outliers, when they are left out. The best trade-offs are the
 * exception: they are kept as a filter, so they are found in the current
 * result, as the assistant finds them.
 *
 * The arithmetic lives in analysis/summary.js and analysis/sensitivity.js;
 * this is the reading of it. Everything is plain DOM rather than d3-drawn SVG
 * -- small histograms and about a hundred cells of text, which stay
 * selectable and need no resize lifecycle.
 */
export default {
  name: "SensitivityDialog",
  components: { CaveatChips, DimensionName, DimensionPicker, MiniScatter },
  data() {
    return {
      // Whether the dialog's content exists: while open, and through the
      // closing transition.
      contentShown: false,
      inputs: [],
      outputs: [],
      measure: "beta",
      // Which output the bars show, and which ranks the matrix's rows.
      focusOutput: null,
      result: null,
      measureChoices: MEASURES,
      // One frozen entry per numeric dimension (see analysis/summary.js).
      summary: [],
      showAllDims: false,
      // Whether the tiles run past the two rows shown until asked.
      dimsOverflow: false,
      // Whether the outliers are looked for among the inputs too.
      outlierInputs: false,
      // Whether the outliers are left out of the tiles, the trade-offs and
      // the sensitivity reading.
      leaveOutOutliers: false,
      // How many fronts the best trade-offs keep.
      keepFronts: 2,
      // The plots' axes as picked; null follows the defaults (see
      // outlierPlotX and tradePlotX).
      outlierX: null,
      outlierY: null,
      tradeX: null,
      tradeY: null,
      frontChoices: FRONTS,
    };
  },
  created() {
    this.applyDefaults();
    this.onResize = () => {
      if (this.contentShown) this.measureDims();
    };
    window.addEventListener("resize", this.onResize);
  },
  beforeDestroy() {
    clearTimeout(this.hideContentTimer);
    clearTimeout(this.computeTimer);
    window.removeEventListener("resize", this.onResize);
  },
  computed: {
    ...mapState({
      dialogState: (state) => state.sensitivityDialog,
      rawData: (state) => state.rawData,
      currentData: (state) => state.data,
      allDimensions: (state) => state.allDimensions,
      numericDimensions: (state) => state.numericDimensions,
      dimensionValuesVersion: (state) => state.dimensionValuesVersion,
      layouts: (state) => state.layouts,
    }),
    ...mapGetters([
      "hasRatings",
      "isUnfilterable",
      "goalOf",
      "tradeOffGoals",
      "tradeOffRows",
    ]),
    open: {
      get() {
        return this.dialogState.open;
      },
      set(value) {
        if (!value) this.$store.dispatch("closeSensitivity");
      },
    },
    /** Every numeric column, plus the rating once anything is rated. */
    candidates() {
      let names = this.numericDimensions.slice();
      if (this.hasRatings && names.indexOf(RATING_DIMENSION) === -1) {
        names.push(RATING_DIMENSION);
      }
      return names;
    },
    dimensionChoices() {
      return dimensionItems(this.candidates);
    },
    outputChoices() {
      return dimensionItems(this.outputs);
    },
    /** Whether the file itself says which columns are inputs and which outputs. */
    hasPrefixes() {
      return this.allDimensions.some((dim) => {
        let kind = columnKind(dim);
        return kind === INPUT || kind === OUTPUT;
      });
    },
    hasPair() {
      return this.inputs.length > 0 && this.outputs.length > 0;
    },
    denominatorText() {
      let count = this.analysisRows.length;
      let text =
        count.toLocaleString() +
        (count === 1 ? " option" : " options") +
        " · whole collection";
      let out = this.rawData.length - count;
      if (out > 0) {
        text +=
          ", " + out.toLocaleString() + (out === 1 ? " outlier" : " outliers") + " left out";
      }
      return text;
    },
    /**
     * The dimensions searched for outliers: the outputs, and the inputs when
     * asked; every column when the file doesn't say which is which. Never
     * custom or weighted ones or the rating, whose values are entered or
     * derived rather than measured.
     */
    outlierDims() {
      return this.numericDimensions.filter((dim) => {
        let kind = columnKind(dim);
        if (dim === RATING_DIMENSION || this.isUnfilterable(dim)) return false;
        if (!this.hasPrefixes) return true;
        return kind === OUTPUT || (this.outlierInputs && kind === INPUT);
      });
    },
    /** `{ ids, byDim, byId }` (see analysis/outliers.js), over the whole collection. */
    outliers() {
      if (!this.contentShown) return { ids: new Set(), byDim: {}, byId: {}, fences: {} };
      return findOutliers(this.rawData, this.outlierDims, { isMissing: isMissingFor });
    },
    /** The outliers' ids as text, which a row's id is matched against. */
    outlierKeys() {
      return new Set(Array.from(this.outliers.ids).map(String));
    },
    /** The ids left out of this reading: the outliers, while they are. */
    leftOut() {
      return this.leaveOutOutliers ? this.outlierKeys : new Set();
    },
    /** What the tiles and the sensitivity read: the collection, less what is left out. */
    analysisRows() {
      if (this.leftOut.size === 0) return this.rawData;
      return this.rawData.filter((row) => !this.leftOut.has(String(row._id)));
    },
    /** The outliers still in the exploration, which can be selected or excluded. */
    outliersInData() {
      if (this.outlierKeys.size === 0) return [];
      return this.currentData
        .filter((row) => this.outlierKeys.has(String(row._id)))
        .map((row) => row._id);
    },
    /** How many outliers a zoom or exclusion took out of the exploration. */
    outliersExcluded() {
      return this.outlierKeys.size - this.outliersInData.length;
    },
    /** "16 options far out on 1 of 8 outputs", beside the section's title. */
    outlierSummary() {
      let count = this.outliers.ids.size;
      let checked = this.outlierDims.length;
      let what = !this.hasPrefixes || this.outlierInputs ? "dimension" : "output";
      let of = checked + " " + what + (checked === 1 ? "" : "s");
      if (count === 0) {
        return "None far out on " + (checked === 1 ? "the one " + what : "any of " + of);
      }
      let dims = Object.keys(this.outliers.byDim).length;
      return this.optionCount(count) + " far out on " + dims + " of " + of;
    },
    /**
     * A row for each dimension with outliers, most first: how many on each
     * side, past which values, and the options themselves on hover.
     */
    outlierRows() {
      let byDim = this.outliers.byDim;
      return this.outlierDims
        .filter((dim) => byDim[dim])
        .map((dim) => {
          let found = byDim[dim];
          let format = this.valueFormat(dim);
          let sides = [];
          let limits = [];
          if (found.high.length > 0) sides.push(found.high.length + " high");
          if (found.low.length > 0) sides.push(found.low.length + " low");
          if (found.low.length > 0) limits.push("below " + format(found.fences[0]));
          if (found.high.length > 0) limits.push("above " + format(found.fences[1]));
          let title = [];
          if (found.high.length > 0) {
            title.push(this.outlierLine(dim, found.high, "Above", found.fences[1]));
          }
          if (found.low.length > 0) {
            title.push(this.outlierLine(dim, found.low, "Below", found.fences[0]));
          }
          title.push("Click to plot it.");
          return {
            dim: dim,
            count: found.high.length + found.low.length,
            countText: sides.join(" · "),
            fenceText: limits.join(" or "),
            title: title.join("\n"),
          };
        })
        .sort((a, b) => b.count - a.count);
    },
    /** The outliers plot's x: the row picked, else the one with the most. */
    outlierPlotX() {
      if (this.outlierX && this.outlierDims.indexOf(this.outlierX) !== -1) return this.outlierX;
      if (this.outlierRows.length > 0) return this.outlierRows[0].dim;
      return this.outlierDims[0] || null;
    },
    /** Its y: as picked, else another with outliers, else another checked. */
    outlierPlotY() {
      let x = this.outlierPlotX;
      let fits = (dim) => !!dim && dim !== x && this.candidates.indexOf(dim) !== -1;
      if (fits(this.outlierY)) return this.outlierY;
      let other =
        this.outlierRows.map((row) => row.dim).find(fits) ||
        this.outlierDims.find(fits) ||
        this.candidates.find(fits);
      return other || x;
    },
    outlierYItems() {
      return dimensionItems(this.candidates.filter((dim) => dim !== this.outlierPlotX));
    },
    /** Far out on either axis, far out elsewhere, or neither. */
    outlierLayerOf() {
      let x = this.outlierPlotX;
      let y = this.outlierPlotY;
      let byId = this.outliers.byId;
      return (row) => {
        let found = byId[row._id];
        if (!found) return null;
        return found.some((entry) => entry.dim === x || entry.dim === y) ? "here" : "other";
      };
    },
    outlierLayers() {
      let out = this.leaveOutOutliers ? ", left out" : "";
      return [
        { key: "other", label: "Far out on another" + out, color: "#ffb74d", hollow: true },
        { key: "here", label: "Far out on these" + out, color: "#e65100" },
      ];
    },
    outlierFences() {
      let fences = this.outliers.fences;
      return { x: fences[this.outlierPlotX] || null, y: fences[this.outlierPlotY] || null };
    },
        /** Whether there are goals enough for a trade-off: two or more that a filter can hold. */
    hasTradeOffs() {
      return this.tradeOffGoals.dims.length >= 2;
    },
    /** The rows the best trade-offs are found in: the current result, less what is left out. */
    tradeOffBase() {
      let rows = this.tradeOffRows;
      if (this.leftOut.size === 0) return rows;
      return rows.filter((row) => !this.leftOut.has(String(row._id)));
    },
    /** `{ rows, fronts, kept, caveats }` (see tradeOffs in analysis/pareto.js). */
    best() {
      let goals = this.tradeOffGoals;
      if (!this.contentShown || goals.dims.length < 2) {
        return { rows: [], fronts: [], kept: [], caveats: [] };
      }
      return tradeOffs({
        rows: this.tradeOffBase,
        dims: goals.dims,
        directions: goals.directions,
        fronts: this.keepFronts,
        isMissing: isMissingFor,
        scoped: this.tradeOffRows.length < this.rawData.length,
        skipped: goals.skipped,
      });
    },
    tradeOffMeta() {
      let goals = this.tradeOffGoals;
      if (goals.dims.length === 0) return "";
      return (
        "By the goals set under Dimensions: " +
        goals.dims
          .map((dim, i) => this.label(dim) + " " + GOAL_MARKS[goals.directions[i]].mark)
          .join(", ")
      );
    },
    /** "Keeps 24 of 648 options: 12 on the front and 12 just behind it." */
    tradeOffPreview() {
      let best = this.best;
      if (best.kept.length === 0) return "No options have a value for every goal.";
      let text =
        "Keeps " +
        best.kept.length.toLocaleString() +
        " of " +
        this.optionCount(best.rows.length);
      let first = best.fronts[0].length;
      let behind = best.kept.length - first;
      if (best.fronts.length === 1) return text + ": the front.";
      return (
        text +
        ": " +
        first.toLocaleString() +
        " on the front and " +
        behind.toLocaleString() +
        (best.fronts.length === 2 ? " just behind it." : " in the two fronts behind it.")
      );
    },
    /** The trade-offs plot's axes: two of the goals, the first two unless picked. */
    tradePlotX() {
      let dims = this.tradeOffGoals.dims;
      return dims.indexOf(this.tradeX) !== -1 ? this.tradeX : dims[0] || null;
    },
    tradePlotY() {
      let dims = this.tradeOffGoals.dims;
      let x = this.tradePlotX;
      if (this.tradeY !== x && dims.indexOf(this.tradeY) !== -1) return this.tradeY;
      return dims.find((dim) => dim !== x) || null;
    },
    tradeXItems() {
      return dimensionItems(this.tradeOffGoals.dims);
    },
    tradeYItems() {
      return dimensionItems(this.tradeOffGoals.dims.filter((dim) => dim !== this.tradePlotX));
    },
    /** On the front, behind it and kept, or not kept. */
    tradeLayerOf() {
      let rank = new Map();
      this.best.fronts.forEach((front, i) => front.forEach((row) => rank.set(row, i)));
      return (row) => {
        let i = rank.get(row);
        return i === undefined ? null : i === 0 ? "front" : "behind";
      };
    },
    tradeLayers() {
      return [
        {
          key: "behind",
          label: this.keepFronts === 2 ? "Just behind it" : "The two fronts behind it",
          color: "#64b5f6",
        },
        { key: "front", label: "The front", color: "#1565c0" },
      ];
    },
    /** With exactly two goals the plot is the whole story: the front's steps. */
    tradeSteps() {
      let front = this.best.fronts[0];
      if (this.tradeOffGoals.dims.length !== 2 || !front) return null;
      let dims = [this.tradePlotX, this.tradePlotY];
      return frontSteps(front, dims, dims.map((dim) => this.goalOf(dim)));
    },
    tradeOffCaveats() {
      let caveats = this.best.caveats.slice();
      let out = this.tradeOffRows.length - this.tradeOffBase.length;
      if (out > 0) {
        caveats.push({
          key: "outliers",
          text: out + (out === 1 ? " outlier" : " outliers") + " left out",
          detail: [
            "They stand far outside the rest, so they aren't compared. Turn off Leave out of the analysis to count them.",
          ],
        });
      }
      return caveats;
    },
    allInputsConstant() {
      if (!this.result) return false;
      let flags = this.result.flags;
      return this.result.inputs.every(
        (dim) => !flags[dim] || flags[dim].n === 0 || flags[dim].constant
      );
    },
    /**
     * The rows the matrix draws: the strongest inputs for the focused output,
     * since past a couple of dozen the grid stops being readable at a glance.
     */
    shownInputs() {
      if (!this.result) return [];
      let all = this.result.inputs;
      if (all.length <= MAX_SHOWN_INPUTS) return all;
      let self = this;
      return all
        .slice()
        .sort(function(a, b) {
          return self.rankStrength(b) - self.rankStrength(a);
        })
        .slice(0, MAX_SHOWN_INPUTS);
    },
    bars() {
      if (!this.result || !this.focusOutput) return [];
      let output = this.focusOutput;
      let self = this;
      return this.shownInputs
        .map(function(input) {
          let cell = self.result.pairs[output][input];
          return {
            input: input,
            value: self.cellValue(input, output),
            thin: !!cell && !cell.same && cell.n < MIN_TRUSTED,
          };
        })
        .filter(function(bar) {
          return bar.value !== null;
        })
        .sort(function(a, b) {
          return Math.abs(b.value) - Math.abs(a.value);
        });
    },
    matrixStyle() {
      let columns = this.result ? this.result.outputs.length : 0;
      return {
        gridTemplateColumns:
          "minmax(140px, 220px) repeat(" + columns + ", minmax(88px, 1fr))",
      };
    },
    /**
     * What a reading rests on and what to doubt in it, as `{ key, text,
     * detail, warn }`: a few words to show, and the whole of it, a line each,
     * for hovering. The sampling one always stands: nothing in the numbers
     * reveals how the options were generated.
     */
    caveats() {
      let caveats = [
        {
          key: "sampling",
          text: "Only as good as the sampling",
          detail: [
            "The analysis is only as good as the sampling behind it: enough " +
              "options, spread fairly over the design space.",
            "A hand-picked set, or the path an optimiser took, mostly " +
              "describes itself.",
          ],
        },
      ];
      let result = this.result;
      if (!result || !this.hasPair || this.allInputsConstant) return caveats;
      if (result.sampled) {
        caveats.push({
          key: "sampled",
          text:
            "Read over " +
            result.rows.toLocaleString() +
            " of " +
            this.analysisRows.length.toLocaleString(),
          detail: [
            "Read over " +
              result.rows.toLocaleString() +
              " evenly spaced options of " +
              this.analysisRows.length.toLocaleString() +
              ", to keep this quick.",
          ],
        });
      }
      if (result.inputs.length > this.shownInputs.length) {
        caveats.push({
          key: "top",
          text:
            "Top " + this.shownInputs.length + " of " + result.inputs.length + " inputs",
          detail: [
            "Showing the top " +
              this.shownInputs.length +
              " of " +
              result.inputs.length +
              " inputs, ranked by how strongly they move with " +
              this.label(this.focusOutput) +
              ".",
          ],
        });
      }
      let alike = this.collinearNotes.concat(this.ridgedNote);
      if (alike.length > 0) {
        caveats.push({
          key: "alike",
          text: "Inputs that move together",
          detail: alike,
          warn: true,
        });
      }
      let few = this.fewValueDims;
      if (few.length > 0) {
        caveats.push({
          key: "few",
          text:
            few.length === 1
              ? this.label(few[0]) + " has few values"
              : few.length + " dimensions with few values",
          detail: [
            this.joinNames(few) +
              (few.length === 1 ? " has" : " have") +
              " only a few distinct values: read the rank number, not the " +
              "linear one.",
          ],
          warn: true,
        });
      }
      return caveats;
    },
    /** Pairs of inputs too alike to be told apart, named once each. */
    collinearNotes() {
      let seen = {};
      let notes = [];
      let self = this;
      this.result.outputs.forEach(function(output) {
        let model = self.result.models[output];
        if (!model || !model.culprits) return;
        model.culprits.forEach(function(pair) {
          let key = pair[0] + "|" + pair[1];
          if (seen[key]) return;
          seen[key] = true;
          notes.push(
            self.label(pair[0]) +
              " and " +
              self.label(pair[1]) +
              " move together (r " +
              fixed(pair[2]) +
              "), so the influence shown for each is unreliable — the " +
              "correlations beside them are not."
          );
        });
      });
      return notes;
    },
    ridgedNote() {
      let self = this;
      let outputs = this.result.outputs.filter(function(output) {
        let model = self.result.models[output];
        return model && model.ok && model.ridged;
      });
      if (outputs.length === 0) return [];
      return [
        "For " +
          this.joinNames(outputs) +
          ", the split between look-alike inputs was decided arithmetically, " +
          "not by the data.",
      ];
    },
    /** The dimensions read with only a few distinct values. */
    fewValueDims() {
      let flags = this.result.flags;
      return this.shownInputs.concat(this.result.outputs).filter(function(dim) {
        return flags[dim] && flags[dim].fewValues;
      });
    },
    /** Whether a value the user can edit is being read, so edits must recompute. */
    readsEditableValues() {
      let self = this;
      return this.inputs.concat(this.outputs).some(function(dim) {
        return dim === RATING_DIMENSION || self.isUnfilterable(dim);
      });
    },
  },
  watch: {
    dialogState(next, previous) {
      let wasOpen = !!previous && previous.open;
      clearTimeout(this.hideContentTimer);
      if (next.open) {
        this.contentShown = true;
        this.scheduleCompute();
      } else if (wasOpen) {
        this.hideContentTimer = setTimeout(() => {
          if (!this.dialogState.open) {
            this.contentShown = false;
            // Nothing on screen needs these, and they hold copies of the columns.
            this.result = null;
            this.summary = [];
          }
        }, CLOSE_TRANSITION_MS);
      }
    },
    // A different file, or a dimension added or removed, means different
    // defaults; the picks made against the old columns no longer apply.
    allDimensions() {
      this.applyDefaults();
    },
    inputs() {
      this.scheduleCompute();
    },
    outputs() {
      this.syncFocus();
      this.scheduleCompute();
    },
    // A new collection, or the outliers left out or let back in.
    analysisRows() {
      this.scheduleCompute();
    },
    // The rating joins the dimensions once anything is rated.
    candidates() {
      this.scheduleCompute();
    },
    // Ratings and custom values change in place. The summary covers every
    // dimension, so it follows them; the sensitivity reading only when one of
    // the dimensions it reads is one of them.
    dimensionValuesVersion() {
      if (!this.contentShown) return;
      this.computeSummary();
      if (this.readsEditableValues) this.scheduleCompute();
    },
  },
  methods: {
    label: displayName,
    fmt: fixed,
    onDialogKey(e) {
      // The dialog handles Escape itself; keep digits and Space from the
      // workspace shortcuts in main.js.
      e.stopPropagation();
    },
    /**
     * Inputs and outputs as the file names them. The store's
     * `inputDimensions` upper-cases its answers for the parallel coordinates,
     * so the columns are read here instead. Custom and weighted dimensions are
     * left out: they are usually filled in for a handful of options only.
     */
    applyDefaults() {
      // With no prefixes there is nothing to infer, and a guess would be
      // mistaken for the file's own answer.
      if (!this.hasPrefixes) {
        this.inputs = [];
        this.outputs = [];
        this.syncFocus();
        return;
      }
      let self = this;
      let pick = function(kind) {
        return self.candidates.filter(function(dim) {
          return columnKind(dim) === kind && !self.isUnfilterable(dim);
        });
      };
      let outputs = pick(OUTPUT);
      if (this.hasRatings && outputs.indexOf(RATING_DIMENSION) === -1) {
        outputs.push(RATING_DIMENSION);
      }
      this.inputs = pick(INPUT);
      this.outputs = outputs;
      this.syncFocus();
    },
    syncFocus() {
      if (this.outputs.indexOf(this.focusOutput) === -1) {
        this.focusOutput = this.outputs.length > 0 ? this.outputs[0] : null;
      }
    },
    /**
     * Measured at roughly 60 ms over 2,000 rows and 15 by 15 dimensions, so
     * one trailing run is enough; what it guards against is a run per
     * keystroke while the pickers are being filled.
     */
    scheduleCompute() {
      clearTimeout(this.computeTimer);
      this.computeTimer = setTimeout(() => {
        this.computeTimer = null;
        this.compute();
      }, COMPUTE_DELAY_MS);
    },
    compute() {
      if (!this.contentShown) {
        this.result = null;
        this.summary = [];
        return;
      }
      this.computeSummary();
      if (!this.hasPair) {
        this.result = null;
        return;
      }
      this.result = sensitivity(this.analysisRows, this.inputs, this.outputs, {
        // An unrated option has no rating, rather than a rating of zero.
        isMissing: isMissingFor,
        maxRows: MAX_ROWS,
        maxInputs: MAX_INPUTS,
      });
    },
    /**
     * A single pass over the rows per dimension: a few milliseconds at ten
     * thousand options. Frozen, so Vue doesn't watch every bin.
     */
    computeSummary() {
      // Every row has a rating column; until something is rated it is empty.
      let dims = this.candidates.filter(
        (dim) => dim !== RATING_DIMENSION || this.hasRatings
      );
      this.summary = Object.freeze(
        summarize(this.analysisRows, dims, { isMissing: isMissingFor }).map(
          Object.freeze
        )
      );
      this.$nextTick(this.measureDims);
    },
    /** Whether the tiles run past the two rows the collapsed grid shows. */
    measureDims() {
      let el = this.$refs.dims;
      if (!el || this.showAllDims) return;
      this.dimsOverflow = el.scrollHeight > el.clientHeight + 1;
    },
    kindOf(dim) {
      return columnKind(dim);
    },
    /** A value in the dimension's own precision, as the filters show it. */
    statText(dim, value) {
      return formatValue(
        value,
        dim.max - dim.min,
        Math.max(Math.abs(dim.min), Math.abs(dim.max))
      );
    },
    /**
     * Where a value falls across the chart, in percent. Bins run edge to
     * edge; levels sit inset, so the end stems and their labels aren't cut.
     */
    histPosition(dim, value) {
      if (dim.levels) {
        if (dim.max === dim.min) return 50;
        let span = 100 - 2 * LEVEL_INSET;
        let at = LEVEL_INSET + ((value - dim.min) / (dim.max - dim.min)) * span;
        return Math.max(LEVEL_INSET, Math.min(100 - LEVEL_INSET, at));
      }
      let at = ((value - dim.lo) / (dim.hi - dim.lo)) * 100;
      return Math.max(0, Math.min(100, at));
    },
    barHeight(dim, count) {
      if (count === 0) return "0";
      // The shortest non-empty bar stays visible beside a tall one.
      return Math.max(6, (count / dim.peak) * 100) + "%";
    },
    showsCounts(dim) {
      return dim.levels.length <= COUNT_LABEL_LEVELS;
    },
    optionCount(count) {
      return count.toLocaleString() + (count === 1 ? " option" : " options");
    },
    /**
     * A level as it is written, to as many decimals as the levels need: the
     * filters' rounding would turn a level of 3.25 into 3.3.
     */
    levelText(dim, value) {
      let decimals = 0;
      dim.levels.forEach(function(level) {
        while (decimals < 4 && Number(level.value.toFixed(decimals)) !== level.value) {
          decimals += 1;
        }
      });
      return value.toLocaleString("en-US", { maximumFractionDigits: decimals });
    },
    levelTitle(dim, level) {
      return (
        this.levelText(dim, level.value) +
        ": " +
        this.optionCount(level.count) +
        " (" +
        Math.round((level.count / dim.n) * 100) +
        "%)"
      );
    },
    binTitle(dim, i, count) {
      let width = (dim.hi - dim.lo) / dim.bins.length;
      let from = dim.lo + i * width;
      // Whole numbers get a bar per value, centred on it.
      let range =
        dim.lo === dim.min - 0.5
          ? this.statText(dim, from + 0.5)
          : this.statText(dim, from) + " to " + this.statText(dim, from + width);
      return range + ": " + this.optionCount(count);
    },
    /** The values under the chart: its two ends, or the levels themselves. */
    axisTicks(dim) {
      let self = this;
      if (dim.levels) {
        let levels = dim.levels;
        if (levels.length > TICK_LEVELS) levels = [levels[0], levels[levels.length - 1]];
        return levels.map(function(level) {
          return {
            text: self.levelText(dim, level.value),
            style: {
              left: self.histPosition(dim, level.value) + "%",
              transform: "translateX(-50%)",
            },
          };
        });
      }
      return [
        { text: this.statText(dim, dim.min), style: { left: 0 } },
        { text: this.statText(dim, dim.max), style: { right: 0 } },
      ];
    },
    bandStyle(dim) {
      let from = this.histPosition(dim, dim.mean - dim.std);
      let to = this.histPosition(dim, dim.mean + dim.std);
      return { left: from + "%", width: to - from + "%" };
    },
    meanStyle(dim) {
      return { left: this.histPosition(dim, dim.mean) + "%" };
    },
    dimTitle(dim) {
      let name = this.label(dim.dim);
      if (dim.n === 0) return name + ": no values in this collection.";
      let text =
        name +
        ": " +
        dim.n.toLocaleString() +
        (dim.n === 1 ? " value" : " values") +
        " from " +
        this.statText(dim, dim.min) +
        " to " +
        this.statText(dim, dim.max) +
        ", average " +
        this.statText(dim, dim.mean) +
        ", standard deviation " +
        this.statText(dim, dim.std) +
        ".";
      if (dim.missing > 0) {
        text +=
          " " +
          dim.missing.toLocaleString() +
          (dim.missing === 1 ? " option has" : " options have") +
          " no value.";
      }
      let goal = this.goalOf(dim.dim);
      if (goal) text += " Goal: " + (goal === MIN ? "lower" : "higher") + " is better.";
      let far = this.outliers.byDim[dim.dim];
      if (far) {
        let count = far.low.length + far.high.length;
        let limits = [];
        if (far.low.length > 0) limits.push("below " + this.statText(dim, far.fences[0]));
        if (far.high.length > 0) limits.push("above " + this.statText(dim, far.fences[1]));
        text +=
          " " +
          this.optionCount(count) +
          " far out, " +
          limits.join(" or ") +
          (this.leaveOutOutliers ? ", left out here." : ".");
      }
      return text;
    },
    /** How many options stand far out on a dimension. */
    farOutCount(dim) {
      let far = this.outliers.byDim[dim];
      return far ? far.low.length + far.high.length : 0;
    },
    isMissing: isMissingFor,
    /**
     * Writes a dimension's single values: a step finer than the tiles', which
     * round for an average.
     */
    valueFormat(dim) {
      let lo = Infinity;
      let hi = -Infinity;
      this.rawData.forEach((row) => {
        if (isMissingFor(dim, row[dim])) return;
        let value = Number(row[dim]);
        if (value < lo) lo = value;
        if (value > hi) hi = value;
      });
      let span = hi - lo;
      let magnitude = Math.max(Math.abs(lo), Math.abs(hi));
      return (value) => formatValue(Number(value), span / 10, magnitude);
    },
    /** A goal for the trade-offs plot's x; the one there goes to y if that was it. */
    pickTradeX(dim) {
      if (dim === this.tradePlotY) this.tradeY = this.tradePlotX;
      this.tradeX = dim;
    },
    /** Plots a dimension's outliers; the one it replaces goes up the other axis. */
    plotOutliersOf(dim) {
      if (dim === this.outlierPlotY) this.outlierY = this.outlierPlotX;
      this.outlierX = dim;
    },
    /** "Above 1,200: Option 12 (1,850), Option 40 (1,600) and 3 more." */
    outlierLine(dim, ids, side, fence) {
      let rows = this.rowsById(ids.slice(0, NAMED_OUTLIERS));
      let format = this.valueFormat(dim);
      let named = rows.map((row) => optionName(row) + " (" + format(row[dim]) + ")");
      let more = ids.length - rows.length;
      return (
        side +
        " " +
        format(fence) +
        ": " +
        named.join(", ") +
        (more > 0 ? " and " + more + " more." : ".")
      );
    },
    rowsById(ids) {
      let wanted = new Set(ids.map(String));
      let found = {};
      this.rawData.forEach((row) => {
        if (wanted.has(String(row._id))) found[String(row._id)] = row;
      });
      return ids.map((id) => found[String(id)]).filter(Boolean);
    },
    /** Selects the outliers still in the exploration, and closes to show them. */
    selectOutliers() {
      if (this.outliersInData.length === 0) return;
      this.$store.dispatch("update", {
        markingID: this.$store.state.defaultMarkingID,
        selection: this.outliersInData,
        operation: operations.REPLACE,
        viewType: "Outliers",
      });
      this.open = false;
    },
    /** Takes them out of every panel, and so out of this reading too. */
    excludeOutliers() {
      this.$store.dispatch("excludeOptions", {
        ids: this.outliersInData,
        label: "Outliers",
      });
      this.leaveOutOutliers = true;
    },
    /** The Goals list, over this dialog; closing it comes back here. */
    setGoals() {
      this.$store.dispatch("openDimensionDialog", { mode: "manage" });
    },
    /** Keeps them as the "Best trade-offs" filter, and closes to show them. */
    keepTradeOffs() {
      this.$store.dispatch("keepBestTradeOffs", {
        fronts: this.keepFronts,
        leaveOut: Array.from(this.leftOut),
      });
      this.open = false;
    },
    /** How strongly an input moves the focused output, for ordering rows. */
    rankStrength(input) {
      let output = this.focusOutput || this.result.outputs[0];
      let cell = this.result.pairs[output][input];
      if (!cell || cell.rho === null) return -1;
      return Math.abs(cell.rho);
    },
    cellValue(input, output) {
      let cell = this.result.pairs[output][input];
      if (!cell || cell.same) return null;
      if (this.measure === "beta") {
        let model = this.result.models[output];
        if (!model || !model.ok) return null;
        let beta = model.betas[input];
        return beta === undefined ? null : beta;
      }
      let value = this.measure === "rho" ? cell.rho : cell.r;
      return value === null ? null : value;
    },
    cellText(input, output) {
      return fixed(this.cellValue(input, output));
    },
    cellClass(input, output) {
      let cell = this.result.pairs[output][input];
      let value = this.cellValue(input, output);
      return {
        "sx-same": !!cell && !!cell.same,
        "sx-blank": value === null,
        "sx-thin": !!cell && !cell.same && cell.n < MIN_TRUSTED,
      };
    },
    /**
     * RdBu over a fixed [-1, 1], never fitted to the data: a scale that
     * stretched to whatever the strongest pair happened to be would make two
     * outputs, and two datasets, look alike when they are not.
     */
    cellStyle(input, output) {
      let value = this.cellValue(input, output);
      if (value === null) return {};
      let clamped = Math.max(-1, Math.min(1, value));
      return {
        // Negative reads red, positive blue.
        background: interpolateRdBu((clamped + 1) / 2),
        color: Math.abs(clamped) > LIGHT_TEXT_ON ? "#fff" : "#263238",
      };
    },
    cellTitle(input, output) {
      let cell = this.result.pairs[output][input];
      if (!cell) return "";
      if (cell.same) return "The same dimension on both sides.";
      let names = this.label(input) + " and " + this.label(output);
      if (cell.n < MIN_TRUSTED) {
        return (
          names +
          ": too few options to trust this — only " +
          cell.n.toLocaleString() +
          " have values on both."
        );
      }
      let thin =
        cell.n < FEW_OPTIONS
          ? " Read it as a hint: only " +
            cell.n.toLocaleString() +
            " options stand behind it."
          : "";
      let model = this.result.models[output];
      let beta =
        model && model.ok && model.betas[input] !== undefined
          ? ", influence " + fixed(model.betas[input])
          : "";
      let effect = this.effectSentence(input, output);
      return (
        names +
        ": rank ρ " +
        this.readable(cell.rho) +
        ", linear r " +
        this.readable(cell.r) +
        beta +
        ", over " +
        cell.n.toLocaleString() +
        " options." +
        (effect ? " " + effect : "") +
        " Click to plot them." +
        thin
      );
    },
    /**
     * Whether raising the input goes with a better output, by the measure on
     * show and the output's goal: 1 better, -1 worse, 0 barely either, or
     * null when the output has no goal or the number can't be read.
     */
    effectOf(input, output) {
      let goal = this.goalOf(output);
      let value = this.cellValue(input, output);
      if (!goal || value === null) return null;
      if (Math.abs(value) < NEGLIGIBLE) return 0;
      return (value > 0) === (goal !== MIN) ? 1 : -1;
    },
    /** "improves" or "worsens" beside a bar, for an output with a goal. */
    effectWord(input, output) {
      let effect = this.effectOf(input, output);
      return effect === 1 ? "improves" : effect === -1 ? "worsens" : "";
    },
    /** The effect in words, for a cell's tooltip: "Raising Depth goes with higher Cooling: worse, since lower is better." */
    effectSentence(input, output) {
      let effect = this.effectOf(input, output);
      if (effect === null) return "";
      let goalText = this.goalOf(output) === MIN ? "lower is better" : "higher is better";
      if (effect === 0) {
        return (
          "Raising " +
          this.label(input) +
          " barely moves " +
          this.label(output) +
          " (" +
          goalText +
          ")."
        );
      }
      let rises = this.cellValue(input, output) > 0;
      return (
        "Raising " +
        this.label(input) +
        " goes with " +
        (rises ? "higher " : "lower ") +
        this.label(output) +
        ": " +
        (effect === 1 ? "better" : "worse") +
        ", since " +
        goalText +
        "."
      );
    },
    readable(value) {
      return value === null ? "not readable" : fixed(value);
    },
    rowTitle(input) {
      let flags = this.result.flags[input];
      if (flags && flags.fewValues) {
        return (
          input + " — only a few distinct values; read the rank number here."
        );
      }
      return input;
    },
    isFewValues(dim) {
      let flags = this.result.flags[dim];
      return !!flags && flags.fewValues;
    },
    r2Text(output) {
      let model = this.result.models[output];
      return model && model.ok ? "R² " + fixed(model.r2) : "no R²";
    },
    /**
     * Why one output has no influence column. The matrix stays on screen: the
     * correlations are unaffected by a regression that wouldn't fit.
     */
    modelNote(output) {
      if (!output || !this.result) return "";
      let model = this.result.models[output];
      if (!model || model.ok) return "";
      let used = model.used ? model.used.length : 0;
      if (model.reason === "too-few-rows") {
        return (
          "Only " +
          model.n.toLocaleString() +
          " of " +
          this.result.rows.toLocaleString() +
          " options have values on all of these."
        );
      }
      if (model.reason === "too-many-inputs") {
        return (
          "Too many inputs for one model (" +
          used +
          " chosen, " +
          MAX_INPUTS +
          " at most). The correlations still hold."
        );
      }
      if (model.reason === "constant-output") {
        return this.label(output) + " never changes, so nothing explains it.";
      }
      if (model.reason === "collinear") {
        return "Two of these inputs are one column here, so no influence can be split between them.";
      }
      return "None of the chosen inputs varies, so there is no influence to show.";
    },
    barStyle(bar) {
      let clamped = Math.max(-1, Math.min(1, bar.value));
      let half = Math.abs(clamped) * 50;
      return {
        width: half + "%",
        left: (clamped >= 0 ? 50 : 50 - half) + "%",
        background: interpolateRdBu((clamped + 1) / 2),
      };
    },
    joinNames(dims) {
      let names = dims.map(this.label);
      if (names.length === 1) return names[0];
      return names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
    },
    /**
     * Plots the pair, so a number can be looked at as a shape. Never touches
     * the selection: reading the matrix shouldn't cost the user their work.
     */
    pickPair(input, output) {
      if (input === output) return;
      this.$store.commit("setViewSetting", { key: "scatterX", value: input });
      this.$store.commit("setViewSetting", { key: "scatterY", value: output });
      if (!this.layouts.some((layout) => layout.type === SCATTER_TYPE)) {
        this.$store.commit("openLayout", { type: SCATTER_TYPE });
      }
      // Closed, or the plot it just set up stays hidden behind this.
      this.open = false;
    },
    download() {
      if (!this.result) return;
      let name =
        "designsense-sensitivity-" +
        new Date().toISOString().slice(0, 10) +
        ".csv";
      let url = URL.createObjectURL(
        new Blob([sensitivityCsv(this.result)], {
          type: "text/csv;charset=utf-8",
        })
      );
      let a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  },
};
</script>

<style scoped>
.sx-card {
  display: flex;
  flex-direction: column;
  background: #fff;
}
.sx-bar {
  flex: 0 0 auto;
  border-bottom: 1px solid #e3e8ee;
}
.sx-bar ::v-deep .v-toolbar__content {
  padding: 0 8px 0 16px;
}
.sx-title {
  font-size: 16px;
  font-weight: 600;
  color: #263238;
  white-space: nowrap;
}
.sx-meta {
  margin-left: 12px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #546e7a;
  font-size: 12px;
}
.sx-info.v-icon {
  margin: 0 4px 0 6px;
  color: #78909c;
  cursor: help;
}
.sx-tip {
  display: block;
}
.sx-tip-line {
  display: block;
  font-size: 12px;
  line-height: 1.45;
}
.sx-tip-line + .sx-tip-line {
  margin-top: 8px;
}
.sx-btn.v-btn--icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  color: #546e7a;
}
.sx-btn--on.v-btn--icon {
  color: #1565c0;
  background: rgba(21, 101, 192, 0.12);
}
.sx-select {
  flex: 0 0 240px;
  max-width: 240px;
  font-size: 13px;
}
.sx-select ::v-deep .v-input__control > .v-input__slot {
  min-height: 28px !important;
  padding: 0 4px 0 8px !important;
  background: #fff;
}
.sx-select ::v-deep fieldset {
  border-color: #d5dce4;
}

.sx-body {
  flex: 1 1 auto;
  padding: 12px 16px 16px !important;
  color: #263238;
  font-size: 13px;
}
.sx-pickers {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 8px;
}
.sx-picker {
  flex: 1 1 320px;
  min-width: 240px;
}

.sx-guide {
  max-width: 620px;
  padding: 14px 0 4px;
}
.sx-guide-line {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: #37474f;
}
.sx-guide-quiet {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: #78909c;
}
.sx-guide-quiet code {
  padding: 1px 4px;
  background: #eceff1;
  box-shadow: none;
  color: #455a64;
  font-size: 12px;
}
/* One line of caveats under the pickers; each says the rest on hover. */
.sx-caveats {
  margin: 0 0 10px;
}

/* --- The sections ------------------------------------------------------ */
.ax-section + .ax-section {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #e3e8ee;
}
.ax-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 8px;
  margin-bottom: 8px;
}
.ax-head-title {
  font-size: 15px;
  font-weight: 600;
  color: #263238;
}
.ax-head-meta {
  font-size: 12px;
  color: #78909c;
}
.ax-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 8px;
  margin-top: 10px;
}
.ax-actions .v-btn.v-btn {
  letter-spacing: 0;
  text-transform: none;
}
.ax-switch.v-input {
  flex: 0 0 auto;
  margin: 0;
  padding: 0;
}
.ax-switch ::v-deep .v-label {
  font-size: 13px;
  color: #37474f;
}
.ax-check.v-input {
  flex: 0 0 auto;
  margin: 0;
  padding: 0;
}
.ax-check ::v-deep .v-label {
  font-size: 12px;
}
.ax-note {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.45;
  color: #78909c;
}
.ax-link.v-btn {
  letter-spacing: 0;
  text-transform: none;
}
.ax-measures.v-btn-toggle {
  border-radius: 6px;
}
.ax-measures .v-btn.v-btn {
  height: 26px !important;
  padding: 0 10px;
  font-size: 12px;
  letter-spacing: 0;
  text-transform: none;
}

/* --- Dimensions: a tile each, two rows until asked for the rest --------- */
/* Tiles grow with the window's height, so a tall screen reads them larger. */
.ax-dims {
  --tile-height: clamp(120px, 16vh, 176px);
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  grid-auto-rows: var(--tile-height);
  gap: 10px;
}
/* Two rows of tiles and the gap between them. */
.ax-dims--collapsed {
  max-height: calc(2 * var(--tile-height) + 10px);
  overflow: hidden;
}
.ax-dim {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 7px 10px 6px;
  border: 1px solid #e3e8ee;
  border-radius: 6px;
  background: #fbfcfd;
}
/* The dimensions a user made, in their colours (see KIND_MARKS). */
.ax-dim--custom {
  border-left: 3px solid #6a1b9a;
  background: #fbf8fc;
}
.ax-dim--weighted {
  border-left: 3px solid #00796b;
  background: #f7fbfa;
}
.ax-dim-head {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 13px;
  line-height: 18px;
  color: #37474f;
}
.ax-dim-name {
  flex: 1 1 auto;
  min-width: 0;
  font-weight: 600;
}
.ax-kind {
  flex: 0 0 auto;
  padding: 0 5px;
  border-radius: 3px;
  font-size: 11px;
  line-height: 16px;
  background: #eceff1;
  color: #607d8b;
}
/* As the parallel coordinates colour them: inputs black, outputs steel blue. */
.ax-kind--in {
  background: #e0e4e7;
  color: #263238;
}
.ax-kind--out {
  background: #e3eef8;
  color: #2f6a9e;
}
.ax-kind--custom {
  background: rgba(106, 27, 154, 0.12);
  color: #6a1b9a;
}
.ax-kind--weighted {
  background: rgba(0, 121, 107, 0.12);
  color: #00796b;
}
.ax-hist {
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: 2px;
  flex: 1 1 auto;
  margin: 6px 0 3px;
  border-bottom: 1px solid #cfd8dc;
}
.ax-hist--empty {
  align-items: center;
  justify-content: center;
  border-bottom: none;
  font-size: 12px;
  color: #90a4ae;
}
/* One standard deviation either side of the average, behind the bars. */
.ax-band {
  position: absolute;
  top: 0;
  bottom: 0;
  background: rgba(25, 118, 210, 0.1);
  pointer-events: none;
}
.ax-bin {
  position: relative;
  flex: 1 1 0;
  min-width: 0;
  background: #90a4ae;
  border-radius: 1px 1px 0 0;
}
.ax-bin:hover,
.ax-stem:hover .ax-stem-bar {
  background: #546e7a;
}
.ax-dim--custom .ax-bin,
.ax-dim--custom .ax-stem-bar {
  background: #ba8fcf;
}
.ax-dim--weighted .ax-bin,
.ax-dim--weighted .ax-stem-bar {
  background: #7fbdb5;
}
.ax-dim--custom .ax-bin:hover,
.ax-dim--custom .ax-stem:hover .ax-stem-bar {
  background: #6a1b9a;
}
.ax-dim--weighted .ax-bin:hover,
.ax-dim--weighted .ax-stem:hover .ax-stem-bar {
  background: #00796b;
}
.ax-mean {
  position: absolute;
  top: -2px;
  bottom: 0;
  width: 2px;
  margin-left: -1px;
  background: #1565c0;
  pointer-events: none;
}
/* Levels: the top of the chart is kept for the counts over the stems, clear
   of the average line, which a balanced sweep puts on its middle level. */
.ax-hist--levels .ax-band,
.ax-hist--levels .ax-mean {
  top: 15px;
}
.ax-stems {
  position: absolute;
  top: 15px;
  right: 0;
  bottom: 0;
  left: 0;
}
/* Wider than its bar, so a thin stem is easy to hover for its count. */
.ax-stem {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 16px;
  margin-left: -8px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.ax-stem-bar {
  position: relative;
  width: 9px;
  background: #90a4ae;
  border-radius: 1px 1px 0 0;
}
.ax-stem-count {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: 2px;
  font-size: 11px;
  line-height: 13px;
  color: #546e7a;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
/* The chart's two ends, or its levels, under the baseline. */
.ax-axis {
  position: relative;
  flex: 0 0 15px;
  margin-bottom: 2px;
  font-size: 11px;
  line-height: 15px;
  color: #78909c;
  font-variant-numeric: tabular-nums;
}
.ax-tick {
  position: absolute;
  top: 0;
  white-space: nowrap;
}
.ax-dim-stats {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  font-size: 12px;
  line-height: 16px;
  color: #78909c;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.ax-dim-stats strong {
  font-weight: 600;
  color: #37474f;
}
/* A section's reading on the left, its plot on the right; stacked when
   narrow. */
.ax-split {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 12px 28px;
}
.ax-split-main {
  flex: 1 1 420px;
  min-width: 0;
}
.ax-split-plot {
  flex: 0 1 380px;
  min-width: 280px;
}
.ax-plot-axes {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}
.ax-plot-label {
  font-size: 12px;
  color: #78909c;
}
.ax-plot-picker.sx-select {
  flex: 1 1 0;
  max-width: none;
  min-width: 0;
}
/* The dimensions with outliers, one row each, the plotted one marked. */
.ax-orows {
  display: flex;
  flex-direction: column;
  border: 1px solid #e3e8ee;
  border-radius: 6px;
  overflow: hidden;
}
.ax-orow {
  display: grid;
  grid-template-columns: minmax(120px, 1.2fr) minmax(90px, auto) minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  padding: 6px 12px;
  border: none;
  border-left: 3px solid transparent;
  background: #fff;
  color: #37474f;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.ax-orow + .ax-orow {
  border-top: 1px solid #eef1f4;
}
.ax-orow:hover {
  background: #f7f9fb;
}
.ax-orow--on {
  border-left-color: #e65100;
  background: #fff8f1;
}
.ax-orow--on:hover {
  background: #fff3e6;
}
.ax-orow-name {
  min-width: 0;
  font-weight: 600;
}
.ax-orow-count {
  color: #8a5300;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.ax-orow-fence {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #78909c;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.ax-quiet {
  margin: 0;
  color: #78909c;
}
.ax-lead {
  margin: 0 0 8px;
  color: #37474f;
}

/* How many stand far out on a dimension, in the caveats' amber. */
.ax-far {
  padding: 0 5px;
  border-radius: 3px;
  background: #fff4e5;
  color: #8a5300;
}
.ax-more {
  margin-top: 6px;
  padding: 0;
  border: none;
  background: none;
  color: #1565c0;
  font-size: 12px;
  cursor: pointer;
}
.ax-more:hover {
  text-decoration: underline;
}

/* The matrix scrolls sideways inside the dialog, never the page. */
.sx-scroll {
  overflow-x: auto;
  padding-bottom: 6px;
}
.sx-matrix {
  display: grid;
  min-width: min-content;
  border-top: 1px solid #e3e8ee;
  border-left: 1px solid #e3e8ee;
}
.sx-corner,
.sx-rowhead {
  position: sticky;
  left: 0;
  z-index: 1;
  background: #f7f9fb;
}
.sx-corner {
  border-right: 1px solid #e3e8ee;
  border-bottom: 1px solid #e3e8ee;
}
.sx-colhead {
  padding: 6px 8px;
  border-right: 1px solid #e3e8ee;
  border-bottom: 1px solid #e3e8ee;
  background: #f7f9fb;
  color: #37474f;
}
.sx-colname {
  display: block;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.3;
}
.sx-r2 {
  margin-top: 2px;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: #546e7a;
}
.sx-colwarn {
  margin-top: 2px;
  font-size: 12px;
  line-height: 1.35;
  color: #b26500;
}
.sx-rowhead {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  min-height: 34px;
  border-right: 1px solid #e3e8ee;
  border-bottom: 1px solid #e3e8ee;
  font-size: 13px;
  color: #37474f;
}
.sx-rowname {
  min-width: 0;
}
.sx-few {
  flex: 0 0 auto;
  padding: 0 4px;
  border-radius: 3px;
  background: #eceff1;
  color: #78909c;
  font-size: 11px;
}
.sx-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  border-right: 1px solid #e3e8ee;
  border-bottom: 1px solid #e3e8ee;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}
.sx-cell:hover {
  outline: 2px solid #1565c0;
  outline-offset: -2px;
}
.sx-same,
.sx-blank {
  background: #fafbfc;
  cursor: default;
}
.sx-same:hover,
.sx-blank:hover {
  outline: none;
}
/* Too few options behind a number for it to mean anything. */
.sx-thin {
  opacity: 0.4;
}

.sx-views {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 20px;
}
.sx-view {
  min-width: 0;
}
/* The matrix takes most of the room a wide dialog gives, so it can show every
   output without scrolling; the bars read fine at half its width. */
.sx-view--matrix {
  flex: 3 1 600px;
}
.sx-view--bars {
  flex: 1 1 380px;
  max-width: 640px;
}
.sx-bars-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.sx-bars-label {
  color: #546e7a;
  font-size: 13px;
  font-weight: 500;
}
.sx-bar-row {
  display: grid;
  grid-template-columns: minmax(120px, 220px) 1fr 52px auto;
  align-items: center;
  gap: 10px;
  padding: 3px 0;
  color: #37474f;
  cursor: pointer;
}
.sx-bar-row:hover {
  background: #f4f7fa;
}
.sx-bar-label {
  min-width: 0;
  font-size: 13px;
}
.sx-bar-track {
  position: relative;
  height: 20px;
  background: #f4f6f8;
  border-radius: 3px;
}
.sx-bar-zero {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1px;
  background: #cfd8dc;
}
.sx-bar-fill {
  position: absolute;
  top: 3px;
  bottom: 3px;
  border-radius: 2px;
}
/* Whether raising the input helps or hurts, for an output with a goal. */
.sx-bar-effect {
  min-width: 56px;
  font-size: 12px;
  color: #78909c;
}
.sx-bar-value {
  text-align: right;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: #37474f;
}
</style>

<style>
/* The dialog's box lives outside this component, so this can't be scoped.
   Taller than Vuetify's 90%, to give the charts the window. */
.v-dialog.sx-dialog {
  max-height: 96vh;
}
</style>
