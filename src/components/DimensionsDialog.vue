<template>
  <v-dialog v-model="open" width="700" scrollable @keydown="onDialogKey">
    <!-- Built only while shown: its coverage counts read every row, and would
         otherwise re-render with every value entered anywhere. -->
    <v-card v-if="contentShown" class="dims-dialog">
      <v-card-title class="dims-title">
        <v-btn
          v-if="view !== 'manage' && returnToManage"
          icon
          small
          class="mr-1"
          @click="back"
        >
          <v-icon>mdi-arrow-left</v-icon>
        </v-btn>
        <span class="dims-title-text">{{ title }}</span>
        <v-spacer />
        <!-- The file's columns and their roles, which goals build on. -->
        <v-btn
          v-if="view === 'manage'"
          small
          text
          class="dims-columns-btn"
          @click="openColumns"
        >
          <v-icon small left>mdi-table-cog</v-icon>
          Columns
        </v-btn>
        <v-btn icon small @click="open = false">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>
      <v-divider />

      <v-card-text class="dims-body">
        <v-alert
          v-if="confirm"
          type="warning"
          dense
          outlined
          class="mt-3 mb-2"
        >
          <div>{{ confirm.message }}</div>
          <div class="mt-2 d-flex justify-end">
            <v-btn small text @click="confirm = null">Cancel</v-btn>
            <v-btn small depressed color="error" class="ml-2" @click="confirmYes">{{
              confirm.action
            }}</v-btn>
          </div>
        </v-alert>

        <!-- Manage -->
        <template v-if="view === 'manage'">
          <v-alert
            v-if="dimensionStorageError"
            type="error"
            dense
            outlined
            class="mt-3 mb-2"
            >{{ dimensionStorageError }}</v-alert
          >
          <v-alert
            v-if="skippedDimensions.length > 0"
            type="info"
            dense
            outlined
            class="mb-2"
          >
            Saved but hidden, since this data doesn't fit them:
            {{ skippedDimensions.map(label).join(", ") }}.
          </v-alert>

          <!-- Which way is better, for what the options are judged on. The
               file can say so too, with min: and max: columns. -->
          <section class="goals">
            <div class="dims-section-head">
              <span class="dims-section-title">Goals</span>
              <span class="dims-section-meta"
                >Which way is better. Pareto fronts, new weighted dimensions,
                the analysis and the parallel coordinates read these.
                {{
                  isLite
                    ? "Ask the assistant for the best trade-offs."
                    : "Keep the best trade-offs by them in the Analysis panel."
                }}</span
              >
            </div>
            <div v-if="goalRows.length === 0" class="dims-empty">
              This collection has no numeric dimensions.
            </div>
            <div v-for="dim in goalRows" :key="dim" class="goal-row">
              <DimensionName class="goal-name" :name="dim" truncate />
              <span v-if="goalSource(dim) === 'file'" class="dims-origin"
                >from file</span
              >
              <v-spacer />
              <span v-if="goalSource(dim) === 'fixed'" class="goal-fixed">{{
                fixedGoalText(dim)
              }}</span>
              <v-btn-toggle
                v-else
                :value="goalOf(dim) || 'none'"
                mandatory
                dense
                class="goal-toggle"
                @change="setGoal(dim, $event)"
              >
                <v-btn
                  small
                  value="max"
                  :aria-label="'Higher ' + label(dim) + ' is better'"
                  >&uarr; Higher</v-btn
                >
                <v-btn
                  small
                  value="min"
                  :aria-label="'Lower ' + label(dim) + ' is better'"
                  >&darr; Lower</v-btn
                >
                <v-btn
                  small
                  value="none"
                  :aria-label="'No goal for ' + label(dim)"
                  >None</v-btn
                >
              </v-btn-toggle>
            </div>
            <button
              v-if="otherGoalDims.length > 0"
              type="button"
              class="goals-more"
              @click="showOtherGoals = !showOtherGoals"
            >
              {{
                showOtherGoals
                  ? "Hide inputs"
                  : "Show inputs (" + otherGoalDims.length + ")"
              }}
            </button>
          </section>

          <div class="dims-section-head">
            <span class="dims-section-title"
              >Custom and Weighted Dimensions</span
            >
          </div>
          <p class="dims-intro dims-mcda">
            Judge options on criteria of your own with custom dimensions, then
            weigh several together into a weighted dimension for
            <strong>multicriteria decision analysis</strong>. Enter values
            beside the star rating or by dragging a knob on the parallel
            coordinates.
          </p>
          <div v-if="listedDefs.length === 0" class="dims-empty">
            No custom or weighted dimensions yet.
          </div>
          <v-list v-else dense class="py-0">
            <v-list-item v-for="def in listedDefs" :key="def.name" class="dims-row">
              <v-list-item-icon class="mr-3">
                <v-icon
                  small
                  :color="def.kind === 'custom' ? 'purple darken-3' : 'teal darken-2'"
                  >{{
                    def.kind === "custom" ? "mdi-pencil-ruler" : "mdi-sigma"
                  }}</v-icon
                >
              </v-list-item-icon>
              <v-list-item-content>
                <v-list-item-title class="dims-name"
                  >{{ label(def.name) }}
                  <span v-if="def.fromFile" class="dims-origin"
                    >from file</span
                  ></v-list-item-title
                >
                <v-list-item-subtitle class="dims-summary"
                  >{{ summary(def) }} &middot; {{ coverageText(def) }}</v-list-item-subtitle
                >
              </v-list-item-content>
              <v-list-item-action class="dims-actions">
                <!-- The rating's range is fixed: whole stars, 1 to 5. -->
                <v-tooltip v-if="def.name !== ratingDimension" bottom>
                  <template v-slot:activator="{ on }">
                    <v-btn
                      icon
                      small
                      v-on="on"
                      @click="
                        def.kind === 'custom'
                          ? startCustom(def.name)
                          : startWeighted(def.name)
                      "
                    >
                      <v-icon small>mdi-pencil</v-icon>
                    </v-btn>
                  </template>
                  <span>{{
                    def.kind === "custom"
                      ? "Change its range"
                      : def.terms.length === 0
                      ? "Give it weights"
                      : "Change its weights"
                  }}</span>
                </v-tooltip>
                <v-tooltip v-if="def.kind === 'custom'" bottom>
                  <template v-slot:activator="{ on }">
                    <v-btn icon small v-on="on" @click="askClear(def)">
                      <v-icon small>mdi-eraser</v-icon>
                    </v-btn>
                  </template>
                  <span>Clear every value</span>
                </v-tooltip>
                <v-tooltip v-if="!def.fromFile" bottom>
                  <template v-slot:activator="{ on }">
                    <v-btn icon small v-on="on" @click="askDelete(def)">
                      <v-icon small>mdi-delete-outline</v-icon>
                    </v-btn>
                  </template>
                  <span>Delete</span>
                </v-tooltip>
              </v-list-item-action>
            </v-list-item>
          </v-list>
          <p class="dims-reference">
            These follow the design space construction framework of Haymaker
            et al. (2018), in which options are judged against objectives and
            the objectives are weighed by preference into an overall value:
            custom dimensions are objectives you judge yourself, and weighted
            dimensions are that value. See &ldquo;<a
              :href="paperUrl"
              target="_blank"
              rel="noopener noreferrer"
              >Design space construction: a framework to support
              collaborative, parametric decision making</a
            >,&rdquo; <em>ITcon</em> 23(8): 157&ndash;178.
          </p>
        </template>

        <!-- New custom dimension, or a custom dimension's range -->
        <template v-else-if="view === 'custom'">
          <p class="dims-intro mt-3">
            <template v-if="editingName"
              >Entered values must fit the new range.</template
            >
            <template v-else
              >A criterion you judge yourself, such as looks.</template
            >
          </p>
          <v-text-field
            v-model="customForm.name"
            label="Name"
            dense
            outlined
            autofocus
            :disabled="!!editingName"
            hide-details="auto"
            class="mb-3"
            @keydown.enter="submitCustom"
          />
          <div class="d-flex dims-range">
            <v-text-field
              v-model="customForm.min"
              label="Lowest value"
              type="number"
              dense
              outlined
              hide-details="auto"
              class="mr-3"
              @keydown.enter="submitCustom"
            />
            <v-text-field
              v-model="customForm.max"
              label="Highest value"
              type="number"
              dense
              outlined
              hide-details="auto"
              @keydown.enter="submitCustom"
            />
          </div>
        </template>

        <!-- New weighted dimension, or a weighted dimension's weights -->
        <template v-else-if="view === 'weighted'">
          <p class="dims-intro mt-3">
            Each dimension is scaled to 0&ndash;1, flipped if lower is better,
            and averaged by its share. The shares always add up to 100%:
            raising one lowers the others in proportion.
            <template v-if="editingFromFile"
              >Shows the file's values until weighted.</template
            >
            <template v-if="editingName">Changes apply live.</template>
          </p>
          <v-text-field
            v-if="!editingName"
            v-model="weightedForm.name"
            label="Name"
            placeholder="score"
            dense
            outlined
            autofocus
            hide-details="auto"
            class="mb-3"
          />

          <!-- One line per dimension under one header: which, its share,
               and which way is better. -->
          <div class="term-row term-head" aria-hidden="true">
            <span>Dimension</span>
            <span class="term-head-share">Share</span>
            <span>Better</span>
          </div>
          <div
            v-for="(term, i) in weightedForm.terms"
            :key="term.key"
            class="term-row"
          >
            <DimensionPicker
              v-model="term.dim"
              :items="itemsFor(term)"
              placeholder="Pick a dimension"
              dense
              outlined
              hide-details
              class="term-dim"
              @change="pickTermDim(term)"
            />
            <!-- Shares of the whole, always adding up to 100%: moving one
                 moves the others in proportion to theirs (see rebalance). -->
            <v-slider
              :value="term.dim ? term.weight * 100 : 0"
              min="0"
              max="100"
              step="0"
              dense
              hide-details
              class="term-slider"
              aria-label="Share"
              :disabled="!term.dim || countedTerms.length < 2"
              title="Its share of the weighted value. Raising it lowers the others in proportion, so together they always make 100%."
              @input="slideShare(term, $event)"
            />
            <!-- Text rather than a number field: no spinner to crowd out
                 the third digit of 100. -->
            <v-text-field
              :value="shareFieldText(term)"
              inputmode="numeric"
              suffix="%"
              dense
              outlined
              hide-details
              class="term-share"
              aria-label="Share, in percent"
              :disabled="!term.dim || countedTerms.length < 2"
              :error="editingShareKey === term.key && !isShareText(term.weightText)"
              @focus="editShare(term)"
              @input="typeShare(term, $event)"
              @blur="editingShareKey = null"
            />
            <v-tooltip bottom max-width="300">
              <template v-slot:activator="{ on }">
                <v-btn
                  v-on="on"
                  small
                  text
                  class="term-flip"
                  :class="{ 'term-flip--conflict': goalConflict(term) }"
                  :disabled="!term.dim"
                  :aria-pressed="String(!!term.lowerIsBetter)"
                  :aria-label="term.lowerIsBetter ? 'Lower is better' : 'Higher is better'"
                  @click="term.lowerIsBetter = !term.lowerIsBetter"
                >
                  <v-icon x-small left>{{
                    term.lowerIsBetter ? "mdi-arrow-down" : "mdi-arrow-up"
                  }}</v-icon
                  >{{ term.lowerIsBetter ? "Lower" : "Higher" }}
                </v-btn>
              </template>
              <span>{{ directionTip(term) }}</span>
            </v-tooltip>
            <v-btn
              icon
              small
              class="term-remove"
              aria-label="Remove"
              @click="removeTerm(i)"
            >
              <v-icon small>mdi-close</v-icon>
            </v-btn>
            <div v-if="termNotes(term).length > 0" class="term-scale">
              <span
                v-for="note in termNotes(term)"
                :key="note.text"
                :class="{ 'term-conflict': note.warn }"
                >{{ note.text }}</span
              >
            </div>
          </div>
          <v-btn small text color="primary" class="mt-1" @click="addTerm">
            <v-icon small left>mdi-plus</v-icon>Add dimension
          </v-btn>
          <div class="dims-preview mt-2">{{ previewText }}</div>
        </template>

        <v-alert
          v-if="error || liveError"
          type="error"
          dense
          outlined
          class="mt-3 mb-0"
          >{{ error || liveError }}</v-alert
        >

      </v-card-text>

      <v-divider />
      <v-card-actions class="dims-footer">
        <template v-if="view === 'manage'">
          <v-btn
            small
            text
            color="error"
            :disabled="defs.length === 0 && skippedDimensions.length === 0"
            @click="askReset"
            >Reset all&hellip;</v-btn
          >
          <v-spacer />
          <v-btn small text @click="startCustom(null)">
            <v-icon small left>mdi-plus</v-icon>Custom dimension
          </v-btn>
          <v-btn small text @click="startWeighted(null)">
            <v-icon small left>mdi-sigma</v-icon>Weighted dimension
          </v-btn>
          <v-btn small depressed color="primary" @click="open = false"
            >Close</v-btn
          >
        </template>
        <template v-else-if="view === 'custom'">
          <v-spacer />
          <v-btn small text @click="back">Cancel</v-btn>
          <v-btn small depressed color="primary" @click="submitCustom">{{
            editingName ? "Save" : "Create"
          }}</v-btn>
        </template>
        <template v-else>
          <v-spacer />
          <template v-if="editingName">
            <v-btn small text :disabled="!isChanged" @click="revert"
              >Revert</v-btn
            >
            <v-btn small depressed color="primary" @click="submitWeighted"
              >Done</v-btn
            >
          </template>
          <template v-else>
            <v-btn small text @click="back">Cancel</v-btn>
            <v-btn small depressed color="primary" @click="submitWeighted"
              >Create</v-btn
            >
          </template>
        </template>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import { mapGetters, mapState } from "vuex";
