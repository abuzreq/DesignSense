<template>
  <v-dialog :value="value" max-width="480" @input="$emit('input', $event)">
    <v-card v-if="value" class="cd-card">
      <v-card-title>Clear data</v-card-title>
      <v-card-text class="cd-body">
        <p class="cd-lead">
          What to delete for this dataset from this browser. The dataset itself
          stays as it is. This can't be undone.
        </p>
        <div class="cd-all">
          <v-checkbox
            :input-value="allChosen"
            :indeterminate="someChosen && !allChosen"
            :disabled="available.length === 0"
            dense
            hide-details
            label="Everything"
            @change="chooseAll"
          />
        </div>
        <div v-for="part in parts" :key="part.key" class="cd-part">
          <v-checkbox
            v-model="chosen[part.key]"
            :disabled="part.count === 0"
            dense
            hide-details
          >
            <template v-slot:label>
              <span class="cd-label">
                {{ part.label }}
                <span class="cd-count">{{ part.count === 0 ? "none" : part.count }}</span>
              </span>
            </template>
          </v-checkbox>
          <div class="cd-help">{{ part.help }}</div>
        </div>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn text @click="$emit('input', false)">Cancel</v-btn>
        <v-btn color="error" depressed :disabled="!someChosen" @click="clear">
          {{ allChosen ? "Clear everything" : "Clear " + chosenCount + (chosenCount === 1 ? " kind" : " kinds") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import { isCustom, isNumber } from "@/customDimensions.js";
import { isRated, isRating } from "@/ratings.js";
import { setColumnRoles } from "@/columns.js";
import { loadColumnRoles, saveColumnRoles } from "@/data/columnRoles.js";
import { remountDataset } from "@/data/loader.js";

/**
 * Deletes chosen parts of the work kept for one dataset: every part with
 * something in it is chosen when the dialog opens, and each can be left out.
 * Parts with nothing to clear are shown, greyed, so the list reads the same
 * every time.
 */
export default {
  name: "ClearDataDialog",
  props: {
    value: { type: Boolean, default: false },
  },
  data() {
    return { chosen: {} };
  },
  computed: {
    parts() {
      let state = this.$store.state;
      void state.dimensionValuesVersion;
      let added = state.customDimensions.filter((def) => !def.fromFile && !isRating(def.name));
      let entered = 0;
      state.customDimensions
        .filter((def) => isCustom(def) && !isRating(def.name))
        .forEach((def) => {
          state.rawData.forEach((row) => {
            if (isNumber(row[def.name])) entered += 1;
          });
        });
      let key = state.datasetKey;
      return [
        { key: "sets", label: "Saved sets", count: state.setsIDs.length, help: "Sets and their notes." },
        { key: "shortlist", label: "Shortlist", count: state.cart.length, help: "The options kept aside." },
        { key: "notes", label: "Notes on options", count: Object.keys(state.optionNotes).length, help: "What you wrote about single options." },
        {
          key: "ratings",
          label: "Ratings",
          count: this.$store.getters.hasRatingDimension ? state.rawData.filter(isRated).length : 0,
          help: "Stars given to options.",
        },
        { key: "values", label: "Values entered in custom dimensions", count: entered, help: "The dimensions stay, empty, unless removed below." },
        { key: "dimensions", label: "Custom and weighted dimensions", count: added.length, help: "Those made here; ones from the data file stay." },
        { key: "goals", label: "Goals you chose", count: Object.keys(state.goalChoices).length, help: "Goals go back to the file's, or none." },
        {
          key: "roles",
          label: "Column roles you set",
          count: Object.keys(loadColumnRoles(key).roles).length,
          help: "Inputs and outputs go back to the file's prefixes. The workspace redraws.",
        },
        { key: "story", label: "Captured story", count: this.$store.getters.captureCount, help: "The views captured for presenting and the report." },
      ];
    },
    available() {
      return this.parts.filter((part) => part.count > 0);
    },
    chosenCount() {
      return this.available.filter((part) => this.chosen[part.key]).length;
    },
    someChosen() {
      return this.chosenCount > 0;
    },
    allChosen() {
      return this.available.length > 0 && this.chosenCount === this.available.length;
    },
  },
  watch: {
    value: {
      immediate: true,
      handler(open) {
        if (open) this.chooseAll(true);
      },
    },
  },
  methods: {
    chooseAll(value) {
      let chosen = {};
      this.parts.forEach((part) => {
        chosen[part.key] = !!value && part.count > 0;
      });
      this.chosen = chosen;
    },
    async clear() {
      let parts = {};
      this.available.forEach((part) => {
        parts[part.key] = !!this.chosen[part.key];
      });
      this.$emit("input", false);
      let done = (await this.$store.dispatch("clearData", parts)).slice();
      if (parts.roles) done.push("column roles");
      let text = "Cleared the " + listed(done) + " for this dataset.";
      if (parts.roles) {
        saveColumnRoles(this.$store.state.datasetKey, { roles: {}, reviewed: true });
        setColumnRoles({});
        // Every view reads roles as it is built, so the workspace starts afresh.
        remountDataset(text);
        return;
      }
      if (done.length > 0) this.$store.commit("showNotice", { text: text });
    },
  },
};

function listed(words) {
  if (words.length <= 1) return words.join("");
  return words.slice(0, -1).join(", ") + " and " + words[words.length - 1];
}
</script>

<style scoped>
.cd-lead {
  margin-bottom: 8px;
  font-size: 14px;
  color: #455a64;
}
.cd-all {
  padding-bottom: 6px;
  margin-bottom: 6px;
  border-bottom: 1px solid #eceff1;
}
.cd-all ::v-deep .v-label {
  font-weight: 600;
}
.cd-part {
  margin-bottom: 6px;
}
.cd-label {
  display: flex;
  align-items: baseline;
  gap: 8px;
  color: #263238;
}
.cd-count {
  font-size: 12px;
  color: #78909c;
}
.cd-help {
  margin-left: 32px;
  font-size: 12px;
  line-height: 1.3;
  color: #90a4ae;
}
</style>
