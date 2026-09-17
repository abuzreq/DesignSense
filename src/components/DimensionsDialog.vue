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
          <p class="dims-intro dims-mcda mt-3">
            Judge options on your own criteria, then weigh them together for
            <strong>multicriteria decision analysis</strong>. Enter values
            beside the star rating or by dragging a knob on the parallel
            coordinates.
          </p>
          <v-alert
            v-if="dimensionStorageError"
            type="error"
            dense
            outlined
            class="mb-2"
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

          <div v-if="defs.length === 0" class="dims-empty">
            No custom or weighted dimensions yet.
          </div>
          <v-list v-else dense class="py-0">
            <v-list-item v-for="def in defs" :key="def.name" class="dims-row">
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
                <v-tooltip bottom>
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
            and averaged by weight.
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

          <div
            v-for="(term, i) in weightedForm.terms"
            :key="term.key"
            class="term-row"
          >
            <v-autocomplete
              v-model="term.dim"
              :items="itemsFor(term)"
              label="Dimension"
              dense
              outlined
              hide-details
              class="term-dim"
            />
            <div class="term-weight">
              <v-text-field
                :value="term.weightText"
                label="Weight"
                type="number"
                min="0"
                step="any"
                dense
                outlined
                hide-details
                class="term-weight-input"
                :error="!isWeightText(term.weightText)"
                @input="setWeightText(term, $event)"
                @blur="term.weightText = String(term.weight)"
              />
              <v-slider
                :value="Math.min(term.weight, sliderMax(term))"
                :max="sliderMax(term)"
                min="0"
                step="0.5"
                dense
                hide-details
                class="term-slider"
                @input="setWeight(term, $event)"
              />
              <span class="term-share">{{ shareText(i) }}</span>
            </div>
            <v-checkbox
              v-model="term.lowerIsBetter"
              label="Lower is better"
              dense
              hide-details
              class="term-flip"
            />
            <v-btn icon small class="term-remove" @click="removeTerm(i)">
              <v-icon small>mdi-close</v-icon>
            </v-btn>
            <div class="term-scale">{{ scaleText(term) }}</div>
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

        <p v-if="view === 'manage'" class="dims-reference">
          See Haymaker et al. (2018),
          &ldquo;<a :href="paperUrl" target="_blank" rel="noopener noreferrer"
            >Design space construction: a framework to support collaborative,
            parametric decision making</a
          >,&rdquo; <em>ITcon</em> 23(8): 157&ndash;178.
        </p>
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
import { dimensionItems, displayName } from "@/columns.js";
import { isMissingFor } from "@/store/dimensions.js";
import { RATING_DIMENSION } from "@/ratings.js";