import { formatValue } from "@/store/filters.js";
import {
  DEFAULT_CUSTOM_BOUNDS,
  coverage,
  isCustom,
  isWeighted,
  makeWeightedDimension,
  weightShares,
  withoutDimension,
} from "@/customDimensions.js";
import {
  CUSTOM,
  INPUT,
  MIN,
  OUTPUT,
  WEIGHTED,
  columnKind,
  dimensionItems,
  displayName,
} from "@/columns.js";
import { isAssetColumn } from "@/data/assets.js";
import DimensionName from "@/components/DimensionName.vue";
import DimensionPicker from "@/components/DimensionPicker.vue";
import { isMissingFor } from "@/store/dimensions.js";
import { RATING_DIMENSION } from "@/ratings.js";

const PAPER_URL = "https://www.itcon.org/papers/2018_08-ITcon-Haymaker.pdf";
// Numeric columns that are bookkeeping rather than something an option is
// judged on, as the parallel coordinates leave them out.
const BOOKKEEPING = ["index", "selected", "ID", "id", "_id", "collection"];
// A little longer than the dialog's fade-out.
const CLOSE_TRANSITION_MS = 400;
// Two weightings whose shares differ by less than this weigh alike.
const SAME_SHARE = 1e-3;

/*
 * Weights count only relative to each other (see weightedValue), so the
 * editor works in shares that add up to 1, shown as percentages.
 */

