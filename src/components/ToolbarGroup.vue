<template>
  <div class="toolbar-group">
    <div class="toolbar-group-buttons">
      <slot name="start" />
      <TipButton
        v-for="name in names"
        :key="name"
        :icon="actions[name].icon"
        :tooltip="actions[name].tooltip()"
        :disabled="disabled(name)"
        :color="color(actions[name].type)"
        @click="actions[name].clickAction"
      />
      <slot />
    </div>
    <div v-if="label" class="toolbar-group-label">{{ label }}</div>
  </div>
</template>

<script>
import TipButton from "@/components/TipButton.vue";

/**
 * A labelled row of toolbar buttons, each drawn from Demo's `actions`.
 * `disabled(name)` says whether an action would do nothing now.
 */
export default {
  name: "ToolbarGroup",
  components: { TipButton },
  props: {
    label: { type: String, default: "" },
    names: { type: Array, default: () => [] },
    actions: { type: Object, required: true },
    disabled: { type: Function, default: () => false },
    color: { type: Function, default: () => undefined },
  },
};
</script>

<style scoped>
.toolbar-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}
/* 36px buttons under an 11px label, which is 48 of the bar's 60 with six
   pixels above and below. The same two numbers are set on the bar itself (see
   Demo.vue, .v-app-bar .v-toolbar__content), since a group is not the only
   thing in it; they are kept in step by hand, and this is the narrower of the
   two selectors, so it wins where both apply. */
.toolbar-group-buttons {
  display: flex;
  align-items: center;
  height: calc(36px * var(--ds-control-scale));
}
.toolbar-group-buttons ::v-deep .v-btn.v-btn--icon {
  width: calc(36px * var(--ds-control-scale)) !important;
  height: calc(36px * var(--ds-control-scale)) !important;
}
/* Its own room either side: at the larger text sizes a label is wider than
   the buttons above it, and two such labels would otherwise run together. */
.toolbar-group-label {
  padding: 0 calc(4px * var(--ds-text-scale));
  font-size: var(--ds-fs-xs);
  line-height: calc(12px * var(--ds-text-scale));
  letter-spacing: 0.02em;
  color: #b0bec5;
  white-space: nowrap;
}
</style>
