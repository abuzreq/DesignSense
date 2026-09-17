<template>
  <v-dialog
    v-model="open"
    fullscreen
    scrollable
    transition="dialog-bottom-transition"
    @keydown="onDialogKey"
  >
    <!-- Built only while shown: the reading walks every row of the whole
         collection, and would otherwise recompute as values change anywhere. -->
    <v-card v-if="contentShown" class="sx-card">
      <v-toolbar flat dense class="sx-bar">
        <span class="sx-title">Sensitivity</span>
        <span class="sx-meta" :title="denominatorText">{{ denominatorText }}</span>
        <v-tooltip bottom max-width="420">
          <template v-slot:activator="{ on }">
            <v-icon v-on="on" small class="sx-info"
              >mdi-information-outline</v-icon
            >
          </template>
          <span class="sx-tip">
            <span class="sx-tip-line"
              >Linear r is how closely two dimensions move together in a
              straight line, from -1 to 1. Rank ρ is the same on rank order, so
              it also catches relationships that bend. Influence β is how much
              an output goes up per input, with the other inputs held still.
              R² is how much of an output all the chosen inputs explain
              together.</span
            >
            <span class="sx-tip-line"
              >These are patterns in the options you loaded, not proof of cause.
              An input can look influential only because it moves with another
              one.</span
            >
            <span class="sx-tip-line"
              >They also assume the options sample the design space: a full,
              space-filling or otherwise sound design of experiments. Nothing
              in the numbers can tell an even sweep from a lopsided one, so
              how the options were generated decides what these mean.</span
            >
            <span class="sx-tip-line"
              >If the options came from an optimiser, the inputs are already
              related to each other, and these numbers reflect that search as
              much as the design.</span
            >
          </span>
        </v-tooltip>

        <v-spacer />

        <v-select
          v-model="measure"
          :items="measureChoices"
          dense
          outlined
          hide-details
          class="sx-select sx-select--measure"
        />
        <v-tooltip bottom>
          <template v-slot:activator="{ on }">
            <v-btn
              icon
              small
              v-on="on"
              class="sx-btn ml-1"
              :disabled="!result"
              @click="download"
            >
              <v-icon small>mdi-download</v-icon>
            </v-btn>
          </template>
          <span>Download these numbers as CSV</span>
        </v-tooltip>
        <v-btn icon small class="ml-1" aria-label="Close" @click="open = false">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-toolbar>

      <v-card-text class="sx-body">
        <div class="sx-pickers">
          <v-autocomplete
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
          <v-autocomplete
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

        <!-- The first thing to say about a sensitivity reading is what it
             rests on. Nothing in the numbers reveals how the options were
             generated, so it is stated in the open rather than left to the
             tooltip. -->
        <p class="sx-sampling">
          <v-icon x-small class="sx-sampling-icon"
            >mdi-information-outline</v-icon
          >
          <span
            >The analysis here is only as good as the sampling behind it, i.e.,
            adequate sample size and reasonable representation of the design
            space. A hand-picked set, or the path an optimiser took, mostly
            describes itself.</span
          >
        </p>

        <!-- What the three numbers are. The select names them; this says
             what each one answers and where they part company. -->
        <div class="sx-legend">
          <div
            v-for="choice in measureChoices"
            :key="choice.value"
            class="sx-legend-item"
            :class="{ 'sx-legend-item--on': choice.value === measure }"
            :title="'Show ' + choice.text"
            @click="measure = choice.value"
          >
            <div class="sx-legend-name">{{ choice.text }}</div>
            <div class="sx-legend-text">{{ choice.note }}</div>
          </div>
        </div>
        <p class="sx-legend-diff">
          All three run from -1 to 1, and the sign says which way the output
          goes. Influence weighs the chosen inputs together, while rank and
          linear read one pair at a time: where influence is small but linear
          is large, another input is carrying that relationship, and where rank
          beats linear, the relationship is steady but not straight.
        </p>

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
            <p v-for="note in notes" :key="note" class="sx-note">{{ note }}</p>

            <!-- Both readings at once: the grid answers "what moves what"
                 across every pair, the bars rank one output's inputs. Plain
                 DOM rather than SVG -- a hundred cells of text that stay
                 selectable, and no resize lifecycle to manage. -->
            <div class="sx-views">
              <div class="sx-view sx-view--matrix">
                <div class="sx-view-head">Every input against every output</div>
                <div class="sx-scroll">
                  <div class="sx-matrix" :style="matrixStyle">
                    <div class="sx-corner"></div>
                    <div
                      v-for="output in result.outputs"
                      :key="'head-' + output"
                      class="sx-colhead"
                      :title="output"
                    >
                      <div class="sx-colname">{{ label(output) }}</div>
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
                        <span class="sx-rowname">{{ label(input) }}</span>
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
                  <v-select
                    v-model="focusOutput"
                    :items="outputChoices"
                    dense
                    outlined
                    hide-details
                    class="sx-select sx-select--focus"
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
                  <div class="sx-bar-label" :title="bar.input">
                    {{ label(bar.input) }}
                  </div>
                  <div class="sx-bar-track">
                    <div class="sx-bar-zero"></div>
                    <div class="sx-bar-fill" :style="barStyle(bar)"></div>
                  </div>
                  <div class="sx-bar-value">{{ fmt(bar.value) }}</div>
                </div>
              </div>
            </div>
          </template>
        </template>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script>