/** Shares adding up to 1 from any weights; equal ones when all are zero. */
function normalized(weights) {
  let total = weights.reduce((sum, w) => sum + (w > 0 ? w : 0), 0);
  if (total > 0) return weights.map((w) => (w > 0 ? w / total : 0));
  return weights.map(() => 1 / weights.length);
}

/**
 * Sets share `index` to `value` and moves the others in proportion to
 * theirs, so the shares still add up to 1. With the others all at zero,
 * they split what is left evenly.
 */
function rebalance(shares, index, value) {
  let set = Math.max(0, Math.min(1, value));
  let rest = shares.reduce((sum, w, j) => (j === index ? sum : sum + w), 0);
  let left = 1 - set;
  return shares.map((w, j) => {
    if (j === index) return set;
    return rest > 0 ? (w / rest) * left : left / (shares.length - 1);
  });
}

/**
 * Shares as whole percentages that add up to exactly 100, the largest
 * remainders rounded up: 33.3, 33.3 and 33.3 become 34, 33 and 33.
 */
function wholePercents(shares) {
  let total = shares.reduce((sum, w) => sum + w, 0);
  if (!(total > 0)) return shares.map(() => 0);
  let raw = shares.map((w) => (w / total) * 100);
  let whole = raw.map(Math.floor);
  let left = 100 - whole.reduce((sum, w) => sum + w, 0);
  raw
    .map((r, i) => [r - whole[i], i])
    .sort((a, b) => b[0] - a[0])
    .slice(0, left)
    .forEach((pair) => (whole[pair[1]] += 1));
  return whole;
}

