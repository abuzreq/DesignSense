<template>
  <!-- What a reading rests on and what to doubt in it: a few words each, in
       view beside the numbers, and the whole of it on hover or focus. -->
  <div class="caveats">
    <v-tooltip
      v-for="caveat in caveats"
      :key="caveat.key"
      bottom
      max-width="380"
    >
      <template v-slot:activator="{ on }">
        <span
          v-on="on"
          class="caveat"
          :class="{ 'caveat--warn': caveat.warn }"
          tabindex="0"
        >
          <v-icon x-small class="caveat-icon">{{
            caveat.warn ? "mdi-alert-circle-outline" : "mdi-information-outline"
          }}</v-icon
          >{{ caveat.text }}
        </span>
      </template>
      <span class="caveat-tip">
        <span
          v-for="(line, i) in caveat.detail"
          :key="i"
          class="caveat-tip-line"
          >{{ line }}</span
        >
      </span>
    </v-tooltip>
  </div>
</template>

<script>
/**
 * A line of caveats, each `{ key, text, detail, warn }`: `text` shown, the
 * `detail` lines on hover, and warnings in amber. Used by the analysis
 * dialog's sensitivity reading, outliers and best trade-offs.
 */
export default {
  name: "CaveatChips",
  props: {
    caveats: { type: Array, default: () => [] },
  },
};
</script>

<style scoped>
.caveats {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.caveat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 9px 1px 7px;
  border-radius: 11px;
  background: #f1f4f6;
  color: #546e7a;
  font-size: 12px;
  line-height: 20px;
  cursor: help;
}
.caveat--warn {
  background: #fff4e5;
  color: #8a5300;
}
.caveat-icon.v-icon {
  color: inherit;
}
/* The tooltip renders outside this component, but its content is ours. */
.caveat-tip {
  display: block;
}
.caveat-tip-line {
  display: block;
  font-size: 12px;
  line-height: 1.45;
}
.caveat-tip-line + .caveat-tip-line {
  margin-top: 8px;
}
</style>