import { mapGetters, mapState } from "vuex";
import { interpolateRdBu } from "d3-scale-chromatic";
import { sensitivity, sensitivityCsv } from "@/analysis/sensitivity.js";
import { INPUT, OUTPUT, columnKind, dimensionItems, displayName } from "@/columns.js";
import { isMissingFor } from "@/store/dimensions.js";
import { RATING_DIMENSION } from "@/ratings.js";

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
// The panel this dialog plots a pair in.
const SCATTER_TYPE = "ScatterPlot";

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
 * Which inputs move which outputs, over the whole collection.
 *
 * Deliberately reads `rawData` rather than `data`: the question is what the
 * design space does, not what the current zoom happens to hold, and a
 * correlation over a brushed corner of the space is a different claim.
 *
 * The arithmetic lives in analysis/sensitivity.js; this is the reading of it.
 * Both views are plain DOM on a CSS grid rather than d3-drawn SVG -- about a
 * hundred cells of text, which stay selectable and need no resize lifecycle.
 */
export default {
  name: "SensitivityDialog",
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
    };
  },
  created() {
    this.applyDefaults();
  },
  beforeDestroy() {
    clearTimeout(this.hideContentTimer);
    clearTimeout(this.computeTimer);
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
    ...mapGetters(["hasRatings", "isUnfilterable"]),
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
          "minmax(150px, 220px) repeat(" + columns + ", minmax(104px, 1fr))",
      };
    },
    /** The caveats that belong beside the numbers rather than inside a tooltip. */
    notes() {
      if (!this.result) return [];
      let notes = [];
      let total = this.rawData.length;
      if (this.result.sampled) {
        notes.push(
          "Read over " +
            this.result.rows.toLocaleString() +
            " evenly spaced options of " +
            total.toLocaleString() +
            ", to keep this quick."
        );
      }
      if (this.result.inputs.length > this.shownInputs.length) {
        notes.push(
          "Showing the top " +
            this.shownInputs.length +
            " of " +
            this.result.inputs.length +
            " inputs, ranked by how strongly they move with " +
            this.label(this.focusOutput) +
            "."
        );
      }
      notes = notes.concat(this.collinearNotes, this.ridgedNote, this.fewValuesNote);
      return notes.filter(Boolean);
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
    fewValuesNote() {
      let flags = this.result.flags;
      let dims = this.shownInputs
        .concat(this.result.outputs)
        .filter(function(dim) {
          return flags[dim] && flags[dim].fewValues;
        });
      if (dims.length === 0) return [];
      return [
        this.joinNames(dims) +
          (dims.length === 1 ? " has" : " have") +
          " only a few distinct values — read the rank number, not the linear one.",
      ];
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
            // Nothing on screen needs it, and it holds a copy of the columns.
            this.result = null;
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
    // Ratings and custom values change in place; recompute only when one of
    // the dimensions being read is one of them.
    dimensionValuesVersion() {
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
      if (!this.contentShown || !this.hasPair) {
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
      return (
        names +
        ": rank ρ " +
        this.readable(cell.rho) +
        ", linear r " +
        this.readable(cell.r) +
        beta +
        ", over " +
        cell.n.toLocaleString() +
        " options. Click to plot them." +
        thin
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
  flex: 0 0 150px;
  max-width: 150px;
  font-size: 13px;
}
.sx-select--focus {
  flex: 0 0 200px;
  max-width: 200px;
}
.sx-select ::v-deep .v-input__control > .v-input__slot {
  min-height: 30px !important;
  padding: 0 4px 0 8px !important;
  background: #fff;
}
.sx-select ::v-deep fieldset {
  border-color: #d5dce4;
}

.sx-body {
  flex: 1 1 auto;
  padding: 14px 16px 24px !important;
  color: #263238;
  font-size: 13px;
}
.sx-pickers {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 14px;
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
.sx-sampling {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0 0 14px;
  max-width: 880px;
  padding: 8px 10px;
  border-left: 3px solid #cfd8dc;
  background: #f7f9fa;
  font-size: 12px;
  line-height: 1.5;
  color: #546e7a;
}
.sx-sampling-icon.v-icon {
  margin-top: 2px;
  color: #90a4ae;
}
.sx-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 0 0 8px;
}
.sx-legend-item {
  flex: 1 1 250px;
  min-width: 210px;
  padding: 8px 10px;
  border: 1px solid #e0e6ea;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
}
.sx-legend-item:hover {
  border-color: #b0bec5;
}
/* The one the numbers are showing; clicking another switches to it. */
.sx-legend-item--on {
  border-color: #1976d2;
  background: #f3f8fd;
}
.sx-legend-name {
  margin-bottom: 2px;
  font-size: 12px;
  font-weight: 600;
  color: #37474f;
}
.sx-legend-text {
  font-size: 12px;
  line-height: 1.45;
  color: #607d8b;
}
.sx-legend-diff {
  margin: 0 0 16px;
  max-width: 880px;
  font-size: 12px;
  line-height: 1.5;
  color: #78909c;
}
.sx-note {
  margin: 0 0 6px;
  max-width: 880px;
  font-size: 12px;
  line-height: 1.5;
  color: #546e7a;
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
}
.sx-colname {
  font-size: 13px;
  font-weight: 600;
  color: #37474f;
  line-height: 1.3;
}
.sx-r2 {
  margin-top: 2px;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: #546e7a;
}
.sx-colwarn {
  margin-top: 2px;
  font-size: 11px;
  line-height: 1.35;
  color: #b26500;
}
.sx-rowhead {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  min-height: 28px;
  border-right: 1px solid #e3e8ee;
  border-bottom: 1px solid #e3e8ee;
  font-size: 13px;
  color: #37474f;
}
.sx-rowname {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sx-few {
  flex: 0 0 auto;
  padding: 0 4px;
  border-radius: 3px;
  background: #eceff1;
  color: #78909c;
  font-size: 10px;
}
.sx-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  border-right: 1px solid #e3e8ee;
  border-bottom: 1px solid #e3e8ee;
  font-size: 12px;
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
  gap: 28px;
}
.sx-view {
  min-width: 0;
}
.sx-view--matrix {
  flex: 1 1 520px;
}
.sx-view--bars {
  flex: 1 1 400px;
  max-width: 620px;
  padding-top: 2px;
}
.sx-view-head {
  margin-bottom: 10px;
  color: #546e7a;
  font-size: 12px;
  font-weight: 500;
  /* The bars carry a select on their heading line; this keeps the two
     headings on the same line as each other. */
  line-height: 40px;
}
.sx-bars-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.sx-bars-label {
  color: #546e7a;
  font-size: 12px;
  font-weight: 500;
}
.sx-bar-row {
  display: grid;
  grid-template-columns: minmax(120px, 190px) 1fr 56px;
  align-items: center;
  gap: 10px;
  padding: 3px 0;
  cursor: pointer;
}
.sx-bar-row:hover {
  background: #f4f7fa;
}
.sx-bar-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: #37474f;
}
.sx-bar-track {
  position: relative;
  height: 16px;
  background: #f4f6f8;
  border-radius: 2px;
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
  top: 2px;
  bottom: 2px;
  border-radius: 2px;
}
.sx-bar-value {
  text-align: right;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: #37474f;
}
</style>
