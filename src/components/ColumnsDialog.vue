<template>
  <v-dialog :value="open" max-width="720" scrollable @input="onInput">
    <v-card v-if="open" class="cols-card">
      <v-card-title class="cols-title">
        Your columns
        <v-spacer />
        <v-btn icon small aria-label="Close" @click="close">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>
      <div class="cols-lead">
        How DesignSense read the {{ fields.length }} columns of this dataset.
        Check which numbers are inputs and outputs, and which way is better
        for each; the rest is here to show what was done with it.
      </div>
      <div class="cols-summary">
        <span v-for="part in summary" :key="part.key" class="cols-pill" :class="'cols-pill--' + part.key">
          {{ part.text }}
        </span>
      </div>
      <v-divider />

      <v-card-text class="cols-body">
        <template v-if="numeric.length > 0">
          <div class="cols-section">Numbers: plotted, filtered and compared</div>
          <div class="cols-help">
            <b>Inputs</b> are what the designs vary (parameters);
            <b>outputs</b> are what comes of them (performance, cost). A goal
            says which way is better, and drives the best trade-offs.
          </div>
          <div class="cols-table" role="table">
            <div class="cols-row cols-row--head" role="row">
              <span role="columnheader">Column</span>
              <span role="columnheader">Values</span>
              <span role="columnheader">Role</span>
              <span role="columnheader">Goal</span>
            </div>
            <div
              v-for="column in numeric"
              :key="column.name"
              class="cols-row"
              :class="{ 'cols-row--changed': isChanged(column) }"
              role="row"
            >
              <span class="cols-name" :title="column.name">
                {{ column.label }}
                <span v-if="column.prefix" class="cols-prefix" title="The prefix in the file. The role here is what counts.">{{ column.prefix }}</span>
              </span>
              <span class="cols-range">{{ column.range }}</span>
              <v-btn-toggle
                v-model="column.role"
                mandatory
                dense
                class="cols-toggle"
                :aria-label="'Role of ' + column.label"
              >
                <v-btn x-small value="in">Input</v-btn>
                <v-btn x-small value="out">Output</v-btn>
                <v-btn x-small value="none" title="Neither: plotted, but not an input or output">Other</v-btn>
              </v-btn-toggle>
              <v-btn-toggle
                v-model="column.goal"
                dense
                class="cols-toggle"
                :aria-label="'Goal of ' + column.label"
              >
                <v-btn
                  x-small
                  value="max"
                  :disabled="column.role === 'in'"
                  title="Higher is better"
                  >↑ Higher</v-btn
                >
                <v-btn
                  x-small
                  value="min"
                  :disabled="column.role === 'in'"
                  title="Lower is better"
                  >↓ Lower</v-btn
                >
              </v-btn-toggle>
            </div>
          </div>
        </template>

        <div v-for="group in otherGroups" :key="group.key" class="cols-group">
          <div class="cols-section">{{ group.title }}</div>
          <div class="cols-help">{{ group.help }}</div>
          <div class="cols-chips">
            <span v-for="name in group.columns" :key="name" class="cols-chip" :title="name">{{
              label(name)
            }}</span>
          </div>
        </div>

        <div v-if="warnings.length > 0" class="cols-group">
          <div class="cols-section">Noticed while loading</div>
          <ul class="cols-warnings">
            <li v-for="(warning, i) in warnings" :key="i">{{ warning }}</li>
          </ul>
        </div>
      </v-card-text>

      <v-divider />
      <v-card-actions class="cols-actions">
        <span class="cols-foot">
          Saved for this dataset. Reopen it from Dimensions and goals.
          <template v-if="rolesChanged"> Applying redraws the workspace; filters start afresh.</template>
        </span>
        <v-spacer />
        <v-btn v-if="changedCount > 0" text @click="reset">Undo changes</v-btn>
        <v-btn color="primary" depressed @click="apply">
          {{ changedCount > 0 ? "Apply " + changedCount + (changedCount === 1 ? " change" : " changes") : "Looks right" }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import * as d3 from "d3";
import {
  CUSTOM,
  INPUT,
  OUTPUT,
  WEIGHTED,
  columnKind,
  displayName,
  prefixKind,
  setColumnRoles,
} from "@/columns.js";
import { loadState, remountDataset } from "@/data/loader.js";
import { loadColumnRoles, saveColumnRoles } from "@/data/columnRoles.js";
import { formatValue } from "@/store/filters.js";

const ID_COLUMNS = ["_id", "ID", "id"];

function roleOf(kind) {
  return kind === INPUT || kind === OUTPUT ? kind : "none";
}

function sortedJson(map) {
  let out = {};
  Object.keys(map)
    .sort()
    .forEach((key) => (out[key] = map[key]));
  return JSON.stringify(out);
}

/**
 * What a loaded dataset's columns were read as: inputs, outputs and other
 * numbers, with their goals, which can be changed here; and images, 3D models,
 * the ID and text columns, listed for reference. Roles are saved per dataset
 * (data/columnRoles.js) and take effect by showing the dataset afresh, since
 * every view reads them from the start; goals apply at once.
 */
export default {
  name: "ColumnsDialog",
  data() {
    return { numeric: [], initial: {} };
  },
  computed: {
    open() {
      return this.$store.state.columnsDialog.open;
    },
    columns() {
      return loadState.columns || { fields: [], types: {}, images: [], models: [] };
    },
    fields() {
      return this.columns.fields;
    },
    warnings() {
      return loadState.warnings || [];
    },
    otherGroups() {
      let { fields, types, images, models } = this.columns;
      let made = fields.filter((f) => {
        let kind = prefixKind(f);
        return kind === CUSTOM || kind === WEIGHTED;
      });
      let ids = fields.filter((f) => ID_COLUMNS.indexOf(f) !== -1);
      let text = fields.filter(
        (f) =>
          types[f] !== "Float" &&
          ids.indexOf(f) === -1 &&
          images.indexOf(f) === -1 &&
          models.indexOf(f) === -1 &&
          made.indexOf(f) === -1
      );
      return [
        { key: "images", title: "Images", help: "Shown in the gallery, the inspector and Compare.", columns: images },
        { key: "models", title: "3D models", help: "Opened in the inspector's 3D view.", columns: models },
        { key: "id", title: "Identifier", help: "Names each option wherever it is listed.", columns: ids },
        {
          key: "text",
          title: "Text: not plotted",
          help: "Words rather than numbers, so no chart can place them. They show in the inspector and in Compare.",
          columns: text,
        },
        {
          key: "made",
          title: "Made in DesignSense",
          help: "Custom and weighted dimensions saved in the file; manage them in Dimensions and goals.",
          columns: made,
        },
      ].filter((group) => group.columns.length > 0);
    },
    summary() {
      let count = (role) => this.numeric.filter((c) => c.role === role).length;
      let goals = this.numeric.filter((c) => c.role !== INPUT && c.goal).length;
      let parts = [
        { key: "in", n: count(INPUT), one: "input", many: "inputs" },
        { key: "out", n: count(OUTPUT), one: "output", many: "outputs" },
        { key: "none", n: count("none"), one: "other number", many: "other numbers" },
        { key: "goal", n: goals, one: "goal", many: "goals" },
      ];
      this.otherGroups.forEach((group) => {
        let n = group.columns.length;
        let names = {
          images: ["image column", "image columns"],
          models: ["3D model column", "3D model columns"],
          id: ["ID", "IDs"],
          text: ["text column, not plotted", "text columns, not plotted"],
          made: ["made in DesignSense", "made in DesignSense"],
        }[group.key];
        parts.push({ key: group.key, n: n, one: names[0], many: names[1] });
      });
      return parts
        .filter((p) => p.n > 0 || p.key === "goal")
        .map((p) => ({ key: p.key, text: p.n + " " + (p.n === 1 ? p.one : p.many) }));
    },
    changedCount() {
      return this.numeric.filter((c) => this.isChanged(c)).length;
    },
    overrides() {
      let out = {};
      this.numeric.forEach((c) => {
        if (c.role !== roleOf(prefixKind(c.name))) out[c.name] = c.role;
      });
      return out;
    },
    rolesChanged() {
      return sortedJson(this.overrides) !== sortedJson(loadColumnRoles(this.key).roles);
    },
    key() {
      return this.$store.state.datasetKey;
    },
  },
  watch: {
    open: {
      immediate: true,
      handler(value) {
        if (value) this.start();
      },
    },
  },
  methods: {
    label(name) {
      return displayName(name);
    },
    start() {
      let { fields, types } = this.columns;
      let rows = this.$store.state.rawData;
      let getters = this.$store.getters;
      this.numeric = fields
        .filter((f) => {
          if (types[f] !== "Float") return false;
          let kind = prefixKind(f);
          return kind !== CUSTOM && kind !== WEIGHTED;
        })
        .map((name) => {
          let values = rows.map((row) => Number(row[name])).filter((v) => isFinite(v));
          let extent = d3.extent(values);
          let range = "none";
          if (values.length > 0) {
            let span = extent[1] - extent[0];
            let magnitude = Math.max(Math.abs(extent[0]), Math.abs(extent[1]));
            range =
              span === 0
                ? formatValue(extent[0], 1, magnitude)
                : formatValue(extent[0], span, magnitude) + " – " + formatValue(extent[1], span, magnitude);
          }
          let prefix = /^\s*([a-z]+)\s*:/i.exec(name);
          return {
            name: name,
            label: displayName(name),
            prefix: prefix ? prefix[1].toLowerCase() + ":" : "",
            range: range,
            role: roleOf(columnKind(name)),
            goal: getters.goalOf(name) || undefined,
          };
        });
      this.initial = {};
      this.numeric.forEach((c) => {
        this.initial[c.name] = { role: c.role, goal: c.goal };
      });
    },
    isChanged(column) {
      let was = this.initial[column.name];
      if (!was) return false;
      let goal = column.role === INPUT ? undefined : column.goal;
      return was.role !== column.role || (was.goal || null) !== (goal || null);
    },
    reset() {
      this.numeric.forEach((c) => {
        c.role = this.initial[c.name].role;
        c.goal = this.initial[c.name].goal;
      });
    },
    markReviewed() {
      let saved = loadColumnRoles(this.key);
      saveColumnRoles(this.key, { roles: saved.roles, reviewed: true });
    },
    close() {
      this.markReviewed();
      this.$store.commit("setColumnsDialog", { open: false });
    },
    onInput(value) {
      if (!value) this.close();
    },
    apply() {
      if (this.changedCount === 0) {
        this.close();
        return;
      }
      let overrides = this.overrides;
      let remount = this.rolesChanged;
      // Roles first: a goal is judged against what the column now is.
      setColumnRoles(overrides);
      saveColumnRoles(this.key, { roles: overrides, reviewed: true });
      let getters = this.$store.getters;
      this.numeric.forEach((c) => {
        let goal = c.role === INPUT ? null : c.goal || null;
        if (goal !== (getters.goalOf(c.name) || null)) {
          this.$store.dispatch("setGoal", { dim: c.name, goal: goal });
        }
      });
      this.$store.commit("setColumnsDialog", { open: false });
      if (remount) {
        // Every view reads roles as it is built, so the dataset is shown
        // afresh; saved work comes back with it.
        let n = Object.keys(overrides).length;
        remountDataset(
          "Updated the columns' roles" + (n > 0 ? " (" + n + " set by you)." : ".")
        );
      } else {
        this.$store.commit("showNotice", { text: "Updated the goals." });
      }
    },
  },
};
</script>

<style scoped>
.cols-title {
  padding-bottom: 0 !important;
}
.cols-lead {
  padding: 4px 24px 8px;
  font-size: 14px;
  color: #455a64;
}
.cols-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 24px 12px;
}
.cols-pill {
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
  background: #eceff1;
  color: #37474f;
}
.cols-pill--in {
  background: #e3f2fd;
  color: #0d47a1;
}
.cols-pill--out {
  background: #fff3e0;
  color: #e65100;
}
.cols-pill--goal {
  background: #e8f5e9;
  color: #1b5e20;
}
.cols-pill--text {
  background: #fbe9e7;
  color: #bf360c;
}
.cols-body {
  max-height: 60vh;
  padding-top: 12px !important;
  color: #263238 !important;
}
.cols-section {
  margin-top: 4px;
  font-size: 13px;
  font-weight: 600;
  color: #37474f;
}
.cols-help {
  margin: 2px 0 8px;
  font-size: 12px;
  color: #607d8b;
}
.cols-table {
  display: grid;
  grid-template-columns: minmax(120px, 1.4fr) minmax(90px, 1fr) auto auto;
  column-gap: 12px;
}
.cols-row {
  display: contents;
}
.cols-row > * {
  display: flex;
  align-items: center;
  min-height: 34px;
  border-bottom: 1px solid #eceff1;
}
.cols-row--head > * {
  min-height: 24px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #90a4ae;
}
.cols-row--changed > * {
  background: #fffde7;
}
.cols-name {
  gap: 6px;
  min-width: 0;
  overflow: hidden;
  font-size: 13px;
  font-weight: 500;
}
.cols-prefix {
  flex: 0 0 auto;
  padding: 0 5px;
  font-size: 10px;
  font-family: monospace;
  color: #78909c;
  border: 1px solid #cfd8dc;
  border-radius: 3px;
}
.cols-range {
  font-size: 12px;
  color: #607d8b;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.cols-toggle .v-btn {
  text-transform: none;
  letter-spacing: 0;
  font-size: 12px;
}
.cols-group {
  margin-top: 16px;
}
.cols-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.cols-chip {
  padding: 1px 8px;
  font-size: 12px;
  background: #f5f7f8;
  border: 1px solid #e0e6e9;
  border-radius: 10px;
}
.cols-warnings {
  margin: 4px 0 0;
  font-size: 12px;
  color: #6d4c41;
}
.cols-actions {
  padding: 10px 16px !important;
}
.cols-foot {
  font-size: 12px;
  color: #78909c;
}
</style>
