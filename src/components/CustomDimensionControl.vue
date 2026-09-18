<template>
  <v-menu
    v-model="menu"
    offset-y
    left
    :close-on-content-click="false"
    min-width="270"
    max-width="340"
  >
    <template v-slot:activator="{ on: menuOn }">
      <v-tooltip bottom>
        <template v-slot:activator="{ on: tooltipOn }">
          <v-btn small icon v-on="Object.assign({}, tooltipOn, menuOn)">
            <v-icon small :color="hasAnyValue ? 'primary' : undefined"
              >mdi-tune-vertical</v-icon
            >
          </v-btn>
        </template>
        <span>Custom and weighted dimensions: enter this option's values</span>
      </v-tooltip>
    </template>

    <!-- Keys stay here, so Space, digits and Escape don't reach the workspace shortcuts. -->
    <v-card class="custom-dim-card">
      <div @keydown.stop="onCardKey">
        <template v-if="editingDef">
          <v-card-text class="pb-1">
            <div class="text-subtitle-2 custom-dim-title">
              {{ label(editingDef.name) }}
            </div>
            <div class="text-caption grey--text text--darken-1">
              A value from {{ editingDef.bounds[0] }} to
              {{ editingDef.bounds[1] }}; leave it blank for no value.
            </div>
            <v-text-field
              ref="input"
              v-model="draft"
              class="mt-2"
              type="number"
              dense
              outlined
              autofocus
              placeholder="No value"
              hide-details="auto"
              :min="editingDef.bounds[0]"
              :max="editingDef.bounds[1]"
              :step="stepFor(editingDef.bounds)"
              :error-messages="error ? [error] : []"
              @keydown.stop="onInputKey"
            />
          </v-card-text>
          <v-card-actions>
            <v-btn
              text
              small
              :disabled="!hasValue(editingDef)"
              @click="clearValue"
              >Clear value</v-btn
            >
            <v-spacer />
            <v-btn text small @click="cancelEdit">Cancel</v-btn>
            <v-btn small depressed color="primary" @click="save">Save</v-btn>
          </v-card-actions>
        </template>

        <v-list v-else dense>
          <template v-if="customDefs.length > 0">
            <v-subheader>Values for this option</v-subheader>
            <v-list-item
              v-for="def in customDefs"
              :key="def.name"
              @click="startEdit(def)"
            >
              <v-list-item-content>
                <v-list-item-title
                  ><DimensionName :name="def.name"
                /></v-list-item-title>
                <v-list-item-subtitle
                  >{{ def.bounds[0] }}&ndash;{{
                    def.bounds[1]
                  }}</v-list-item-subtitle
                >
              </v-list-item-content>
              <v-list-item-action class="custom-dim-value">
                <span :class="{ 'grey--text': !hasValue(def) }">{{
                  display(def)
                }}</span>
                <v-icon x-small class="ml-1">mdi-pencil</v-icon>
              </v-list-item-action>
            </v-list-item>
          </template>

          <template v-if="weightedDefs.length > 0">
            <v-subheader>Weighted dimensions</v-subheader>
            <v-list-item v-for="def in weightedDefs" :key="def.name" inactive>
              <v-list-item-content>
                <v-list-item-title
                  ><DimensionName :name="def.name"
                /></v-list-item-title>
                <v-progress-linear
                  class="mt-1"
                  height="4"
                  color="teal darken-2"
                  background-color="grey lighten-3"
                  :value="share(def)"
                />
              </v-list-item-content>
              <v-list-item-action class="custom-dim-value">
                <span :class="{ 'grey--text': !hasValue(def) }">{{
                  display(def)
                }}</span>
              </v-list-item-action>
            </v-list-item>
          </template>

          <div
            v-if="customDefs.length === 0 && weightedDefs.length === 0"
            class="px-4 py-2 text-caption custom-dim-empty"
          >
            Rate options on criteria of your own, such as performance, then
            combine criteria into a weighted dimension to compare options.
          </div>

          <v-divider class="my-1" />
          <v-list-item @click="openDialog('custom')">
            <v-list-item-icon class="mr-3">
              <v-icon small>mdi-plus</v-icon>
            </v-list-item-icon>
            <v-list-item-title>New custom dimension&hellip;</v-list-item-title>
          </v-list-item>
          <v-list-item @click="openDialog('weighted')">
            <v-list-item-icon class="mr-3">
              <v-icon small>mdi-sigma</v-icon>
            </v-list-item-icon>
            <v-list-item-title>New weighted dimension&hellip;</v-list-item-title>
          </v-list-item>
          <v-list-item
            v-if="customDefs.length > 0 || weightedDefs.length > 0"
            @click="openDialog('manage')"
          >
            <v-list-item-icon class="mr-3">
              <v-icon small>mdi-cog-outline</v-icon>
            </v-list-item-icon>
            <v-list-item-title>Manage dimensions&hellip;</v-list-item-title>
          </v-list-item>
        </v-list>
      </div>
    </v-card>
  </v-menu>
