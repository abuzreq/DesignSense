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
import {
  INPUT,
  MIN,
  OUTPUT,
  columnKind,
  dimensionItems,
  displayName,
} from "@/columns.js";
import { isMissingFor } from "@/store/dimensions.js";
import { formatValue } from "@/store/filters.js";
import { RATING_DIMENSION } from "@/ratings.js";
import CaveatChips from "@/components/CaveatChips.vue";
import DimensionName from "@/components/DimensionName.vue";
import DimensionPicker from "@/components/DimensionPicker.vue";

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
 * The analysis dialog: every dimension on its own, then which inputs move
 * which outputs, over the whole collection.
 *
 * Deliberately reads `rawData` rather than `data`: the question is what the
 * design space does, not what the current zoom happens to hold, and a
 * correlation over a brushed corner of the space is a different claim.
 *
 * The arithmetic lives in analysis/summary.js and analysis/sensitivity.js;
 * this is the reading of it. Everything is plain DOM rather than d3-drawn SVG
 * -- small histograms and about a hundred cells of text, which stay
 * selectable and need no resize lifecycle.
 */
export default {
  name: "SensitivityDialog",
  components: { CaveatChips, DimensionName, DimensionPicker },
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
      allDimensions: (state) => state.allDimensions,
      numericDimensions: (state) => state.numericDimensions,
      dimensionValuesVersion: (state) => state.dimensionValuesVersion,
      layouts: (state) => state.layouts,
    }),
    ...mapGetters(["hasRatings", "isUnfilterable", "goalOf"]),
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
      let count = this.rawData.length;
      return (
        count.toLocaleString() +
        (count === 1 ? " option" : " options") +
        " · whole collection"
      );
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
            this.rawData.length.toLocaleString(),
          detail: [
            "Read over " +
              result.rows.toLocaleString() +
              " evenly spaced options of " +
              this.rawData.length.toLocaleString() +
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
    rawData() {
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
      this.result = sensitivity(this.rawData, this.inputs, this.outputs, {
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
        summarize(this.rawData, dims, { isMissing: isMissingFor }).map(
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
      return text;
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

/* --- The two sections -------------------------------------------------- */
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
