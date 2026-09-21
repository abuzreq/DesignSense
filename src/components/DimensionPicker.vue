<template>
  <!-- A v-autocomplete of dimensions (items from dimensionItems) that marks
       them as DimensionName does, custom and weighted ones by kind and any
       with a goal by ↑ or ↓: in the list, in chips, and after a single
       choice's own text. -->
  <v-autocomplete
    v-bind="$attrs"
    :value="value"
    :items="items"
    :multiple="multiple"
    :small-chips="smallChips"
    :deletable-chips="deletableChips"
    :suffix="singleSuffix"
    :class="singleClass"
    v-on="$listeners"
  >
    <template v-slot:item="{ item, attrs, parent }">
      <v-list-item-action v-if="multiple">
        <v-simple-checkbox
          :value="attrs.inputValue"
          :disabled="attrs.disabled"
          color="primary"
          :ripple="false"
          @input="parent.$emit('select', item)"
        />
      </v-list-item-action>
      <v-list-item-content>
        <v-list-item-title>
          <!-- The list's own rendering, which highlights what was typed. -->
          <span class="ds-dim" :class="kindClass(item.value)"
            ><span v-html="parent.genFilteredText(item.text)"></span
            ><span
              v-if="markOf(item.value)"
              class="ds-dim-mark"
              :title="markOf(item.value).title"
              >{{ markOf(item.value).mark }}</span
            ><span
              v-if="goalMark(item.value)"
              class="ds-dim-goal"
              :title="goalMark(item.value).title"
              >{{ goalMark(item.value).mark }}</span
            ></span
          >
        </v-list-item-title>
      </v-list-item-content>
    </template>
    <template v-if="multiple" v-slot:selection="{ item, index, parent, selected, disabled }">
      <v-chip
        v-if="!countLabel && smallChips"
        small
        tabindex="-1"
        class="v-chip--select"
        :class="kindClass(item.value)"
        :close="deletableChips && !disabled"
        :disabled="disabled"
        :input-value="selected"
        @click.stop="parent.selectedIndex = index"
        @click:close="parent.onChipInput(item)"
        >{{ item.text
        }}<span v-if="markOf(item.value)" class="ds-dim-mark">{{
          markOf(item.value).mark
        }}</span
        ><span v-if="goalMark(item.value)" class="ds-dim-goal">{{
          goalMark(item.value).mark
        }}</span></v-chip
      >
      <span
        v-else-if="!countLabel"
        class="v-select__selection v-select__selection--comma"
        :class="kindClass(item.value)"
        >{{ item.text
        }}{{ index < parent.selectedItems.length - 1 ? ", " : "" }}</span
      >
      <!-- A count in place of the names, where a header has room for one line. -->
      <span v-else-if="index === 0" class="v-select__selection ds-picker-count">{{
        parent.selectedItems.length + " " + countLabel
      }}</span>
    </template>
  </v-autocomplete>
</template>

<script>
import { GOAL_MARKS, columnKind, kindMark } from "@/columns.js";

/**
 * Passes everything else to the v-autocomplete, so it takes the same props,
 * v-model and events; `multiple` and the chip props are its own because the
 * slots depend on them.
 */
export default {
  name: "DimensionPicker",
  inheritAttrs: false,
  props: {
    value: { type: [String, Array], default: null },
    items: { type: Array, default: () => [] },
    multiple: { type: Boolean, default: false },
    smallChips: { type: Boolean, default: false },
    deletableChips: { type: Boolean, default: false },
    // With `multiple`, shows "4 dimensions" rather than each name.
    countLabel: { type: String, default: null },
  },
  computed: {
    /** A single choice's signs, after its text: its kind's, then its goal's. */
    singleSuffix() {
      if (this.multiple || !this.value) return undefined;
      let marks = [kindMark(this.value), this.goalMark(this.value)].filter(Boolean);
      return marks.length > 0 ? marks.map((m) => m.mark).join(" ") : undefined;
    },
    singleClass() {
      if (this.multiple || !this.value) return null;
      if (kindMark(this.value)) return "ds-picker--" + columnKind(this.value);
      return this.goalMark(this.value) ? "ds-picker--goal" : null;
    },
  },
  methods: {
    markOf: kindMark,
    goalMark(name) {
      let goalOf = this.$store && this.$store.getters.goalOf;
      return (goalOf && GOAL_MARKS[goalOf(name)]) || null;
    },
    kindClass(name) {
      return kindMark(name) ? "ds-dim--" + columnKind(name) : null;
    },
  },
};
</script>

<style>
.ds-picker-count {
  white-space: nowrap;
}
/* The chosen dimension, as the text of a single choice. */
.ds-picker--custom .v-select__slot input {
  color: #6a1b9a;
}
.ds-picker--weighted .v-select__slot input {
  color: #00796b;
}
.ds-picker--custom .v-text-field__suffix,
.ds-picker--weighted .v-text-field__suffix {
  padding: 0 0.3em;
  border-radius: 3px;
  font-size: 0.85em;
  font-weight: 600;
  line-height: 1.35;
}
.ds-picker--custom .v-text-field__suffix {
  color: #6a1b9a;
  background: rgba(106, 27, 154, 0.12);
}
.ds-picker--weighted .v-text-field__suffix {
  color: #00796b;
  background: rgba(0, 121, 107, 0.12);
}
.ds-picker--goal .v-text-field__suffix {
  color: #607d8b;
  font-weight: 700;
}
/* A chip in the dimension's colour, its sign without a second tint. */
.v-chip.ds-dim--custom {
  background: rgba(106, 27, 154, 0.12) !important;
  color: #6a1b9a !important;
}
.v-chip.ds-dim--weighted {
  background: rgba(0, 121, 107, 0.12) !important;
  color: #00796b !important;
}
.v-chip.ds-dim--custom .ds-dim-mark,
.v-chip.ds-dim--weighted .ds-dim-mark {
  background: none;
  padding-right: 0;
}
</style>