/** Whether two lists of terms weigh the same dimensions the same way, by shares. */
function sameWeighting(a, b) {
  if (a.length !== b.length) return false;
  let sa = normalized(a.map((term) => Number(term.weight)));
  let sb = normalized(b.map((term) => Number(term.weight)));
  return a.every(
    (term, i) =>
      term.dim === b[i].dim &&
      !!term.lowerIsBetter === !!b[i].lowerIsBetter &&
      Math.abs(sa[i] - sb[i]) < SAME_SHARE
  );
}

function quoted(name) {
  return "“" + displayName(name) + "”";
}

function formatBound(value, span) {
  return formatValue(value, span);
}

/**
 * Creates, edits and removes custom and weighted dimensions. Opened from the
 * inspection view and the parallel coordinates through the store's
 * `dimensionDialog`, in one of three views: the list, a custom dimension, or
 * a weighted dimension. Dimensions are named by the column names they carry
 * ("custom:looks") but shown without the prefix.
 */
export default {
  name: "DimensionsDialog",
  components: { DimensionName, DimensionPicker },
  data() {
    return {
      ratingDimension: RATING_DIMENSION,
      view: "manage",
      // The dimension being edited; null while creating one.
      editingName: null,
      // Whether the list was open before, so finishing goes back to it.
      returnToManage: false,
      customForm: { name: "", min: "", max: "" },
      weightedForm: { name: "", terms: [] },
      paperUrl: PAPER_URL,
      // The weights a dimension had when its editing began, for Revert.
      snapshot: null,
      error: null,
      liveError: null,
      // { kind, name, message, action } awaiting a yes.
      confirm: null,
      // Whether the dialog's content exists: while open, and through the
      // closing transition.
      contentShown: false,
      // Whether the Goals list shows the inputs too.
      showOtherGoals: false,
      // The term whose percentage is being typed, shown as typed until done.
      editingShareKey: null,
    };
  },
  beforeDestroy() {
    clearTimeout(this.hideContentTimer);
  },
  computed: {
    ...mapState({
      dialogState: (state) => state.dimensionDialog,
      defs: (state) => state.customDimensions,
      rawData: (state) => state.rawData,
      dimensionStorageError: (state) => state.dimensionStorageError,
      skippedDimensions: (state) => state.skippedDimensions,
      dimensionValuesVersion: (state) => state.dimensionValuesVersion,
      numericDimensions: (state) => state.numericDimensions,
      allDimensions: (state) => state.allDimensions,
    }),
    ...mapGetters([
      "weightedTermCandidates",
      "scoringBoundsOf",
      "goalOf",
      "goalSource",
      "hasRatings",
      "isLite",
    ]),
    listedDefs() {
      return this.defs;
    },
    /** The numeric dimensions that can have a goal: not bookkeeping or pictures. */
    goalCandidates() {
      return this.numericDimensions.filter(
        (dim) =>
          !isAssetColumn(dim) &&
          BOOKKEEPING.indexOf(dim) === -1 &&
          (dim !== RATING_DIMENSION || this.hasRatings)
      );
    },
    /** Whether the file names its inputs and outputs; without, every column is listed. */
    hasPrefixes() {
      return this.allDimensions.some((dim) => {
        let kind = columnKind(dim);
        return kind === INPUT || kind === OUTPUT;
      });
    },
    /**
     * The Goals list's rows: the outputs, then custom, weighted and the
     * rating. The inputs, and in a file without prefixes nothing, wait
     * behind "Show inputs".
     */
    mainGoalDims() {
      let columns = this.goalCandidates.filter((dim) => dim !== RATING_DIMENSION);
      let byKind = (kind) => columns.filter((dim) => columnKind(dim) === kind);
      let fileColumns = this.hasPrefixes
        ? byKind(OUTPUT)
        : columns.filter((dim) => {
            let kind = columnKind(dim);
            return kind !== CUSTOM && kind !== WEIGHTED;
          });
      let rating = this.goalCandidates.filter((dim) => dim === RATING_DIMENSION);
      return fileColumns.concat(byKind(CUSTOM), byKind(WEIGHTED), rating);
    },
    otherGoalDims() {
      return this.goalCandidates.filter((dim) => this.mainGoalDims.indexOf(dim) === -1);
    },
    goalRows() {
      return this.showOtherGoals
        ? this.mainGoalDims.concat(this.otherGoalDims)
        : this.mainGoalDims;
    },
    open: {
      get() {
        return this.dialogState.open;
      },
      set(value) {
        if (!value) this.$store.dispatch("closeDimensionDialog");
      },
    },
    title() {
      if (this.view === "custom") {
        return this.editingName
          ? "Range of " + this.label(this.editingName)
          : "New Custom Dimension";
      }
      if (this.view === "weighted") {
        return this.editingName
          ? "Weights of " + this.label(this.editingName)
          : "New Weighted Dimension";
      }
      return "Dimensions and Goals";
    },
    /** Whether the weighted dimension being edited is a column of the data file. */
    editingFromFile() {
      let def = this.defs.find((d) => d.name === this.editingName);
      return !!def && !!def.fromFile && isWeighted(def);
    },
    candidates() {
      return this.weightedTermCandidates(this.editingName);
    },
    /** The terms with a dimension picked: those the shares are split among. */
    countedTerms() {
      return this.weightedForm.terms.filter((term) => term.dim);
    },
    /** Each counted term's whole percentage, by its key, adding up to 100. */
    termPercents() {
      let terms = this.countedTerms;
      let whole = wholePercents(terms.map((term) => term.weight));
      let out = {};
      terms.forEach((term, i) => (out[term.key] = whole[i]));
      return out;
    },
    completeTerms() {
      return this.countedTerms.map((term) => ({
        dim: term.dim,
        // Four places: a hundredth of a percent is finer than any slider.
        weight: Math.round(Number(term.weight) * 1e4) / 1e4,
        lowerIsBetter: !!term.lowerIsBetter,
      }));
    },
    /** Changed from where editing began, by shares: 1, 1, 2 and 25%, 25%, 50% are one. */
    isChanged() {
      return !!this.snapshot && !sameWeighting(this.snapshot, this.completeTerms);
    },
    previewText() {
      void this.dimensionValuesVersion;
      let terms = this.completeTerms.filter((term) => term.weight > 0);
      if (terms.length === 0) return "";
      let result = coverage(
        this.rawData,
        makeWeightedDimension("preview", terms),
        isMissingFor
      );
      return this.coverageSentence(result);
    },
  },
  watch: {
    dialogState(next, previous) {
      let wasOpen = !!previous && previous.open;
      clearTimeout(this.hideContentTimer);
      if (next.open) {
        this.contentShown = true;
      } else if (wasOpen) {
        this.hideContentTimer = setTimeout(() => {
          if (!this.dialogState.open) this.contentShown = false;
        }, CLOSE_TRANSITION_MS);
      }
      if (next.open) {
        if (
          !wasOpen ||
          next.mode !== previous.mode ||
          next.name !== previous.name
        ) {
          this.returnToManage = false;
          this.start(next.mode, next.name);
        }
      } else if (wasOpen) {
        this.finishLiveEdit();
      }
    },
    "weightedForm.terms": {
      deep: true,
      handler() {
        if (this.view !== "weighted" || !this.editingName) return;
        let def = this.defs.find((d) => d.name === this.editingName);
        if (def && sameWeighting(def.terms, this.completeTerms)) {
          this.liveError = null;
          return;
        }
        this.$store
          .dispatch("updateWeightedDimension", {
            name: this.editingName,
            terms: this.completeTerms,
            final: false,
          })
          .then((result) => {
            this.liveError = result && result.error ? result.error : null;
          });
      },
    },
  },
  methods: {
    openColumns() {
      this.open = false;
      this.$store.commit("setColumnsDialog", { open: true });
    },
    label: displayName,
    setGoal(dim, choice) {
      this.$store.dispatch("setGoal", {
        dim: dim,
        goal: choice === "none" ? null : choice,
      });
    },
    fixedGoalText(dim) {
      return dim === RATING_DIMENSION
        ? "Higher is better: more stars"
        : "Higher is better: a weighted score";
    },
    start(mode, name) {
      this.error = null;
      this.liveError = null;
      this.confirm = null;
      this.snapshot = null;
      let def = name ? this.defs.find((d) => d.name === name) : null;
      if (mode === "custom") {
        this.view = "custom";
        this.editingName = isCustom(def) ? def.name : null;
        let bounds = isCustom(def) ? def.bounds : DEFAULT_CUSTOM_BOUNDS;
        this.customForm = {
          name: isCustom(def) ? displayName(def.name) : "",
          min: String(bounds[0]),
          max: String(bounds[1]),
        };
      } else if (mode === "weighted") {
        this.view = "weighted";
        this.editingName = isWeighted(def) ? def.name : null;
        let terms;
        if (isWeighted(def)) {
          terms = def.terms.map((term) => Object.assign({}, term));
          this.snapshot = def.terms.map((term) => Object.assign({}, term));
          // One from the file shows the file's values until a weight is given.
          if (terms.length === 0) {
            terms.push({ dim: null, weight: 1, lowerIsBetter: false });
          }
        } else {
          // Starts empty: which dimensions to weigh is the user's to say.
          // Each picked weighs the way its goal says (see pickTermDim).
          terms = [{ dim: null, weight: 0, lowerIsBetter: false }];
        }
        this.weightedForm = { name: "", terms: this.formTerms(terms) };
      } else {
        this.view = "manage";
        this.editingName = null;
      }
    },
    /**
     * The form's terms from stored ones: a key each, weights turned into
     * shares of those with a dimension, and a term without one sharing none.
     */
    formTerms(terms) {
      let counted = terms.filter((term) => term.dim);
      let shares = normalized(counted.map((term) => Number(term.weight)));
      return terms.map((term) => {
        let at = counted.indexOf(term);
        return this.withKey(
          Object.assign({}, term, { weight: at === -1 ? 0 : shares[at] })
        );
      });
    },
    withKey(term) {
      this.termKey = (this.termKey || 0) + 1;
      // `weightText` is the percentage as typed, which may be mid-edit
      // ("", "4") while the share keeps its last valid value; `counted`
      // whether the term holds a share, which picking its first dimension
      // gives it.
      return Object.assign(
        { key: this.termKey, weightText: "", counted: !!term.dim },
        term
      );
    },
    /** Sets one term's share, moving the others in proportion to keep 100%. */
    setShare(term, share) {
      let terms = this.countedTerms;
      let index = terms.indexOf(term);
      if (index === -1) return;
      let next = rebalance(
        terms.map((other) => other.weight),
        index,
        share
      );
      terms.forEach((other, i) => (other.weight = next[i]));
    },
    /** Brings the shares back to 100% after a term left. */
    normalizeShares() {
      let terms = this.countedTerms;
      let next = normalized(terms.map((term) => term.weight));
      terms.forEach((term, i) => (term.weight = next[i]));
    },
    /**
     * A move of the slider. It also reports back positions it is given, as
     * the others move with this one; those are no move at all.
     */
    slideShare(term, position) {
      if (Math.abs(position / 100 - term.weight) < 1e-9) return;
      this.setShare(term, position / 100);
    },
    shareFieldText(term) {
      if (!term.dim) return "";
      return this.editingShareKey === term.key
        ? term.weightText
        : String(this.termPercents[term.key]);
    },
    editShare(term) {
      this.editingShareKey = term.key;
      term.weightText = String(this.termPercents[term.key]);
    },
    isShareText(text) {
      let trimmed = String(text === undefined || text === null ? "" : text).trim();
      let percent = Number(trimmed);
      return trimmed !== "" && isFinite(percent) && percent >= 0 && percent <= 100;
    },
    typeShare(term, text) {
      term.weightText = text;
      if (this.isShareText(text)) this.setShare(term, Number(text) / 100);
    },
    /**
     * A dimension picked for a term: its first gives it an equal share, the
     * others making room in proportion; clearing it gives its share back.
     * It weighs the way the dimension's goal says.
     */
    pickTermDim(term) {
      if (term.dim && !term.counted) {
        term.counted = true;
        term.weight = 0;
        this.setShare(term, 1 / this.countedTerms.length);
      } else if (!term.dim && term.counted) {
        term.counted = false;
        term.weight = 0;
        this.normalizeShares();
      }
      this.followGoal(term);
    },
    startCustom(name) {
      this.finishLiveEdit();
      this.returnToManage = this.view === "manage" || this.returnToManage;
      this.start("custom", name);
    },
    startWeighted(name) {
      this.finishLiveEdit();
      this.returnToManage = this.view === "manage" || this.returnToManage;
      this.start("weighted", name);
    },
    back() {
      this.finishLiveEdit();
      if (this.returnToManage) {
        this.start("manage", null);
      } else {
        this.open = false;
      }
    },
    /** A weighted dimension's weights apply as they change; leaving saves them. */
    finishLiveEdit() {
      if (this.view === "weighted" && this.editingName) {
        this.$store.dispatch("saveDimensions");
      }
    },
    onDialogKey(e) {
      // The dialog handles Escape itself; keep keys from workspace shortcuts.
      e.stopPropagation();
    },
    submitCustom() {
      let action = this.editingName
        ? this.$store.dispatch("updateCustomBounds", {
            name: this.editingName,
            bounds: [this.customForm.min, this.customForm.max],
          })
        : this.$store.dispatch("createCustomDimension", {
            name: this.customForm.name,
            min: this.customForm.min,
            max: this.customForm.max,
          });
      action.then((result) => {
        if (result.error) {
          this.error = result.error;
          return;
        }
        this.back();
      });
    },
    submitWeighted() {
      let action = this.editingName
        ? this.$store.dispatch("updateWeightedDimension", {
            name: this.editingName,
            terms: this.completeTerms,
            final: true,
          })
        : this.$store.dispatch("createWeightedDimension", {
            name: this.weightedForm.name,
            terms: this.completeTerms,
          });
      action.then((result) => {
        if (result.error) {
          this.error = result.error;
          return;
        }
        // Saved already; nothing left to finish.
        this.editingName = null;
        this.back();
      });
    },
    revert() {
      if (!this.snapshot) return;
      let terms = this.snapshot.map((term) => Object.assign({}, term));
      if (terms.length === 0) {
        terms.push({ dim: null, weight: 1, lowerIsBetter: false });
      }
      this.weightedForm.terms = this.formTerms(terms);
      this.$store.dispatch("updateWeightedDimension", {
        name: this.editingName,
        terms: this.snapshot,
        final: true,
      });
    },
    /** A row waiting for its dimension; picking one gives it a share. */
    addTerm() {
      this.weightedForm.terms.push(
        this.withKey({ dim: null, weight: 0, lowerIsBetter: false })
      );
    },
    removeTerm(index) {
      this.weightedForm.terms.splice(index, 1);
      this.normalizeShares();
    },
    itemsFor(term) {
      let used = new Set(
        this.weightedForm.terms
          .filter((other) => other !== term && other.dim)
          .map((other) => other.dim)
      );
      return dimensionItems(this.candidates.filter((dim) => !used.has(dim)));
    },
    /**
     * What the direction toggle does, with the dimension's range: "Lower is
     * better: 851 counts as 1 and 3,070 as 0. Click for higher."
     */
    directionTip(term) {
      if (!term.dim) return "Pick a dimension first.";
      let lower = !!term.lowerIsBetter;
      let text = lower ? "Lower is better" : "Higher is better";
      let bounds = this.scoringBoundsOf(term.dim);
      if (bounds) {
        let span = bounds[1] - bounds[0];
        let best = formatBound(bounds[lower ? 0 : 1], span);
        let worst = formatBound(bounds[lower ? 1 : 0], span);
        text += ": " + best + " counts as 1 and " + worst + " as 0";
      }
      return text + ". Click for " + (lower ? "higher" : "lower") + ".";
    },
    /** Small print under a row: what to know, and a disagreement with the goal. */
    termNotes(term) {
      if (!term.dim) return [];
      let notes = [];
      if (!this.scoringBoundsOf(term.dim)) notes.push({ text: "No values yet." });
      if (term.dim === RATING_DIMENSION) {
        notes.push({ text: "Unrated options get no value." });
      }
      let conflict = this.goalConflict(term);
      if (conflict) {
        notes.push({ text: "Its goal says " + conflict + " is better.", warn: true });
      }
      return notes;
    },
        /** A newly picked dimension weighs the way its goal says, when it has one. */
    followGoal(term) {
      let goal = term.dim ? this.goalOf(term.dim) : null;
      if (goal) term.lowerIsBetter = goal === MIN;
    },
    /** "lower" or "higher" when the checkbox disagrees with the dimension's goal, else "". */
    goalConflict(term) {
      let goal = term.dim ? this.goalOf(term.dim) : null;
      if (!goal || (goal === MIN) === !!term.lowerIsBetter) return "";
      return goal === MIN ? "lower" : "higher";
    },
    summary(def) {
      if (isCustom(def)) {
        return "Custom, " + def.bounds[0] + "–" + def.bounds[1];
      }
      if (def.terms.length === 0) {
        return "Weighted, no weights yet";
      }
      let percents = wholePercents(weightShares(def.terms));
      return (
        "Weighted: " +
        def.terms
          .map(
            (term, i) =>
              displayName(term.dim) +
              " " +
              percents[i] +
              "%" +
              (term.lowerIsBetter ? " (lower is better)" : "")
          )
          .join(", ")
      );
    },
    coverageText(def) {
      void this.dimensionValuesVersion;
      let result = coverage(this.rawData, def, isMissingFor);
      if (isCustom(def) || def.terms.length === 0) {
        return result.complete + " of " + result.total + " have values";
      }
      return this.coverageSentence(result);
    },
    coverageSentence(result) {
      let text = result.complete + " of " + result.total + " have values";
      let missing = Object.keys(result.missingByDim).sort(
        (a, b) => result.missingByDim[b] - result.missingByDim[a]
      );
      if (result.complete < result.total && missing.length > 0) {
        text +=
          "; " +
          result.missingByDim[missing[0]] +
          (result.missingByDim[missing[0]] === 1 ? " lacks " : " lack ") +
          quoted(missing[0]);
      }
      return text;
    },
    askDelete(def) {
      let result = withoutDimension(this.defs, def.name);
      let parts = [
        "Delete " + quoted(def.name) + (isCustom(def) ? " and its values?" : "?"),
      ];
      result.changed.forEach((d) =>
        parts.push(quoted(d.name) + " stops weighing it.")
      );
      result.removed
        .filter((name) => name !== def.name)
        .forEach((name) => parts.push(quoted(name) + " is deleted too."));
      this.confirm = {
        kind: "delete",
        name: def.name,
        message: parts.join(" "),
        action: "Delete",
      };
    },
    askClear(def) {
      this.confirm = {
        kind: "clear",
        name: def.name,
        message:
          "Clear all values of " +
          quoted(def.name) +
          "? Weighted dimensions using it lose theirs too.",
        action: "Clear values",
      };
    },
    askReset() {
      this.confirm = {
        kind: "reset",
        name: null,
        message:
          "Remove the dimensions you added and restore those from the file? This can't be undone.",
        action: "Reset all",
      };
    },
    confirmYes() {
      let confirm = this.confirm;
      this.confirm = null;
      if (!confirm) return;
      let action =
        confirm.kind === "delete"
          ? this.$store.dispatch("deleteDimension", { name: confirm.name })
          : confirm.kind === "clear"
          ? this.$store.dispatch("clearDimensionValues", { name: confirm.name })
          : this.$store.dispatch("resetCustomDimensions");
      action.then((result) => {
        this.error = result && result.error ? result.error : null;
      });
    },
  },
};
</script>