</template>

<script>
import { mapState } from "vuex";
import { formatValue } from "@/store/filters.js";
import {
  fixedBounds,
  isCustom,
  isNumber,
  isWeighted,
  stepFor,
} from "@/customDimensions.js";
import { displayName } from "@/columns.js";
import DimensionName from "@/components/DimensionName.vue";

/**
 * Beside the star rating: the inspected option's values on custom dimensions,
 * edited one at a time, and on weighted dimensions, read-only.
 */
export default {
  name: "CustomDimensionControl",
  components: { DimensionName },
  props: ["item"],
  data() {
    return {
      menu: false,
      // The name of the custom dimension being edited, or null for the list.
      editing: null,
      draft: "",
      error: null,
    };
  },
  computed: {
    ...mapState({
      customDimensions: (state) => state.customDimensions,
    }),
    customDefs() {
      return this.customDimensions.filter(isCustom);
    },
    weightedDefs() {
      return this.customDimensions.filter(isWeighted);
    },
    editingDef() {
      return this.editing === null
        ? null
        : this.customDefs.find((def) => def.name === this.editing) || null;
    },
    hasAnyValue() {
      return this.customDefs.some((def) => this.hasValue(def));
    },
  },
  watch: {
    item(next, previous) {
      if (!next || !previous || next._id !== previous._id) this.cancelEdit();
    },
    menu(open) {
      if (!open) this.cancelEdit();
    },
  },
  methods: {
    stepFor: stepFor,
    label: displayName,
    // Every read of a value goes through here. Rows are not reactive (see
    // store/rows.js), so reading the version is what redraws after an edit.
    hasValue(def) {
      void this.$store.state.dimensionValuesVersion;
      return !!this.item && isNumber(this.item[def.name]);
    },
    display(def) {
      if (!this.hasValue(def)) return "—";
      let bounds = fixedBounds(def);
      return formatValue(this.item[def.name], bounds[1] - bounds[0]);
    },
    /** How far along its range a weighted value lies, 0-100, for its bar. */
    share(def) {
      if (!this.hasValue(def)) return 0;
      let bounds = fixedBounds(def);
      let span = bounds[1] - bounds[0];
      return span > 0 ? ((this.item[def.name] - bounds[0]) / span) * 100 : 0;
    },
    startEdit(def) {
      this.editing = def.name;
      this.draft = this.hasValue(def) ? String(this.item[def.name]) : "";
      this.error = null;
      this.$nextTick(() => {
        if (this.$refs.input) this.$refs.input.focus();
      });
    },
    cancelEdit() {
      this.editing = null;
      this.error = null;
    },
    save() {
      let def = this.editingDef;
      if (!def) return;
      let text = String(this.draft === null ? "" : this.draft).trim();
      let value;
      if (text !== "") {
        value = Number(text);
        if (!isFinite(value)) {
          this.error = "Enter a number.";
          return;
        }
        if (value < def.bounds[0] || value > def.bounds[1]) {
          this.error =
            "Enter a value from " + def.bounds[0] + " to " + def.bounds[1] + ".";
          return;
        }
      }
      this.write(def, value);
    },
    clearValue() {
      if (this.editingDef) this.write(this.editingDef, undefined);
    },
    write(def, value) {
      this.$store.dispatch("setDimensionValue", {
        dim: def.name,
        id: this.item._id,
        value: value,
        final: true,
      });
      this.cancelEdit();
    },
    onInputKey(e) {
      if (e.key === "Enter") {
        e.preventDefault();
        this.save();
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.cancelEdit();
      }
    },
    onCardKey(e) {
      if (e.key === "Escape") {
        if (this.editing !== null) this.cancelEdit();
        else this.menu = false;
      }
    },
    openDialog(mode) {
      this.menu = false;
      this.$store.dispatch("openDimensionDialog", { mode: mode });
    },
  },
};
</script>

<style scoped>
.custom-dim-card {
  max-height: 70vh;
  overflow-y: auto;
}
.custom-dim-title {
  word-break: break-word;
}
.custom-dim-value {
  flex-direction: row;
  align-items: center;
  min-width: 0;
  font-variant-numeric: tabular-nums;
}
.custom-dim-empty {
  max-width: 300px;
  line-height: 1.4;
}
</style>