const PAPER_URL = "https://www.itcon.org/papers/2018_08-ITcon-Haymaker.pdf";
// A little longer than the dialog's fade-out.
const CLOSE_TRANSITION_MS = 400;

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
  data() {
    return {
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
    }),
    ...mapGetters(["weightedTermCandidates", "scoringBoundsOf"]),
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
      return "Custom and Weighted Dimensions";
    },
    /** Whether the weighted dimension being edited is a column of the data file. */
    editingFromFile() {
      let def = this.defs.find((d) => d.name === this.editingName);
      return !!def && !!def.fromFile && isWeighted(def);
    },
    candidates() {
      return this.weightedTermCandidates(this.editingName);
    },
    completeTerms() {
      return this.weightedForm.terms
        .filter((term) => term.dim)
        .map((term) => ({
          dim: term.dim,
          weight: Number(term.weight),
          lowerIsBetter: !!term.lowerIsBetter,
        }));
    },
    isChanged() {
      return (
        !!this.snapshot &&
        JSON.stringify(this.snapshot) !== JSON.stringify(this.completeTerms)
      );
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
        if (
          def &&
          JSON.stringify(def.terms) === JSON.stringify(this.completeTerms)
        ) {
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
    label: displayName,
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
          // Starts from every custom dimension, equally weighted.
          terms = this.defs
            .filter(isCustom)
            .map((d) => ({ dim: d.name, weight: 1, lowerIsBetter: false }));
          if (terms.length < 2) {
            terms.push({ dim: null, weight: 1, lowerIsBetter: false });
          }
        }
        this.weightedForm = {
          name: "",
          terms: terms.map((term) => this.withKey(term)),
        };
      } else {
        this.view = "manage";
        this.editingName = null;
      }
    },
    withKey(term) {
      this.termKey = (this.termKey || 0) + 1;
      // The weight as typed, which may be mid-edit ("", "0.") while the
      // weight itself keeps its last valid number.
      return Object.assign(
        { key: this.termKey, weightText: String(term.weight) },
        term
      );
    },
    isWeightText(text) {
      let trimmed = String(text === undefined || text === null ? "" : text).trim();
      let weight = Number(trimmed);
      return trimmed !== "" && isFinite(weight) && weight >= 0;
    },
    setWeightText(term, text) {
      term.weightText = text;
      if (this.isWeightText(text)) term.weight = Number(text);
    },
    setWeight(term, weight) {
      term.weight = weight;
      term.weightText = String(weight);
    },
    /** The slider reaches 10, or further when a larger weight was typed. */
    sliderMax(term) {
      return Math.max(10, Math.ceil(Number(term.weight) || 0));
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
      this.weightedForm.terms = terms.map((term) => this.withKey(term));
      this.$store.dispatch("updateWeightedDimension", {
        name: this.editingName,
        terms: this.snapshot,
        final: true,
      });
    },
    addTerm() {
      this.weightedForm.terms.push(
        this.withKey({ dim: null, weight: 1, lowerIsBetter: false })
      );
    },
    removeTerm(index) {
      this.weightedForm.terms.splice(index, 1);
    },
    itemsFor(term) {
      let used = new Set(
        this.weightedForm.terms
          .filter((other) => other !== term && other.dim)
          .map((other) => other.dim)
      );
      return dimensionItems(this.candidates.filter((dim) => !used.has(dim)));
    },
    shareText(index) {
      let shares = weightShares(
        this.weightedForm.terms.map((term) => ({
          weight: term.dim ? Number(term.weight) : 0,
        }))
      );
      return Math.round(shares[index] * 100) + "%";
    },
    scaleText(term) {
      if (!term.dim) return "";
      let bounds = this.scoringBoundsOf(term.dim);
      if (!bounds) return "No values yet.";
      let span = bounds[1] - bounds[0];
      let text =
        "Range " + formatBound(bounds[0], span) + "–" + formatBound(bounds[1], span);
      if (term.dim === RATING_DIMENSION) text += " stars; unrated options get no value";
      return text;
    },
    summary(def) {
      if (isCustom(def)) {
        return "Custom, " + def.bounds[0] + "–" + def.bounds[1];
      }
      if (def.terms.length === 0) {
        return "Weighted, no weights yet";
      }
      let shares = weightShares(def.terms);
      return (
        "Weighted: " +
        def.terms
          .map(
            (term, i) =>
              displayName(term.dim) +
              " " +
              Math.round(shares[i] * 100) +
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
  padding: 8px 10px;
  border-left: 3px solid #00796b;
  background: rgba(0, 121, 107, 0.06);
}

.dims-summary {
  white-space: normal;
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
.term-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  column-gap: 12px;
  row-gap: 4px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}
.term-dim {
  flex: 1 1 180px;
  min-width: 150px;
}
.term-weight {
  flex: 2 1 200px;
  display: flex;
  align-items: center;
  min-width: 180px;
}
.term-weight-input {
  flex: 0 0 84px;
  max-width: 84px;
  margin-right: 8px;
}
.dims-reference {
  margin: 16px 0 0;
  font-size: 12px;
  line-height: 1.45;
  color: rgba(0, 0, 0, 0.6);
}
.term-slider {
  flex: 1 1 auto;
  min-width: 80px;
}
.term-share {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  width: 38px;
  text-align: right;
}
.term-flip {
  margin-top: 0;
  padding-top: 0;
  flex: 0 0 auto;
}
.term-remove {
  flex: 0 0 auto;
}
.term-scale {
  flex: 1 1 100%;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.55);
}
</style>