<style scoped>
.dims-title {
  flex-wrap: nowrap;
  padding: 10px 12px 10px 16px !important;
}
.dims-title-text {
  font-size: 1.1rem;
  font-weight: 500;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dims-body {
  max-height: 70vh;
}
.dims-intro {
  font-size: 13px;
  line-height: 1.45;
  color: rgba(0, 0, 0, 0.7);
}
.dims-empty {
  padding: 16px 0;
  color: rgba(0, 0, 0, 0.55);
}
.dims-row {
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}
.dims-name {
  font-weight: 500;
}
.dims-origin {
  margin-left: 6px;
  font-size: 11px;
  font-weight: 400;
  color: rgba(0, 0, 0, 0.55);
}
.dims-mcda {
  margin-bottom: 6px;
  padding: 8px 10px;
  border-left: 3px solid #00796b;
  background: rgba(0, 121, 107, 0.06);
}

.dims-summary {
  white-space: normal;
}
.dims-section-head {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 2px 8px;
  margin: 14px 0 6px;
}
.dims-section-title {
  font-size: 14px;
  font-weight: 600;
  color: #263238;
}
.dims-section-meta {
  font-size: 12px;
  line-height: 1.45;
  color: rgba(0, 0, 0, 0.6);
}
.goal-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}
.goal-name {
  min-width: 0;
  font-weight: 500;
}
.goal-fixed {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.55);
}
.goal-toggle.v-btn-toggle {
  flex: 0 0 auto;
  border-radius: 6px;
}
.goal-toggle .v-btn.v-btn {
  height: 26px !important;
  min-width: 0;
  padding: 0 9px;
  font-size: 12px;
  letter-spacing: 0;
  text-transform: none;
}
.goals-more {
  margin-top: 6px;
  padding: 0;
  border: none;
  background: none;
  color: #1565c0;
  font-size: 12px;
  cursor: pointer;
}
.goals-more:hover {
  text-decoration: underline;
}
.dims-actions {
  flex-direction: row;
  align-items: center;
}
.dims-range > * {
  flex: 1 1 0;
  min-width: 0;
}
.dims-footer {
  flex-wrap: wrap;
  gap: 4px;
}
.dims-preview {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.7);
}
/* Dimension, slider, percentage, direction and remove on one line. */
.term-row {
  display: grid;
  grid-template-columns: minmax(140px, 1.1fr) minmax(90px, 1.3fr) 68px 84px 28px;
  align-items: center;
  column-gap: 8px;
  row-gap: 2px;
  padding: 4px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}
