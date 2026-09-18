<template>
  <!-- A custom (✎) or weighted (Σ) dimension in its colour with its sign;
       any other column as its plain name. -->
  <span
    class="ds-dim"
    :class="[
      mark ? 'ds-dim--' + kind : null,
      { 'ds-dim--truncate': truncate },
    ]"
    ><span class="ds-dim-text">{{ shown }}</span
    ><span v-if="mark" class="ds-dim-mark" :title="mark.title">{{
      mark.mark
    }}</span></span
  >
</template>

<script>
import { columnKind, displayName, kindMark } from "@/columns.js";

/** A column's name as the interface shows it, marked by kind (see KIND_MARKS). */
export default {
  name: "DimensionName",
  props: {
    // The column's name, prefix and all.
    name: { type: String, default: "" },
    // Text to show instead of the name, such as a shortened one.
    text: { type: String, default: null },
    // Cut a long name with an ellipsis, keeping the sign in view.
    truncate: { type: Boolean, default: false },
  },
  computed: {
    kind() {
      return columnKind(this.name);
    },
    mark() {
      return kindMark(this.name);
    },
    shown() {
      return this.text === null ? displayName(this.name) : this.text;
    },
  },
};
</script>

<style>
/* Not scoped: DimensionPicker marks list items and chips with these too.
   Colours are KIND_MARKS'. */
.ds-dim--custom {
  color: #6a1b9a;
}
.ds-dim--weighted {
  color: #00796b;
}
.ds-dim-mark {
  display: inline-block;
  margin-left: 0.3em;
  padding: 0 0.3em;
  border-radius: 3px;
  font-size: 0.85em;
  font-weight: 600;
  line-height: 1.35;
}
.ds-dim--custom .ds-dim-mark {
  background: rgba(106, 27, 154, 0.12);
}
.ds-dim--weighted .ds-dim-mark {
  background: rgba(0, 121, 107, 0.12);
}
.ds-dim--truncate {
  display: inline-flex;
  align-items: baseline;
  max-width: 100%;
  min-width: 0;
}
.ds-dim--truncate .ds-dim-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ds-dim--truncate .ds-dim-mark {
  flex: 0 0 auto;
}
</style>
