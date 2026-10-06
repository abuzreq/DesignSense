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
  height: 36px;
}
.toolbar-group-buttons ::v-deep .v-btn.v-btn--icon {
  width: 36px !important;
  height: 36px !important;
}
.toolbar-group-label {
  font-size: 11px;
  line-height: 12px;
  letter-spacing: 0.02em;
  color: #b0bec5;
  white-space: nowrap;
}
</style>