.term-head {
  padding: 8px 0 2px;
  font-size: 11px;
  letter-spacing: 0.02em;
  color: rgba(0, 0, 0, 0.5);
}
.term-head-share {
  grid-column: 2 / 4;
}
.term-dim,
.term-share {
  min-width: 0;
}
/* 32px rather than a dense field's 40, like the analysis' pickers. */
.term-dim ::v-deep .v-input__control > .v-input__slot,
.term-share ::v-deep .v-input__control > .v-input__slot {
  min-height: 32px !important;
}
.term-dim ::v-deep .v-input__append-inner {
  margin-top: 4px !important;
}
/* Narrow sides, so "100" and its "%" fit whole. */
.term-share ::v-deep .v-input__control > .v-input__slot {
  padding: 0 8px !important;
}
.term-share ::v-deep input {
  text-align: right;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.term-share ::v-deep .v-text-field__suffix {
  padding-left: 2px;
}
.dims-reference {
  margin: 16px 0 0;
  font-size: 12px;
  line-height: 1.45;
  color: rgba(0, 0, 0, 0.6);
}
.term-slider {
  min-width: 0;
}
.term-slider ::v-deep .v-slider {
  margin: 0;
}
.term-flip.v-btn {
  justify-self: start;
  min-width: 0 !important;
  padding: 0 6px !important;
  letter-spacing: 0;
  text-transform: none;
  font-size: 12px;
}
/* The direction disagrees with the dimension's goal. */
.term-flip--conflict.v-btn {
  color: #b26500;
}
.term-remove {
  justify-self: end;
}
.term-scale {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 0 8px;
  font-size: 11px;
  color: rgba(0, 0, 0, 0.55);
}
.term-conflict {
  color: #b26500;
}
/* Narrow: the dimension on a line of its own, the rest below it. */
@media (max-width: 620px) {
  .term-row {
    grid-template-columns: minmax(0, 1fr) 68px 84px 28px;
  }
  .term-dim {
    grid-column: 1 / -1;
  }
  .term-head {
    display: none;
  }
}
</style>
